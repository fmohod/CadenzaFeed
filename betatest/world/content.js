// ContentLoader — the world is data. This reads it, validates it, and skips what
// is broken. ARCHITECTURE_PRINCIPLES 1 (engine discovers content) and 13 (never
// crash on missing content): a bad file is a warning in the console and a hole
// in the world, never a blank page.
//
//   content/world.json          the manifest: start, neighborhoods, places, spaces[], npcs[]
//   content/spaces/<id>.json    a playable Space (tilemap + spawns + exits + interactables + npc placements)
//   content/npcs/<id>.json      an NPC definition (name, sprite, conditional dialogue)
//
// A Place (real-world anchor: slug, entity_id, coordinates) POINTS AT a Space; a
// Space never knows the registry exists. Coordinates anchor a place to reality;
// they never define playable geometry (Machine Head, 2026-09-03).
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
        for (const p of manifest.places || []) {
            if (p && p.slug && p.space) content.places.set(p.slug, p);
            else warn('place without slug/space skipped');
        }

        const base = manifestPath.replace(/[^/]*$/, '');
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
        for (const [slug, place] of content.places) {
            if (!content.spaces.has(place.space)) warn(`place ${slug} points at unknown space ${place.space}`);
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
