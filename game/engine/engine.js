// ENGINE CORE
// Event bus. Game loop. Input. Save/load. Coordinates Archive + Simulation + Presentation.
// Never references specific Records, NPCs, or Locations by name.

class EventBus {
  constructor() { this._listeners = {}; }
  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
  emit(event, data) {
    (this._listeners[event] || []).forEach(fn => fn(data));
  }
}

class Engine {
  constructor() {
    this.bus = new EventBus();
    this.archive = new Archive();
    this.audio = new AudioManager(this.bus);
    this.simulation = null;
    this.presentation = null;
    this.running = false;
    this.devMode = false;
    this._lastTime = 0;
    this._keys = {};
    this._inputCooldown = 0;
  }

  async init(presentation) {
    this.presentation = presentation;

    // Boot sequence — the ENTER that ends it is the user gesture that lets
    // browsers play audio, so unlock the audio context right here.
    await this.presentation.showBoot(this.archive);
    this.audio.unlock();

    // Load archive from manifest
    const ok = await this.archive.load('manifest.json');
    if (!ok) {
      this.presentation.showFatalError('Archive could not be loaded. Check manifest.json.');
      return;
    }

    // Validate
    const warnings = this.archive.validate();
    if (warnings.length > 0 && this.devMode) {
      console.group('[DEV] Archive Validation');
      warnings.forEach(w => console.warn(w));
      console.groupEnd();
    }

    // Init simulation
    this.simulation = new Simulation(this.archive, this.bus);

    // Audio reacts to engine events (music per area, stingers on recovery/sync).
    // Wire before the first travelTo so the opening area's music starts.
    this.audio.wire();

    // Load save if exists
    const saved = this._loadSave();
    this.simulation.load(saved);

    // Wire up event reactions
    this._wireEvents();

    // Input
    this._bindInput();

    // Hand off to presentation for first render
    await this.presentation.init(this.archive, this.simulation, this.bus);

    // Full-screen Archive OS terminal (reads Archive Records, not HTML).
    this.terminal = new ArchiveTerminal(this);
    this.terminal.wire();

    // Travel to current location
    this.simulation.travelTo(this.simulation.getCurrentLocation());

    // Start loop
    this.running = true;
    requestAnimationFrame(t => this._loop(t));
  }

  _wireEvents() {
    this.bus.on('RecordRecovered', data => {
      this._autoSave();
    });
    this.bus.on('ArchiveSynchronized', data => {
      this._autoSave();
    });
    this.bus.on('LocationChanged', data => {
      this._autoSave();
    });
  }

  _loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.1);
    this._lastTime = timestamp;
    if (this._inputCooldown > 0) this._inputCooldown -= dt;
    this.presentation.update(dt, this._keys, this.simulation, this.archive);
    this.presentation.render(this.simulation, this.archive, this.devMode);
    requestAnimationFrame(t => this._loop(t));
  }

  _bindInput() {
    window.addEventListener('keydown', e => {
      this._keys[e.key] = true;
      // First keypress is the user gesture that unlocks browser audio.
      this.audio.unlock();
      // Toggle dev mode
      if (e.key === 'F12') {
        e.preventDefault();
        this.devMode = !this.devMode;
        this.bus.emit('DevModeToggled', { active: this.devMode });
      }
      // Toggle mute
      if (e.key === 'm' || e.key === 'M') {
        const muted = this.audio.toggleMute();
        this.bus.emit('MuteToggled', { muted });
      }
    });
    window.addEventListener('keyup', e => { this._keys[e.key] = false; });
  }

  // Virtual key input. Touch controls (joystick / on-screen buttons) feed the
  // same key map the keyboard does, so the game loop is unaware of input source.
  setVirtualKey(key, down) {
    this._keys[key] = down;
    if (down && this.audio) this.audio.unlock();
  }

  _autoSave() {
    if (!this.simulation) return;
    try {
      const state = this.simulation.save();
      localStorage.setItem('cadenza-save', JSON.stringify(state));
    } catch (e) {
      console.warn('AutoSave failed:', e);
    }
  }

  _loadSave() {
    try {
      const raw = localStorage.getItem('cadenza-save');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  resetSave() {
    localStorage.removeItem('cadenza-save');
    location.reload();
  }
}
