// InputRouter — one active input owner, six actions, any device.
//
//   Keyboard ─┐
//             ├─► UP DOWN LEFT RIGHT INTERACT BACK ─► whoever owns input right now
//   Touch    ─┘
//
// Owner "world": the engine polls held()/consume(). Owner "terminal": every
// action is translated to the key CAIN understands and handed to the terminal's
// handleKey(); a real keyboard event is handed over as-is. The other owner
// receives nothing. That is the whole rule (Machine Head, 2026-09-03): one owner,
// never two listeners deciding whether they care.
class InputRouter {
    constructor() {
        this.owner = 'world';
        this.terminalSink = null;          // fn(keyLikeEvent) while owner === 'terminal'
        this._held = new Set();            // actions currently down (world)
        this._pressed = [];                // edge-triggered actions since last drain (world)
        this._rawHooks = [];               // fn(e) → true to swallow; for dev toggles
        this.lastActivity = performance.now();
        this.keymap = {
            ArrowUp: 'UP', w: 'UP', W: 'UP',
            ArrowDown: 'DOWN', s: 'DOWN', S: 'DOWN',
            ArrowLeft: 'LEFT', a: 'LEFT', A: 'LEFT',
            ArrowRight: 'RIGHT', d: 'RIGHT', D: 'RIGHT',
            Enter: 'INTERACT', ' ': 'INTERACT', e: 'INTERACT', E: 'INTERACT',
            Escape: 'BACK', Backspace: 'BACK', x: 'BACK', X: 'BACK',
        };
        this.terminalKeys = {
            UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
            INTERACT: 'Enter', BACK: 'Escape',
        };
        this._bindKeyboard();
    }

    // ── ownership ──
    setOwner(owner, terminalSink = null) {
        this.owner = owner;
        this.terminalSink = owner === 'terminal' ? terminalSink : null;
        // A key held across the boundary must not carry over as movement.
        this._held.clear();
        this._pressed.length = 0;
    }

    // ── world-side polling ──
    held(action) { return this.owner === 'world' && this._held.has(action); }
    drainPressed() {
        if (this.owner !== 'world') { this._pressed.length = 0; return []; }
        const out = this._pressed.slice();
        this._pressed.length = 0;
        return out;
    }

    onRaw(fn) { this._rawHooks.push(fn); }

    // ── the single entry point for an action from ANY device ──
    press(action, source = 'touch') {
        this.lastActivity = performance.now();
        if (this.owner === 'terminal') {
            if (this.terminalSink) this.terminalSink({ key: this.terminalKeys[action] || '', preventDefault() {}, source });
            return;
        }
        if (!this._held.has(action)) this._pressed.push(action);
        this._held.add(action);
    }
    release(action) {
        this._held.delete(action);
    }

    // ── keyboard ──
    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            this.lastActivity = performance.now();
            for (const hook of this._rawHooks) { if (hook(e) === true) { e.preventDefault(); return; } }
            if (this.owner === 'terminal') {
                // Typing inside CAIN (a future search field) must still work, so
                // only navigation keys are intercepted; everything else passes.
                if (this.terminalSink) this.terminalSink(e);
                if (e.key in this.keymap) e.preventDefault();
                return;
            }
            const action = this.keymap[e.key];
            if (!action) return;
            e.preventDefault();
            if (e.repeat) return;
            if (!this._held.has(action)) this._pressed.push(action);
            this._held.add(action);
        });
        document.addEventListener('keyup', (e) => {
            const action = this.keymap[e.key];
            if (action) this._held.delete(action);
        });
        // Losing the window loses every key.
        window.addEventListener('blur', () => this._held.clear());
    }

    // ── touch ──
    // Buttons carry data-act. Pointer events so a thumb sliding off a button
    // releases it, and a press on the d-pad never becomes a page scroll.
    bindTouch(root) {
        if (!root) return;
        root.querySelectorAll('[data-act]').forEach((btn) => {
            const act = btn.dataset.act;
            const down = (e) => { e.preventDefault(); btn.classList.add('held'); this.press(act, 'touch'); };
            const up = (e) => { e.preventDefault(); btn.classList.remove('held'); this.release(act); };
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointercancel', up);
            btn.addEventListener('pointerleave', up);
            btn.addEventListener('contextmenu', (e) => e.preventDefault());
        });
    }

    static touchWanted() {
        const params = new URLSearchParams(location.search);
        if (params.get('touch') === '0') return false;
        if (params.has('touch')) return true;
        return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ||
               window.matchMedia('(pointer: coarse)').matches;
    }
}
