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

    // Boot sequence
    await this.presentation.showBoot(this.archive);

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

    // Load save if exists
    const saved = this._loadSave();
    this.simulation.load(saved);

    // Wire up event reactions
    this._wireEvents();

    // Input
    this._bindInput();

    // Hand off to presentation for first render
    await this.presentation.init(this.archive, this.simulation, this.bus);

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
      // Toggle dev mode
      if (e.key === 'F12') {
        e.preventDefault();
        this.devMode = !this.devMode;
        this.bus.emit('DevModeToggled', { active: this.devMode });
      }
    });
    window.addEventListener('keyup', e => { this._keys[e.key] = false; });
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
