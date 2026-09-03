// Renderer — draws a Space, its occupants and the player to a canvas.
// Presentation only: no content decisions, no game logic. V0 draws every tile
// and figure procedurally so the world can be walked before any art exists;
// a tileset can replace drawTile() without touching the engine.

const TILE = 32;

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.zoom = 2;
        this.frame = 0;
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.canvas.width = w;
        this.canvas.height = h;
        // Show roughly 12x8 tiles at minimum; integer zoom keeps pixels crisp.
        this.zoom = Math.max(1, Math.min(3, Math.floor(Math.min(w / (TILE * 12), h / (TILE * 8)))));
        this.ctx.imageSmoothingEnabled = false;
    }

    // Camera: follow the player, clamp to the map, centre small maps.
    camera(space, px, py) {
        const ts = TILE * this.zoom;
        const vw = this.canvas.width, vh = this.canvas.height;
        const mw = space.width * ts, mh = space.height * ts;
        let cx = px * ts + ts / 2 - vw / 2;
        let cy = py * ts + ts / 2 - vh / 2;
        if (mw <= vw) cx = -(vw - mw) / 2; else cx = Math.max(0, Math.min(mw - vw, cx));
        if (mh <= vh) cy = -(vh - mh) / 2; else cy = Math.max(0, Math.min(mh - vh, cy));
        return { x: Math.round(cx), y: Math.round(cy), ts };
    }

    render(scene) {
        const { space, player, dev, target } = scene;
        const ctx = this.ctx;
        this.frame++;
        // A rotation or a viewport change that never fired `resize` (it happens
        // under emulation and in some in-app browsers) would otherwise leave the
        // canvas stretched. Cheap to check every frame; resize only when needed.
        if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) this._resize();
        ctx.fillStyle = '#0d0b08';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        if (!space) return;

        const cam = this.camera(space, player.px, player.py);
        const ts = cam.ts;
        const x0 = Math.max(0, Math.floor(cam.x / ts)), y0 = Math.max(0, Math.floor(cam.y / ts));
        const x1 = Math.min(space.width - 1, Math.ceil((cam.x + this.canvas.width) / ts));
        const y1 = Math.min(space.height - 1, Math.ceil((cam.y + this.canvas.height) / ts));

        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                this.drawTile(ctx, space, x, y, x * ts - cam.x, y * ts - cam.y, ts);
            }
        }

        // Highlight the tile the player is facing when something is there.
        if (target) {
            ctx.strokeStyle = 'rgba(160,120,64,0.9)';
            ctx.lineWidth = Math.max(2, this.zoom);
            ctx.strokeRect(target.x * ts - cam.x + 2, target.y * ts - cam.y + 2, ts - 4, ts - 4);
        }

        // Things on the map, in y order so nearer things draw over farther ones.
        const figures = [];
        for (const i of space.interactables) figures.push({ y: i.y, draw: () => this.drawInteractable(ctx, i, i.x * ts - cam.x, i.y * ts - cam.y, ts) });
        for (const n of space.npcs) figures.push({ y: n.y, draw: () => this.drawFigure(ctx, n.x * ts - cam.x, n.y * ts - cam.y, ts, n.facing, (n.def.sprite && n.def.sprite.color) || '#7fb3d5', false) });
        figures.push({ y: player.py, draw: () => this.drawFigure(ctx, player.px * ts - cam.x, player.py * ts - cam.y, ts, player.facing, '#F6F2EB', player.moving) });
        figures.sort((a, b) => a.y - b.y).forEach(f => f.draw());

        // The real sky over the real place: sun first, then what is falling out of it.
        if (scene.daylight && scene.daylight.tint) {
            const [r, g, b, a] = scene.daylight.tint;
            ctx.fillStyle = `rgba(${r},${g},${b},${space.kind === 'interior' ? a * 0.45 : a})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        if (scene.weather && space.kind !== 'interior') this.drawWeather(ctx, scene.weather);

        if (dev) this.drawDev(ctx, space, cam, ts, x0, y0, x1, y1, player);
    }

    // Real weather, drawn over the world: a tint for the sky, streaks for rain,
    // haze for fog, a flash now and then for a storm. Screen space, so it does
    // not care about the camera.
    drawWeather(ctx, w) {
        const W = this.canvas.width, H = this.canvas.height;
        const f = this.frame;
        if (w.kind === 'cloudy') { ctx.fillStyle = `rgba(60, 65, 80, ${0.08 + 0.12 * w.intensity})`; ctx.fillRect(0, 0, W, H); }
        if (w.kind === 'fog') {
            ctx.fillStyle = 'rgba(205, 205, 215, 0.38)'; ctx.fillRect(0, 0, W, H);
            const drift = (f * 0.4) % W;
            ctx.fillStyle = 'rgba(230, 230, 235, 0.12)';
            for (let i = 0; i < 4; i++) ctx.fillRect(((drift + i * W / 4) % W) - W / 8, (i * 97) % H, W / 4, 40);
        }
        if (w.kind === 'drizzle' || w.kind === 'rain' || w.kind === 'storm') {
            ctx.fillStyle = `rgba(20, 30, 60, ${0.18 + 0.2 * w.intensity})`; ctx.fillRect(0, 0, W, H);
            const n = Math.floor(60 + 260 * w.intensity);
            ctx.strokeStyle = 'rgba(200, 215, 240, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const speed = 14 + 10 * w.intensity;
            for (let i = 0; i < n; i++) {
                // deterministic pseudo-random per streak, animated by frame
                const sx = ((i * 7919) % W + f * 1.3) % W;
                const sy = ((i * 104729) % H + f * speed) % H;
                ctx.moveTo(sx, sy); ctx.lineTo(sx - 3, sy + 10 + 8 * w.intensity);
            }
            ctx.stroke();
            if (w.kind === 'storm' && f % 160 < 3) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(0, 0, W, H); }
        }
        if (w.kind === 'snow') {
            ctx.fillStyle = 'rgba(200, 205, 220, 0.18)'; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            const n = Math.floor(80 + 120 * w.intensity);
            for (let i = 0; i < n; i++) {
                const sx = ((i * 7919) % W + Math.sin((f + i) / 30) * 12 + f * 0.3) % W;
                const sy = ((i * 104729) % H + f * 1.6) % H;
                ctx.fillRect(sx, sy, 2, 2);
            }
        }
    }

    drawTile(ctx, space, x, y, sx, sy, ts) {
        const c = space.tile(x, y);
        const interior = space.theme === 'interior';
        const checker = (x + y) % 2 === 0;
        const u = ts / 8; // one "pixel" of detail
        switch (c) {
            case '.': ctx.fillStyle = interior ? (checker ? '#3b2f24' : '#40342a') : (checker ? '#8a8578' : '#847f72'); ctx.fillRect(sx, sy, ts, ts); break;
            case 'M': ctx.fillStyle = '#6b3a2e'; ctx.fillRect(sx, sy, ts, ts); ctx.strokeStyle = '#a07840'; ctx.lineWidth = u / 2; ctx.strokeRect(sx + u, sy + u, ts - 2 * u, ts - 2 * u); break;
            case 'S': ctx.fillStyle = checker ? '#8a8578' : '#84806f'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(sx, sy + ts - u / 2, ts, u / 2); break;
            case 'R': ctx.fillStyle = '#3c3c3c'; ctx.fillRect(sx, sy, ts, ts); break;
            case '-': ctx.fillStyle = '#3c3c3c'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#c9a43a'; ctx.fillRect(sx + u, sy + ts / 2 - u / 2, ts * 0.5, u); break;
            case 'G': ctx.fillStyle = checker ? '#3f6b3a' : '#3a6436'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#4a7a44'; ctx.fillRect(sx + 2 * u, sy + 3 * u, u, u); ctx.fillRect(sx + 5 * u, sy + 6 * u, u, u); break;
            case 'T': ctx.fillStyle = checker ? '#3f6b3a' : '#3a6436'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#4a3320'; ctx.fillRect(sx + 3.5 * u, sy + 5 * u, u, 3 * u); ctx.fillStyle = '#245a2a'; ctx.beginPath(); ctx.arc(sx + ts / 2, sy + 3.2 * u, 3.2 * u, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2f7034'; ctx.beginPath(); ctx.arc(sx + ts / 2 - u, sy + 2.6 * u, 1.6 * u, 0, Math.PI * 2); ctx.fill(); break;
            case 'F': ctx.fillStyle = checker ? '#3f6b3a' : '#3a6436'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#7a6a4a'; ctx.fillRect(sx, sy + 3 * u, ts, u); ctx.fillRect(sx, sy + 5.5 * u, ts, u); ctx.fillRect(sx + u, sy + 2 * u, u, 5 * u); ctx.fillRect(sx + 6 * u, sy + 2 * u, u, 5 * u); break;
            case 'W': ctx.fillStyle = interior ? '#1d1712' : '#2a2a20'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = interior ? '#5a4632' : '#3a3a30'; ctx.fillRect(sx, sy, ts, u); break;
            case 'w': ctx.fillStyle = interior ? '#1d1712' : '#2a2a20'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#5a4632'; ctx.fillRect(sx, sy, ts, u); ctx.fillStyle = '#7fa8c9'; ctx.fillRect(sx + 2 * u, sy + 2 * u, 4 * u, 3 * u); ctx.fillStyle = '#1d1712'; ctx.fillRect(sx + 3.8 * u, sy + 2 * u, 0.4 * u, 3 * u); break;
            case 'B': ctx.fillStyle = '#4a3a30'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#5c4a3e'; ctx.fillRect(sx, sy, ts, u / 2); ctx.fillStyle = '#c9b48a'; ctx.fillRect(sx + 1.5 * u, sy + 2 * u, 2 * u, 2.5 * u); ctx.fillRect(sx + 4.5 * u, sy + 2 * u, 2 * u, 2.5 * u); break;
            case 'D': ctx.fillStyle = interior ? '#3b2f24' : '#4a3a30'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#6b4a2a'; ctx.fillRect(sx + 1.5 * u, sy + u, 5 * u, 7 * u); ctx.fillStyle = '#c9a43a'; ctx.fillRect(sx + 5.5 * u, sy + 4.5 * u, u * 0.7, u * 0.7); break;
            case '=': ctx.fillStyle = '#3b2f24'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(sx + u / 2, sy + 2 * u, ts - u, 4 * u); ctx.fillStyle = '#5a4028'; ctx.fillRect(sx + u, sy + 6 * u, u, 1.5 * u); ctx.fillRect(sx + ts - 2 * u, sy + 6 * u, u, 1.5 * u); break;
            case '#': ctx.fillStyle = '#3b2f24'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#5a4028'; ctx.fillRect(sx + u / 2, sy + u / 2, ts - u, ts - u); ctx.fillStyle = '#a07840'; ctx.fillRect(sx + u, sy + 2 * u, ts - 2 * u, u / 2); ctx.fillRect(sx + u, sy + 4.5 * u, ts - 2 * u, u / 2); ctx.fillStyle = '#c9b48a'; ctx.fillRect(sx + 1.5 * u, sy + 1.2 * u, u, 0.8 * u); ctx.fillRect(sx + 3.5 * u, sy + 3.7 * u, u, 0.8 * u); ctx.fillStyle = '#8a3a2a'; ctx.fillRect(sx + 5 * u, sy + 1.2 * u, u, 0.8 * u); break;
            case 'C': ctx.fillStyle = '#3b2f24'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#8a7a5a'; ctx.fillRect(sx, sy + 2 * u, ts, 4 * u); ctx.fillStyle = '#6a5a40'; ctx.fillRect(sx, sy + 6 * u, ts, u); break;
            case 'P': ctx.fillStyle = '#3b2f24'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(sx + u / 2, sy + 4 * u, ts - u, 3 * u); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(sx + 1.5 * u, sy + u, 5 * u, 3.5 * u); ctx.fillStyle = (Math.floor(this.frame / 30) % 2) ? '#20C20E' : '#178f0a'; ctx.fillRect(sx + 2 * u, sy + 1.5 * u, 4 * u, 2.5 * u); break;
            case 'Z': ctx.fillStyle = '#3b2f24'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#5a3a5a'; ctx.fillRect(sx + u / 2, sy + u, ts - u, 6 * u); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(sx + u, sy + 1.5 * u, 2.5 * u, 2 * u); break;
            case 'p': ctx.fillStyle = checker ? '#9a958a' : '#948f83'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(sx, sy, ts, u / 3); ctx.fillRect(sx, sy, u / 3, ts); break;
            case 'g': ctx.fillStyle = '#2f5a2c'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = '#c9436a'; ctx.fillRect(sx + 1.5 * u, sy + 2 * u, u, u); ctx.fillStyle = '#e0c040'; ctx.fillRect(sx + 5 * u, sy + 4.5 * u, u, u); ctx.fillStyle = '#3f7a3a'; ctx.fillRect(sx + 3 * u, sy + 6 * u, u, u); break;
            case '~': ctx.fillStyle = '#2c5f8a'; ctx.fillRect(sx, sy, ts, ts); ctx.fillStyle = (Math.floor((this.frame / 20) + x + y) % 3 === 0) ? '#3a76a8' : '#2c5f8a'; ctx.fillRect(sx + u, sy + 3 * u, 3 * u, u / 2); ctx.fillRect(sx + 4 * u, sy + 6 * u, 2.5 * u, u / 2); break;
            case 'X': default: ctx.fillStyle = '#0d0b08'; ctx.fillRect(sx, sy, ts, ts); break;
        }
    }

    drawInteractable(ctx, item, sx, sy, ts) {
        const u = ts / 8;
        if (item.type === 'examine' && item.marker !== false) {
            ctx.fillStyle = '#c9b48a';
            ctx.fillRect(sx + 3 * u, sy + 2 * u, 2 * u, 2.5 * u);
            ctx.fillStyle = '#4a3320';
            ctx.fillRect(sx + 3.7 * u, sy + 4.5 * u, 0.6 * u, 2.5 * u);
        }
    }

    // A small figure: head, body, two legs. `moving` bobs the legs.
    drawFigure(ctx, sx, sy, ts, facing, color, moving) {
        const u = ts / 8;
        const step = moving ? (Math.floor(this.frame / 6) % 2 ? u / 2 : -u / 2) : 0;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.ellipse(sx + ts / 2, sy + ts - u / 2, 2.6 * u, u, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        ctx.fillRect(sx + 2.5 * u, sy + 3 * u, 3 * u, 3 * u);          // body
        ctx.fillRect(sx + 2.5 * u, sy + 6 * u, u, 1.5 * u + step);     // leg
        ctx.fillRect(sx + 4.5 * u, sy + 6 * u, u, 1.5 * u - step);     // leg
        ctx.fillStyle = '#e0b48c';
        ctx.fillRect(sx + 2.75 * u, sy + 0.75 * u, 2.5 * u, 2.5 * u);  // head
        ctx.fillStyle = '#2a1a10';
        ctx.fillRect(sx + 2.75 * u, sy + 0.5 * u, 2.5 * u, 0.8 * u);   // hair
        // eyes show which way we face
        ctx.fillStyle = '#1a1a1a';
        if (facing === 'down') { ctx.fillRect(sx + 3.2 * u, sy + 1.9 * u, 0.5 * u, 0.5 * u); ctx.fillRect(sx + 4.3 * u, sy + 1.9 * u, 0.5 * u, 0.5 * u); }
        else if (facing === 'left') ctx.fillRect(sx + 3 * u, sy + 1.9 * u, 0.5 * u, 0.5 * u);
        else if (facing === 'right') ctx.fillRect(sx + 4.5 * u, sy + 1.9 * u, 0.5 * u, 0.5 * u);
        ctx.fillStyle = '#A07840';
        ctx.fillRect(sx + 2.5 * u, sy + 3 * u, 3 * u, 0.6 * u);        // collar
    }

    drawDev(ctx, space, cam, ts, x0, y0, x1, y1, player) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ctx.strokeRect(x * ts - cam.x + 0.5, y * ts - cam.y + 0.5, ts, ts);
        ctx.font = `${Math.max(9, 5 * this.zoom)}px monospace`;
        ctx.fillStyle = '#ffd37a';
        const label = (x, y, text) => ctx.fillText(text, x * ts - cam.x + 2, y * ts - cam.y + 10);
        for (const i of space.interactables) label(i.x, i.y, i.id);
        for (const e of space.exits) label(e.x, e.y, e.id);
        for (const n of space.npcs) label(n.x, n.y, n.id);
        for (const s of space.spawns.values()) label(s.x, s.y, s.id);
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(`${space.id}  (${player.x},${player.y}) ${player.facing}  zoom ${this.zoom}  ${this.devNote || ''}  ${this.weatherNote || ''}`, 8, this.canvas.height - 10);
    }
}
