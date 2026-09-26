// Party — up to four Watchers on one Wi-Fi, seeing each other move.
//
// Owner ruling, log 20260923-03: "four people can exist within Universe B
// locally at the same time ... no communication, maybe they can only
// communicate with NPCs." This module does exactly that and no more. It only
// wakes up when the page was served by CAMT's party door (jobs\party.py),
// which answers /party/info; on the public site that path is a 404 and the
// game is single-player as before. Joined, it posts where you are ten times a
// second and listens to where the others are, and the renderer draws them as
// faint figures in the same room and time. They never block a tile, never
// speak, never trigger anything. NPCs stay local to each device.
const PARTY_SEND_HZ = 10;

class Party {
    constructor(engine) {
        this.engine = engine;
        this.id = null;
        this.cap = 4;
        this.n = 0;
        this.others = {};          // id -> last state
        this.es = null;
        this._last = '';
        this._acc = 0;
        this.on = false;
        this._probe();
    }

    async _probe() {
        try {
            const r = await fetch('/party/info', { cache: 'no-store' });
            if (!r.ok) return;
            const info = await r.json();
            if (!info || !info.party) return;
            this.cap = info.cap || 4;
            const j = await fetch('/party/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            if (j.status === 409) { this.full = true; this._hud(); return; }
            if (!j.ok) return;
            this.id = (await j.json()).id;
            this.on = true;
            this._listen();
            window.addEventListener('pagehide', () => {
                try { navigator.sendBeacon('/party/leave', new Blob([JSON.stringify({ id: this.id })], { type: 'application/json' })); } catch (e) { /* gone anyway */ }
            });
            this._hud();
        } catch (e) { /* not a party page */ }
    }

    _listen() {
        this.es = new EventSource(`/party/stream?id=${this.id}`);
        this.es.onmessage = (ev) => {
            try {
                const d = JSON.parse(ev.data);
                this.others = d.others || {};
                this.n = d.n || 0;
                this.cap = d.cap || this.cap;
                this._hud();
            } catch (e) { /* a bad frame is skipped */ }
        };
        this.es.onerror = () => { /* EventSource reconnects on its own */ };
    }

    _hud() {
        const el = document.getElementById('hud-party');
        if (!el) return;
        el.textContent = this.full ? `party full (${this.cap})` : this.on ? `party ${this.n}/${this.cap}` : '';
    }

    // Called every frame by the engine; posts only when something changed, at most 10 Hz.
    tick(dt) {
        if (!this.on) return;
        this._acc += dt;
        if (this._acc < 1 / PARTY_SEND_HZ) return;
        this._acc = 0;
        const e = this.engine, p = e.player;
        const st = e.ship.active
            ? { space: 'ship', ship: { lat: +e.ship.pos.lat.toFixed(3), lon: +e.ship.pos.lon.toFixed(3) }, avatar: e.state.avatar, era: e.state.era }
            : { space: p.space, x: p.x, y: p.y, facing: p.facing, avatar: e.state.avatar, era: e.state.era };
        const key = JSON.stringify(st);
        if (key === this._last) return;
        this._last = key;
        fetch('/party/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: this.id, ...st }), keepalive: true }).catch(() => {});
    }

    // The others standing in this room, in this time.
    inRoom(spaceId, era) {
        const out = [];
        for (const [id, s] of Object.entries(this.others)) {
            if (!s || s.space !== spaceId || (s.era || 'present') !== (era || 'present')) continue;
            out.push({ id, x: s.x, y: s.y, facing: s.facing || 'down', avatar: s.avatar || 'rocco' });
        }
        return out;
    }
}
