// SaveLog — player state only, never world state (RULES.md 6, ARCHITECTURE 10).
//
//   {
//     "schema": 1,
//     "player": { "space": "space:archive-office", "x": 5, "y": 4, "facing": "down", "era": "present" },
//     "events": [ { "t": 1725390000000, "type": "SpaceEntered", "id": "space:archive-office" }, ... ]
//   }
//
// `player` is a checkpoint (where to put the figure). `events` is append-only and
// is what everything else is DERIVED from on load: visited spaces, NPCs talked to,
// whether the terminal was ever opened. Publishing new content never corrupts a
// save: an event naming something that no longer exists is simply ignored on
// replay.
class SaveLog {
    constructor(key) {
        this.key = key;
        this.data = { schema: 1, player: null, events: [] };
    }

    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.schema !== 1) return null;
            this.data = { schema: 1, player: parsed.player || null, events: Array.isArray(parsed.events) ? parsed.events : [] };
            return this.data;
        } catch (e) {
            console.warn('[save] unreadable save discarded:', e.message);
            return null;
        }
    }

    record(type, id = null, extra = null) {
        const ev = { t: Date.now(), type };
        if (id) ev.id = id;
        if (extra) Object.assign(ev, extra);
        this.data.events.push(ev);
        return ev;
    }

    checkpoint(player) {
        this.data.player = { space: player.space, x: player.x, y: player.y, facing: player.facing, era: player.era || 'present' };
    }

    flush() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {
            console.warn('[save] could not persist:', e.message);
        }
    }

    // Rebuild derived flags from the log. Deterministic: same log → same flags.
    replay() {
        const flags = { visited: new Set(), talked: new Set(), terminalOpened: false };
        for (const ev of this.data.events) {
            if (ev.type === 'SpaceEntered' && ev.id) flags.visited.add(ev.id);
            else if (ev.type === 'NPCTalked' && ev.id) flags.talked.add(ev.id);
            else if (ev.type === 'TerminalOpened') flags.terminalOpened = true;
        }
        return flags;
    }

    reset() {
        this.data = { schema: 1, player: null, events: [] };
        try { localStorage.removeItem(this.key); } catch (e) { /* nothing to remove */ }
    }
}
