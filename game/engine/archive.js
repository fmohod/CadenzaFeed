// ARCHIVE LAYER
// Knows what exists. The website IS the database.
//
// Records are NOT stored as separate files. They are read directly from the
// real article folders (/0001/index.html, /0002/index.html, ... resolved against
// archiveRoot) by parsing the standardized <meta name="game-*"> tags each article
// carries. Publishing a new article with those tags makes it appear automatically.
//
// The engine never hardcodes which articles exist. It discovers them — using the
// same GitHub API the website homepage already uses — then reads their metadata.
//
// NPCs and Locations are game-only constructs with no home in journalism, so they
// remain as JSON under game/content/.

class Archive {
  constructor(opts = {}) {
    this.manifest = null;
    this.records = new Map();
    this.npcs = new Map();
    this.locations = new Map();
    this.relationships = [];
    this.loaded = false;
    this.errors = [];
    this.GITHUB_USER = 'fmohod';
    this.GITHUB_REPO = 'CadenzaFeed';

    // Where the article archive lives. '' = same-origin root, so the app reads
    // local files locally and deployed files in production — and stays correct
    // whether served from /game/ or a subdomain root. PlatformConfig will supply
    // this in Step 2; defaulting here keeps the change additive.
    this.archiveRoot = opts.archiveRoot
      ?? (typeof window !== 'undefined' && window.CADENZA_CONFIG?.archiveRoot)
      ?? '';
  }

  async load(manifestPath = 'manifest.json') {
    // Manifest carries the game-layer registry (NPCs, locations, eras) and a
    // fallback list of record IDs in case content discovery fails.
    try {
      const res = await fetch(manifestPath);
      if (!res.ok) throw new Error(`Manifest not found at ${manifestPath}`);
      this.manifest = await res.json();
    } catch (e) {
      this.errors.push(`ARCHIVE ERROR: Cannot load manifest — ${e.message}`);
      this.manifest = { records: [], npcs: [], locations: [] };
    }

    // Discover article folders dynamically, then read each as a Record.
    const recordIds = await this._discoverRecordIds();

    const loads = [
      ...recordIds.map(id => this._loadRecordFromArticle(id)),
      ...(this.manifest.npcs || []).map(id => this._loadNPC(id)),
      ...(this.manifest.locations || []).map(id => this._loadLocation(id)),
    ];

    await Promise.all(loads);
    this._buildRelationshipIndex();
    this.loaded = true;
    return true;
  }

  // Dynamic discovery: GitHub API → localStorage cache → manifest fallback.
  // The engine never knows that "0008" exists — it asks what's there.
  async _discoverRecordIds() {
    const cacheKey = 'cadenza-record-ids';

    try {
      const apiUrl = `https://api.github.com/repos/${this.GITHUB_USER}/${this.GITHUB_REPO}/contents/`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const items = await res.json();
        const ids = items
          .filter(i => i.type === 'dir' && /^\d{4}$/.test(i.name))
          .map(i => i.name)
          .sort();
        if (ids.length) {
          try { localStorage.setItem(cacheKey, JSON.stringify(ids)); } catch (e) {}
          return ids;
        }
      }
    } catch (e) {
      this.errors.push(`ARCHIVE WARNING: Folder discovery via API failed — ${e.message}. Using fallback.`);
    }

    // Cached list from a previous successful discovery
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (cached && cached.length) return cached;
    } catch (e) {}

    // Last resort: the manifest's seed list
    return this.manifest.records || [];
  }

  // Read one article's HTML and build a Record from its meta tags.
  // DOMParser does not execute scripts, so this only reads metadata — safe.
  async _loadRecordFromArticle(id) {
    try {
      // Root-absolute via archiveRoot ('' = same origin) — unambiguous at any
      // serve depth or subdomain. Articles live at the deployment root.
      const res = await fetch(`${this.archiveRoot}/${id}/index.html`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const meta = (name) =>
        doc.querySelector(`meta[name="${name}"]`)?.content ||
        doc.querySelector(`meta[property="${name}"]`)?.content ||
        null;

      // Only articles that opt in become collectible Records.
      if (meta('game-record') !== 'true') return;

      const title = doc.querySelector('title')?.textContent?.trim() || `Record ${id}`;
      const date = meta('date');
      const tags = (meta('game-tags') || '')
        .split(',').map(s => s.trim()).filter(Boolean);

      const record = {
        schema: 1,
        id: `record:${id}`,
        articleId: id,
        title,
        date,
        era: meta('game-era') || (date || '').slice(0, 4) || 'unknown',
        canon: 'historical',
        section: meta('article:section'),
        location: meta('game-location'),
        tags,
        summary: meta('description'),
        url: `https://cadenzaarthouse.com/${id}/`,
        relationships: meta('game-location')
          ? [{ type: 'located_at', object: `place:${meta('game-location')}` }]
          : [],
        game: {
          inGameTitle: `Record ${id} — ${title}`,
          flavorText: meta('game-flavor') || meta('description') || 'A recovered fragment of the archive.',
          location: meta('game-location'),
        },
      };

      this.records.set(record.id, record);
    } catch (e) {
      this.errors.push(`ARCHIVE WARNING: Could not load article ${id} — ${e.message}`);
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

  // Records whose game-location matches a neighborhood slug.
  getRecordsByLocation(slug) {
    return [...this.records.values()].filter(r => r.location === slug);
  }

  getRelationshipsFor(id) {
    return this.relationships.filter(r => r.subject === id || r.object === id);
  }

  getTotalRecordCount() {
    return this.records.size;
  }

  validate() {
    const warnings = [...this.errors];
    for (const [, record] of this.records) {
      if (!record.date) warnings.push(`VALIDATION: ${record.id} missing date`);
      if (!record.location) warnings.push(`VALIDATION: ${record.id} has no game-location`);
    }
    return warnings;
  }
}
