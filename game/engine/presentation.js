// PRESENTATION LAYER
// Knows how to display things. No content decisions. No game logic.
// Reads from Archive and Simulation. Renders to canvas and DOM overlays.

const TILE = 48;
const COLS = 16;
const ROWS = 11;

// Tilemap definitions — pure visual data
const TILEMAPS = {
  apartment: {
    floor: '#2a2118',
    wall: '#1a1410',
    accent: '#3d2e1e',
    layout: [
      'WWWWWWWWWWWWWWWW',
      'W..........W...W',
      'W..c.......W...W',
      'W......n...W...W',
      'W..........W...W',
      'W.....W....D...W',
      'W.....W........W',
      'W..........W...W',
      'W..........W...W',
      'W..........W...W',
      'WWWWWWWWWWWWWWWW',
    ]
  },
  'third-ward-street': {
    floor: '#3a3a2e',
    wall: '#2a2a20',
    accent: '#4a4a38',
    layout: [
      'SSSSSSSSSSSSSSSS',
      'S..............S',
      'S..B...........S',
      'S..B...........S',
      'SD.B...........S',
      'S..............S',
      'RRRRRRRRRRRRRRRR',
      'S..............S',
      'S..............S',
      'S..............S',
      'SSSSSSSSSSSSSSSS',
    ]
  }
};

// Color palette matching Cadenza Arthouse visual identity
const PALETTE = {
  bg: '#0d0b08',
  text: '#F6F2EB',
  textDim: '#8a8070',
  bronze: '#A07840',
  bronzeDim: '#5a4422',
  green: '#4a8a5a',
  red: '#8a3a2a',
  wall: '#1a1410',
  floor: '#2a2118',
  player: '#F6F2EB',
  npc: '#A07840',
  record: '#4a8a5a',
  terminal: '#3a5a8a',
  exit: '#5a3a8a',
  examine: '#6a5a3a',
  overlay: 'rgba(13,11,8,0.92)',
};

class Presentation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = COLS * TILE;
    this.canvas.height = ROWS * TILE;

    this.player = { x: 4, y: 5, facing: 'down' };
    this.currentMap = null;
    this.currentLocationData = null;
    this.interactTarget = null;

    this.dialogueOpen = false;
    this.dialogueText = '';
    this.dialogueSpeaker = '';
    this.dialogueCallback = null;

    this.terminalOpen = false;
    this.terminalLines = [];

    this.notificationQueue = [];
    this.activeNotification = null;
    this.notificationTimer = 0;

    this.bootDone = false;
    this.syncAnimation = false;
    this.syncTimer = 0;
    this._inputCooldown = 0;
  }

  // Build a chunky, pixelated, bronze-tinted version of the brand logo entirely
  // in code — downscale to a low-res buffer, then recolor the black artwork to
  // bronze using its own alpha as a mask. No new image asset required.
  _prepareBootLogo() {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const pw = 130; // low-res pixel width — controls chunkiness
        const ph = Math.max(1, Math.round(pw * (img.height / img.width)));
        const buf = document.createElement('canvas');
        buf.width = pw; buf.height = ph;
        const bctx = buf.getContext('2d');
        bctx.imageSmoothingEnabled = false;
        bctx.drawImage(img, 0, 0, pw, ph);
        // Recolor: keep the logo's alpha shape, fill it bronze.
        bctx.globalCompositeOperation = 'source-in';
        bctx.fillStyle = PALETTE.bronze;
        bctx.fillRect(0, 0, pw, ph);
        resolve(buf);
      };
      img.onerror = () => resolve(null);
      img.src = '../assets/logo.png';
    });
  }

  // CRT overlay: scanlines, a slow phosphor scan band, and a vignette.
  _drawCRT(ctx, frame) {
    const w = this.canvas.width, h = this.canvas.height;
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    // slow bronze scan band sweeping down
    const bandY = ((frame * 1.4) % (h + 160)) - 80;
    const band = ctx.createLinearGradient(0, bandY - 50, 0, bandY + 50);
    band.addColorStop(0, 'rgba(160,120,64,0)');
    band.addColorStop(0.5, 'rgba(160,120,64,0.06)');
    band.addColorStop(1, 'rgba(160,120,64,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, bandY - 50, w, 100);
    // vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  async showBoot(archive) {
    const logo = await this._prepareBootLogo();

    return new Promise(resolve => {
      const lines = [
        { text: 'CADENZA ARCHIVE v0.01', delay: 0 },
        { text: '', delay: 600 },
        { text: 'Initializing...', delay: 900 },
        { text: 'Scanning content providers...', delay: 1800 },
        { text: '  > Records', delay: 2400 },
        { text: '  > NPCs', delay: 2700 },
        { text: '  > Locations', delay: 3000 },
        { text: '', delay: 3400 },
        { text: 'Integrity Check...', delay: 3800 },
        { text: '  0.4%', delay: 4400 },
        { text: '', delay: 4800 },
        { text: 'ERROR', delay: 5200, color: PALETTE.red },
        { text: 'Archive Fragmented', delay: 5600, color: PALETTE.red },
        { text: '', delay: 6000 },
        { text: 'Records Found: 8', delay: 6400, color: PALETTE.bronze },
        { text: 'Connections Found: 0', delay: 6800, color: PALETTE.textDim },
        { text: '', delay: 7400 },
        { text: '> Press ENTER to begin recovery', delay: 8000, color: PALETTE.bronze },
      ];

      const visible = [];
      let done = false;
      let frame = 0;

      const W = this.canvas.width;
      const logoW = 300;
      const logoH = logo ? Math.round(logoW * (logo.height / logo.width)) : 0;
      const logoX = Math.round((W - logoW) / 2);
      const logoY = 16;
      const textTop = logo ? logoY + logoH + 26 : 80;
      const lineH = 19;

      const draw = () => {
        const ctx = this.ctx;
        frame++;
        ctx.fillStyle = PALETTE.bg;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // pixelated bronze logo with a faint flicker
        if (logo) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = 0.9 + 0.1 * Math.sin(frame * 0.25);
          ctx.drawImage(logo, logoX, logoY, logoW, logoH);
          ctx.restore();
        }

        // terminal text
        ctx.font = '14px "IBM Plex Mono", monospace';
        let y = textTop;
        for (const line of visible) {
          ctx.fillStyle = line.color || PALETTE.text;
          ctx.fillText(line.text, 60, y);
          y += lineH;
        }

        // CRT overlay on top of everything
        this._drawCRT(ctx, frame);

        if (!done) requestAnimationFrame(draw);
      };
      draw();

      lines.forEach(line => {
        setTimeout(() => { visible.push(line); }, line.delay);
      });

      const onKey = e => {
        if (e.key === 'Enter' && visible.length >= lines.length) {
          done = true;
          window.removeEventListener('keydown', onKey);
          this.bootDone = true;
          resolve();
        }
      };
      window.addEventListener('keydown', onKey);
    });
  }

  async init(archive, simulation, bus) {
    this._archive = archive;
    this._simulation = simulation;
    this._bus = bus;

    // Subscribe to events
    bus.on('LocationChanged', data => this._onLocationChanged(data));
    bus.on('RecordRecovered', data => this._onRecordRecovered(data));
    bus.on('ArchiveSynchronized', data => this._onArchiveSynchronized(data));
    bus.on('DevModeToggled', data => this._onDevMode(data));

    // DOM overlays
    this._buildDOM();
  }

  _buildDOM() {
    // Dialogue box
    const dlg = document.createElement('div');
    dlg.id = 'dialogue';
    dlg.style.cssText = `
      display:none; position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      width:680px; max-width:90vw; background:rgba(13,11,8,0.97);
      border:1px solid ${PALETTE.bronze}; padding:20px 24px; font-family:'IBM Plex Mono',monospace;
      color:${PALETTE.text}; z-index:100;
    `;
    dlg.innerHTML = `
      <div id="dialogue-speaker" style="color:${PALETTE.bronze};font-size:11px;letter-spacing:2px;margin-bottom:8px;"></div>
      <div id="dialogue-text" style="font-size:14px;line-height:1.7;"></div>
      <div style="margin-top:14px;color:${PALETTE.textDim};font-size:11px;">[ ENTER ] Continue</div>
    `;
    document.body.appendChild(dlg);

    // Terminal overlay
    const term = document.createElement('div');
    term.id = 'terminal';
    term.style.cssText = `
      display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      width:640px; max-width:90vw; max-height:80vh; overflow-y:auto;
      background:rgba(13,11,8,0.98); border:1px solid ${PALETTE.terminal};
      padding:24px; font-family:'IBM Plex Mono',monospace; color:${PALETTE.text}; z-index:100;
    `;
    document.body.appendChild(term);

    // Notification bar
    const notif = document.createElement('div');
    notif.id = 'notification';
    notif.style.cssText = `
      display:none; position:fixed; top:20px; left:50%; transform:translateX(-50%);
      background:rgba(13,11,8,0.95); border:1px solid ${PALETTE.green};
      padding:10px 20px; font-family:'IBM Plex Mono',monospace;
      color:${PALETTE.green}; font-size:12px; z-index:200; letter-spacing:1px;
    `;
    document.body.appendChild(notif);

    // HUD
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.style.cssText = `
      position:fixed; top:0; left:0; right:0; padding:8px 16px;
      display:flex; justify-content:space-between; align-items:center;
      font-family:'IBM Plex Mono',monospace; font-size:11px;
      color:${PALETTE.textDim}; pointer-events:none; z-index:50;
    `;
    hud.innerHTML = `
      <span id="hud-location">—</span>
      <span id="hud-records">□□□□□□□□</span>
      <span id="hud-controls">WASD / ARROWS — MOVE &nbsp;|&nbsp; E — INTERACT &nbsp;|&nbsp; TAB — SYNC &nbsp;|&nbsp; F12 — DEV</span>
    `;
    document.body.appendChild(hud);

    // Dev mode overlay
    const dev = document.createElement('div');
    dev.id = 'devmode';
    dev.style.cssText = `
      display:none; position:fixed; bottom:20px; right:20px;
      background:rgba(0,0,0,0.9); border:1px solid #ff4400;
      padding:12px; font-family:'IBM Plex Mono',monospace;
      font-size:11px; color:#ff6600; z-index:300; max-width:300px;
    `;
    document.body.appendChild(dev);
  }

  _onLocationChanged(data) {
    const loc = data.location;
    const mapKey = loc.tilemap || 'apartment';
    this.currentMap = TILEMAPS[mapKey] || TILEMAPS.apartment;

    // Build the live interactable list: the neighborhood's base interactables
    // plus dynamically spawned Records whose game-location matches this
    // neighborhood's slug. The location file never names specific records —
    // it only provides spawn points. The archive decides what appears.
    const base = (loc.interactables || []).slice();
    const spawned = [];
    if (loc.recordSlug && loc.recordSpawns) {
      const matching = this._archive.getRecordsByLocation(loc.recordSlug)
        .filter(r => !this._simulation.isRecovered(r.id));
      matching.forEach((rec, i) => {
        const spawn = loc.recordSpawns[i];
        if (!spawn) return; // more matching records than spawn points — rest listed in terminal
        spawned.push({
          id: `record-spawn-${rec.articleId}`,
          type: 'record',
          recordId: rec.id,
          position: { tileX: spawn.tileX, tileY: spawn.tileY },
          label: spawn.label || 'Scattered Papers',
        });
      });
    }
    this.currentLocationData = { ...loc, interactables: [...base, ...spawned] };
    document.getElementById('hud-location').textContent = loc.name.toUpperCase();

    // Place player at entrance
    const entrance = base.find(i => i.type === 'exit' && i.destination === this._simulation.state?.previousLocation);
    if (entrance) {
      this.player.x = entrance.position.tileX;
      this.player.y = entrance.position.tileY;
    } else {
      this.player.x = 2; this.player.y = 5;
    }
  }

  _onRecordRecovered(data) {
    const record = data.record;
    this._showNotification(`RECORD RECOVERED — ${record.game?.inGameTitle || record.title}`);
    this._updateRecordHUD();
  }

  _onArchiveSynchronized(data) {
    this.syncAnimation = true;
    this.syncTimer = 2.5;
    this._showNotification(`ARCHIVE SYNCHRONIZED — ${data.recovered.length} / ${data.total} RECORDS CONNECTED`);
    this._updateRecordHUD();
  }

  _onDevMode(data) {
    document.getElementById('devmode').style.display = data.active ? 'block' : 'none';
  }

  _updateRecordHUD() {
    const recovered = this._simulation.getRecoveredCount();
    const total = this._simulation.getTotalCount();
    const boxes = Array(total).fill(0).map((_, i) => i < recovered ? '■' : '□').join('');
    document.getElementById('hud-records').textContent = boxes;
  }

  _showNotification(text) {
    this.notificationQueue.push(text);
  }

  _tickNotification(dt) {
    if (this.activeNotification) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) {
        this.activeNotification = null;
        document.getElementById('notification').style.display = 'none';
      }
    }
    if (!this.activeNotification && this.notificationQueue.length > 0) {
      this.activeNotification = this.notificationQueue.shift();
      const el = document.getElementById('notification');
      el.textContent = this.activeNotification;
      el.style.display = 'block';
      this.notificationTimer = 3.0;
    }
  }

  update(dt, keys, simulation, archive) {
    if (this.dialogueOpen || this.terminalOpen) return;

    this._tickNotification(dt);
    if (this.syncAnimation) {
      this.syncTimer -= dt;
      if (this.syncTimer <= 0) this.syncAnimation = false;
    }

    const loc = this.currentLocationData;
    if (!loc) return;

    // Always update interactTarget based on current player position
    this.interactTarget = (loc.interactables || []).find(i => {
      const dx = Math.abs(i.position.tileX - this.player.x);
      const dy = Math.abs(i.position.tileY - this.player.y);
      return dx + dy <= 1;
    }) || null;

    // E key interact — works independently of movement
    if ((keys['e'] || keys['E']) && this.interactTarget && this._inputCooldown <= 0) {
      this._interact(this.interactTarget, simulation, archive);
      this._inputCooldown = 0.4;
      keys['e'] = false; keys['E'] = false;
      return;
    }

    // TAB — archive sync (only at home terminal)
    if (keys['Tab'] && loc.id === 'location:apartment' && this._inputCooldown <= 0) {
      simulation.synchronize();
      this._inputCooldown = 0.5;
      keys['Tab'] = false;
    }

    // Movement — only proceed if not in cooldown
    if (this._inputCooldown > 0) { this._inputCooldown -= dt; return; }

    let nx = this.player.x, ny = this.player.y;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) { ny--; this.player.facing = 'up'; }
    else if (keys['ArrowDown'] || keys['s'] || keys['S']) { ny++; this.player.facing = 'down'; }
    else if (keys['ArrowLeft'] || keys['a'] || keys['A']) { nx--; this.player.facing = 'left'; }
    else if (keys['ArrowRight'] || keys['d'] || keys['D']) { nx++; this.player.facing = 'right'; }
    else return;

    this._inputCooldown = 0.14;

    // Bounds check
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;

    // Wall collision
    const tile = (this.currentMap?.layout[ny] || '')[nx];
    if (tile === 'W' || tile === 'S' || tile === 'B') return;

    // Step onto interactable — auto-trigger (exits, on-step records)
    const stepped = (loc.interactables || []).find(i =>
      i.position.tileX === nx && i.position.tileY === ny
    );
    if (stepped && (stepped.type === 'exit' || stepped.type === 'record')) {
      this._interact(stepped, simulation, archive);
      return;
    }

    this.player.x = nx;
    this.player.y = ny;
  }

  _interact(item, simulation, archive) {
    if (item.type === 'exit') {
      simulation.travelTo(item.destination);
      return;
    }
    if (item.type === 'examine') {
      this._openDialogue('', item.text, null);
      return;
    }
    if (item.type === 'npc') {
      const npc = archive.getNPC(item.npcId);
      if (!npc) return;
      const text = simulation.getNPCDialogue(item.npcId);
      this._openDialogue(npc.name.toUpperCase(), text, null);
      return;
    }
    if (item.type === 'record') {
      if (simulation.isRecovered(item.recordId)) {
        this._openDialogue('ARCHIVE TERMINAL', 'This record has already been recovered and logged.', null);
        return;
      }
      const record = archive.getRecord(item.recordId);
      if (!record) return;
      const flavor = record.game?.flavorText || record.summary;
      this._openDialogue('RECORD FOUND', flavor, () => {
        simulation.recoverRecord(item.recordId);
      });
      return;
    }
    if (item.type === 'terminal') {
      this._openTerminal(simulation, archive);
      return;
    }
  }

  _openDialogue(speaker, text, onClose) {
    this.dialogueOpen = true;
    this.dialogueSpeaker = speaker;
    this.dialogueText = text;
    this.dialogueCallback = onClose;
    document.getElementById('dialogue-speaker').textContent = speaker;
    document.getElementById('dialogue-text').textContent = text;
    document.getElementById('dialogue').style.display = 'block';

    const onKey = e => {
      if (e.key === 'Enter' || e.key === 'e' || e.key === 'E' || e.key === ' ') {
        e.preventDefault();
        document.getElementById('dialogue').style.display = 'none';
        this.dialogueOpen = false;
        window.removeEventListener('keydown', onKey);
        if (this.dialogueCallback) this.dialogueCallback();
        this.dialogueCallback = null;
      }
    };
    setTimeout(() => window.addEventListener('keydown', onKey), 100);
  }

  _openTerminal(simulation, archive) {
    this.terminalOpen = true;
    const recovered = simulation.getRecoveredCount();
    const total = simulation.getTotalCount();
    const hasPending = simulation.hasSyncPending();

    const lines = [];
    lines.push(`<div style="color:${PALETTE.bronze};font-size:13px;letter-spacing:2px;margin-bottom:16px;">CADENZA ARCHIVE TERMINAL</div>`);
    lines.push(`<div style="color:${PALETTE.textDim};margin-bottom:16px;">Records: ${recovered} / ${total} &nbsp;|&nbsp; Era: ${simulation.getEra()}</div>`);

    if (hasPending) {
      lines.push(`<div style="color:${PALETTE.red};margin-bottom:12px;">! Sync pending — press TAB to synchronize</div>`);
    }

    // Recovered records
    if (recovered > 0) {
      lines.push(`<div style="margin-bottom:12px;color:${PALETTE.textDim};">RECOVERED RECORDS</div>`);
      for (const recordId of simulation.state.recovered) {
        const record = archive.getRecord(recordId);
        if (record) {
          lines.push(`<div style="color:${PALETTE.green};margin-bottom:6px;">■ ${record.game?.inGameTitle || record.title}</div>`);
          lines.push(`<div style="color:${PALETTE.textDim};font-size:12px;margin-bottom:10px;margin-left:16px;">${record.summary || ''}</div>`);
        }
      }
    }

    // Unrecovered records become "signals." A signal is reachable if its
    // neighborhood has been built (a location declares its slug); otherwise it
    // is a locked signal — detected, but not yet accessible.
    const reachableSlugs = new Set(
      [...archive.locations.values()].map(l => l.recordSlug).filter(Boolean)
    );
    const unrecovered = archive.getAllRecords().filter(r => !simulation.isRecovered(r.id));
    const reachable = unrecovered.filter(r => reachableSlugs.has(r.location));
    const locked = unrecovered.filter(r => !reachableSlugs.has(r.location));

    if (reachable.length) {
      lines.push(`<div style="margin:14px 0 8px;color:${PALETTE.textDim};">SIGNALS DETECTED — RECOVERABLE NOW</div>`);
      for (const r of reachable) {
        lines.push(`<div style="color:${PALETTE.bronze};margin-bottom:4px;">◆ ${r.title}</div>`);
        lines.push(`<div style="color:${PALETTE.textDim};font-size:11px;margin-bottom:8px;margin-left:16px;">${r.location} · ${r.era}</div>`);
      }
    }

    if (locked.length) {
      lines.push(`<div style="margin:14px 0 8px;color:${PALETTE.textDim};">SIGNALS DETECTED — LOCATION NOT YET ACCESSIBLE</div>`);
      for (const r of locked) {
        lines.push(`<div style="color:${PALETTE.textDim};margin-bottom:4px;">▢ ${r.title}</div>`);
        lines.push(`<div style="color:${PALETTE.textDim};font-size:11px;margin-bottom:8px;margin-left:16px;opacity:0.6;">${r.location || 'unknown'} · ${r.era} · locked</div>`);
      }
    }

    lines.push(`<div style="margin-top:20px;color:${PALETTE.textDim};font-size:11px;">[ ENTER ] Close terminal</div>`);

    const term = document.getElementById('terminal');
    term.innerHTML = lines.join('');
    term.style.display = 'block';

    const onKey = e => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        term.style.display = 'none';
        this.terminalOpen = false;
        window.removeEventListener('keydown', onKey);
      }
    };
    setTimeout(() => window.addEventListener('keydown', onKey), 100);
  }

  render(simulation, archive, devMode) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.currentMap) return;

    this._renderTilemap(ctx);
    this._renderInteractables(ctx, simulation);
    this._renderPlayer(ctx);

    if (this.syncAnimation) {
      this._renderSyncEffect(ctx);
    }

    if (devMode) this._renderDevOverlay(ctx, simulation, archive);
  }

  _renderTilemap(ctx) {
    const map = this.currentMap;
    for (let row = 0; row < ROWS; row++) {
      const rowStr = map.layout[row] || '';
      for (let col = 0; col < COLS; col++) {
        const tile = rowStr[col] || '.';
        const x = col * TILE, y = row * TILE;
        if (tile === 'W') {
          ctx.fillStyle = map.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(x, y, TILE, 1);
        } else if (tile === 'S') {
          ctx.fillStyle = map.wall;
          ctx.fillRect(x, y, TILE, TILE);
        } else if (tile === 'D') {
          ctx.fillStyle = '#4a3a2a';
          ctx.fillRect(x, y, TILE, TILE);
        } else if (tile === 'R') {
          ctx.fillStyle = '#2a2a20';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#3a3a2e';
          ctx.fillRect(x + 2, y + TILE/2 - 2, TILE - 4, 4);
        } else if (tile === 'B') {
          ctx.fillStyle = '#3a2a10';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#2a1a08';
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        } else {
          ctx.fillStyle = map.floor;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.015)';
          ctx.fillRect(x, y, TILE, 1);
          ctx.fillRect(x, y, 1, TILE);
        }
      }
    }
  }

  _renderInteractables(ctx, simulation) {
    const loc = this.currentLocationData;
    if (!loc) return;
    for (const item of (loc.interactables || [])) {
      const x = item.position.tileX * TILE;
      const y = item.position.tileY * TILE;
      let color = PALETTE.examine;
      let symbol = '?';

      if (item.type === 'npc') { color = PALETTE.npc; symbol = '@'; }
      else if (item.type === 'terminal') { color = PALETTE.terminal; symbol = '▣'; }
      else if (item.type === 'exit') { color = PALETTE.exit; symbol = '↑'; }
      else if (item.type === 'record') {
        if (simulation.isRecovered(item.recordId)) {
          color = PALETTE.textDim; symbol = '·';
        } else {
          color = PALETTE.record; symbol = '◆';
          // Pulse effect
          const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 500);
          ctx.globalAlpha = pulse;
        }
      }

      ctx.fillStyle = color;
      ctx.font = `${TILE * 0.5}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, x + TILE / 2, y + TILE / 2);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // Label on hover proximity
      const dx = Math.abs(item.position.tileX - this.player.x);
      const dy = Math.abs(item.position.tileY - this.player.y);
      if (dx + dy <= 1 && item.label) {
        ctx.fillStyle = PALETTE.bronze;
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`[ E ] ${item.label}`, x + TILE / 2, y - 6);
        ctx.textAlign = 'left';
      }
    }
  }

  _renderPlayer(ctx) {
    const x = this.player.x * TILE;
    const y = this.player.y * TILE;
    const pad = 10;
    ctx.fillStyle = PALETTE.player;
    ctx.fillRect(x + pad, y + pad, TILE - pad * 2, TILE - pad * 2);
    ctx.fillStyle = PALETTE.bg;
    const eyeSize = 3;
    if (this.player.facing === 'up') { ctx.fillRect(x + 14, y + 14, eyeSize, eyeSize); ctx.fillRect(x + 28, y + 14, eyeSize, eyeSize); }
    else if (this.player.facing === 'down') { ctx.fillRect(x + 14, y + 28, eyeSize, eyeSize); ctx.fillRect(x + 28, y + 28, eyeSize, eyeSize); }
    else if (this.player.facing === 'left') { ctx.fillRect(x + 12, y + 20, eyeSize, eyeSize); }
    else { ctx.fillRect(x + 32, y + 20, eyeSize, eyeSize); }
  }

  _renderSyncEffect(ctx) {
    const alpha = Math.min(this.syncTimer / 2.5, 1) * 0.15;
    ctx.fillStyle = `rgba(74, 138, 90, ${alpha})`;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _renderDevOverlay(ctx, simulation, archive) {
    const loc = this.currentLocationData;
    const devEl = document.getElementById('devmode');
    if (!loc) return;
    const lines = [
      `[DEV MODE]`,
      `Location: ${loc.id}`,
      `Player: (${this.player.x}, ${this.player.y}) facing ${this.player.facing}`,
      `Era: ${simulation.getEra()}`,
      `Records: ${simulation.getRecoveredCount()}/${simulation.getTotalCount()}`,
      `Sync pending: ${simulation.hasSyncPending()}`,
    ];
    devEl.innerHTML = lines.map(l => `<div>${l}</div>`).join('');

    // Tile coordinates overlay
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255,68,0,0.5)';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillText(`${c},${r}`, c * TILE + 2, r * TILE + 10);
      }
    }

    // Interactable IDs
    for (const item of (loc.interactables || [])) {
      ctx.fillStyle = '#ff4400';
      ctx.font = '9px monospace';
      ctx.fillText(item.id, item.position.tileX * TILE + 2, item.position.tileY * TILE + TILE - 4);
    }
  }

  showFatalError(msg) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = PALETTE.red;
    ctx.font = '14px "IBM Plex Mono", monospace';
    ctx.fillText('FATAL ERROR', 60, 100);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(msg, 60, 130);
  }
}
