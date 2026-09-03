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
        if (!this.flags.visited.has(spaceId)) {
            this.flags.visited.add(spaceId);
            this.save.record('SpaceEntered', spaceId);
        }
        if (!silent) this.persist();
        return true;
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
