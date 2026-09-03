// CAIN OS — TerminalOS (Core Engine: screen stack + input dispatch)
//
// Two ways to run, one implementation (Machine Head / dev concurrence, 2026-09-03):
//
//   STANDALONE  new TerminalOS('cain-os-display')
//               CAIN owns the document: it binds keydown/click itself, exactly as
//               it always has. This is terminal.html and /terminal/.
//
//   HOSTED      new TerminalOS('cain-os-display', { host })
//               CAIN binds NOTHING at document level. The host (world/terminal-host.js)
//               owns the input boundary and calls handleKey()/handleClick() only while
//               the terminal is the active input owner. Back at the root screen asks
//               the host to close the terminal instead of doing nothing.
//
// The point of the seam: there is exactly one input owner at any moment. Not two
// listeners deciding whether they care about a key — that is where keyboard ghosts
// come from.
class TerminalOS {
    constructor(displayContainerId, options = {}) {
        this.container = document.getElementById(displayContainerId);
        this.stack = [];
        this.focus = new FocusManager();
        this.host = options.host || null;
        // Standalone: active from birth. Hosted: inert until the host activates it.
        this.active = !this.host;
        if (!this.host) this._bindDocument();
    }

    // ── lifecycle (hosted mode) ──
    activate() { this.active = true; }
    deactivate() { this.active = false; }

    // Drop every screen without rendering anything. The host calls this when the
    // overlay closes so the next open() starts from a clean stack — no leftover
    // Record dossier, no duplicated DOM.
    clear() {
        while (this.stack.length) {
            const screen = this.stack.pop();
            if (typeof screen.onLeave === 'function') screen.onLeave();
        }
        this.container.innerHTML = '';
    }

    push(screenPlugin, data = null) {
        if (this.stack.length > 0) {
            this.stack[this.stack.length - 1].onSuspend();
        }

        this.stack.push(screenPlugin);
        this.container.innerHTML = '';

        screenPlugin.render(this.container, data);
        screenPlugin.onEnter(this, data);

        this.focus.scan(this.container);
    }

    // Clears the entire screen stack and pushes a fresh one. Used by the Idle
    // Manager to snap a kiosk back to Home before showing the attract loop,
    // regardless of which screen the previous visitor left it on.
    resetTo(screenPlugin, data = null) {
        this.clear();
        this.push(screenPlugin, data);
    }

    pop() {
        if (this.stack.length > 1) {
            const poppedScreen = this.stack.pop();
            poppedScreen.onLeave();

            const currentScreen = this.stack[this.stack.length - 1];
            this.container.innerHTML = '';

            currentScreen.render(this.container, currentScreen.state);
            currentScreen.onResume();

            this.focus.scan(this.container);

            if (typeof CAIN_Audio !== 'undefined' && typeof CAIN_Audio.backBeep === 'function') {
                CAIN_Audio.backBeep();
            } else if (typeof CAIN_Audio !== 'undefined') {
                CAIN_Audio.navSelect();
            }
        } else if (this.host && typeof this.host.onExit === 'function') {
            // Root screen + BACK inside a host = "power off" the in-world computer.
            this.host.onExit();
        }
    }

    // ── input (both modes) ──
    handleKey(e) {
        const currentScreen = this.stack[this.stack.length - 1];

        if (e.key === 'Escape') { this.executeAction('SYS_BACK'); return; }
        if (e.key === 'ArrowUp') { this.focus.move('UP'); return; }
        if (e.key === 'ArrowDown') { this.focus.move('DOWN'); return; }
        if (e.key === 'ArrowLeft') { this.focus.move('LEFT'); return; }
        if (e.key === 'ArrowRight') { this.focus.move('RIGHT'); return; }

        if (e.key === 'Enter') {
            const target = this.focus.activate();
            if (target) {
                const action = target.dataset.action;
                if (action) this.executeAction(action, target.dataset);
                return;
            }
            // Nothing focusable on this screen (the boot sequence): let the
            // screen itself see the key. Before 2026-09-03 this returned early
            // and "Press ENTER to skip" never worked.
        }

        if (currentScreen && typeof currentScreen.onKey === 'function') {
            currentScreen.onKey(e);
        }
    }

    handleClick(e) {
        const target = e.target.closest('[data-selectable]');
        if (target) {
            this.focus.setFocus(target);
            this.focus.activate();
            const action = target.dataset.action;
            if (action) this.executeAction(action, target.dataset);
        }
    }

    // Standalone only. Hosted CAIN never reaches here (see constructor).
    _bindDocument() {
        document.addEventListener('keydown', (e) => { if (this.active) this.handleKey(e); });
        document.addEventListener('click', (e) => { if (this.active) this.handleClick(e); });
    }

    executeAction(actionName, dataset = {}) {
        if (actionName.startsWith('SYS_')) {
            this._handleSystemAction(actionName, dataset);
            return;
        }

        const currentScreen = this.stack[this.stack.length - 1];
        if (currentScreen && currentScreen.actions && typeof currentScreen.actions[actionName] === 'function') {
            currentScreen.actions[actionName](dataset, this);
        } else {
            console.warn(`[OS] Action '${actionName}' not registered by active screen.`);
        }
    }

    _handleSystemAction(actionName, dataset) {
        switch(actionName) {
            case 'SYS_BACK':
                this.pop();
                break;
            default:
                console.warn(`[OS] Unknown System Action: ${actionName}`);
        }
    }
}
