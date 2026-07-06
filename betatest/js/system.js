class TerminalOS {
    constructor(displayContainerId) {
        this.container = document.getElementById(displayContainerId);
        this.stack = [];
        this.focus = new FocusManager();
        this._bindMasterDispatcher();
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
        while (this.stack.length) {
            const screen = this.stack.pop();
            if (typeof screen.onLeave === 'function') screen.onLeave();
        }
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
        }
    }

    _bindMasterDispatcher() {
        document.addEventListener('keydown', (e) => {
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
                }
                return;
            }

            if (currentScreen && typeof currentScreen.onKey === 'function') {
                currentScreen.onKey(e);
            }
        });

        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-selectable]');
            if (target) {
                this.focus.setFocus(target);
                this.focus.activate();
                const action = target.dataset.action;
                if (action) this.executeAction(action, target.dataset);
            }
        });
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