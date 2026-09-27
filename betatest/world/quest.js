// QuestRunner — a storyline as data, played through the rooms, tracked in the save.
//
// Owner, 2026-09-26: "story structure ideas that we can have the characters play
// through via dialogue boxes and scripts and things that they interact with, and
// their progress can be tracked so that they can move through the entire
// storyboard." A quest (content/quests/<id>.json) is a list of steps on Dan
// Harmon's circle; each step has one objective — talk to an NPC, examine a
// thing, or enter a room — and the lines that play when it is met. Placements
// put NPCs into rooms for a range of steps, so a litter can appear at Find and
// go at Suffer. Progress is three save events (QuestStarted, QuestStep,
// QuestDone) replayed on load like everything else, so a reload lands on the
// same step in the same room, and a finished arc unlocks its animal in the
// mirror (his ruling). Watchers play AS the animal: `play_as` swaps the avatar
// for the quest's length and gives it back after.
class QuestRunner {
    constructor(engine) {
        this.engine = engine;
        this.active = null;      // { quest, step, prevAvatar, shown:Set }
    }

    get quests() { return this.engine.content.quests; }

    // NPCs a quest puts in this room at the current step.
    placementsFor(spaceId) {
        if (!this.active) return [];
        const s = this.active.step;
        return (this.active.quest.placements || []).filter(p => p.space === spaceId && s >= p.from && s <= p.to);
    }

    start(id, restoreStep = null) {
        const q = this.quests.get(id);
        if (!q) return false;
        const e = this.engine;
        this.active = { quest: q, step: restoreStep == null ? 0 : restoreStep, prevAvatar: e.state.avatar, shown: new Set() };
        if (q.play_as) { e.state.avatar = q.play_as; e.player.avatar = q.play_as; }
        e.state.era = q.era || 'present';
        if (restoreStep == null) {
            e.save.record('QuestStarted', id);
            e.save.record('QuestStep', id, { step: 0 });
            e.flags.quests[id] = { step: 0, done: false };     // the live flags learn now, not on reload
            e.enter(q.start.space, q.start.spawn);
        } else {
            this.refreshNpcs();
        }
        e.persist();
        return true;
    }

    step() { return this.active ? this.active.quest.steps[this.active.step] : null; }

    hint() {
        const s = this.step();
        return s && s.objective && s.objective.hint ? `${s.beat}: ${s.objective.hint}` : '';
    }

    // A room was entered: an `enter` objective completes; then the (new) step's scene plays once.
    onEnter(spaceId) {
        let s = this.step();
        if (!s) return;
        // A step whose objective is to enter this room carries the scene that
        // plays on arrival; it completes here, and its lines still play.
        let arrival = null;
        if (s.objective && s.objective.enter === spaceId) {
            if (s.enter && s.enter.space === spaceId) arrival = s.enter.lines;
            this.complete(); s = this.step();
        }
        if (s && s.enter && s.enter.space === spaceId) {
            const k = `${this.active.step}:${spaceId}`;
            if (!this.active.shown.has(k)) { this.active.shown.add(k); arrival = s.enter.lines; }
        }
        if (arrival && this.active) this.engine.dialogue.show('', arrival);
    }

    onTalk(npc) {
        const s = this.step();
        if (!s || !s.objective || s.objective.talk !== npc.id) return false;
        this.engine.dialogue.show(npc.def.name, s.talk_lines || ['...'], () => this.complete());
        return true;
    }

    onExamine(item) {
        const s = this.step();
        if (!s || !s.objective || s.objective.examine !== item.id) return false;
        if (s.done_lines) this.engine.dialogue.show(item.label || '', s.done_lines, () => this.complete());
        else this.complete();
        return true;
    }

    complete() {
        const a = this.active; if (!a) return;
        const e = this.engine;
        a.step++;
        e.save.record('QuestStep', a.quest.id, { step: a.step });
        e.flags.quests[a.quest.id] = { step: a.step, done: false };
        if (a.step >= a.quest.steps.length) { this.finish(); return; }
        e.persist();
        this.refreshNpcs();
        e.bus.emit('QuestStep', { quest: a.quest.id, step: a.step });
    }

    // Re-apply this step's placements to the room the player is in.
    refreshNpcs() {
        const e = this.engine, sp = e.space;
        if (!sp) return;
        sp.npcs = sp.npcs.filter(n => !n.quest);
        for (const p of this.placementsFor(sp.id)) {
            const def = e.content.npcs.get(p.id);
            if (def) sp.npcs.push({ id: p.id, x: p.x, y: p.y, facing: p.facing || 'down', def, quest: true });
        }
    }

    finish() {
        const a = this.active; if (!a) return;
        const e = this.engine, q = a.quest, f = q.finish || {};
        e.save.record('QuestDone', q.id);
        e.flags.quests[q.id] = { step: a.step, done: true };
        if (f.unlock) { e.flags.unlocked.add(f.unlock); e.save.record('ArcUnlocked', f.unlock); }
        e.state.era = 'present';
        e.state.avatar = a.prevAvatar; e.player.avatar = a.prevAvatar;
        this.active = null;
        e.persist();
        e.dialogue.show(q.title, f.lines || ['The end.'], () => { if (f.return) e.enter(f.return.space, f.return.spawn); });
    }

    // On boot: pick up an unfinished quest at its step.
    restore(flags) {
        for (const [id, st] of Object.entries(flags.quests || {})) {
            if (!st.done && this.quests.has(id)) { this.start(id, st.step); return true; }
        }
        return false;
    }

    // The album: every quest, with where the player stands in it.
    catalogue(flags) {
        return [...this.quests.values()].map(q => {
            const st = (flags.quests || {})[q.id];
            const where = !st ? 'not started' : st.done ? 'complete' : `${q.steps[Math.min(st.step, q.steps.length - 1)].beat} (${st.step + 1} of ${q.steps.length})`;
            return { id: q.id, label: `${q.title} — ${where}`, started: !!st && !st.done, done: !!st && st.done };
        });
    }
}

// ResumeCode — progress that survives coming back, with no account anywhere.
//
// Owner, 2026-09-26: "we have to figure out a way that players don't lose their
// progress when they come back" — and Watchers have no accounts. So: a code, the
// way games did it before the internet. It carries the player's checkpoint and
// the DERIVED flags (rooms seen, NPCs talked to, quests, unlocked animals), not
// the event log, so it stays short. `UB1-<check>-<payload>`; the check is six
// base-36 characters of FNV-1a over the payload, so a typo is refused rather
// than loaded. Nothing about the person is in it. `?resume=<code>` on the URL
// loads it too, so a QR of the code is a save file.
class ResumeCode {
    static fromEngine(e) {
        const p = e.save.data.player || {};
        const f = e.flags;
        const body = {
            v: 1,
            p: { space: p.space, x: p.x, y: p.y, facing: p.facing, era: p.era, avatar: p.avatar, ship: p.ship || null },
            f: { visited: [...f.visited], talked: [...f.talked], t: !!f.terminalOpened, q: f.quests || {}, u: [...f.unlocked] },
        };
        const payload = ResumeCode._b64(JSON.stringify(body));
        return `UB1-${ResumeCode._check(payload)}-${payload}`;
    }

    // Rewrites the save from a code. Returns null on success, or a reason.
    static apply(save, code) {
        const m = /^UB1-([0-9a-z]{6})-([A-Za-z0-9_-]+)$/.exec((code || '').trim());
        if (!m) return 'That is not a resume code.';
        if (ResumeCode._check(m[2]) !== m[1]) return 'That code has a typo in it.';
        let body;
        try { body = JSON.parse(ResumeCode._unb64(m[2])); } catch (err) { return 'That code could not be read.'; }
        if (!body || body.v !== 1 || !body.p || !body.f) return 'That code is from another version.';
        const ev = [];
        const t0 = Date.now();
        for (const id of body.f.visited || []) ev.push({ t: t0, type: 'SpaceEntered', id });
        for (const id of body.f.talked || []) ev.push({ t: t0, type: 'NPCTalked', id });
        if (body.f.t) ev.push({ t: t0, type: 'TerminalOpened' });
        for (const [id, st] of Object.entries(body.f.q || {})) {
            ev.push({ t: t0, type: 'QuestStarted', id });
            ev.push({ t: t0, type: 'QuestStep', id, step: st.step | 0 });
            if (st.done) ev.push({ t: t0, type: 'QuestDone', id });
        }
        for (const id of body.f.u || []) ev.push({ t: t0, type: 'ArcUnlocked', id });
        ev.push({ t: t0, type: 'Resumed' });
        save.data = { schema: 1, player: body.p, events: ev };
        save.flush();
        return null;
    }

    static _check(s) {
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
        return h.toString(36).padStart(6, '0').slice(-6);
    }
    static _b64(str) {
        const bytes = new TextEncoder().encode(str);
        let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    static _unb64(s) {
        const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }
}
