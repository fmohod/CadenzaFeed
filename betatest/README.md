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

## Content model

- A **Space** (`content/spaces/<id>.json`, `id: "space:<slug>"`) is playable geometry: a
  tilemap (rows of single-character codes; the vocabulary is in `world/space.js`), plus
  `spawns[]`, `exits[]`, `interactables[]` and `npcs[]` placements — every one with a
  stable local id (`spawn:…`, `exit:…`, `terminal:…`, `examine:…`).
- A **Place** (in `content/world.json`) is a real-world anchor: `slug`, `entity_id`,
  `coordinates`, and the space it opens. A place points at a space; a space never knows
  the registry exists. **Coordinates anchor a place to reality; they never define
  playable geometry.**
- A **Neighborhood** groups spaces and carries an approximate anchor for orientation.
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

## Not in V0 (deliberately)

Quests, story, eras, records placed in the world, real NPC identities, the CAMT export
job, OSM-derived geometry, music, art assets beyond procedural tiles. Each waits for the
sandbox to be walked by the owner first.
