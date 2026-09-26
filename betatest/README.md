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
  derived by replaying `events[]`. Owner ruling, log 20260908-06: saves stay on the
  player's own machine, *"just reference points to know where in the timeline"* they
  are; nothing personal reaches a server, and a private window losing its save is
  accepted. The world says so once, on the first visit in a browser (the beta notice).
- **Consent.** A real person becomes an NPC only with the owner's per-person consent; a
  friend's animal only with the friend's recorded yes. V0's NPC is `npc:test-001`,
  `canon: developer-test`, on purpose. The player's home is a fictional Archive Office.
- **Privacy** (owner ruling, log 20260912-02, 2026-09-12). The player's home is **not on
  Earth**: the Archive Office and the station around it sit in low Earth orbit, with no
  coordinates, no weather and a UTC clock. The only Earth places in the game are the public
  registry entities in `places.json`, each asked for by name; *"I don't want my local
  Wendy's to appear either, because that's kind of creepy … I don't want people to figure
  out where I live."* So: nothing is ever added to the world because it is near him, no
  neighborhood anchor is ever a private point (each is a public park), and the fictional
  *Third Ward block* that used to hold the office is now the station (same id, same
  layout, different theme) so no fiction stands in for a real neighborhood.
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

## On a phone

Owner, 2026-09-03: controls on screen *"only when i need to move the avatar."* So the
d-pad and A/B show only in world mode, hide whenever a dialogue, a menu or the terminal
owns the screen, and fade after four seconds without a touch. In their place: tapping the
dialogue box advances it, tapping a menu row picks it, and the hosted terminal carries a
`⏻ leave` button because a phone has no Escape key (standalone CAIN never shows it). The
dialogue sits under the HUD so it never covers the controls.

## The studio's animals, from one painter

Owner ruling, log 20260907-02: Flutie Cats and this world share **one asset pool**. The
seven real animals (Rocco, Star, Ella, Xica, Elvis, Randy Boy, Smokey; Lulu waits on
consent) are drawn by one parametric pixel painter that lives in CAMT `jobs/flute.py`.
CAMT publishes it as `/platform/sprites/critters.js` (derived; never edit the export),
and `world/renderer.js` draws the player and any NPC whose sprite names a `critter` with
it, flipped for left. The player walks as **Rocco** by default (the first character
everyone gets, the owner's ruling) and can change at the **mirror** in the office; the
choice is player state and is saved. Every drawn detail is an accuracy constraint from
life (Flutie Cats README): Rocco has no tail, Star grins, Xica's tail is a question mark.

Canon timeline for later: in the real-world universe an animal exists in-game only within
its real lifetime, which the timeline model already supports (a placement is a binding
with a `valid` span).

## The party: four Watchers on one Wi-Fi (owner, log 20260923-03; built 2026-09-26)

*"Four people can exist within Universe B locally at the same time ... on the same Wi-Fi
... a max party of four ... no communication, maybe they can only communicate with NPCs."*
Built as a **transient door in CAMT**, `jobs\party.py` (`core.SERVICES["party"]`, port
8747, bound to the LAN, open only while he runs it). It serves this folder, `/platform/`
and `/game/engine/record.js` straight from the CadenzaFeed working tree and nothing else,
and relays where each player is. The game side is `world/party.js`: it wakes only when
`/party/info` answers (on the public site that is a 404, so nothing changes there), joins a
slot, posts its own room, tile, facing, avatar and time ten times a second when they
change, and listens on a server-sent stream for the others. The renderer draws the other
Watchers as faint figures in the same room and time; they never block a tile, never speak,
never trigger anything, and NPCs stay local to each device (Randy wanders differently on
every phone). A fifth join is refused with "party full"; a slot that goes quiet for fifteen
seconds is free again; the door holds nothing on disk and forgets everything when it
closes. No account, no chat, no save, no code: it exists only on his Wi-Fi while he says so.
To play: run the job, scan the QR it prints, everyone lands in the same world.
*Not this:* the online version (a relay somewhere public) is the "what that actually takes,
if that takes servers" he deferred; the ship's world map does not yet show other ships.

## The co-op side quest: four timelines by party size (design, not built)

Owner, 2026-09-26, with the Dan Harmon story circle as the frame (his link, boords.com):
one side quest whose timeline differs by how many are playing, one to four, *"a custom
storyline for each version or mode that you're playing in"* (log 20260923-03). The circle's
eight steps are the spine of every version — You, Need, Go, Struggle, Find, Suffer, Return,
Change, the top half order and the bottom half chaos — and the party size decides which
timeline the Go step drops the party into, so the same quest is four different stories
that all come home changed. Proposed shape, his to rule on: the quest is *one* Houston
event on record (the archive is the source, so it is factual); a solo Watcher relives it
as it happened; two split it into two viewpoints that must meet at Find; three and four add
timelines on either side of it, so that Struggle needs *"somebody to flip a switch
somewhere ... at one time"* (his words) in another year for the others to get through.
The engine already has the time layer and the party; what it needs is quest state shared
through the party door and a first event chosen by him. Nothing minted here.

### What already fits the circle (read 2026-09-26 from `F:\Apps\Flutie Cats\CHARACTERS.md`,
### his logs 20260907-02 and 20260925-03/-04/-05, and the Flutie Cats runner's beats)

The canon is real animals and real events, so every arc below is factual, and the steps are
Harmon's: You · Need · Go · Struggle · Find · Suffer · Return · Change.

- **Smokey, the household's origin — a complete circle already.** You: a kitten on a
  construction site, 2021. Need: warmth, food. Go: the machines, the night. Struggle: the
  site. Find: someone starts leaving food out. Suffer: nine lives, the cold. Return: a
  friend of Valerie's carries her out. Change: she becomes the mama. The Flutie Cats runner
  ("Before the House") already plays Go → Return; what Universe B can add is the second
  circle: the **travel trailer chapter** with Rocco, the litter, Ghost — *"the origin of the
  household"* and the only place her story and Rocco's overlap.
- **Randy, Charlotte → Randy — a complete circle.** You: a cousin's "girl" cat in Livingston,
  carried around. Need: to be fed. Go: into Frankie's care. Struggle: worms, too small.
  Find: deworming, food. Suffer: neutered, loses "Charlotte". Return: a big healthy handsome
  boy. Change: the suit, the flute, the author's stand-in. Livingston is already a named
  place (log 20260914-01).
- **Rocco — a circle with a broken Return.** The tail taken *"before he was able to make
  decisions for himself"*; dead because *"he made decisions for himself and tried to cross the
  street."* He exists only within his years, and he and Randy never met, so a Watcher reaches
  him only through the time layer. That is the tragedy the time machine is for.
- **Ella — a comic circle that never closes.** Need: a new side hustle. Go, Struggle, Find,
  then Suffer by her own carelessness, Return, and *no* Change; repeatable forever, with Star
  as the accomplice who only misbehaves in Ella's company. Side quests, not the main line.
- **Elvis — Change already happened offstage** (*"a son of a bitch"*, now *"good cat"*), with a
  mystery background and Missy, who ran. A quest hook, not a quest.
- **Xica and Ghost — the rule about the door.** Ghost's death is why the cats come in at night;
  Xica is the kitten who tests the rule two doors down. A Suffer step for the household, to be
  told as gently as the runner tells the site.
- **Star** — arrived through a Christmas photo shoot with a named real person; thin material,
  and consent decides whether the person appears.

**Rulings, 2026-09-26 (owner, in session):**
- **Quest one is Smokey's household origin. Watchers play as the animals.**
- **Humans are never named in Universe B.** The animals call people *"the humans"* or *"the
  people"*, and **each animal has its own word for them**, which can change by region — his
  reference is *The Walking Dead*, where nobody says "zombie" and every group has its own
  word. So the consent question for real people mostly dissolves: no human appears by name;
  the people in these stories are whichever word the animal telling it uses. (The words
  themselves are his to give; see the open questions.)
- **The years, as he gave them:** Rocco came home in **March 2016** from the Houston animal
  shelter on Canino Road; he died at the **end of September 2024** (exact day pending: he
  told Brad Stewart by text). The **travel trailer chapter ran February 2020 to about summer
  2021**, at a private address that stays out of the game; then he left Rocco with Johnny and
  lived out of his car between Texas, Denver and California. Randy's first kitten pictures in
  Pasadena are from **22 October 2024**, so Randy arrived after Rocco died, which is why they
  never met. Ghost's date of death is pending. Smokey's litter belongs to the trailer years.
- **Where and how (his agreement pending on 6 to 8):** the household as fictional interiors
  bound to no place; progress per Watcher in the browser save, shared through the party door
  only for that session; finishing an animal's arc unlocks that animal in the mirror.

**Party-size timelines that fall out of this:** the household's origin spans years, so one
player relives one thread, two play Smokey and Rocco in the trailer years, three add the
litter and Ghost, four add Randy's arrival — each Watcher as a different animal in a
different year (his Chrono Cross party control), meeting at Find, which is the trailer.

## Randy Boy, the wandering NPC (owner, log 20260925-07; built 2026-09-26)

*"He's an NPC that just casually walks around the world, every now and again he might lift
his flute up and play something ... you can go up and talk to him and right now the only
response you get is: Randy the cat looks at you and then plays a little flute diddy ...
he'll disappear at random and leave the room ... just a wandering entity NPC."* That is
`world/roamer.js`, and any NPC whose definition carries `wander` is one. Randy
(`content/npcs/randy.json`) is not placed in any space: when the player enters a room he
is there six times in ten, otherwise he turns up within about forty seconds; he takes a
step every second or two on walkable tiles, never onto a door, a stop or the player; every
ten to thirty seconds he lifts the flute for a couple of seconds (a five-note pentatonic
figure through WebAudio, heard within eight tiles once the page has had a gesture, a note
glyph rising over him); after one to two minutes he leaves, and the cycle starts over in
whatever room the player is in next. Talking to him: two lines by his instruction, no
dialogue tree yet, then the tune, then he walks on. `NPCTalked` goes in the save log like
any NPC. The body is the shared painter's Randy; the **business suit** is a game-side
overlay (jacket, collar, tie) until the production suit art comes through the Flutie Cats
asset route. Aboard the ship there are no rooms, so no roamers. The four-player local
multiplayer he also asked for (log 20260923-03) is not this; it is recorded, not built.

## The address gate

Owner, same log: `/betatest` sits behind the same Cloudflare gate as `/flutiecats`. A
Worker on the route checks a `GATE_CODE` secret; the right code sets a cookie for the
path, anything else sees the lock page. Deployed by CAMT `shell\cloudflare-gate.ps1
-Preset betatest`, which prompts for the API token and the code and writes neither to
disk. The address is gated; this repo stays public, the owner's accepted trade-off.

Live since 2026-09-07 (worker `betatest-gate`). Verified from a cookieless browser: the
page is a 401 lock page with `no-store`, every asset under the path is 401 too, and a wrong
code at `/betatest/gate?c=` is 403. One wrinkle the first test found: a browser that had
the game open before the gate went up still holds `index.html` for ten minutes (the site's
`max-age=600`), so the shell renders and then the data comes back as the lock page. The
content loader now handles that: a 401 HTML answer to any content fetch replaces the
document with the lock page itself. Since 2026-09-11 the lock page is a zero-JavaScript
form (television browsers, log 20260908-06): submitting navigates to `/betatest/gate?c=`,
which answers 303 into the game with the cookie set, or 303 back to `/betatest/?bad=1`.

## The Station, and the ground

Since 2026-09-12 (owner ruling, log 20260912-02) the hub is **The Station — Forward
Base**: the old fictional block, kept tile for tile (`space:community-block`, so saves
standing on it still resolve), rethemed as *"a small, small mini town, like a forward
operating base orbiting the Earth"* with a greenhouse deck, the Archive Office through
one hatch and the Commissary (the old Corner Store) through the other. `theme: "station"`
is a renderer palette over the same tile codes plus a starfield; walkability is
unchanged. Its neighborhood is `orbit` (`region: "orbit"`, `anchor: null`, `timezone:
UTC`): no coordinates, so no weather is fetched and the HUD shows a UTC clock.

Aboard it lives the studio's own tools as a character, `npc:camt` ("Cadenza Arthouse
Media Tools"). Character design comes later; for now it is the real Cadenza Arthouse logo
stamped on a floating gold coin (`content/sprites/camt-coin.png`, generated from
`F:\Apps\Libraries\assets\logo.png` by a script, never hand-drawn), drawn through the new
`sprite.image` path in the renderer. Its lines are placeholders. It is not a live model;
that idea, and the codec-style call the owner described, are recorded in CAMT
`FUTURE_IDEAS.md`.

**The campus has a registry identity.** Owner, 2026-09-12, to the software manager
session: the studio's online chat room *"would exist in the RPG in the space station …
where our archive campus is"*, as the **Library Multipurpose Room**, and every session
held there is that room's history. So the campus is the one piece of fiction with
registry entities, of kind `virtual` (the location model's own word for a place that is
online), `internal_only`, parent-linked, and the RPG's rooms are their addresses:

| registry entity | slug | game space |
|---|---|---|
| `ent_c87c133caad8` The Station | `station-campus` | `space:community-block` |
| `ent_368ef850c808` The Library | `station-library` | `space:library` |
| `ent_752c5eeeb371` Library Multipurpose Room | `library-multipurpose-room` | `space:library-multipurpose-room` |

CAMT files each session's log under the room's entity id; the room in the game shows
only that the room exists (notes never travel). The Library is the third door on the
deck, the Multipurpose Room is through the back of the Library. They are not bound in
`world.json` because they are not public places and the bus never lists them.

**The way down and the way up.** The station's **Drop shuttle** is the travel chooser
(below). Every Earth bus stop offers **"Shuttle up to the Station"** (the `hub` entry).
The owner said the mechanic for getting between orbit and the ground *"we're going to
have to figure out"*; until he does, the shuttle is a bus stop that goes up, and nothing
else pretends to be the answer.

**Third Ward is three real places now**, minted public on his instruction: Emancipation
Park and Peggy Park (both generated from OpenStreetMap the usual way) and the Third Ward
Chess Park, whose position is the registry's own verified reading but which OpenStreetMap
does not know, so its space is hand-authored and says so in its `_note`. The neighborhood
anchor moved from an approximate centroid to Emancipation Park.

## Getting around

The Drop shuttle on the station (`type: "travel"`) is a chooser built at runtime from
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
- The player's time is player state (`state.era`, saved) and **only the gate changes
  it**. Owner, 2026-09-03, after playing: *"buses only move you around the current time
  you're in; portals move you through time only; buses through space only."* So the
  **bus stop** lists only places whose binding covers the date you are standing in (the
  station is a present-day place and is offered only in the present), and in a
  time with no other bound place it says so and points at the gate. Arriving anywhere by
  bus never rewrites the era. The **gate** (`type: "timegate"`, one tile from every
  generated bus stop) lists the other times of *this* place and drops you on the same
  tile. Later, a place that existed at a time but has no space yet can be shown as
  inactive rather than absent; for now, unbound means unlisted, so the whole planet is
  never available in every time.
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

## The Watchers of Universe B — design canon (owner, logs 20260913-03 and -06), not built

His working title for the released game, and the shape of the player in it:

- **The player is a Watcher.** No player accounts, no player-to-player messaging, no
  microphones — *"that way it's also safe for people."* A Watcher comes down into
  Universe B and watches: *"they just float around and look at stuff."* He floated
  dropping the interact button for regular players; the beta keeps it, because the beta
  is his developer walk. Everything the Watcher sees is already in the archive: *"Universe
  B is just like a visual renderer … a different presentation layer, just like a video
  reel is or a newspaper article."* The game receives what he does on the back end and
  the Watcher experiences it. This settles the multiplayer question of 2026-09-03: there
  is no relay to build, because there is nothing for players to say to each other.
- **The Multipurpose Room is his.** The station's chat room is his developer space,
  *"my chat room for my developer stuff"*, and may never be open to regular players. Its
  session logs might later be *"where NPC texts can pull from."* The station door stays;
  what is behind it is a separate question from the Watcher's game.
- **Backstory** is a Book of Enoch analogy: the Watchers came down among people. He will
  not rewrite that text (*"this is the archive and it's a real text from the real world"*),
  and the production backstory need not name it directly; it only has to make it make
  sense that you are walking around Houston.
- **Party mechanics** are Chrono Cross and Chrono Trigger: a party of characters, control
  passing between them, *"maybe sometimes you're controlling a protagonist character,
  maybe sometimes you're controlling other characters."* Rocco's Flutie Cats arc is a
  side quest. His own reported stories become replayable side arcs, *"and then it can be
  factual"*; well-documented historical events are recreated so a Watcher can watch them
  — *"that's the purpose of time traveling."* The time layer already built is the floor
  this stands on.
- **The real animals' health is an in-game stat**: vet visits, flea medicine, tracked from
  life. Later, people may pay for a vet visit in-game and see it reflected. Costumes and
  skins for the animals are future purchasable content, sold in the merch store on
  cadenzaarthouse.studio, never on a game page, so *"the game can just be about the game
  and its IP"* and cadenzaarthouse.com keeps the serious work.

## The ship, the world map, and the layers — structure from logs 20260913-07 and 20260914-01

He asked for the structure to be organized now and built later (*"we don't have to build it
yet … start organizing the structure"*). The one exception is stated as a need: *"walking
around this is painful, it just takes too long … I need to have a general overworld map."*

**The ship (09-14).** The way between orbit and the ground, left open on 09-12, is now
decided: one ship, his, the only thing in Universe B that travels time (*"there's only
going to be one ship that can do time travel, and I already have that ship"*). It flies a
**world map of the real Earth**, to scale, and a full circuit of the equator takes about a
minute (he priced it with his assistant: 1.5 million mph, and accepted that as fiction).
It lands straight down like an elevator, only where a ship its size could really stand: a
big ring or cone, *"three tour buses side by side"* through it, so parks yes, streets no.
Teleporters cover the rest of the planet, as in Chrono Trigger. Horses and cars later.
Boss Lady, a real mobile mechanic, was named as an NPC who services the ship; **she is a
real person and enters only after her consent** (*"we probably have to send her an
email"*). Livingston, Texas was named as a place. Houston's own radical years (riots, the
Civil War era) are to be reenacted, which is what the time layer is for.
**Built 2026-09-19 on his go (*"Yes build my ship"*).** `world/ship.js` is a second mode
of the engine: when the ship is aloft the world map draws instead of a space, the six
actions steer it, and everything else is untouched.
- The map is `content/geo/earth.png`, Natural Earth 1:110m land (public domain) rasterised
  by `tools/earth_map.py` at 8 px per degree, equirectangular, wrapped across the
  antimeridian, with a 30° graticule and a 10° scale bar so "to scale" is visible.
- Speed is 6° per second in any direction: the equator in 60 s, Houston to Tokyo in
  about 23 s. Latitude stops at ±85°.
- **Landing** is exactly the real places bound in the player's time (the same
  `bestBinding` the bus used), each at its space's anchor: INTERACT lists those within
  60 km by distance, or lands straight down if there is one; nothing else is ever
  standable. BACK opens the ship's own menu: return to the Station, or fly to any bound
  place. Markers closer together than a marker share one ring and one label with a
  count, so Houston reads as one place from orbit.
- **The ramp.** Every `travel` stop is now the ship's ramp: *Board the ship* first (it
  lifts off over that place), then the direct list of places as the teleporters he named,
  then *Fly to the Station*. The station's stop is the ship's berth.
- **Save:** `player.space === "ship"` means aloft; `player.ship = {lat, lon}` is where the
  one ship is, always, so it waits where it was left. Events `ShipBoarded` and
  `ShipLanded` go in the log. Reload while aloft comes back aloft on the same spot.
- The HUD aboard shows a UTC clock and the ship's position; no weather, no sky.
- *Not yet:* the ship's time controller (time travel stays with the gate on the ground
  until he wants it in the cockpit), the ship drawn on the ground at the ramp, and the
  AR landing seen from the park.

**The layers (09-13, his Spider-Verse framing: one world, many expressions, the archive
as the operational layer).** Recorded as structure, each a renderer over the same content:
1. *Terminals.* In-game terminals run the same CAIN a real person runs; later an avatar
   may work a real station. Already the seam this game is built on.
2. *Camera entity.* A player or thing with a camera: simplest, the same top-down view;
   fuller, a 360° view for a headset (his Quest 3); or a flat screen in front of the viewer.
3. *Matching artifacts.* A QR code at a real place opens that place in the game, and the
   same code exists in the game, at the same spot.
4. *GPS layer.* Pokémon Go style: the phone knows where it is, the camera knows where it
   points, markers at real places that also exist in the game. First test he named: the
   ship landing at Emancipation Park, seen from the park through a phone or glasses.
5. *Built places in VR.* The Library and the Multipurpose Room explorable on a headset or
   through pass-through glasses.
6. *Live data.* Weather and the clock already render at real places; a 3D open world may
   come later and every layer must still interoperate.

**The Multipurpose Room (09-14).** First floor of the Library, panel discussions, no cap
on people at first, with a control room off to the side (operator's console, DJ booth,
audio and video) holding the terminal where he logs into the room's session. He wants to
experience the built chat room before saying more; the room here stays as it is.

**Virtual events (09-15).** Later, an event in Universe B may sell and check tickets through
the same Cadenza Arthouse ticketing and a CAIN kiosk in-game. Not designed here.

**Not Universe B (09-17).** The flea-pandemic ending is another universe in the multiverse
framework, not this one.

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
- **Universe B is this world's fiction** (owner, logs 20260907-02, 20260908-05,
  20260911-01, 20260911-02; the framework is recorded in CAMT `FUTURE_IDEAS.md`, "The IP
  ruling"). Universe A is the real world the registry describes; Universe B is where the
  studio's animals are people with their own lives, voiced by real actors in Universe A,
  and where the story strands live (first named: a crooked-cop comedy, filmed like a
  sitcom). The canon mechanics of how the two universes touch are queued for a design
  pass, not decided here; nothing in this folder mints canon.
- **Party and animal behaviour** (owner, log 20260911-02): recognisable animal behaviour as
  mechanics — a party member who runs *"eleven and a half steps ahead"* and waits where
  you were going (Ella), the confused head-tilt, the rest of the cutes. Needs the party
  system first, which needs NPC placement first. Recorded so the behaviour is designed in,
  not bolted on.
- **Televisions** (owner, log 20260908-06): the lock page is a plain HTML form so a TV
  browser's on-screen keyboard can submit the code; the game itself has not been walked on
  a television yet, and remote-microphone input stays open.
- **The look, and MonoGame** (owner, log 20260913-02): *"I like the placeholder, like
  version one of how it looks now. I think it's kind of cool actually, a retro look, so we
  may not have to even change it at all."* He noticed MonoGame (Stardew Valley's engine)
  because one framework exports many ways, and ruled: install it *"only if it makes sense
  for the purpose of developing it."* Assessment on record: it does not, yet. This game is
  plain web with no build step, which is what lets it run behind the Cloudflare gate on a
  phone, a television browser and a cast screen from one URL, and share CAIN and the
  sprite export with the rest of the site. MonoGame is C# with a per-platform build, so
  adopting it is a rewrite that gives up the browser path. The day a native or console
  build is actually wanted is the day to revisit; nothing about the current look needs it.
- **Beta tester feedback is filed under "Universe B"** (owner, 2026-09-13, to the software
  manager session): the tester portal's product menu names the RPG *Universe B*, and
  entries filed there are feedback, never rulings, even when he files one himself. Whoever
  carries the game reads them by product in CAMT; nothing from them travels here.
  *First one acted on, 2026-09-20 (`bt-0003/tester-20260920-02`):* on a phone, a dialogue
  made the touch controls vanish, which read as a dead end. Now a dialogue hides only the
  d-pad and keeps A (advance) and B (close) at full opacity; a menu brings the d-pad back
  for the cursor; the terminal still hides everything. The owner's rule from 2026-09-03,
  controls only when they are what you need, is kept: A and B *are* what you need then.

## Not in V0 (deliberately)

Quests, story, records placed in the world, real NPC identities, music, art assets beyond
procedural tiles, the era switch, the options menu. Each waits for the sandbox to be walked
by the owner first.
