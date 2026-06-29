// TOUCH CONTROLS
// On-screen joystick + action buttons for phones and tablets. Pure client-side —
// no server, no build step, no deployment change. Touch input feeds the engine's
// existing key map and modal handlers, so the game logic is completely unaware
// that the input came from a thumb instead of a keyboard.
//
// Layout:
//   left  — analog-style joystick (4-way, grid movement)
//   right — A (primary action: talk / take / open / advance dialogue / confirm)
//           B (back / cancel — closes the terminal, backs out)
//   top-right — mute toggle
//   contextual — SYNC button appears at home when a synchronize is pending
//
// Shown automatically on touch devices. Force on with ?touch in the URL for
// desktop testing; force off with ?touch=0.

class TouchControls {
  constructor(engine) {
    this.engine = engine;
    this.root = null;
    this.joyId = null;
    this.joyActive = false;
    this._injectStyles();
    this._build();
    this._bind();
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  static shouldEnable() {
    const params = new URLSearchParams(location.search);
    if (params.get('touch') === '0') return false;
    if (params.has('touch')) return true;
    return ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           window.matchMedia('(pointer: coarse)').matches;
  }

  _injectStyles() {
    const css = `
      #touch-controls {
        position: fixed; inset: 0; z-index: 150;
        pointer-events: none; display: none;
        font-family: 'IBM Plex Mono', monospace;
        touch-action: none; user-select: none; -webkit-user-select: none;
      }
      #touch-controls.on { display: block; }
      #touch-controls .ctl { pointer-events: auto; touch-action: none; }

      #tc-joy {
        position: absolute; left: max(20px, env(safe-area-inset-left));
        bottom: max(24px, env(safe-area-inset-bottom));
        width: 128px; height: 128px; border-radius: 50%;
        background: rgba(160,120,64,0.10);
        border: 1px solid rgba(160,120,64,0.45);
      }
      #tc-joy-stick {
        position: absolute; left: 50%; top: 50%;
        width: 58px; height: 58px; margin: -29px 0 0 -29px;
        border-radius: 50%; background: rgba(160,120,64,0.55);
        border: 1px solid rgba(246,242,235,0.5);
        transition: transform 0.04s linear;
      }

      #tc-actions {
        position: absolute; right: max(22px, env(safe-area-inset-right));
        bottom: max(30px, env(safe-area-inset-bottom));
        width: 180px; height: 150px;
      }
      .tc-btn {
        position: absolute; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        color: #F6F2EB; letter-spacing: 1px; font-weight: 500;
        background: rgba(40,33,24,0.7); border: 1px solid rgba(160,120,64,0.4);
      }
      .tc-btn:active { transform: scale(0.92); }
      #tc-a { right: 4px; bottom: 4px; width: 88px; height: 88px; font-size: 14px;
              opacity: 0.55; transition: opacity 0.12s, background 0.12s, border-color 0.12s; }
      #tc-a.active { opacity: 1; background: rgba(160,120,64,0.85);
                     border-color: #F6F2EB; color: #0d0b08; }
      #tc-b { left: 4px; bottom: 22px; width: 60px; height: 60px; font-size: 12px; opacity: 0.75; }

      #tc-mute {
        position: absolute; top: max(14px, env(safe-area-inset-top));
        right: max(16px, env(safe-area-inset-right));
        width: 40px; height: 40px; border-radius: 8px; font-size: 16px;
        background: rgba(40,33,24,0.7); border: 1px solid rgba(160,120,64,0.4);
        color: #F6F2EB; display: flex; align-items: center; justify-content: center;
      }

      #tc-sync {
        position: absolute; left: 50%; transform: translateX(-50%);
        bottom: max(40px, env(safe-area-inset-bottom));
        padding: 12px 22px; border-radius: 24px; font-size: 13px; letter-spacing: 2px;
        background: rgba(160,120,64,0.9); color: #0d0b08; border: 1px solid #F6F2EB;
        display: none; align-items: center; justify-content: center;
        animation: tc-pulse 1.4s ease-in-out infinite;
      }
      @keyframes tc-pulse { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }
    `;
    const style = document.createElement('style');
    style.id = 'tc-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  _build() {
    const root = document.createElement('div');
    root.id = 'touch-controls';
    root.innerHTML = `
      <div id="tc-joy" class="ctl"><div id="tc-joy-stick"></div></div>
      <div id="tc-actions">
        <div id="tc-b" class="ctl tc-btn">BACK</div>
        <div id="tc-a" class="ctl tc-btn"><span class="tc-a-label">A</span></div>
      </div>
      <div id="tc-mute" class="ctl">&#128266;</div>
      <div id="tc-sync" class="ctl">SYNC ARCHIVE</div>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.joy = root.querySelector('#tc-joy');
    this.stick = root.querySelector('#tc-joy-stick');
    this.btnA = root.querySelector('#tc-a');
    this.btnALabel = root.querySelector('.tc-a-label');
    this.btnB = root.querySelector('#tc-b');
    this.btnMute = root.querySelector('#tc-mute');
    this.btnSync = root.querySelector('#tc-sync');
  }

  _bind() {
    // ── joystick (pointer events handle multi-touch via pointer capture) ──
    const start = (e) => {
      e.preventDefault();
      this.joy.setPointerCapture(e.pointerId);
      this.joyId = e.pointerId;
      this.joyActive = true;
      this._moveJoy(e);
    };
    const move = (e) => {
      if (this.joyActive && e.pointerId === this.joyId) { e.preventDefault(); this._moveJoy(e); }
    };
    const end = (e) => {
      if (e.pointerId === this.joyId) { this.joyActive = false; this.joyId = null; this._resetJoy(); }
    };
    this.joy.addEventListener('pointerdown', start);
    this.joy.addEventListener('pointermove', move);
    this.joy.addEventListener('pointerup', end);
    this.joy.addEventListener('pointercancel', end);

    // ── action buttons ──
    const tap = (el, fn) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
    };
    tap(this.btnA, () => this._onAction());
    tap(this.btnB, () => this._onBack());
    tap(this.btnMute, () => this._onMute());
    tap(this.btnSync, () => this._onSync());
  }

  _moveJoy(e) {
    const r = this.joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const R = r.width / 2;
    const dist = Math.hypot(dx, dy) || 0.0001;
    if (dist > R) { dx = dx / dist * R; dy = dy / dist * R; }
    this.stick.style.transform = `translate(${dx}px, ${dy}px)`;

    // clear, then set the single dominant direction (4-way, suits grid movement)
    const eng = this.engine;
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(k => eng.setVirtualKey(k, false));
    const dead = R * 0.30;
    if (dist > dead) {
      if (Math.abs(dx) > Math.abs(dy)) eng.setVirtualKey(dx < 0 ? 'ArrowLeft' : 'ArrowRight', true);
      else eng.setVirtualKey(dy < 0 ? 'ArrowUp' : 'ArrowDown', true);
    }
  }

  _resetJoy() {
    this.stick.style.transform = 'translate(0,0)';
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(k => this.engine.setVirtualKey(k, false));
  }

  _onAction() {
    const eng = this.engine, p = eng.presentation;
    if (eng.audio) eng.audio.unlock();
    if (!p) return;
    if (p.dialogueOpen || p.terminalOpen) {
      // advance / close modal via the handlers it already listens for
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else if (typeof p.touchInteract === 'function') {
      p.touchInteract(eng.simulation, eng.archive);
    }
  }

  _onBack() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  _onMute() {
    if (!this.engine.audio) return;
    const muted = this.engine.audio.toggleMute();
    this.btnMute.innerHTML = muted ? '&#128263;' : '&#128266;'; // muted / loud speaker
    this.engine.bus.emit('MuteToggled', { muted });
  }

  _onSync() {
    const eng = this.engine, p = eng.presentation;
    if (!p || !eng.simulation) return;
    const atHome = p.currentLocationData && p.currentLocationData.id === 'location:apartment';
    if (atHome) eng.simulation.synchronize();
  }

  // Per-frame UI state: show controls only once the game is running, light the
  // action button when there's something to do, surface the SYNC button at home.
  _tick() {
    const eng = this.engine, p = eng.presentation;
    const live = eng.running && p && p.bootDone;
    this.root.classList.toggle('on', !!live);

    if (live) {
      const label = p.touchActionLabel ? p.touchActionLabel() : '';
      const actionable = !!(p.interactTarget || p.dialogueOpen || p.terminalOpen);
      this.btnA.classList.toggle('active', actionable);
      this.btnALabel.textContent = label || 'A';

      const atHome = p.currentLocationData && p.currentLocationData.id === 'location:apartment';
      const pending = eng.simulation && eng.simulation.hasSyncPending && eng.simulation.hasSyncPending();
      this.btnSync.style.display = (atHome && pending) ? 'flex' : 'none';
    }
    requestAnimationFrame(this._tick);
  }
}
