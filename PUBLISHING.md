# Publishing a New Article — Cadenza Arthouse

**This is the one place that tells you exactly how to format a new article's
`index.html` so it works for BOTH the website and the game in a single pass.**
Follow it when publishing, and you never have to come back and re-code folders.

> Golden rule: every published article folder ships a complete `<head>` that
> includes the **GAME META BLOCK**. The game reads those tags. Omit them and the
> piece is invisible to the game (the website still works, but you'll have to
> retrofit later — which is exactly what this guide prevents).

---

## 1. Folder structure

Articles are sequential numbered folders at the repo root. Next number, zero-padded
to 4 digits.

```
0009/
  index.html        ← the article (uses the template below)
  thumb.jpg         ← card thumbnail (or thumb.png)
  images/           ← gallery photos (any .jpg/.png/.gif/.webp)
    photo1.jpg
    photo2.jpg
```

The homepage, archive, RSS, and game all **auto-discover** the folder. Images load
dynamically from `images/` — you don't list them anywhere.

---

## 2. The `<head>` template (copy, paste, fill the `{{...}}`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="index, follow">

<title>{{TITLE}}</title>

<meta name="date" content="{{YYYY-MM-DD}}">
<meta name="description" content="{{ONE-OR-TWO SENTENCE SUMMARY}}">
<meta name="article-id" content="{{NNNN}}">

<!-- ── Cadenza Archive · game layer (read by /game) ── -->
<!-- REQUIRED for the article to appear in the game -->
<meta name="game-record"       content="true">
<meta name="game-era"          content="{{YYYY}}">
<meta name="game-location"     content="{{neighborhood-slug}}">
<meta name="game-tags"         content="{{tag1,tag2,tag3}}">
<meta name="game-flavor"       content="{{short in-world description of the found object}}">
<!-- RECOMMENDED article facts -->
<meta name="game-record-type"  content="{{news}}">
<meta name="game-region"       content="{{houston}}">
<meta name="game-world"         content="modern">
<meta name="game-record-version" content="1">
<!-- RECOMMENDED graph references (bare slugs; engine namespaces them) -->
<meta name="game-people"       content="{{person-slug,person-slug}}">
<meta name="game-orgs"         content="{{org-slug}}">
<meta name="game-places"       content="{{place-slug}}">
<meta name="game-events"       content="{{event-slug}}">
<meta name="game-concepts"     content="{{concept-slug}}">
<meta name="game-discovers"    content="{{knowledge-slug,knowledge-slug}}">
<!-- ── end game layer ── -->

<link rel="canonical" href="https://cadenzaarthouse.com/{{NNNN}}/">

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:site_name" content="Cadenza Arthouse Press">
<meta property="og:title" content="{{TITLE}}">
<meta property="og:description" content="{{SUMMARY}}">
<meta property="og:url" content="https://cadenzaarthouse.com/{{NNNN}}/">
<meta property="og:image" content="https://cadenzaarthouse.com/{{NNNN}}/thumb.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="article:published_time" content="{{YYYY-MM-DD}}T12:00:00-05:00">
<meta property="article:author" content="Frankie Mohammed">
<meta property="article:section" content="{{Community}}">

<!-- Twitter / X card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{TITLE}}">
<meta name="twitter:description" content="{{SUMMARY}}">
<meta name="twitter:image" content="https://cadenzaarthouse.com/{{NNNN}}/thumb.jpg">

<!-- Structured data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "{{TITLE}}",
  "description": "{{SUMMARY}}",
  "image": ["https://cadenzaarthouse.com/{{NNNN}}/thumb.jpg"],
  "datePublished": "{{YYYY-MM-DD}}T12:00:00-05:00",
  "author": { "@type": "Person", "name": "Frankie Mohammed" },
  "publisher": {
    "@type": "Organization",
    "name": "Cadenza Arthouse Press",
    "logo": { "@type": "ImageObject", "url": "https://cadenzaarthouse.com/assets/logo.png" }
  },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://cadenzaarthouse.com/{{NNNN}}/" }
}
</script>

<link rel="icon" href="/assets/favicon.ico" type="image/x-icon">
<link rel="icon" href="/assets/favicon-32x32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/assets/favicon-192x192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" sizes="180x180">
<link rel="stylesheet" href="../style.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
```

The `<body>` (masthead, `.article-wrap`, `.article-body`, auto-slideshow script,
footer) is unchanged from any existing article — copy it from the most recent
folder. **The article prose goes inside `<div class="article-body">`.** The game's
terminal reader extracts that container, so keep the prose there.

### 2a. Standard footer — the methodology note (every article)

Every article ends with two things inside `.article-body`, after the prose:

1. A small **italic credit/dateline** line (event, date, venue, photo credit; note any
   details that remain unconfirmed at publication).
2. The standard **"About this coverage"** methodology note — identical on every piece.
   It signals firsthand, independent reporting and distinguishes the archive from
   auto-generated content. Paste it verbatim (adjust the reporter name only if needed):

```html
<p style="font-size:0.8rem;color:#777;"><em>About this coverage.</em> Cadenza Arthouse reporting is based on firsthand attendance and original photography by Frankie Mohammed, supported by official event materials, archival records, and verified public information. Details that could not be independently confirmed are identified as such.</p>
```

---

## 3. Field reference

### Website-standard (you already do these)

| Tag | Required | Notes |
|-----|----------|-------|
| `title` | yes | The headline. |
| `date` | yes | `YYYY-MM-DD`. Also used by the game as the record's date — don't add a separate game date. |
| `description` | yes | 1–2 sentences. Reused for OG/Twitter/JSON-LD and the game's record summary. |
| `article-id` | yes | The 4-digit folder number, e.g. `0009`. |
| `article:section` | yes | Category: Community / Culture / Events / Exhibitions / etc. |

### GAME META BLOCK — required (article won't appear in the game without these)

| Tag | Values | Notes |
|-----|--------|-------|
| `game-record` | `true` / `false` | The on/off switch. `true` = collectible in the game. Set `false` (or omit) to keep a piece website-only. |
| `game-era` | year, e.g. `2024` | Which archive layer / time period. |
| `game-location` | neighborhood slug | Where the Record is found in-world: `third-ward`, `east-end`, `midtown`, `montrose`, `houston`, `sugarland`, `dallas`, … Use an existing slug when possible. |
| `game-tags` | `tag1,tag2,…` | Lowercase, kebab-case, comma-separated. Powers search and tag queries. |
| `game-flavor` | short sentence | The in-world description shown when the player finds the Record (e.g. "A worn training schedule, reps tallied in the margin."). **No double quotes inside.** |

### GAME META BLOCK — recommended

| Tag | Values | Notes |
|-----|--------|-------|
| `game-record-type` | `news` / `photo-essay` / `interview` / `flyer` / `document` / `audio` / `video` | What kind of record. |
| `game-region` | `houston` / `dallas` / … | City / metro. |
| `game-world` | `modern` / `historical` / `reconstruction` | Defaults to `modern`. |
| `game-record-version` | integer | Defaults to `1`. **Bump it when you materially edit an already-published piece** — the terminal uses it to flag "updated since you last read this." |

### GAME META BLOCK — graph references (fill what applies)

Bare, lowercase, kebab-case slugs. The engine adds the namespace (so `game-people`
value `george-jackson` becomes `person:george-jackson`).

| Tag | Becomes | Use for |
|-----|---------|---------|
| `game-people` | `person:` | People named in the piece. |
| `game-orgs` | `organization:` | Organizations. |
| `game-places` | `place:` | Specific venues/locations. |
| `game-events` | `event:` | Named events. |
| `game-concepts` | `concept:` | Themes/ideas. |
| `game-discovers` | `knowledge:` | What the player *learns* by reading it (gates quests later). |
| `game-npcs` | `npc:` | Characters who appear near this Record in-world (optional). |
| `game-advances-quest` | `quest:` | Pointer to a quest this Record advances (optional). |

**Connections are automatic.** You never hand-author links between articles — any
two articles that reference the same slug are connected by the engine. Just be
consistent with slugs (use the same `george-jackson` everywhere).

---

## 4. Slug rules

- Lowercase, kebab-case, ASCII: `diamond-ashman`, `cultured-concepts`, `peggy-park`.
- One slug per real-world thing. Reuse the exact same slug across articles.
- No `person:` / `place:` prefix in the meta tags — the engine adds it.

---

## 5. Pre-publish checklist

- [ ] Folder is the next sequential 4-digit number.
- [ ] `index.html` uses the template; every `{{...}}` is filled.
- [ ] `article-id` matches the folder number.
- [ ] **GAME META BLOCK present**, with all five required tags.
- [ ] `game-flavor` has no double quotes.
- [ ] Slugs are kebab-case and reuse existing ones where they exist.
- [ ] `thumb.jpg` (or `.png`) present; photos in `images/`.
- [ ] Prose is inside `<div class="article-body">`.
- [ ] Italic credit/dateline line + the standard **"About this coverage"** footer are present (§2a).
- [ ] Want it website-only? Set `game-record` to `false`.

---

## 6. Where the deeper schema lives

This guide is the practical "how." The full canonical spec — the Archive Record
model, entity registry, quest format, ID conventions — lives in the **DevNotes**
repo (`ARCHIVE_RECORD_SPEC.md`, `GAME_METADATA_SCHEMA.md`, `RULES.md`), which is
**not** part of this repo. When in doubt about *why* a field exists, that's the
reference. For day-to-day publishing, this file is all you need.
