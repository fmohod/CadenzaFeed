// Roamer — an NPC that is nowhere in particular and everywhere now and then.
//
// Owner ruling, log 20260925-07, for Randy Boy: "an NPC that just casually
// walks around the world, every now and again he might lift his flute up and
// play something, and then continue to walk around ... he'll disappear at
// random and leave the room ... just a wandering entity NPC." Any NPC whose
// definition carries `wander` is one of these. It is not placed in any space;
// it turns up in whichever room the player is in, walks a step at a time on
// walkable tiles, plays now and then, and leaves. Talking to it (version one,
// his instruction: no dialogue yet) gets a look, a tune, and it walks on.
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const ROAM_STEP_SECONDS = 0.26;

class Roamer {
    constructor(engine, def) {
        this.engine = engine;
        this.def = def;
        this.id = def.id;
        const w = def.wander || {};
        this.cfg = {
            step: w.step_seconds || [0.6, 2.0],
            flute: w.flute_seconds || [10, 30],
            stay: w.stay_seconds || [45, 120],
            away: w.away_seconds || [8, 40],
            chance: typeof w.appear_chance_on_enter === 'number' ? w.appear_chance_on_enter : 0.6,
        };
        this.actor = null;         // the placement in space.npcs while present
        this.space = null;
        this.t = 0;                // roamer clock, seconds
        this.nextAppear = rand(2, 6);
        this.leaveAt = 0; this.stepAt = 0; this.nextFlute = 0;
        this.playing = 0;          // seconds of flute left
        this.tween = null;
        this.busy = false;         // being talked to: no leaving, no wandering
    }

    // The player walked into a room: the roamer may already be here.
    onEnter(space) {
        this.actor = null; this.tween = null; this.playing = 0; this.busy = false;
        this.space = space;
        if (Math.random() < this.cfg.chance) this.appear(); else this.nextAppear = this.t + rand(...this.cfg.away);
    }

    onLeaveSpace() { this.actor = null; this.space = null; this.tween = null; this.busy = false; }

    // A walkable tile a few steps from the player, off every marked tile.
    _spot() {
        const s = this.space, p = this.engine.player;
        for (let i = 0; i < 60; i++) {
            const x = Math.floor(Math.random() * s.width), y = Math.floor(Math.random() * s.height);
            if (!this._free(x, y)) continue;
            if (Math.abs(x - p.x) + Math.abs(y - p.y) < 3) continue;
            return { x, y };
        }
        return null;
    }
    _free(x, y) {
        const s = this.space, p = this.engine.player;
        if (!s.walkable(x, y)) return false;
        if (x === p.x && y === p.y) return false;
        if (s.exitAt(x, y) || s.interactableAt(x, y)) return false;
        return true;
    }

    appear() {
        if (!this.space || this.actor) return;
        const at = this._spot();
        if (!at) { this.nextAppear = this.t + rand(...this.cfg.away); return; }
        this.actor = { id: this.id, x: at.x, y: at.y, px: at.x, py: at.y, facing: 'down', def: this.def, moving: false, fluteUp: false };
        this.space.npcs.push(this.actor);
        this.leaveAt = this.t + rand(...this.cfg.stay);
        this.nextFlute = this.t + rand(...this.cfg.flute);
        this.stepAt = this.t + rand(...this.cfg.step);
    }

    leave() {
        if (!this.actor || !this.space) return;
        const i = this.space.npcs.indexOf(this.actor);
        if (i >= 0) this.space.npcs.splice(i, 1);
        this.actor = null; this.tween = null; this.playing = 0;
        this.nextAppear = this.t + rand(...this.cfg.away);
    }

    update(dt) {
        this.t += dt;
        const a = this.actor;
        if (!a) {
            if (this.space && this.t >= this.nextAppear && !this.engine.dialogue.open) this.appear();
            return;
        }
        if (this.tween) {
            this.tween.k += dt / ROAM_STEP_SECONDS;
            const k = Math.min(1, this.tween.k);
            a.px = this.tween.fx + (a.x - this.tween.fx) * k;
            a.py = this.tween.fy + (a.y - this.tween.fy) * k;
            if (k >= 1) { a.px = a.x; a.py = a.y; this.tween = null; a.moving = false; }
            return;
        }
        if (this.playing > 0) {
            this.playing -= dt;
            a.fluteUp = this.playing > 0;
            return;
        }
        if (this.busy) return;
        if (this.t >= this.nextFlute) { this.play(false); this.nextFlute = this.t + rand(...this.cfg.flute); return; }
        if (this.t >= this.leaveAt) { this.leave(); return; }
        if (this.t >= this.stepAt) {
            this.stepAt = this.t + rand(...this.cfg.step);
            const dir = ['up', 'down', 'left', 'right'][Math.floor(Math.random() * 4)];
            a.facing = dir;
            const n = Space.ahead(a.x, a.y, dir);
            if (!this._free(n.x, n.y)) return;
            this.tween = { fx: a.x, fy: a.y, k: 0 };
            a.x = n.x; a.y = n.y; a.moving = true;    // the tile is his from the first frame
        }
    }

    // Lift the flute and play a little something. Heard only if the player is
    // near, and only once the page has had a gesture (browser audio rules).
    play(fromTalk) {
        const a = this.actor; if (!a) return;
        this.playing = 2.6; a.fluteUp = true; a.moving = false; this.tween = null;
        const p = this.engine.player;
        const d = Math.hypot(a.x - p.x, a.y - p.y);
        if (fromTalk || d <= 8) Roamer.diddy(Math.max(0.15, 1 - d / 10));
    }

    // Talked to (version one): looks at you, plays, walks on.
    talk(player) {
        const a = this.actor; if (!a) return;
        this.busy = true; this.tween = null; a.moving = false;
        a.facing = { up: 'down', down: 'up', left: 'right', right: 'left' }[player.facing] || a.facing;
        const lines = (this.def.dialogue && this.def.dialogue[0] && this.def.dialogue[0].lines) || [`${this.def.name} looks at you.`];
        const eng = this.engine;
        eng.dialogue.show(this.def.name, lines, () => {
            this.busy = false;
            this.play(true);
            this.leaveAt = Math.max(this.leaveAt, this.t + 12);   // he finishes the tune and goes on his way
        });
        eng.flags.talked.add(this.id);
        eng.save.record('NPCTalked', this.id);
    }

    // A five-note flute figure on a pentatonic, sine with a little breath.
    static diddy(gain) {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            Roamer._ac = Roamer._ac || new AC();
            const ac = Roamer._ac;
            if (ac.state === 'suspended') ac.resume();
            const scale = [587.33, 659.25, 783.99, 880, 1046.5, 1174.66];   // D5 E5 G5 A5 C6 D6
            const t0 = ac.currentTime + 0.05;
            const n = 5, dur = 0.22;
            let idx = Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) {
                idx = Math.max(0, Math.min(scale.length - 1, idx + (Math.random() < 0.5 ? -1 : 1) * (1 + (Math.random() < 0.3 ? 1 : 0))));
                const f = scale[idx], t = t0 + i * dur;
                const o = ac.createOscillator(), g = ac.createGain();
                o.type = 'sine'; o.frequency.setValueAtTime(f, t);
                o.frequency.linearRampToValueAtTime(f * 1.004, t + dur);      // a breath of vibrato
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(0.12 * gain, t + 0.03);
                g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (i === n - 1 ? 2.2 : 0.95));
                o.connect(g).connect(ac.destination);
                o.start(t); o.stop(t + dur * 2.3);
            }
        } catch (e) { /* no audio is fine */ }
    }
}
