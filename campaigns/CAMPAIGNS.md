# Campaigns — Cadenza Arthouse

**This is the one place that says what a campaign is on cadenzaarthouse.com, how a campaign
folder is shaped, and what `campaign.json` must contain.** `PUBLISHING.md` at the repo root
governs articles; this file governs `/campaigns/`. Registered in CAMT's
`DOCUMENTATION_REGISTER.md`. Created 2026-09-02, on the owner's instruction, with the first
campaign (0001, the Cadenza Arthouse Instrument Library).

> **Cadenza Arthouse is Frankie Mohammed's company. He owns it.** The business is named
> **"Cadenza Arthouse" — always both words**, never "Cadenza" alone. A client or a venue is a
> *field on a record*, never the identity of the work: a campaign page never names a client
> school, district, venue or organization in a heading, and names one in the body only when the
> campaign is genuinely about it. Full statement: `F:\README.md`.

---

## 1. What a campaign is

A campaign is a **story with a number on it**: a concrete objective, a first-person account of
why it matters, and Square checkout links that let a stranger put money on it without leaving
the page. It is an **appeal, not reporting** — every campaign page says so in its meta line
(`Campaign · first-person appeal`) and in its closing note, so a reader never mistakes it for
journalism (CAS §12.6, type of work).

The system is called **Campaigns**, not fundraising. Fundraising describes the money; a
campaign is story + objective + audience + money + outcome. The first campaign funds
instruments; later ones may fund a photography project, an archival preservation job,
equipment, or a specific person's need the publication has come across.

**Square is the payment processor. Cadenza Arthouse owns the campaign.** Square is
authoritative for what was actually paid; the campaign record is authoritative for what the
campaign is, what it set out to do, and what it did.

## 2. Folder structure

Campaigns are sequential numbered folders under `/campaigns/`, four digits, zero-padded —
the same convention as articles at the root, chosen by the owner so every campaign is one
self-contained folder.

```
campaigns/
  index.html          ← section landing; auto-discovers NNNN/ folders (§5)
  campaigns.css       ← the section's styles (style.css still supplies masthead + type)
  CAMPAIGNS.md        ← this file
  0001/
    index.html        ← the campaign page (§4)
    campaign.json     ← THE RECORD — canonical, machine-readable (§3)
    thumb.jpg         ← 1200×630 share image (Open Graph / cards)
    images/           ← optional photographs; same publication rules as articles
```

The section index and the campaign page both read `campaign.json` at load. **`campaign.json`
is the authoritative campaign data. The HTML must not contain an independently maintained copy
of any financial or progress value** — the page renders those from the record and shows
"unavailable" if it cannot. The one thing the HTML does carry is the give buttons' `href`s,
because a stranger must be able to pay with scripts off; each must equal the `url` of a tier in
the record, and the ADR-0011 manager's repo scan is what catches a mismatch.

## 3. `campaign.json` — the record (schema_version 1)

```json
{
  "schema_version": 1,
  "id": "0001",
  "title": "Ten flutes. Ten kids who can take one home.",
  "summary": "One or two sentences. Reused by the section index card and by CAMT.",
  "author": "Frankie Mohammed",
  "status": "active",
  "created": "2026-09-02",
  "closes": null,
  "goal":      { "amount_cents": 100000, "currency": "USD" },
  "objective": { "label": "flute", "count": 10 },
  "progress":  { "raised_cents": 0, "successful_contributions": 0, "as_of": "2026-09-03T02:19:05Z", "source": "manual" },
  "funding": {
    "provider": "square",
    "tiers": [
      { "label": "$25",  "description": "A quarter of a flute", "amount_cents": 2500,  "url": "https://square.link/u/<code>", "square_link_id": "XXXXXXXXXXXXXXXX" },
      { "label": "$100", "description": "One flute",            "amount_cents": 10000, "url": "https://square.link/u/<code>", "square_link_id": "XXXXXXXXXXXXXXXX" }
    ]
  },
  "beneficiary": { "program": "Cadenza Arthouse Instrument Library" },
  "outcomes": []
}
```

| Field | Required | Consumer | Notes |
|---|---|---|---|
| `schema_version` | yes | everything | Integer. **Additive-only**: fields are added, never renamed, removed or repurposed. Bump when a field is added. |
| `id` | yes | index, page, CAMT | The folder name. Stable identity; the title may change, the id never does. |
| `title` | yes | index card, page | The headline. |
| `summary` | yes | index card, CAMT | One or two sentences. |
| `author` | yes | page meta, CAMT | The person whose first-person account the page is. |
| `status` | yes | index (ordering + label), page | `active` · `funded` · `closed`. `funded` = goal reached, still accepting; `closed` = no longer accepting. |
| `created` | yes | CAMT | `YYYY-MM-DD` the campaign went live. |
| `closes` | yes | CAMT, page (future) | `YYYY-MM-DD` or `null`. Null means open-ended. |
| `goal.amount_cents`, `goal.currency` | yes | index, page | The money target, in cents. |
| `objective.label`, `objective.count` | no | index, page | What the money buys, countable. **Deliberately separate from the goal**: the schema does not assert that `goal ÷ count` is the price of one unit — that figure belongs in the story. Omit the block for a campaign with no natural unit; the page then shows a percentage. |
| `progress.raised_cents` | yes | index, page | What has come in. **Square is the truth; this is a dated copy of it.** |
| `progress.successful_contributions` | yes | page, CAMT | Count of **completed Square payments** against the campaign's links — not people, not attempts. Named precisely so it is never read as either. |
| `progress.as_of` | yes | page | ISO-8601 UTC. Shown on the page as "Figures as of …", so a reader can see how current the number is. |
| `progress.source` | yes | CAMT | `manual` (a person copied it from Square) or `square_ingest` (CAMT reconciled it). Flipping this value is the whole of the V1→V2 change; no field is renamed. |
| `funding.provider` | yes | CAMT | `square`. A campaign has one provider. |
| `funding.tiers[]` | yes | page buttons, CAMT, `jobs/square_links.py` | `label` (the amount as shown), `description` (what the amount means, in words), `amount_cents`, `url`, `square_link_id`. `url` is `https://square.link/u/<code>` with no tracking parameters — the `<code>` is the identity the ADR-0011 registry is keyed on, so the manager's repo scan finds it. `square_link_id` is Square's own payment-link id, kept so the V2 ingest can match orders to a tier without parsing URLs. **A `url` whose code is not in the registry with `tested: true` may not be published.** |
| `beneficiary.program` | yes | CAMT | Which Cadenza Arthouse program receives the outcome. Free text today; becomes a registry pointer when programs are minted. |
| `outcomes[]` | yes (may be empty) | page ledger, CAMT | Append-only. Each entry: `{ "date": "YYYY-MM-DD", "type": "purchase" \| "loan" \| "return" \| "gift", "quantity": 10, "unit": "flute", "note": "…" }`. **Never edit or delete an entry; append a correcting one.** Loan tracking beyond this list is not V1. |

**Every field has a consumer or a documented future contract.** Do not add a field because
"everything has a kind"; the folder already says this is a campaign.

## 4. The campaign page

Copy `0001/index.html` and change the content. The page is:

1. Kicker (`Campaign NNNN · <program>`), headline, lede, meta line — the meta line **must**
   carry `Campaign · first-person appeal` (or another honest type), the author, and the start date.
2. **The goal block above the fold** — raised, goal, unit count, progress bar, status, "Figures as of".
3. **The give tiers** — one `<a class="cmp-tier">` per Square link. A stranger must be able to
   give from this block without scrolling past it.
4. The story, in `.cmp-story`. Headed sections; the author's own observations; no claim that
   could damage a named party without the CAS §12 treatment.
5. **Where the money goes** — a list, including the processing fee and what happens over goal.
6. **The ledger** — rendered from `outcomes[]`, "No purchases yet" until there are some.
7. The italic provenance line (who wrote it, from what, over what dates, what is deliberately
   not named) and the "About this page" note that says a campaign is an appeal, not reporting.

`?thanks=1` on the URL shows the thank-you block; every Square link's `redirect_url` points
back at the campaign page with that parameter.

### What may not appear on a campaign page

- **A student's name, photograph, voice, quote, or anything that identifies one.** The
  education program's `internal_only` gate is untouched by campaigns (arts program rulings
  R2, R6–R8; CAS §9.13).
- **A client, district or venue as identity** — not in the kicker, headline, or a heading, and
  not in the body unless the campaign is genuinely about that organization and CAS §12.3
  (seeking comment) has been satisfied for any claim that could damage it.
- **The bare word "Cadenza."**
- **A photograph from an archive event whose `publication` is `internal_only`.** The share
  image for 0001 is a typographic card with the master logo for exactly that reason.

## 5. Discovery

`campaigns/index.html` lists `campaigns/NNNN/` folders through the GitHub contents API (the
same call the homepage uses for articles), falling back to probing `0001/campaign.json`,
`0002/…` in sequence if the API is unavailable. It reads each `campaign.json` and orders cards
**active → funded → closed**, newest first within each. Nothing is registered by hand.

## 6. Square links — governed by ADR-0011

- **Only reusable `quick_pay` links.** A single-use order link, once paid, shows every later
  visitor the first buyer's confirmation; never publish one. All four links for 0001 were
  created through the Checkout API as `quick_pay` with `redirect_url` back to the page.
- **Every published link is registered** in `F:\Media\registry\square_links.yaml` via
  `py -3.11 jobs\square_links.py save` (CAMT), and **fresh-visitor tested** — opened in a
  browser with no history, showing a real card-entry checkout — with `tested: true` and a
  dated note before it goes live.
- **Run the manager before any change that adds, moves or removes a link.** A `DEAD` link
  (referenced in the repo, unknown to Square) or a published `UNTESTED` one blocks the change.
- Canonical form: `https://square.link/u/<code>`, no tracking parameters.

## 7. Updating progress (V1 — by hand)

1. Open the Square dashboard, find payments against the campaign's links (their names begin
   `Campaign NNNN ·`).
2. Edit `campaign.json`: `progress.raised_cents`, `progress.contributions`, `progress.as_of`
   (UTC now). Leave `source: manual`.
3. If the goal is met, set `status: funded` (still accepting) — or `closed` when it should stop.
4. When the money buys something, **append** to `outcomes[]`.
5. Validate — `py -3.11 -c "import json;json.load(open('campaign.json',encoding='utf-8'))"` —
   then commit and push. The live site is the record.

**V2 — CAMT.** When CAMT ingests Square payments for campaign links (the same ingest ticketing
already runs), it writes `progress` with `source: square_ingest` and publishes the folder
through the same git-push channel the ticker uses. The schema above is the contract it will
write to; it does not change shape when that happens.

## 8. Pre-publish checklist

- [ ] Folder is the next sequential 4-digit number; `id` matches it.
- [ ] `campaign.json` parses; `schema_version` present; every required field filled.
- [ ] `thumb.jpg` present, 1200×630.
- [ ] Meta line declares the type of work; author and start date present.
- [ ] Give tiers above the story; every `href` is in `funding.tiers[]` and equal to it.
- [ ] Every Square link is reusable, registered, and `tested: true`.
- [ ] No student identity; no client/venue as identity; no bare "Cadenza"; no `internal_only` photograph.
- [ ] Provenance line and "About this page" note present.
- [ ] `sitemap.xml` updated with the new page.
