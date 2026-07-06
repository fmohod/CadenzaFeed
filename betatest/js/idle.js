// CAIN OS — Idle Manager (Core Engine)
//
// Idle Mode is Core Engine behavior: the engine decides WHEN to attract-loop
// (inactivity timing, what interrupts it, and how it takes over the screen
// stack). WHAT plays during idle — the video playlist — is Deployment
// Configuration data (deployment.json's kiosk.idlePlaylist). The Idle
// Manager never hardcodes media; it only asks CAIN_Deployment for it.
//
// Behavior:
// - Any mouse/touch/key/scroll activity anywhere resets the inactivity timer.
// - When the timer elapses, the engine snaps the screen stack back to Home
//   and shows the Idle screen on top of it — regardless of what screen a
//   previous visitor left the kiosk on.
// - Idle Mode does not interrupt Boot, and does not re-trigger on top of
//   itself.
// - Dismissal (tap/click/keypress) is handled by IdleScreen itself; the
//   Idle Manager only needs to notice the stack has moved on.
class IdleManager {
    constructor(os) {
        this.os = os;
        this.timer = null;
    }

    start() {
        const activityEvents = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'wheel'];
        activityEvents.forEach((evt) => {
            document.addEventListener(evt, () => this._arm(), { passive: true });
        });
        this._arm();
    }

    _arm() {
        clearTimeout(this.timer);
        const timeoutMs = (typeof CAIN_Deployment !== 'undefined' ? CAIN_Deployment.getIdleTimeoutSeconds() : 60) * 1000;
        this.timer = setTimeout(() => this._trigger(), timeoutMs);
    }

    _trigger() {
        const top = this.os.stack[this.os.stack.length - 1];
        if (!top) return;
        if (top.id === 'idle') return; // already showing; activity listeners will re-arm on dismissal
        if (top.id === 'boot') { this._arm(); return; } // don't attract-loop mid-boot; check again later

        this.os.resetTo(HomeScreen);
        this.os.push(IdleScreen);
    }
}
