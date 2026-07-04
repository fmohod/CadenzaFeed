# CAIN OS — Interface Packs

Interface Packs are **presentation packages** for CAIN OS. They control how the
terminal looks, sounds, and animates — never what it does. All behavior (boot,
navigation, archive discovery, record parsing, settings) belongs to CAIN OS.

See `CAIN Interface specifications.txt` for the full v1.0 contract.

## Structure

```
interface-packs/
  manifest.json      ← ordered list of pack folders the loader reads
  phosphor/          ← a pack (folder name = pack id, lowercase kebab-case)
    pack.json        ← required metadata (id, uuid, layout, entry.css, supports…)
    skin.css         ← required; sets CAIN OS CSS variables + styles supported classes
    preview.svg      ← shown in Display Settings
    README / LICENSE / CHANGELOG
```

## Non-negotiable

A pack must **not** include JavaScript, HTML templates, `fetch()`, remote assets,
or behavior overrides. Packs provide static presentation assets and metadata only.

## Adding a pack

1. Create a named folder here.
2. Add `pack.json` (unique `uuid`, `id` matching the folder, `spec` `1.0`).
3. Add `skin.css` and `preview.svg`.
4. Add the folder name to `manifest.json`.
5. Load CAIN OS → Display Settings and confirm archive navigation still works.
