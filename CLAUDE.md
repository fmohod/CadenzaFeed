# CLAUDE.md — Cadenza Arthouse archive repo

This repository is the **Cadenza Arthouse archive**: a static site (GitHub Pages +
Cloudflare, no build step) at cadenzaarthouse.com, plus a game at `/game/` that
reads the same archive. Articles are sequential numbered folders (`0001/`, `0002/`,
…), each with an `index.html`, a `thumb`, and an `images/` folder.

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
- The deeper canonical schema (Archive Record spec, entity/quest model, ID
  conventions) lives in the separate **DevNotes** repo and is not present here.
  `PUBLISHING.md` is the self-contained, practical reference for this repo.
