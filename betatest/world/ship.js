// ShipMode — the owner's ship over a world map of the real Earth.
//
// Owner ruling, log 20260914-01: "there's only going to be one ship that can
// do time travel, and I already have that ship"; "the world map literally
// needs to be a map of the whole world"; a full circuit of the equator takes
// about a minute; it lands straight down like an elevator, only where a ship
// "three tour buses side by side" could really stand — so the landing list is
// exactly the real places bound in the player's time, never a street.
//
// The map is content/geo/earth.png (Natural Earth land, public domain) at
// PX_PER_DEG pixels per degree, equirectangular: x = (lon+180)*k, y = (90-lat)*k.
// The ship is a position in degrees and nothing else; where it can land comes
// from the same bindings the bus stop used, so binding a place puts it under
// the ship too. Time travel stays with the gate for now (README: next).
const SHIP_DEG_PER_SEC = 6;          // 360° in 60 s at any latitude: to scale, still fun
const SHIP_LAND_KM = 60;             // how close you must be to see a place below
const SHIP_HOME = { lat: 29.7359, lon: -95.3651 };   // over Houston (Emancipation Park) until the ship has been anywhere

class ShipMode {
    constructor(engine) {
        this.engine = engine;
        this.pos = { ...SHIP_HOME };
        this.heading = 0;             // radians, for the picture only
        this.spin = 0;                // the ring turns on itself (owner: "it can rotate around itself")
        this.map = null;              // { img, k, w, h } once earth.png is in
        this.meta = null;
        this.active = false;
        this.zoom = 3;                // screen pixels per map pixel
        this._load();
    }

    async _load() {
        try {
            const res = await fetch('content/geo/earth.json', { cache: 'no-cache' });
            this.meta = res.ok ? await res.json() : null;
        } catch (e) { this.meta = null; }
        const k = (this.meta && this.meta.px_per_deg) || 8;
        const img = new Image();
        img.onload = () => { this.map = { img, k, w: img.naturalWidth, h: img.naturalHeight }; };
        img.src = 'content/geo/earth.png';
    }

    // ── state ──
    board(at) {
        // Boarding from a place puts the ship over that place; from the station,
        // over wherever it last was.
        if (at && typeof at.lat === 'number' && typeof at.lon === 'number') this.pos = { lat: at.lat, lon: at.lon };
        this.active = true;
        const e = this.engine;
        e.space = null;
        for (const r of e.roamers || []) r.onLeaveSpace();
        e.tween = null; e.tapQueue = [];
        e.hudSpace.textContent = 'The Ship';
        e.renderer.weatherNote = 'aloft';
        clearInterval(e._sunTimer);
        e.weatherNow = null; e.daylightNow = null;
        e.bus.emit('LocationChanged', { space: 'ship' });
        e.save.record('ShipBoarded', null, { lat: +this.pos.lat.toFixed(4), lon: +this.pos.lon.toFixed(4) });
        e.persist();
    }

    // ── per frame ──
    update(dt, pressed) {
        const e = this.engine;
        const inp = e.input;
        let dx = 0, dy = 0;
        if (inp.held('LEFT')) dx -= 1;
        if (inp.held('RIGHT')) dx += 1;
        if (inp.held('UP')) dy += 1;
        if (inp.held('DOWN')) dy -= 1;
        for (const a of pressed) {
            if (a === 'INTERACT') { this.land(); return; }
            if (a === 'BACK') { this.landingList(true); return; }
        }
        if (dx || dy) {
            const n = Math.hypot(dx, dy);
            this.pos.lon += (dx / n) * SHIP_DEG_PER_SEC * dt;
            this.pos.lat += (dy / n) * SHIP_DEG_PER_SEC * dt;
            if (this.pos.lon > 180) this.pos.lon -= 360;
            if (this.pos.lon < -180) this.pos.lon += 360;
            this.pos.lat = Math.max(-85, Math.min(85, this.pos.lat));
            this.heading = Math.atan2(-dy, dx);
            this.spin += dt * 2.5;
        } else {
            this.spin += dt * 0.6;
        }
        const near = this.nearby();
        const first = near[0];
        e.hudHint.textContent = first
            ? `[E] Land: ${first.label} (${first.km < 1 ? 'below' : Math.round(first.km) + ' km'})${near.length > 1 ? ` +${near.length - 1}` : ''}`
            : '[E] Nowhere below the ship could stand · [B] Return to the Station';
        const t = new Date().toISOString().slice(11, 16);
        e.hudWeather.textContent = `Aboard The Ship: ${t} UTC · ${ShipMode.fmt(this.pos)}`;
    }

    // Every real place bound in the player's time, with its distance from the ship.
    nearby(all = false) {
        const e = this.engine;
        const seen = new Set();
        const out = [];
        for (const b0 of e.content.bindingList) {
            if (seen.has(b0.place)) continue;
            seen.add(b0.place);
            const b = e.bestBinding(b0.place, e.state.era);
            if (!b) continue;
            const place = e.content.places.get(b.place);
            const sp = e.content.spaces.get(b.space);
            if (!place || !sp) continue;
            const c = e.spaceCoords({ kind: sp.kind || 'exterior', width: sp.map[0].length, height: sp.map.length }, sp);
            if (!c) continue;
            const km = ShipMode.km(this.pos, c);
            if (all || km <= SHIP_LAND_KM) out.push({ label: (b.era !== 'present' && sp.name) ? sp.name : place.name, space: b.space, km, lat: c.lat, lon: c.lon });
        }
        out.sort((a, b) => a.km - b.km);
        return out;
    }

    land() {
        const near = this.nearby();
        if (!near.length) { this.landingList(false); return; }
        if (near.length === 1) { this.touchdown(near[0]); return; }
        const options = near.map(n => ({ label: `${n.label} · ${n.km < 1 ? 'below' : Math.round(n.km) + ' km'}`, value: n.space }));
        options.push({ label: 'Stay aloft', value: null });
        this.engine.dialogue.choose('Land where?', options, (spaceId) => {
            const pick = near.find(n => n.space === spaceId);
            if (pick) this.touchdown(pick);
        });
    }

    // Nothing below, or BACK: the ship's home, and the whole landing list by distance.
    landingList(withHome) {
        const e = this.engine;
        const all = this.nearby(true);
        const options = [];
        const hub = e.content.manifest.hub;
        if (hub && e.content.spaces.has(hub.space)) options.push({ label: 'Return to the Station', value: '__station__' });
        for (const n of all.slice(0, 8)) options.push({ label: `Fly to ${n.label} · ${Math.round(n.km)} km`, value: n.space });
        options.push({ label: 'Stay aloft', value: null });
        e.dialogue.choose(withHome ? 'The Ship' : 'Nowhere below the ship could stand', options, (v) => {
            if (!v) return;
            if (v === '__station__') { this.disembark(hub.space, hub.spawn); return; }
            const pick = all.find(n => n.space === v);
            if (pick) { this.pos = { lat: pick.lat, lon: pick.lon }; }
        });
    }

    touchdown(n) {
        this.pos = { lat: n.lat, lon: n.lon };
        this.engine.save.record('ShipLanded', n.space);
        this.disembark(n.space, 'spawn:from-block');
    }

    disembark(spaceId, spawnId) {
        this.active = false;
        this.engine.enter(spaceId, spawnId);
    }

    // ── picture ──
    render(ctx, W, H, frame) {
        ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
        if (!this.map) { ctx.fillStyle = '#8a8070'; ctx.font = '14px monospace'; ctx.fillText('charting the world…', 12, 24); return; }
        const { img, k, w, h } = this.map;
        const z = this.zoom;
        // map pixel under the ship
        const mx = (this.pos.lon + 180) * k, my = (90 - this.pos.lat) * k;
        // top-left of the view in map pixels (may be negative / past the edge: wrap in x, clamp nothing in y — space above/below the poles)
        const vx = mx - W / (2 * z), vy = my - H / (2 * z);
        const prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        // draw the map up to three times across so the antimeridian wraps
        for (const off of [-w, 0, w]) {
            const sx = vx - off;
            const dx = -sx * z;
            if (dx > W || dx + w * z < 0) continue;
            ctx.drawImage(img, 0, 0, w, h, Math.round(dx), Math.round(-vy * z), w * z, h * z);
        }
        ctx.imageSmoothingEnabled = prev;
        // graticule every 30°
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
        for (let lon = -180; lon <= 180; lon += 30) {
            const x = ((lon + 180) * k - vx) * z;
            for (const off of [-w * z, 0, w * z]) { const xx = x + off; if (xx >= 0 && xx <= W) { ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, H); ctx.stroke(); } }
        }
        for (let lat = -60; lat <= 60; lat += 30) {
            const y = ((90 - lat) * k - vy) * z;
            if (y >= 0 && y <= H) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        }
        // landing markers: every bound place in this time. Places closer together
        // than a marker (a whole city at this scale) share one ring and one label,
        // nearest first, with a count — so Houston reads as one place from orbit.
        const ts = 12 * (z / 3);
        const clusters = [];
        for (const n of this.nearby(true)) {
            const x = (((n.lon + 180) * k) - vx) * z, y = (((90 - n.lat) * k) - vy) * z;
            const c = clusters.find(c => Math.hypot(c.x - x, c.y - y) < ts * 1.5);
            if (c) c.n++; else clusters.push({ x, y, n: 1, first: n });
        }
        for (const c of clusters) {
            for (const off of [-w * z, 0, w * z]) {
                const x = c.x + off, y = c.y;
                if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
                const pulse = 1 + 0.15 * Math.sin(frame / 10);
                ctx.strokeStyle = c.first.km <= SHIP_LAND_KM ? 'rgba(160,220,255,0.95)' : 'rgba(255,255,255,0.45)';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(x, y, ts * 0.5 * pulse, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = '#F6F2EB'; ctx.font = `${Math.max(10, ts)}px monospace`;
                ctx.fillText(c.n > 1 ? `${c.first.label} +${c.n - 1}` : c.first.label, x + ts * 0.8, y + 4);
            }
        }
        this.drawShip(ctx, W / 2, H / 2, 22 * (z / 3), frame);
        // the scale, so "to scale" is visible: 10° at this zoom
        const barPx = 10 * k * z;
        ctx.fillStyle = 'rgba(246,242,235,0.8)'; ctx.fillRect(16, H - 22, barPx, 2);
        ctx.font = '11px monospace'; ctx.fillText('10°', 16, H - 26);
    }

    // The ship from above: a big ring (fat at the bottom, pointy on top reads as
    // a hub) in the brand gold, turning on itself, with a shadow on the ground.
    drawShip(ctx, cx, cy, r, frame) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(cx + r * 0.25, cy + r * 0.35, r * 1.05, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.translate(cx, cy);
        ctx.rotate(this.spin);
        ctx.fillStyle = '#A07840';
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6b4a2a';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d6ac60';
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.fillRect(Math.cos(a) * r * 0.86 - 2, Math.sin(a) * r * 0.86 - 2, 4, 4);
        }
        ctx.rotate(-this.spin + this.heading);
        ctx.fillStyle = '#F6F2EB';
        ctx.beginPath(); ctx.moveTo(r * 0.55, 0); ctx.lineTo(-r * 0.2, -r * 0.3); ctx.lineTo(-r * 0.2, r * 0.3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = (Math.floor(frame / 15) % 2) ? '#7fd3ff' : '#3aa0c9';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // ── maths ──
    static km(a, b) {
        const R = 6371, d = Math.PI / 180;
        const dLat = (b.lat - a.lat) * d, dLon = (b.lon - a.lon) * d;
        const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(s));
    }
    static fmt(p) {
        return `${Math.abs(p.lat).toFixed(1)}°${p.lat >= 0 ? 'N' : 'S'} ${Math.abs(p.lon).toFixed(1)}°${p.lon >= 0 ? 'E' : 'W'}`;
    }
}
