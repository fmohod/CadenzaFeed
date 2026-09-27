// Title — the door you come in by, every time (owner, log 20260926-01).
//
// "Just like Chrono Trigger had a title screen, it had a loading animation,
// the title select screen, load game ... so they have a starting point every
// time they come back to the game ... and maybe the title screen loads
// differently the second time through, like a new game plus."
//
// Shown before anything loads (so it IS the loading screen), then it becomes
// the menu: Continue if a save exists, New game, Enter a resume code, and —
// once any arc has been finished in this browser — New game +, which starts
// over but keeps the animals you have unlocked. The title owns input while it
// is up (the router's "terminal" owner, the same seam CAIN uses), so nothing
// in the world moves under it. Text comes from world.json `title`.
class Title {
    constructor(input) {
        this.input = input;
        this.root = document.getElementById('title');
        this.nameEl = document.getElementById('title-name');
        this.subEl = document.getElementById('title-sub');
        this.menuEl = document.getElementById('title-menu');
        this.noteEl = document.getElementById('title-note');
        this.options = [];
        this.cursor = 0;
        this.world = null;
        this.open = false;
        this._onPick = null;
        this.menuEl.addEventListener('pointerdown', (ev) => {
            const row = ev.target.closest('.title-row');
            if (!row) return;
            ev.preventDefault();
            this.cursor = Number(row.dataset.index);
            this._render();
            this.pick();
        });
    }

    // Before content loads: the name and a loading line.
    show(meta) {
        this.meta = meta || {};
        this.nameEl.textContent = this.meta.name || 'UNIVERSE B';
        this.subEl.textContent = this.meta.loading || 'loading…';
        this.menuEl.innerHTML = '';
        this.noteEl.textContent = '';
        this.root.hidden = false;
        this.open = true;
        document.body.classList.add('title-open');
        this.input.setOwner('terminal', (e) => this._key(e));
    }

    // The world is up: become the menu.
    ready(world) {
        this.world = world;
        const t = (world.content.manifest && world.content.manifest.title) || this.meta;
        // Continue only when there is something to continue: more than the one
        // room entered at first boot (talked, walked, quested, boarded, chose).
        const saved = world.save.data && world.save.data.player && (world.save.data.events || []).length > 1;
        const plus = [...world.flags.unlocked].some(id => id !== 'rocco');
        this.nameEl.textContent = t.name || 'UNIVERSE B';
        this.subEl.textContent = plus ? (t.sub_plus || t.sub || '') : (t.sub || '');
        this.noteEl.textContent = plus ? (t.note_plus || '') : (t.note || '');
        this.options = [];
        if (saved) this.options.push({ label: 'Continue', value: 'continue' });
        this.options.push({ label: 'New game', value: 'new' });
        if (plus) this.options.push({ label: 'New game +', value: 'plus' });
        this.options.push({ label: 'Enter a resume code', value: 'resume' });
        this.cursor = 0;
        this._render();
    }

    _render() {
        this.menuEl.innerHTML = '';
        this.options.forEach((o, i) => {
            const d = document.createElement('div');
            d.className = 'title-row' + (i === this.cursor ? ' on' : '');
            d.dataset.index = String(i);
            d.textContent = (i === this.cursor ? '▶ ' : '   ') + o.label;
            this.menuEl.appendChild(d);
        });
    }

    _key(e) {
        if (!this.open || !this.options.length) return;
        const k = e.key;
        if (k === 'ArrowUp') { this.cursor = (this.cursor + this.options.length - 1) % this.options.length; this._render(); }
        else if (k === 'ArrowDown') { this.cursor = (this.cursor + 1) % this.options.length; this._render(); }
        else if (k === 'Enter' || k === ' ' || k === 'e' || k === 'E') this.pick();
        if (e.preventDefault) e.preventDefault();
    }

    pick() {
        const o = this.options[this.cursor];
        if (!o || !this.world) return;
        const w = this.world;
        if (o.value === 'continue') { this.close(); return; }
        if (o.value === 'new') { w.newGame(false); this.close(); return; }
        if (o.value === 'plus') { w.newGame(true); this.close(); return; }
        if (o.value === 'resume') {
            const code = window.prompt('Resume code:');
            if (!code) return;
            const why = ResumeCode.apply(w.save, code);
            if (why) { this.noteEl.textContent = why; return; }
            location.reload();
        }
    }

    close() {
        this.open = false;
        this.root.hidden = true;
        document.body.classList.remove('title-open');
        this.input.setOwner('world');
        if (this.world) this.world.save.record('TitleLeft');
    }
}
