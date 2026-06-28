// ARCHIVE LAYER
// Knows what exists. Loads content from manifest and JSON files.
// Has no knowledge of game state, player actions, or rendering.

class Archive {
  constructor() {
    this.manifest = null;
    this.records = new Map();
    this.npcs = new Map();
    this.locations = new Map();
    this.relationships = [];
    this.loaded = false;
    this.errors = [];
  }

  async load(manifestPath = 'manifest.json') {
    try {
      const res = await fetch(manifestPath);
      if (!res.ok) throw new Error(`Manifest not found at ${manifestPath}`);
      this.manifest = await res.json();
    } catch (e) {
      this.errors.push(`ARCHIVE ERROR: Cannot load manifest — ${e.message}`);
      return false;
    }

    const loads = [
      ...this.manifest.records.map(id => this._loadRecord(id)),
      ...this.manifest.npcs.map(id => this._loadNPC(id)),
      ...this.manifest.locations.map(id => this._loadLocation(id)),
    ];

    await Promise.all(loads);
    this._buildRelationshipIndex();
    this.loaded = true;
    return true;
  }

  async _loadRecord(id) {
    try {
      const res = await fetch(`content/records/${id}/record.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.records.set(data.id, data);
    } catch (e) {
      this.errors.push(`ARCHIVE WARNING: Could not load record ${id} — ${e.message}`);
    }
  }

  async _loadNPC(id) {
    try {
      const res = await fetch(`content/npcs/${id}/npc.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.npcs.set(data.id, data);
    } catch (e) {
      this.errors.push(`ARCHIVE WARNING: Could not load NPC ${id} — ${e.message}`);
    }
  }

  async _loadLocation(id) {
    try {
      const res = await fetch(`content/locations/${id}/location.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.locations.set(data.id, data);
    } catch (e) {
      this.errors.push(`ARCHIVE WARNING: Could not load location ${id} — ${e.message}`);
    }
  }

  _buildRelationshipIndex() {
    this.relationships = [];
    for (const [, record] of this.records) {
      if (!record.relationships) continue;
      for (const rel of record.relationships) {
        this.relationships.push({
          subject: record.id,
          type: rel.type,
          object: rel.object,
          source: record.id,
        });
      }
    }
  }

  getRecord(id) { return this.records.get(id) || null; }
  getNPC(id) { return this.npcs.get(id) || null; }
  getLocation(id) { return this.locations.get(id) || null; }
  getAllRecords() { return [...this.records.values()]; }
  getAllNPCs() { return [...this.npcs.values()]; }

  getRelationshipsFor(id) {
    return this.relationships.filter(r => r.subject === id || r.object === id);
  }

  getTotalRecordCount() {
    return this.manifest ? this.manifest.records.length : 0;
  }

  validate() {
    const warnings = [...this.errors];
    for (const rel of this.relationships) {
      const subjectExists = this.records.has(rel.subject) || this.npcs.has(rel.subject) || this.locations.has(rel.subject);
      const objectExists = this.records.has(rel.object) || this.npcs.has(rel.object) || this.locations.has(rel.object);
      if (!subjectExists) warnings.push(`VALIDATION: Unknown subject ${rel.subject}`);
      if (!objectExists) warnings.push(`VALIDATION: Unknown object ${rel.object} referenced in ${rel.source}`);
    }
    return warnings;
  }
}
