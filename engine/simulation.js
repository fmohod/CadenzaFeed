// SIMULATION LAYER
// Knows what the player has done and what that changes.
// Reads from Archive. Emits events. Never renders anything.

class Simulation {
  constructor(archive, eventBus) {
    this.archive = archive;
    this.bus = eventBus;
    this.state = {
      recovered: [],
      completed: [],
      era: '2024',
      currentLocation: 'location:apartment',
      syncPending: false,
      firstBoot: true,
    };
  }

  load(savedState) {
    if (savedState) {
      this.state = { ...this.state, ...savedState };
      this.state.firstBoot = false;
    }
    this._rebuildWorld();
  }

  save() {
    return {
      recovered: [...this.state.recovered],
      completed: [...this.state.completed],
      era: this.state.era,
      currentLocation: this.state.currentLocation,
      firstBoot: false,
    };
  }

  _rebuildWorld() {
    // Deterministic: same save + same archive = same world
    // Re-apply all recovered records in order
    for (const recordId of this.state.recovered) {
      this._applyRecordEffects(recordId, true);
    }
  }

  recoverRecord(recordId) {
    if (this.state.recovered.includes(recordId)) return false;
    const record = this.archive.getRecord(recordId);
    if (!record) {
      console.warn(`Simulation: Record ${recordId} not found in archive`);
      return false;
    }
    this.state.recovered.push(recordId);
    this.state.syncPending = true;
    this._applyRecordEffects(recordId, false); // silent=false, triggers world reactions
    this.bus.emit('RecordRecovered', { record, totalRecovered: this.state.recovered.length });
    return true;
  }

  _applyRecordEffects(recordId, silent = false) {
    const record = this.archive.getRecord(recordId);
    if (!record || !record.game) return;
    const unlocks = record.game.unlocks;
    if (!unlocks) return;
    if (unlocks.mapPins && !silent) {
      for (const pin of unlocks.mapPins) {
        this.bus.emit('MapPinUnlocked', { locationId: pin, sourceRecord: recordId });
      }
    }
    if (unlocks.rumors && !silent) {
      for (const rumor of unlocks.rumors) {
        this.bus.emit('RumorUnlocked', { rumorId: rumor, sourceRecord: recordId });
      }
    }
    if (unlocks.terminalEntries && !silent) {
      for (const entry of unlocks.terminalEntries) {
        this.bus.emit('TerminalEntryUnlocked', { entryId: entry, sourceRecord: recordId });
      }
    }
  }

  synchronize() {
    if (!this.state.syncPending) return;
    this.state.syncPending = false;
    this.bus.emit('ArchiveSynchronized', {
      recovered: [...this.state.recovered],
      total: this.archive.getTotalRecordCount(),
    });
  }

  travelTo(locationId) {
    const loc = this.archive.getLocation(locationId);
    if (!loc) {
      console.warn(`Simulation: Location ${locationId} not found`);
      return false;
    }
    const previous = this.state.currentLocation;
    this.state.currentLocation = locationId;
    this.bus.emit('LocationChanged', { from: previous, to: locationId, location: loc });
    return true;
  }

  getNPCDialogue(npcId) {
    const npc = this.archive.getNPC(npcId);
    if (!npc) return null;
    const dialogue = npc.dialogue;

    // Check conditions in priority order: most specific first
    if (!this.state.syncPending && this.state.recovered.length > 0) {
      const afterSync = dialogue['after_sync'];
      if (afterSync && this.state.recovered.length >= 2) return afterSync;
    }
    for (const recordId of [...this.state.recovered].reverse()) {
      const shortId = recordId.replace('record:', '');
      const key = `after_record_${shortId}`;
      if (dialogue[key]) return dialogue[key];
    }
    return dialogue['default'] || '...';
  }

  isRecovered(recordId) { return this.state.recovered.includes(recordId); }
  getRecoveredCount() { return this.state.recovered.length; }
  getTotalCount() { return this.archive.getTotalRecordCount(); }
  getCurrentLocation() { return this.state.currentLocation; }
  hasSyncPending() { return this.state.syncPending; }
  getEra() { return this.state.era; }
}
