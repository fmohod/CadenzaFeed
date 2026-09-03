// DialogueBox — one speaker, a list of lines, advanced with INTERACT, closed with
// BACK. Pure presentation plus the condition resolver that picks WHICH lines an
// NPC says. The engine feeds it state; it never reads the world itself.
//
// NPC dialogue shape (content/npcs/*.json):
//   "dialogue": [
//     { "if": { "terminal_opened": true }, "lines": ["..."] },
//     { "if": { "talked_to": "npc:test-001" }, "lines": ["..."] },
//     { "lines": ["Hey.", "You looking for something?"] }        <- default, last
//   ]
// Entries are tried in order; the first whose every condition holds wins.
// Known predicates today: talked_to (npc id), visited (space id),
// terminal_opened (bool). Unknown predicates never match, so a future field
// added to content before the engine learns it simply falls through.
class DialogueBox {
    constructor(root) {
        this.root = root;
        this.speakerEl = root.querySelector('#dialogue-speaker');
        this.textEl = root.querySelector('#dialogue-text');
        this.moreEl = root.querySelector('#dialogue-more');
        this.lines = [];
        this.index = 0;
        this.onClose = null;
        this.open = false;
    }

    show(speaker, lines, onClose = null) {
        this.lines = Array.isArray(lines) ? lines.slice() : [String(lines)];
        this.index = 0;
        this.onClose = onClose;
        this.open = true;
        this.speakerEl.textContent = speaker || '';
        this.speakerEl.hidden = !speaker;
        this.root.hidden = false;
        this._page();
    }

    // INTERACT: next line, or close on the last one.
    advance() {
        if (!this.open) return;
        this.index++;
        if (this.index >= this.lines.length) { this.close(); return; }
        this._page();
    }

    close() {
        if (!this.open) return;
        this.open = false;
        this.root.hidden = true;
        const cb = this.onClose;
        this.onClose = null;
        if (cb) cb();
    }

    _page() {
        this.textEl.textContent = this.lines[this.index];
        this.moreEl.textContent = this.index < this.lines.length - 1 ? '▼' : '■';
    }

    static resolve(npcDef, flags) {
        for (const entry of npcDef.dialogue || []) {
            if (!entry.if) return entry.lines;
            if (DialogueBox.holds(entry.if, flags)) return entry.lines;
        }
        return ['...'];
    }

    static holds(cond, flags) {
        for (const [key, value] of Object.entries(cond)) {
            switch (key) {
                case 'talked_to':
                    if (!flags.talked.has(value)) return false;
                    break;
                case 'visited':
                    if (!flags.visited.has(value)) return false;
                    break;
                case 'terminal_opened':
                    if (Boolean(flags.terminalOpened) !== Boolean(value)) return false;
                    break;
                default:
                    return false; // unknown predicate: never matches
            }
        }
        return true;
    }
}
