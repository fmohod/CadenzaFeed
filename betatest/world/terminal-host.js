// TerminalHost — the seam between the world and CAIN (Machine Head, 2026-09-03).
//
//   World ──open({sourceId})──► TerminalHost ──mount/activate──► CAIN (TerminalOS)
//   World ◄──bus: terminal.opened / terminal.closed──┘
//
// The world never touches TerminalOS. CAIN never touches the world. The host:
//   mount()      init CAIN's services once (Interface Packs, Deployment), create the
//                OS in hosted mode, wire the overlay's clicks to it
//   open()       show the overlay, boot CAIN from a clean stack, hand input to it
//   close()      take input back, clear CAIN's stack, hide the overlay
//   onExit()     what CAIN calls when BACK is pressed on its root screen
//
// Re-entry is safe by construction: one overlay, one OS, one set of listeners,
// created in mount() and reused for every open().
class TerminalHost {
    constructor({ bus, input, overlayId = 'cain-overlay', displayId = 'cain-os-display' }) {
        this.bus = bus;
        this.input = input;
        this.overlay = document.getElementById(overlayId);
        this.display = document.getElementById(displayId);
        this.os = null;
        this.isOpen = false;
        this.mounted = false;
        this.sourceId = null;
    }

    async mount() {
        if (this.mounted) return;
        // Both loaders are fail-soft: a missing manifest logs and CAIN still boots.
        await Promise.all([CAIN_InterfacePacks.init(), CAIN_Deployment.init()]);
        this.os = new TerminalOS(this.display.id, { host: this });
        this.display.osRef = this.os; // BootScreen.onKey reaches the OS this way
        this.overlay.addEventListener('click', (e) => { if (this.isOpen) this.os.handleClick(e); });
        // A phone has no Escape key: a visible way to power the computer off.
        // Hosted-only chrome; standalone CAIN (terminal.html) never shows it.
        const off = document.createElement('button');
        off.id = 'cain-leave';
        off.type = 'button';
        off.textContent = '⏻ leave';
        off.setAttribute('aria-label', 'Leave the terminal');
        off.addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
        this.overlay.appendChild(off);
        this.mounted = true;
    }

    open({ sourceId = null } = {}) {
        if (!this.mounted || this.isOpen) return false;
        this.isOpen = true;
        this.sourceId = sourceId;
        this.overlay.hidden = false;
        this.os.activate();
        this.input.setOwner('terminal', (e) => this.os.handleKey(e));
        this.os.resetTo(BootScreen);
        this.bus.emit('terminal.opened', { sourceId });
        return true;
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.os.deactivate();
        this.os.clear();
        this.overlay.hidden = true;
        this.input.setOwner('world');
        this.bus.emit('terminal.closed', { sourceId: this.sourceId });
        this.sourceId = null;
    }

    onExit() { this.close(); }
}
