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
        this.mode = 'lines';
        this.lines = Array.isArray(lines) ? lines.slice() : [String(lines)];
        this.index = 0;
        this.onClose = onClose;
        this.open = true;
        this.speakerEl.textContent = speaker || '';
        this.speakerEl.hidden = !speaker;
        this.root.hidden = false;
        this._page();
    }

    // A menu in the same box: UP/DOWN move the cursor, INTERACT picks, BACK
    // cancels. options = [{ label, value }]; onPick(value|null).
    choose(speaker, options, onPick) {
        this.mode = 'choose';
        this.options = options;
        this.cursor = 0;
        this.onPick = onPick;
        this.open = true;
        this.speakerEl.textContent = speaker || '';
        this.speakerEl.hidden = !speaker;
        this.root.hidden = false;
        this._menu();
    }

    move(delta) {
        if (!this.open || this.mode !== 'choose') return;
        this.cursor = (this.cursor + delta + this.options.length) % this.options.length;
        this._menu();
    }

    // INTERACT: next line, or close on the last one; in a menu, pick.
    advance() {
        if (!this.open) return;
        if (this.mode === 'choose') {
            const picked = this.options[this.cursor];
            this._end();
            if (this.onPick) { const cb = this.onPick; this.onPick = null; cb(picked ? picked.value : null); }
            return;
        }
        this.index++;
        if (this.index >= this.lines.length) { this.close(); return; }
        this._page();
    }

    close() {
        if (!this.open) return;
        const wasMenu = this.mode === 'choose';
        this._end();
        if (wasMenu) { const cb = this.onPick; this.onPick = null; if (cb) cb(null); return; }
        const cb = this.onClose;
        this.onClose = null;
        if (cb) cb();
    }

    _end() {
        this.open = false;
        this.root.hidden = true;
    }

    _menu() {
        this.textEl.textContent = this.options.map((o, i) => (i === this.cursor ? '▶ ' : '   ') + o.label).join('\n');
        this.moreEl.textContent = '↕';
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
