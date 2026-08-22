# Green Phosphor

The classic green-CRT interface for CAIN OS, and the **compatibility baseline** for
the Interface Pack system — the look every other pack is measured against.

- **Layout profile:** `terminal-classic`
- **Animation profile:** `crt-flicker`
- **Sound profile:** `terminal-basic` (CAIN OS synthesizes these sounds; no audio files ship with this pack)

## What this pack provides

Presentation only, per the CAIN Interface Pack Specification v1.0:

- `skin.css` — sets the CAIN OS core CSS custom properties (phosphor green on near-black)
- `preview.svg` — the card image shown in Display Settings

It ships **no JavaScript, no HTML, and no network requests** — CAIN OS owns all
behavior. This pack cannot change archive discovery, record parsing, navigation, or
settings.

## Boot logo

This pack does not override `bootLogo`, so CAIN OS falls back to the shared Cadenza Arthouse
mark, tinted by the OS. A future revision may ship a pack-local boot mark.
