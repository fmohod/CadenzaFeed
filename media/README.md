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
| `media.css` | `media/media.css` (a dark band on this light site, accent bronze `#C9A26B`) | the "MEDIA PAGE" sections of `style.css` | Ported, colours differ on purpose; a layout fix goes to both |
| `channels.json` | Live Shows, Houston, Atmosphere (+ the Vigil/Canvass report, unlisted) | the Fashion Shows channel | **No — each site's own lineup** |
| `index.html` | this masthead and footer | that masthead and footer | No — page chrome |

There is no build step, so the engine cannot be shared by reference. A change to `media.js` that
exists in only one repo is the drift this table is here to catch.

## The lineup

Channels are the owner's YouTube playlists. `jobs\youtube_lineup.py fetch --site
F:\Apps\CadenzaFeed` (CAMT, menu 36; channel #8, read-only, on demand) rewrites each channel's
`lineup` from its playlist and takes exact durations from the API. Run it once per site. **No API key is stored yet**, so
this manifest is kept by hand (see `MEDIA.md` §5 in Model Auctions); when the key goes in, check the `live` playlist id here: it is
only 13 characters, shorter than a usual playlist id.

**Not here yet:** a channel of the videos already embedded in the articles (`0002`–`0005`, `0009`–`0012`
embed nine), which he described as "our version of a playlist". It needs their durations, and
the picker he wants in CAMT to manage it is not designed.

## Honesty

This page's own code makes no request to YouTube until a visitor presses play: until then it is
HTML, CSS, `channels.json`, this site's art and plain thumbnail images from `i.ytimg.com`; the first
click loads YouTube's player from `youtube-nocookie.com`. That describes the page, not the host:
Cloudflare injects its own scripts into the HTML it serves (observed at go-live, 2026-10-08), here
and on every other page of both sites, so what a visitor's browser runs is more than this file.
