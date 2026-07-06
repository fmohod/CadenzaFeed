// CAIN OS — Idle Screen (attract loop)
//
// Pure presentation of whatever IdleManager decided to show. Content comes
// entirely from the active deployment: CAIN_Deployment.getIdlePlaylist().
// If a deployment has no playlist configured (e.g. cadenza-news today), this
// falls back to a branded "touch to begin" card rather than a blank screen.
const IdleScreen = {
    id: 'idle',
    title: 'Idle Attract Loop',
    state: {},
    _dismiss: null,
    _playlist: [],
    _index: 0,

    render: function(container) {
        const deployment = CAIN_Deployment.current;
        const brand = deployment ? deployment.brand : 'C.A.I.N.';
        const playlist = CAIN_Deployment.getIdlePlaylist()
            .map((path) => CAIN_Deployment.asset(path))
            .filter(Boolean);

        if (playlist.length === 0) {
            container.innerHTML = `
                <div class="idle-layout" data-selectable data-action="SYS_BACK">
                    <div class="idle-brand">
                        <h1>${brand}</h1>
                        <p class="blink">TOUCH TO BEGIN</p>
                    </div>
                </div>
            `;
            return;
        }

        this._playlist = playlist;
        this._index = 0;

        container.innerHTML = `
            <div class="idle-layout">
                <video class="idle-video" id="idle-video" autoplay muted playsinline></video>
                <div class="idle-caption">
                    <h1>${brand}</h1>
                    <p class="blink">TOUCH TO BEGIN</p>
                </div>
            </div>
        `;

        this._playCurrent();
    },

    _playCurrent: function() {
        const video = document.getElementById('idle-video');
        if (!video || this._playlist.length === 0) return;
        video.src = this._playlist[this._index];
        video.play().catch(() => {}); // autoplay can be blocked until first user gesture; harmless if so
        video.onended = () => {
            this._index = (this._index + 1) % this._playlist.length;
            this._playCurrent();
        };
    },

    onEnter: function(os) {
        // Any tap/click anywhere dismisses idle, not just on a data-selectable
        // element — a kiosk visitor shouldn't have to hit a precise target.
        this._dismiss = () => os.pop();
        document.addEventListener('pointerdown', this._dismiss, { once: true });
    },
    onSuspend: function() { this._teardown(); },
    onResume: function() {},
    onLeave: function() { this._teardown(); },
    destroy: function() {},

    _teardown: function() {
        if (this._dismiss) {
            document.removeEventListener('pointerdown', this._dismiss);
            this._dismiss = null;
        }
        const video = document.getElementById('idle-video');
        if (video) { video.onended = null; video.pause(); }
    },

    get actions() {
        return {}; // SYS_BACK (no-playlist branch) is handled by the OS automatically
    },

    // Master dispatcher already routes Escape/Arrows/Enter elsewhere; this
    // catches every other key so a kiosk keyboard/remote also dismisses idle.
    onKey: function() {
        const osRef = document.getElementById('cain-os-display').osRef;
        if (osRef) osRef.pop();
    }
};
