# CLAUDE.md — Cadenza Arthouse archive repo

This repository is the **Cadenza Arthouse archive**: a static site (GitHub Pages +
Cloudflare, no build step) at cadenzaarthouse.com, plus a game that reads the same
archive. Articles are sequential numbered folders (`0001/`, `0002/`, …), each with an
`index.html`, a `thumb`, and an `images/` folder.

**The game lives in `/betatest/` (owner's ruling, 2026-09-03).** `betatest/README.md` is
its contract: the world shell (V0, the Houston Sandbox) and CAIN, the archive terminal,
which the world mounts as the in-game computer and `betatest/terminal.html` boots on its
own. `/game/` is the V1 proof of concept and is not live; it is kept only because
`game/engine/record.js` is the canonical Archive Record builder everything still loads.

## The one rule that matters when adding or editing an article

**When you create or modify an article folder, you MUST follow `PUBLISHING.md`
exactly — including the GAME META BLOCK in the `<head>`.**

The website and the game read the same `index.html`. If the `game-*` meta tags are
missing, the article is invisible to the game and someone has to retrofit it later.
Produce a complete, game-ready `index.html` on the first pass. Never publish an
article without the GAME META BLOCK.

- Full template + field reference + checklist: **`PUBLISHING.md`** (read it before
  writing any article HTML).
- `game-record="true"` makes a piece a collectible Record in the game. Set it to
  `false` only when the author explicitly wants a piece to be website-only.
- Reuse existing slugs for people/places/orgs (kebab-case, no namespace prefix).
- `date`, `description`, and `article-id` are reused by the game — don't duplicate
  them with game-specific equivalents.

## Other conventions

- No build step, no npm, no framework. Vanilla HTML/CSS/JS. Keep it that way unless
  explicitly asked.
- The homepage, archive, RSS, and game **auto-discover** article folders and images —
  you don't register new articles anywhere by hand.
- The deeper canonical schemas are not present here, and as of 2026-08-07 they sit in
  two places: **`ARCHIVE_RECORD_SPEC.md` is in CAMT**
  (`F:\Apps\Cadenza Arthouse Media Tools\`) because journalism now depends on it — it is
  the contract `game/engine/record.js` implements — while the quest model, game layers
  and ID conventions stay parked in **DevNotes**. `PUBLISHING.md` remains the
  self-contained, practical reference for this repo.
- **A change to the record spec must be mirrored in `game/engine/record.js` in the same
  session**, and vice versa. That pair has already drifted once: the spec defines a
  `body` block type of `image`, the builder omits `<img>` from its selector, and zero
  image blocks exist across twelve published articles.

## The media page

`/media/` is the Cadenza Arthouse media page (2026-10-08): a streaming-service wrapper over the owner's YouTube
playlists, nothing loads before a click. It is a second deployment of an engine whose contract is
`Modelauctions-site/MEDIA.md`; **`media/media.js` is mirrored line for line between the two sites** and `media/README.md`
says what is shared and what is each site's own. Modeling content stays on Model Auctions; everything else is here.
The masthead carries a Media link on every page, so a new page copies the nav from an existing one.
**`/media/` itself has no masthead, on purpose** (owner's ask, 2026-10-09: the cream newspaper header above a dark streaming
screen read as two different sites): it has its own slim dark bar (Back, brand, Menu) and its own footer, with the bar's
slide-away and the Menu panel in `media/chrome.js`. Do not "restore" the masthead there. **The lineup file
`media/channels.json` is written by CAMT's Channel Manager only** (CAMT `CHANNEL_MANAGER.md`): never hand-edit it or push a change to it.
