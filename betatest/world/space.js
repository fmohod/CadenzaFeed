// Space — a playable area: a tilemap plus the things standing on it.
//
// Tile codes (shared vocabulary; a space may extend `passable`):
//   .  floor           W  wall           w  window (in a wall)   D  door (passable)
//   R  road            -  road centre    S  sidewalk/path        G  grass
//   p  paved plaza     g  garden bed     ~  water                T  tree
//   F  fence           B  building face  X  void
//   =  desk/table      #  shelf          C  counter              P  computer
//   Z  bed             M  rug
// Passability is a property of the code, not of the picture: the renderer may
// draw a tile however it likes; walkability comes from this table only.
const DEFAULT_PASSABLE = new Set(['.', 'D', 'S', 'R', '-', 'G', 'M', 'p']);

const FACING_DELTA = {
    up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
};

class Space {
    constructor(data, npcDefs) {
        this.id = data.id;
        this.name = data.name || data.id;
        this.kind = data.kind || 'exterior';
        this.theme = data.theme || (this.kind === 'interior' ? 'interior' : 'street');
        this.canon = data.canon || 'fiction';
        this.era = data.era || 'present';
        this.eraLabel = data.era_label || null;
        this.eraStyle = data.era_style || null;   // { tint: [r,g,b,a], grain: 0..1 } — presentation only
        this.map = data.map;
        this.width = data.map[0].length;
        this.height = data.map.length;
        this.passable = new Set(DEFAULT_PASSABLE);
        for (const c of (data.tiles && data.tiles.passable) || []) this.passable.add(c);
        for (const c of (data.tiles && data.tiles.blocked) || []) this.passable.delete(c);

        this.spawns = new Map((data.spawns || []).map(s => [s.id, s]));
        this.exits = data.exits || [];
        this.interactables = data.interactables || [];
        // NPC placements joined to their definitions; unknown ones were already
        // reported by the loader and are simply absent from the world.
        this.npcs = (data.npcs || [])
            .filter(p => npcDefs.has(p.id))
            .map(p => ({ ...p, def: npcDefs.get(p.id), facing: p.facing || 'down' }));
    }

    tile(x, y) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 'X';
        return this.map[y][x];
    }

    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

    // Can the player stand here? Tiles, then anything solid standing on them.
    walkable(x, y) {
        if (!this.passable.has(this.tile(x, y))) return false;
        if (this.npcAt(x, y)) return false;
        if (this.interactables.some(i => i.x === x && i.y === y && i.solid)) return false;
        return true;
    }

    npcAt(x, y) { return this.npcs.find(n => n.x === x && n.y === y) || null; }
    interactableAt(x, y) { return this.interactables.find(i => i.x === x && i.y === y) || null; }
    exitAt(x, y) { return this.exits.find(e => e.x === x && e.y === y) || null; }

    spawn(id) {
        return this.spawns.get(id) || this.spawns.values().next().value;
    }

    static ahead(x, y, facing) {
        const d = FACING_DELTA[facing] || FACING_DELTA.down;
        return { x: x + d.dx, y: y + d.dy };
    }
}
