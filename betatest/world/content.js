// ContentLoader — the world is data. This reads it, validates it, and skips what
// is broken. ARCHITECTURE_PRINCIPLES 1 (engine discovers content) and 13 (never
// crash on missing content): a bad file is a warning in the console and a hole
// in the world, never a blank page.
//
//   content/world.json          the manifest: start, neighborhoods, places_file, bindings, spaces[], npcs[]
//   content/places.json         WRITTEN BY CAMT (jobs/publish.py, target "places") from the archive
//                               registry: every location entity at publication: public. Never hand-edited.
//   content/spaces/<id>.json    a playable Space (tilemap + spawns + exits + interactables + npc placements)
//   content/npcs/<id>.json      an NPC definition (name, sprite, conditional dialogue)
//
// A Place (registry entity: slug, entity_id, coordinates, parent, kind) is bound
// to a Space by the manifest; a Space never knows the registry exists.
// Coordinates anchor a place to reality; they never define playable geometry
// (Machine Head, 2026-09-03). One source of places, the registry — the owner's
// ruling the same day: real places only, authored once.
class ContentLoader {
    static async load(manifestPath = 'content/world.json') {
        const content = {
            manifest: null,
            spaces: new Map(),
            npcs: new Map(),
            places: new Map(),
            neighborhoods: new Map(),
            warnings: [],
        };
        const warn = (msg) => { content.warnings.push(msg); console.warn('[content] ' + msg); };

        const manifest = await ContentLoader._json(manifestPath);
        if (!manifest || manifest.schema !== 1) {
            warn(`manifest missing or wrong schema at ${manifestPath}`);
            return content;
        }
        content.manifest = manifest;

        for (const n of manifest.neighborhoods || []) {
            if (n && n.slug) content.neighborhoods.set(n.slug, n);
            else warn('neighborhood without slug skipped');
        }

        const base = manifestPath.replace(/[^/]*$/, '');

        // Places come from ONE source: the registry, via CAMT's publish job
        // (places.json). Nothing here authors a place; a missing or malformed
        // file means a world with no places, reported, never a crash.
        content.placesMeta = null;
        if (manifest.places_file) {
            const pj = await ContentLoader._json(`${base}${manifest.places_file}`);
            if (!pj || pj.schema !== 1 || !Array.isArray(pj.places)) {
                warn(`places file ${manifest.places_file} missing or wrong schema; the world has no places`);
            } else {
                content.placesMeta = { generated: pj._generated || null, publication: pj.publication || null, count: pj.places.length };
                for (const p of pj.places) {
                    if (p && p.slug && p.entity_id) content.places.set(p.slug, p);
                    else warn('place without slug/entity_id skipped');
                }
            }
        }
        // The join: which Space represents which Place, in which era. Authored
        // here, by slug (an address the registry owns, ADR-0002), never inside a
        // Space. One place may bind several spaces, one per era; no era means
        // the present. bindings: space → { place, era }; bindingList: all of them.
        content.bindings = new Map();
        content.bindingList = [];
        for (const b of manifest.bindings || []) {
            if (!b || !b.place || !b.space) { warn('binding without place/space skipped'); continue; }
            if (!content.places.has(b.place)) { warn(`binding to unknown or unpublished place ${b.place} skipped`); continue; }
            const entry = { place: b.place, space: b.space, era: b.era || 'present', valid: b.valid || null };
            content.bindings.set(b.space, entry);
            content.bindingList.push(entry);
        }
        const spaceLoads = (manifest.spaces || []).map(async (file) => {
            const data = await ContentLoader._json(`${base}spaces/${file}.json`);
            const err = ContentLoader.validateSpace(data);
            if (err) { warn(`space "${file}" skipped: ${err}`); return; }
            content.spaces.set(data.id, data);
        });
        const npcLoads = (manifest.npcs || []).map(async (file) => {
            const data = await ContentLoader._json(`${base}npcs/${file}.json`);
            const err = ContentLoader.validateNpc(data);
            if (err) { warn(`npc "${file}" skipped: ${err}`); return; }
            content.npcs.set(data.id, data);
        });
        await Promise.all([...spaceLoads, ...npcLoads]);

        // Cross-references: report, do not fail.
        for (const [id, space] of content.spaces) {
            for (const ex of space.exits || []) {
                if (!content.spaces.has(ex.to && ex.to.space)) warn(`${id} exit ${ex.id} points at unknown space ${ex.to && ex.to.space}`);
            }
            for (const np of space.npcs || []) {
                if (!content.npcs.has(np.id)) warn(`${id} places unknown npc ${np.id}`);
            }
        }
        for (const [spaceId] of content.bindings) {
            if (!content.spaces.has(spaceId)) warn(`binding names unknown space ${spaceId}`);
        }
        return content;
    }

    static validateSpace(s) {
        if (!s) return 'not found or not JSON';
        if (s.schema !== 1) return `schema ${s.schema} unsupported`;
        if (typeof s.id !== 'string' || !s.id.startsWith('space:')) return 'id must be "space:<slug>"';
        if (!Array.isArray(s.map) || s.map.length === 0) return 'map must be a non-empty array of strings';
        const w = s.map[0].length;
        if (!w) return 'map rows must not be empty';
        for (let i = 0; i < s.map.length; i++) {
            if (typeof s.map[i] !== 'string' || s.map[i].length !== w) return `map row ${i} is not ${w} characters`;
        }
        if (!Array.isArray(s.spawns) || s.spawns.length === 0) return 'at least one spawn required';
        for (const sp of s.spawns) {
            if (!sp.id || !Number.isInteger(sp.x) || !Number.isInteger(sp.y)) return `spawn ${sp.id || '?'} needs id, x, y`;
        }
        for (const list of ['exits', 'interactables', 'npcs']) {
            if (s[list] && !Array.isArray(s[list])) return `${list} must be an array`;
            for (const it of s[list] || []) {
                if (!it.id || !Number.isInteger(it.x) || !Number.isInteger(it.y)) return `${list} entry needs id, x, y`;
            }
        }
        return null;
    }

    static validateNpc(n) {
        if (!n) return 'not found or not JSON';
        if (n.schema !== 1) return `schema ${n.schema} unsupported`;
        if (typeof n.id !== 'string' || !n.id.startsWith('npc:')) return 'id must be "npc:<slug>"';
        if (typeof n.name !== 'string' || !n.name) return 'name required';
        if (!Array.isArray(n.dialogue) || n.dialogue.length === 0) return 'dialogue must be a non-empty array';
        for (const d of n.dialogue) {
            if (!Array.isArray(d.lines) || d.lines.length === 0) return 'every dialogue entry needs lines[]';
        }
        return null;
    }

    static async _json(url) {
        try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.warn(`[content] ${url}: ${e.message}`);
            return null;
        }
    }
}
