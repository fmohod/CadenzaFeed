# media/ — the Cadenza Arthouse media page

`cadenzaarthouse.com/media/`: video from Houston stages, galleries and streets and from the
archive, presented as a streaming service. Built 2026-10-08 at the owner's ask: **everything that
is not modeling content moved here from Model Auctions; modeling content stays on
`modelauctions.net/media/`.** (Voice logs `20260903-02` for the idea, `20261008-01` and the
2026-10-08 chat for the split.)

## Where the contract lives

**`Modelauctions-site/MEDIA.md` is the contract for both sites** — what a channel is, the
schedule arithmetic (every visitor computes the same "on now" from the clock), the manifest shape,
"nothing loads before a click". This folder is a second deployment of the same engine and does not
restate it.

## The two copies, and the rule that keeps them one thing

| File | Here | Model Auctions | Mirrored? |
|---|---|---|---|
| `media.js` | yes | `media/media.js` | **Yes — line for line** (line endings aside). Fix one, fix the other |
| `media.css` | `media/media.css` (a dark band on this light site, accent bronze `#C9A26B`) | the "MEDIA PAGE" sections of `style.css` | Ported, colors differ on purpose; a layout fix goes to both |
| `channels.json` | Live Shows, Houston, Atmosphere (+ the Vigil/Canvass report, unlisted) | the Fashion Shows channel | **No — each site's own lineup** |
| `index.html` | this masthead and footer | that masthead and footer | No — page chrome |

There is no build step, so the engine cannot be shared by reference. A change to `media.js` that
exists in only one repo is the drift this table is here to catch.

## The lineup

**This folder's `channels.json` is written by CAMT's Channel Manager and by nothing else** (CAMT menu 40,
`jobs\channels.py`; contract CAMT `CHANNEL_MANAGER.md`, `ADR/ADR-0020`, and `MEDIA.md` §5 in Model
Auctions). Do not hand-edit it and do not push a change to it from this checkout: the manager publishes
from its own clean clone, checks every video, and compares the **live** file with what it meant to
publish; a hand edit is surfaced as drift and refused until the owner adopts it. The file's format is
fixed (indent 2, LF, no trailing newline) because the manager writes it back byte for byte. A channel's
`playlist` id is reference only; it no longer drives the lineup (the `live` id here is 13 characters,
shorter than a usual playlist id, which is one more reason). A channel with no videos breaks the page,
so the manager refuses to publish one.

**Not here yet:** a channel of the videos already embedded in the articles (`0002`–`0005`, `0009`–`0012`
embed nine), which he described as "our version of a playlist". It needs their durations, and
the picker he wants in CAMT to manage it is not designed.

## Honesty

This page's own code makes no request to YouTube until a visitor presses play: until then it is
HTML, CSS, `channels.json`, this site's art and plain thumbnail images from `i.ytimg.com`; the first
click loads YouTube's player from `youtube-nocookie.com`. That describes the page, not the host:
Cloudflare injects its own scripts into the HTML it serves (observed at go-live, 2026-10-08), here
and on every other page of both sites, so what a visitor's browser runs is more than this file.
