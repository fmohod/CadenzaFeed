# /betatest/ — the world (V0: the Houston Sandbox) and CAIN

**Status: V0 built 2026-09-03.** This folder is the working home of the live game. The
earlier proof of concept at `/game/` is V1 and is kept only because its
`engine/record.js` is the canonical Archive Record builder that everything here still
loads; nothing else in `/game/` is live.

Designed to concurrence with Machine Head (CAMT `AGENTS.md` rule 8, channel #7) on
2026-09-03; the rules below were checked against the CAMT rulebook and the CAS by the
dev session, and the collaborator's output is a proposal, never an authority.

## Two doors, one terminal

| Page | Boots | What it is |
|---|---|---|
| `index.html` | the **world** | the game. CAIN is mounted once and shown when the player uses a computer in the world |
| `terminal.html` | **CAIN** standalone | the same files, booted on their own: the kiosk / browser entry |

There is one implementation of the archive browser. `TerminalOS` runs standalone (it
binds the document) or hosted (it binds nothing; the host feeds it input while it is the
active owner). See `js/system.js`.

## The dependency direction

```
content/            (data: world.json, spaces/, npcs/)
   ↓
world/              (simulation: engine, input, renderer, dialogue, save)
   ↓
world/terminal-host.js   (the seam)
   ↓
js/ + css/          (CAIN: services, screens, Interface Packs, Deployments)
   ↓
/game/engine/record.js → /NNNN/index.html   (Archive Records; the ONLY HTML-aware code)
```

CAIN never depends on the world. The world never touches `TerminalOS` directly. The host
translates: `open({sourceId})` / `close()` on one side, `terminal.opened` /
`terminal.closed` on the event bus on the other.

## One input owner

`world/input.js` turns keyboard and touch into six actions — UP, DOWN, LEFT, RIGHT,
INTERACT, BACK — and routes them to exactly one owner: `world` or `terminal`. The other
owner receives nothing. The engine never learns which device produced an action.

Three invariants of the seam, frozen 2026-09-03 (Machine Head's review of `baee316`):

1. **TerminalHost owns all input into the terminal while it is open. CAIN never listens
   above its own display surface.** No CAIN screen may add a `document` or `window`
   listener; the host feeds `handleKey()` and `handleClick()` and nothing else does.
2. **When CAIN gains a text-entry control, focus moves into the control and normal
   browser text input takes precedence** over action translation. Today no such control
   exists; the router already passes unmapped keys through untouched. Do not solve this
   early; do not violate it when the day comes.
3. **Transient UI state is never part of player state.** The save holds `space`, `x`,
   `y`, `facing` and `events[]`. It never holds a CAIN screen, CAIN focus, an open menu,
   a dialogue box or the overlay. A reload while CAIN is open boots the world cleanly.

## Content model

- A **Space** (`content/spaces/<id>.json`, `id: "space:<slug>"`) is playable geometry: a
  tilemap (rows of single-character codes; the vocabulary is in `world/space.js`), plus
  `spawns[]`, `exits[]`, `interactables[]` and `npcs[]` placements — every one with a
  stable local id (`spawn:…`, `exit:…`, `terminal:…`, `examine:…`).
- A **Place** is a real registry entity and **nothing here authors one.** Owner ruling
  2026-09-03: *"always talking about real places … no double work making locations for
  the game come from somewhere else."* `content/places.json` is written by CAMT
  (`jobs/publish.py`, target `places`, from `core.world_places`) and holds every active
  location entity at `publication: public`: `entity_id`, `slug`/`slugs`, `name`/`aliases`,
  `coordinates`, `address`, `verification`, and `parent`/`kind` when the registry records
  them (the declared hierarchy: region → campus → building → room/zone; physical /
  virtual / hybrid). Never hand-edit it; edit the archive. A location's `notes` never
  travel.
- **Bindings** in `content/world.json` are the join: `{ place: <slug>, space: <id> }`.
  A Space with no binding is fiction and is labelled `canon: fiction`. A Space never
  knows the registry exists. **Coordinates anchor a place to reality; they never define
  playable geometry.**
- A **Neighborhood** groups spaces and carries an approximate anchor for orientation,
  until a region node exists in the registry to bind it to.
- The first in-world consumer of `places.json` is the city map on the office wall
  (`examine:city-map`, `list: "places"`): it lists the public places by name.

## Real places from OpenStreetMap geometry

The first real area is **Discovery Green** (owner's pick, 2026-09-03). Its space is
**generated, not drawn**:

1. `content/geo/<slug>.osm.json` — vendored OpenStreetMap data (park boundary, water,
   gardens, paths, buildings, tree rows, named features), fetched once by a session and
   committed with attribution. **© OpenStreetMap contributors, ODbL.** The attribution
   travels in the file and in the generated space's `source` block; keep it.
2. `tools/space_from_osm.py <slug>` — offline and deterministic. Projects the boundary to
   a 5 m tile grid, rasterises roads, the park, water (`~`), garden beds (`g`), paths,
   buildings, tree rows, and turns every named OSM node inside the park into an
   `examine:` point. Writes `content/spaces/<slug>.json`. Never hand-edit the map: edit
   the geometry or the generator and rerun.
3. `world.json` binds the space to its registry place by slug
   (`discovery-green` → `space:discovery-green`), and the space is `canon: documentary`.

Coordinates still anchor; the map is a rasterisation and is free to be wrong in the ways
a game needs (tile size, simplification, no interiors). Neighborhood `downtown` is
hand-authored until a region node exists in the registry.
- An **NPC** (`content/npcs/<id>.json`, `id: "npc:<slug>"`) has a name, a sprite colour
  and an ordered `dialogue[]` list; the first entry whose `if` conditions all hold wins.
  Predicates today: `talked_to`, `visited`, `terminal_opened`. Unknown predicates never
  match, so content may run ahead of the engine safely.

Content the loader cannot validate is skipped with a console warning; the world keeps
running with a hole in it. It never crashes on content.

## Rules this build enforces (from the CAMT rulebook and the CAS)

- **Publication gate.** The game is public. It may only carry places, people and
  organizations that are `publication: public` in the registry or already published in
  an article. Nothing in `content/` may name a place the archive holds as
  `internal_only`. V0 depicts no real address; the two interiors and the block are
  fiction (`canon: fiction`).
- **Identity.** Opaque `ent_` ids are identity; slugs are addresses (CAMT ADR-0002). A
  real place carries its registry slug and `entity_id`; game-only spaces and NPCs are
  game content with game ids, not registry entities. No hand-minted codes for real places.
- **Registry access is CAMT's** (`core.py`). Data reaches this repo the way the calendar
  does: a CAMT publish job writes a derived, gated JSON file. That job is post-V0.
- **No HTML scraping** (DevNotes RULES 3): Records come through `ArchiveRecordBuilder`.
- **Save = player state only, append-only** (RULES 6): `{ player, events[] }` in
  localStorage under `cadenza-arthouse-world`; visited / talked / terminal flags are
  derived by replaying `events[]`.
- **Consent.** A real person becomes an NPC only with the owner's per-person consent; a
  friend's animal only with the friend's recorded yes. V0's NPC is `npc:test-001`,
  `canon: developer-test`, on purpose. The player's home is a fictional Archive Office.
- **Names.** "Cadenza Arthouse", always both words. The games division has no name yet
  and this folder does not mint one.
- **Vanilla HTML/CSS/JS, no build step.**

## Acceptance (V0) — passed 2026-09-03, layer 2

Run against `http://localhost:8090/betatest/?dev` with a static server at the repo root.
Keys were dispatched as DOM `KeyboardEvent`s on `document` (the same listener a physical
keyboard reaches) because the automated browser pane was hidden and delivered keys
unreliably; the simulation was ticked deterministically. **A hands-on layer-3 pass on a
real keyboard and a real phone is still the owner's to do** (CAMT `AGENTS.md` rule 14).

1. Load → character in the Archive Office at the default spawn.
2. Walk; collide with the terminal tile (`P`) and walls; HUD hint names the target.
3. INTERACT at the terminal → overlay shows, input owner = `terminal`, world paused.
4. Arrow keys while CAIN is open move CAIN's focus and the player does not move.
5. ENTER skips the boot; the Home menu focuses "Enter Archive Terminal"; ENTER lists
   **13 records** ("13 NODES ONLINE"); ENTER opens `[0001]` and renders 9 body blocks.
6. BACK ×3 → Home is the root → the overlay closes, owner = `world`, player on the same
   tile facing the same way, CAIN's display is empty.
7. Open/close ×3: one overlay, one OS, zero leftover DOM.
8. Exit the office → the block at `spawn:from-office`; walk to the NPC; talk; the
   conditional branch changes after the terminal was used; save log records
   `SpaceEntered`, `TerminalOpened`, `TerminalClosed`, `NPCTalked`.
9. Enter the Corner Store, leave, return to the office through the front door; reload
   restores space, tile and facing from the save.
10. `?touch` shows the d-pad; a d-pad tap moves one tile.
11. Missing content: with the NPC file removed the world loads, warns, and the block has
    no NPC.
12. Offline: with the server stopped after one load, the page and CAIN still load from
    the service worker (`sw.js`, network-first, cache fallback).
13. Refresh at every state: reload in the office, on the street, mid-dialogue, in the
    store and **with CAIN open** — each time the world boots cleanly at the saved tile
    with no overlay reconstructed.
14. Viewports: desktop, phone portrait, phone landscape — the canvas fills the usable
    viewport, the d-pad and A/B stay clear of the dialogue box, no page scroll.

**Updating the game.** `sw.js` is network-first, so an online visit always gets the new
files, and the `?v=` query on a script tag is its version. Bump it when a file changes;
bump the `CACHE` name in `sw.js` when the shape of the cache should be discarded. The
first failure Machine Head predicts on a real phone is a stale cached script; if that
happens, that is the fix, not abandoning offline.

## A real clock at real places

Owner, 2026-09-03: *"give the game a real clock to match the real world clock so that the
scene and ambiance change to match actual daylight, dusk, night."* `world/daylight.js`
computes the sun's altitude over the space's coordinates for the current instant (the
standard low-precision solar position; arithmetic, offline, no service) and names the
phase: day above 6°, golden hour, dusk, twilight, night below −12°. The renderer tints the
scene by phase (interiors at half strength: a window, not a sky), recomputed every 30 s.
Each neighborhood carries an IANA `timezone` so the HUD shows the place's own clock.
`?time=HH:MM` (local at the place) overrides for testing.

## Real weather at real places

Owner, 2026-09-03: *"if i load the game right now it should match the weather of the
location in the game to what's happening IRL."* `world/weather.js` asks
[Open-Meteo](https://open-meteo.com) (free, no key; **"Weather data by Open-Meteo.com",
CC BY 4.0**) for the current conditions at the space's anchor: a generated space's own
centre, else its neighborhood's anchor; interiors have no sky. The renderer draws rain,
drizzle, storm (with lightning), fog, snow, cloud and night; the HUD says what it is doing
and where the reading is for. `?weather=rain|storm|drizzle|fog|snow|cloudy|night|clear`
overrides for testing.

Three honest limits. It runs in the visitor's browser and reveals the public place's
coordinates, never the visitor's. It is **not a CAMT sensor**: CAMT's own weather sensing
is a parked entry in CAMT `FUTURE_IDEAS.md` (a local station first, because an API goes
quiet in the storm it exists to warn about). And it fails soft: no network means no
overlay and the dev line says `weather: unavailable`, never "clear".

## Getting around

The bus stop on the community block (`type: "travel"`) is a chooser built at runtime from
the bindings: every real place that has a playable space, by its registry name, and
"Stay here". Nothing lists destinations by hand; bind a place and it appears. Each
generated park has a bus stop back. The dialogue box gained a menu mode for this
(`DialogueBox.choose`: UP/DOWN, INTERACT picks, BACK cancels), which is the first piece
of the options menu below.

## Time: places on a timeline

Owner, 2026-09-03: versions of the same place in different periods, as in Chrono Trigger,
so that *"locations exist accurately on a timeline, later on if two locations exist at a
certain time you can possibly travel between them."* The model:

- A binding is a point or span on the timeline: `era` is `present` (unset) or an ISO
  date, and `valid: {from, to}` is the span the space stands for. One place binds several
  spaces, one per time. `bindings[].era` is no longer reserved; it is live.
- The player's time is player state (`state.era`, saved). The **bus stop** lists places
  whose binding covers that date, so two places that both existed then can be reached
  from each other. The **gate** (`type: "timegate"`, one tile from every generated bus
  stop) lists the other times of *this* place and drops you on the same tile.
- A dated space gets **that day's sun** at the current hour (`Daylight.onDate`) and
  **that day's weather** from Open-Meteo's archive (ERA5 reanalysis, hourly, 1940 on),
  labelled as reanalysis, never as a reading. The renderer adds an era tint and grain.
- **Three rules, frozen 2026-09-03** (Machine Head's review of `01951bf`):
  1. `present` is a temporal *state*, not a date. It never participates in date
     arithmetic and is never rewritten as today's ISO date. "Show me this place now" and
     "show me this place on 2026-09-03" are different requests even when they render the
     same.
  2. `present` is dynamic on load: a save whose time is `present` resolves against the
     present at the moment it is loaded. An immutable snapshot is what an ISO date is for.
  3. Temporal precision is data, and when several bindings cover a requested time the
     **most specific applicable binding wins**: an exact date over a month, a month over a
     year, a year over an open-ended span (`Engine.bestBinding`). A month-precision
     reconstruction is honest data, not inferior data.
- A past version is generated from today's geometry plus an **era overlay**
  (`content/geo/<slug>.<era>.json`: `remove`, `rename`, `examine`, `date`,
  `date_precision`, `valid`, `sources`), `canon: archive-reconstruction`. Every entry
  carries its source. The first: **Pasadena Town Square Mall, March 1982**, the month it
  opened; the grand-opening *day* is not on record in any source reached, so the era is
  dated at month precision and the overlay says so. Set the day in one field when a
  dated source names it.

## Roadmap the owner has stated (2026-09-03) — recorded, not built

- **Input devices and an options menu.** VR headset controllers, mouse, keyboard, touch,
  and the **flute** (CAMT menu 31 already turns a played flute into events). The seam
  exists: `world/input.js` is the single input owner and every device is just another
  producer of the six actions, so a new device is a new binder, not a new game. What is
  missing is a settings screen to choose and configure them; CAIN's Display Settings is
  the pattern. VR also needs a renderer that is not this canvas; the engine does not care.
- **Time travel** is built in its first form (see *Time*, above); what remains is content
  for more times and places, historical geometry where today's is wrong, and the rules
  for what the archive itself says was there once its own record (1999 on) is reached.

## Not in V0 (deliberately)

Quests, story, records placed in the world, real NPC identities, music, art assets beyond
procedural tiles, the era switch, the options menu. Each waits for the sandbox to be walked
by the owner first.
