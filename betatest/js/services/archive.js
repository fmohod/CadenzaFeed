// CAIN OS — Archive Service
// Discovers article folders and turns each into a full, typed Archive Record via
// the canonical ArchiveRecordBuilder (game/engine/record.js) — the ONE HTML-aware
// component in the project (RULES.md). CAIN never re-parses article HTML its own
// way; it consumes Records, so the dossier reader renders clean body blocks instead
// of leaking the site masthead/footer.

class ArchiveService {
    constructor() {
        this.cache = [];       // [{ id, title, record }]
        this.isSynced = false;
        this.isFetching = false;
    }

    async sync() {
        if (this.isSynced) return this.cache;
        if (this.isFetching) return this.cache;
        this.isFetching = true;

        // Contiguous discovery: 0001, 0002, … until a folder is missing.
        // ArchiveRecordBuilder.build() resolves paths via CADENZA_CONFIG.archiveRoot
        // and returns null on a 404, which marks the end of the range.
        let id = 1;
        while (true) {
            const folderId = String(id).padStart(4, '0');
            let record = null;
            try {
                record = await ArchiveRecordBuilder.build(folderId);
            } catch (e) {
                console.warn(`[Service] Build halted at record ${folderId}`, e);
            }
            if (!record) break;
            this.cache.push({ id: folderId, title: record.title, record });
            id++;
        }

        this.isFetching = false;
        this.isSynced = true;
        return this.cache;
    }

    // Returns the cache entry { id, title, record } for a 4-digit folder id.
    getRecord(id) {
        return this.cache.find(item => item.id === id);
    }
}

// Instantiate globally so screens can use it
const CAIN_ArchiveService = new ArchiveService();
