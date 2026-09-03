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
        this.hudSpace.textContent = space.name;
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
        const tickSun = () => {
            if (this.space !== space) return;
            this.daylightNow = Daylight.now(c.lat, c.lon, tz, this.timeOverride);
            this.refreshHud(space);
        };
        clearInterval(this._sunTimer);
        this._sunTimer = setInterval(tickSun, 30000);
        tickSun();
        if (space.kind === 'interior') return; // a clock indoors, but no sky
        const w = await this.weather.get(c.lat, c.lon);
        if (this.space !== space) return; // moved on while the request was out
        this.weatherNow = w;
        this.renderer.weatherNote = w ? `weather: ${w.kind} (${w.source}, ${c.from})` : 'weather: unavailable';
        this.refreshHud(space);
    }

    refreshHud(space) {
        const d = this.daylightNow, w = this.weatherNow;
        const parts = [];
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
            target: this.dialogue.open || this.paused ? null : this.facingTarget(),
        });
        if (!document.hidden) this._scheduleFrame();
    }

    update(dt) {
        if (this.paused) { this.hudHint.textContent = ''; return; }
        const pressed = this.input.drainPressed();

        if (this.dialogue.open) {
            for (const a of pressed) {
                if (a === 'INTERACT') this.dialogue.advance();
                else if (a === 'BACK') this.dialogue.close();
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
        this.dialogue.show('', [t.item && t.item.text ? t.item.text : `${t.label}: nothing happens.`]);
    }

    persist() {
        this.save.checkpoint(this.player);
        this.save.flush();
    }
}
