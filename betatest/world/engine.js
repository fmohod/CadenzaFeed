// WorldEngine — the simulation. Knows where the player is and what they have
// done; asks Space whether a step is legal; asks DialogueBox to speak; asks
// TerminalHost to open the computer. Never draws (Renderer), never reads the
// keyboard (InputRouter), never knows which content exists (ContentLoader).
const STEP_SECONDS = 0.16;
const TAP_DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };

class WorldEngine {
    constructor({ bus, input, content, host, canvas }) {
        this.bus = bus;
        this.input = input;
        this.content = content;
        this.host = host;
        this.renderer = new Renderer(canvas);
        this.dialogue = new DialogueBox(document.getElementById('dialogue'));
        this.save = new SaveLog('cadenza-arthouse-world');
        this.hudSpace = document.getElementById('hud-space');
        this.hudHint = document.getElementById('hud-hint');

        this.space = null;
        this.player = { space: null, x: 0, y: 0, facing: 'down', px: 0, py: 0, moving: false };
        this.state = { era: 'present' };   // the time the player is in; part of the save
        this.flags = { visited: new Set(), talked: new Set(), terminalOpened: false };
        this.tween = null;      // { fromX, fromY, toX, toY, t }
        this.tapQueue = [];     // directions tapped but not yet walked
        this.weather = new WeatherService({ override: new URLSearchParams(location.search).get('weather') });
        this.weatherNow = null; // the current space's real weather, or null
        this.daylightNow = null; // the real sun over the current space, or null
        this.timeOverride = new URLSearchParams(location.search).get('time');
        this.hudWeather = document.getElementById('hud-weather');
        this.paused = false;    // true while the terminal owns the screen
        this.dev = new URLSearchParams(location.search).has('dev');
        this._last = 0;
        this._running = false;
    }

    // ── boot ──
    start() {
        const m = this.content.manifest;
        if (!m || !m.start || !this.content.spaces.has(m.start.space)) {
            this.fatal('The world could not load: content/world.json has no usable start space.\n\nCheck the console for what was skipped.');
            return;
        }

        const saved = this.save.load();
        this.flags = this.save.replay();
        if (saved && saved.player && saved.player.era) this.state.era = saved.player.era;

        let placed = false;
        if (saved && saved.player && this.content.spaces.has(saved.player.space)) {
            placed = this.enter(saved.player.space, null, saved.player, true);
        }
        if (!placed) this.enter(m.start.space, m.start.spawn, null, true);

        this.bus.on('terminal.opened', () => { this.paused = true; });
        this.bus.on('terminal.closed', () => {
            this.paused = false;
            this.flags.terminalOpened = true;
            this.save.record('TerminalClosed');
            this.persist();
        });

        this.input.onRaw((e) => {
            if (e.key === 'F12') { this.dev = !this.dev; document.getElementById('dev-badge').hidden = !this.dev; return true; }
            return false;
        });
        document.getElementById('dev-badge').hidden = !this.dev;
        const pm = this.content.placesMeta;
        this.renderer.devNote = pm ? `places: ${pm.count} public from the registry (${pm.generated || 'undated'})` : 'places: none (no places.json)';

        this._running = true;
        this._frameQueued = false;
        this._scheduleFrame();
        // Hidden tabs get no animation frames. Keep the simulation ticking on a
        // timer so a background tab (or an automated test) never freezes mid-step;
        // the frame loop re-arms itself when the tab is visible again.
        this._hiddenTimer = setInterval(() => { if (document.hidden) this._loop(performance.now()); }, 50);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) this._scheduleFrame(); });
    }

    // Exactly one animation-frame chain, ever.
    _scheduleFrame() {
        if (this._frameQueued) return;
        this._frameQueued = true;
        requestAnimationFrame((t) => { this._frameQueued = false; this._loop(t); });
    }

    fatal(msg) {
        const el = document.getElementById('fatal');
        el.textContent = msg;
        el.hidden = false;
    }

    // ── spaces ──
    enter(spaceId, spawnId = null, at = null, silent = false) {
        const data = this.content.spaces.get(spaceId);
        if (!data) return false;
        const space = new Space(data, this.content.npcs);
        let x, y, facing;
        if (at && Number.isInteger(at.x) && Number.isInteger(at.y) && space.inBounds(at.x, at.y)) {
            ({ x, y } = at); facing = at.facing || 'down';
        } else {
            const sp = space.spawn(spawnId);
            if (!sp) return false;
            x = sp.x; y = sp.y; facing = sp.facing || 'down';
        }
        this.space = space;
        this.tween = null;
        this.tapQueue = [];
        Object.assign(this.player, { space: spaceId, x, y, facing, px: x, py: y, moving: false });
        // The player's time is player state and only the gate changes it. A bus
        // moves through space within the current time; a space never rewrites the
        // era on arrival (owner, 2026-09-03: "buses only move you around the current
        // time you're in; portals move you through time only").
        if ((data.era || 'present') !== (this.state.era || 'present')) console.warn(`[world] ${spaceId} is ${data.era || 'present'} but the player's time is ${this.state.era}`);
        this.hudSpace.textContent = space.name + (this.state.era && this.state.era !== 'present' ? `  ·  ${space.eraLabel || this.state.era}` : '');
        this.bus.emit('LocationChanged', { space: spaceId });
        this.updateWeather(space, data);
        if (!this.flags.visited.has(spaceId)) {
            this.flags.visited.add(spaceId);
            this.save.record('SpaceEntered', spaceId);
        }
        if (!silent) this.persist();
        return true;
    }

    // Where on Earth is this space? A generated space carries its own anchor
    // (top-left corner + metres per tile → centre); a hand-authored exterior
    // borrows its neighborhood's anchor; an interior has no sky.
    spaceCoords(space, data, allowInterior = false) {
        if (space.kind === 'interior' && !allowInterior) return null;
        const a = data.anchor;
        if (a && typeof a.lat_max === 'number' && typeof a.lon_min === 'number' && a.metres_per_tile) {
            const lat = a.lat_max - (space.height / 2) * a.metres_per_tile / 110574;
            const lon = a.lon_min + (space.width / 2) * a.metres_per_tile / (111320 * Math.cos(a.lat_max * Math.PI / 180));
            return { lat, lon, from: 'space anchor' };
        }
        const n = data.neighborhood && this.content.neighborhoods.get(data.neighborhood);
        if (n && n.anchor && typeof n.anchor.lat === 'number') return { lat: n.anchor.lat, lon: n.anchor.lon, from: `neighborhood ${n.slug}` };
        return null;
    }

    // Is this binding standing on the timeline where the player is? The present
    // is its own point; a dated era matches a binding whose valid range covers
    // that date (or whose era is exactly that date). This is what lets two places
    // that both existed on a date be reached from each other (owner, 2026-09-03).
    bindingActive(b, era) {
        const e = era || 'present';
        if (e === 'present') return (b.era || 'present') === 'present';   // a state, never a date
        if (b.valid && b.valid.from && b.valid.to) return b.valid.from <= e && e <= b.valid.to;
        return b.era === e;
    }

    // Days a binding's span covers: the measure of its specificity. `present`
    // and a bare date are points (0); an open-ended span is infinite.
    static spanDays(b) {
        if (!b.valid || !b.valid.from || !b.valid.to) return b.era && b.era !== 'present' ? 0 : Infinity;
        return (Date.parse(b.valid.to) - Date.parse(b.valid.from)) / 86400000;
    }

    // When several bindings of one place cover the requested time, the most
    // specific applicable binding wins (frozen 2026-09-03): a date over a month,
    // a month over a year, a year over an open span.
    bestBinding(placeSlug, era) {
        let best = null;
        for (const b of this.content.bindingList) {
            if (b.place !== placeSlug || !this.bindingActive(b, era)) continue;
            if (!best || WorldEngine.spanDays(b) < WorldEngine.spanDays(best)) best = b;
        }
        return best;
    }

    // The place's clock: its neighborhood's time zone (data), else the browser's.
    spaceTimeZone(data) {
        const n = data.neighborhood && this.content.neighborhoods.get(data.neighborhood);
        return (n && n.timezone) || null;
    }

    // Sun and sky are recomputed every 30 s; the weather is asked once per space
    // (and cached ten minutes), because the sun moves on its own and the rain does not.
    async updateWeather(space, data) {
        this.weatherNow = null;
        this.daylightNow = null;
        this.hudWeather.textContent = '';
        const c = this.spaceCoords(space, data, true);
        if (!c) return;
        const tz = this.spaceTimeZone(data);
        const eraDate = data.era_date || null;     // a dated era: that day's sun, at this hour
        const tickSun = () => {
            if (this.space !== space) return;
            this.daylightNow = Daylight.now(c.lat, c.lon, tz, this.timeOverride, eraDate);
            this.refreshHud(space);
        };
        clearInterval(this._sunTimer);
        this._sunTimer = setInterval(tickSun, 30000);
        tickSun();
        if (space.kind === 'interior') return; // a clock indoors, but no sky
        // A dated era gets THAT day's weather from the archive feed (ERA5, hourly,
        // 1940 onward), at the hour the player is standing in.
        const w = eraDate
            ? await this.weather.historical(c.lat, c.lon, eraDate, tz)
            : await this.weather.get(c.lat, c.lon);
        if (this.space !== space) return; // moved on while the request was out
        this.weatherNow = w;
        this.renderer.weatherNote = w ? `weather: ${w.kind} (${w.source}, ${c.from})` : 'weather: unavailable';
        this.refreshHud(space);
    }

    refreshHud(space) {
        const d = this.daylightNow, w = this.weatherNow;
        const parts = [];
        if (space.era && space.era !== 'present') parts.push(space.eraLabel || space.era);
        if (d) parts.push(`${d.clock}${d.test ? ' (test)' : ''}, ${d.phase}`);
        if (w) parts.push(WeatherService.describe(w, null));
        this.hudWeather.textContent = parts.length ? `Now at ${space.name}: ${parts.join(' · ')}` : '';
    }

    useExit(exit) {
        const to = exit.to || {};
        if (!this.content.spaces.has(to.space)) {
            this.dialogue.show('', [exit.closedText || 'That way is closed for now.']);
            return;
        }
        this.enter(to.space, to.spawn);
    }

    // ── loop ──
    _loop(t) {
        if (!this._running) return;
        const dt = Math.min(Math.max(0, (t - this._last) / 1000), 0.1);
        this._last = t;
        this.update(dt);
        this.renderer.render({
            space: this.space,
            player: this.player,
            dev: this.dev,
            weather: this.weatherNow,
            daylight: this.daylightNow,
            eraStyle: this.space && this.space.eraStyle,
            target: this.dialogue.open || this.paused ? null : this.facingTarget(),
        });
        if (!document.hidden) this._scheduleFrame();
    }

    update(dt) {
        // On-screen controls only when they are what you need (owner, 2026-09-03):
        // hidden while a dialogue, a menu or the terminal owns the screen, faded
        // after a few seconds without a touch.
        const body = document.body;
        body.classList.toggle('controls-hidden', this.paused || this.dialogue.open);
        body.classList.toggle('controls-idle', performance.now() - (this.input.lastActivity || 0) > 4000);
        if (this.paused) { this.hudHint.textContent = ''; return; }
        const pressed = this.input.drainPressed();

        if (this.dialogue.open) {
            for (const a of pressed) {
                if (a === 'INTERACT') this.dialogue.advance();
                else if (a === 'BACK') this.dialogue.close();
                else if (a === 'UP') this.dialogue.move(-1);
                else if (a === 'DOWN') this.dialogue.move(1);
            }
            this.hudHint.textContent = '';
            return;
        }

        for (const a of pressed) {
            if (a === 'INTERACT') { this.interact(); return; }
            // A tap is one step, even if the key was up again before this frame.
            if (a in TAP_DIRS && this.tapQueue.length < 8) this.tapQueue.push(TAP_DIRS[a]);
        }

        this.step(dt);
        const target = this.facingTarget();
        this.hudHint.textContent = target ? `[E] ${target.label}` : '';
    }

    // Grid movement with a short tween so a step reads as walking, not teleporting.
    step(dt) {
        const p = this.player;
        if (this.tween) {
            this.tween.t += dt / STEP_SECONDS;
            const k = Math.min(1, this.tween.t);
            p.px = this.tween.fromX + (this.tween.toX - this.tween.fromX) * k;
            p.py = this.tween.fromY + (this.tween.toY - this.tween.fromY) * k;
            if (k >= 1) {
                p.x = this.tween.toX; p.y = this.tween.toY; p.px = p.x; p.py = p.y;
                this.tween = null; p.moving = false;
                const exit = this.space.exitAt(p.x, p.y);
                if (exit && exit.trigger !== 'interact') { this.useExit(exit); return; }
            } else {
                return;
            }
        }

        const dir = this.tapQueue.length ? this.tapQueue.shift()
                  : this.input.held('UP') ? 'up' : this.input.held('DOWN') ? 'down'
                  : this.input.held('LEFT') ? 'left' : this.input.held('RIGHT') ? 'right' : null;
        if (!dir) return;
        p.facing = dir;
        const next = Space.ahead(p.x, p.y, dir);
        if (!this.space.walkable(next.x, next.y)) return;
        this.tween = { fromX: p.x, fromY: p.y, toX: next.x, toY: next.y, t: 0 };
        p.moving = true;
    }

    // What is on the tile the player faces, if anything worth pressing E for.
    facingTarget() {
        if (!this.space) return null;
        const a = Space.ahead(this.player.x, this.player.y, this.player.facing);
        const npc = this.space.npcAt(a.x, a.y);
        if (npc) return { kind: 'npc', x: a.x, y: a.y, npc, label: `Talk to ${npc.def.name}` };
        const item = this.space.interactableAt(a.x, a.y);
        if (item) return { kind: item.type, x: a.x, y: a.y, item, label: item.label || item.type };
        const exit = this.space.exitAt(a.x, a.y);
        if (exit && exit.trigger === 'interact') return { kind: 'exit', x: a.x, y: a.y, exit, label: exit.label || 'Go' };
        return null;
    }

    interact() {
        const t = this.facingTarget();
        if (!t) return;
        if (t.kind === 'npc') {
            const lines = DialogueBox.resolve(t.npc.def, this.flags);
            // Face the player while talking; restore afterwards.
            const was = t.npc.facing;
            t.npc.facing = { up: 'down', down: 'up', left: 'right', right: 'left' }[this.player.facing] || was;
            this.dialogue.show(t.npc.def.name, lines, () => {
                t.npc.facing = was;
                this.flags.talked.add(t.npc.id);
                this.save.record('NPCTalked', t.npc.id);
                this.persist();
            });
            return;
        }
        if (t.kind === 'terminal') {
            this.save.record('TerminalOpened', t.item.id);
            this.persist();
            this.host.open({ sourceId: t.item.id });
            return;
        }
        if (t.kind === 'examine') {
            // An examine may read the registry's places instead of fixed text:
            // the first consumer of places.json inside the world.
            if (t.item.list === 'places') {
                const names = [...this.content.places.values()].map(p => p.name).filter(Boolean);
                const lines = names.length
                    ? [t.item.text || 'A map of the city, pins on the places the archive can name in public:', ...names.map(n => `• ${n}`)]
                    : ['A map of the city. No pins yet.'];
                this.dialogue.show(t.item.label || '', lines);
                return;
            }
            this.dialogue.show(t.item.label || '', t.item.text || ['Nothing to see.']);
            return;
        }
        if (t.kind === 'exit') { this.useExit(t.exit); return; }
        if (t.kind === 'timegate') {
            // Chrono Trigger's gate: the same place in another era. Eras come
            // from the bindings of THIS place; you arrive on the same tile.
            const here = this.content.bindings.get(this.space.id);
            const opts = [];
            for (const b of this.content.bindingList) {
                if (here && b.place === here.place && b.space !== this.space.id && this.content.spaces.has(b.space)) {
                    const sp = this.content.spaces.get(b.space);
                    opts.push({ label: sp.era_label || b.era || 'Now', value: b.space, era: b.era || 'present' });
                }
            }
            if (!opts.length) { this.dialogue.show(t.item.label || 'Gate', ['The gate is dark. No other time of this place is on record.']); return; }
            opts.sort((a, b) => (a.era === 'present' ? '9999' : a.era).localeCompare(b.era === 'present' ? '9999' : b.era));
            opts.push({ label: 'Stay in this time', value: null });
            this.dialogue.choose(t.item.label || 'Gate', opts, (spaceId) => {
                if (!spaceId) return;
                const picked = opts.find(o => o.value === spaceId);
                this.state.era = picked.era;
                this.save.record('EraChanged', picked.era, { at: spaceId });
                const p = this.player;
                const target = new Space(this.content.spaces.get(spaceId), this.content.npcs);
                const at = target.inBounds(p.x, p.y) && target.walkable(p.x, p.y) ? { x: p.x, y: p.y, facing: p.facing } : null;
                this.enter(spaceId, 'spawn:default', at);
            });
            return;
        }
        if (t.kind === 'travel') {
            // A bus stop: every real place that has a playable space in the
            // CURRENT era, from the registry export and the bindings — never a
            // hard-wired list.
            const options = [];
            const hub = this.content.manifest.hub;
            const hubEra = (hub && hub.era) || 'present';
            if (hub && hub.space !== this.space.id && this.content.spaces.has(hub.space) && this.bindingActive({ era: hubEra }, this.state.era)) {
                options.push({ label: hub.label || hub.space, value: hub.space, spawn: hub.spawn });
            }
            const seen = new Set();
            for (const b0 of this.content.bindingList) {
                if (seen.has(b0.place)) continue;
                seen.add(b0.place);
                const b = this.bestBinding(b0.place, this.state.era);   // one entry per place: its most specific binding for this time
                if (!b || b.space === this.space.id) continue;
                const place = this.content.places.get(b.place);
                const sp = this.content.spaces.get(b.space);
                // A dated destination is named as it was then (the space carries that
                // name); the present one by its registry name.
                if (place && sp) options.push({ label: (b.era !== 'present' && sp.name) ? sp.name : place.name, value: b.space });
            }
            if (!options.length) {
                const when = this.state.era === 'present' ? 'today' : `in ${this.space.eraLabel || this.state.era}`;
                this.dialogue.show(t.item.label || 'Bus stop', [`No other place ${when} is on record yet.`, 'A bus only moves through space in the time you are in. The gate moves through time.']);
                return;
            }
            options.push({ label: 'Stay here', value: null });
            this.dialogue.choose(t.item.label || 'Bus stop', options, (spaceId) => {
                if (!spaceId) return;
                const picked = options.find(o => o.value === spaceId);
                this.enter(spaceId, (picked && picked.spawn) || t.item.spawn || 'spawn:from-block');
            });
            return;
        }
        this.dialogue.show('', [t.item && t.item.text ? t.item.text : `${t.label}: nothing happens.`]);
    }

    persist() {
        this.save.checkpoint({ ...this.player, era: this.state.era });
        this.save.flush();
    }
}
