# cobranzapp — Brand Kit v2

Minimal geometric identity for the user-confirmed name **cobranzapp**. The isotype was approved by the user and is unchanged. The user approved the revised bold geometric wordmark and requested separate transparent files for application use. No application has been implemented.

## Concept

A rounded-square **C** traces a collection loop. A detached yellow square suggests a collection stop. The wordmark is custom bold lowercase lettering constructed from circular bowls, heavier straight stems and flat-cut terminals. Its stroke is 18 units; spacing and stem lengths are adjusted for the bold weight. It requires no fonts and includes no stock imagery, embedded bitmap, gradient, shadow or external resource. This is a deterministic vector design, not an image-generation-tool or fallback-CLI output.

## Choose the right file

| Asset | Meaning | Typical use |
|---|---|---|
| `isotype` | Symbol only | Compact navigation, favicon, icon foreground |
| `wordmark` | Name only | Text-led headers and footer identity |
| `lockup` | Symbol and name together | Onboarding, large headers, marketing |

SVG masters are in `svg/`; transparent PNG exports are in `png/`. All three assets are delivered separately and together in four variants:

- `primary`: charcoal `#171717`, yellow `#FBBF24` node; intended for light surfaces.
- `reversed`: cream `#FFEDD5`, yellow node; intended for dark surfaces.
- `charcoal`: single-color charcoal.
- `white`: single-color white.

**Start here:** `svg/cobranzapp-isotype-primary.svg`, `svg/cobranzapp-wordmark-primary.svg`, `svg/cobranzapp-lockup-primary.svg`. Use the corresponding `reversed` files on dark backgrounds. White or cream artwork can appear invisible in a white viewer because the background is genuinely transparent.

## Sizes and optimization

- Isotype PNGs: 24, 32, 48, 64, 128, 256, 512 and 1024 px square.
- Wordmark and lockup PNGs: 512, 1024 and 2048 px wide, with proportional heights.
- SVGs: small, font-independent vector masters with `viewBox`; no embedded raster data or external dependencies. Both paths and strokes remain editable.
- PNGs: RGBA, transparent background, lossless compression, no baked-in preview surfaces.
- Web favicon: `cobranzapp-favicon.ico`, containing transparent 16/24/32/48/64/128/256 px frames.
- `manifest.json`: export dimensions and variant metadata.
- `validation.json`: automated alpha, bounds, SVG and checksum checks.
- `cobranzapp-brand-kit-v2.zip`: all masters, exports, source and documentation. It excludes itself.

Use an export matching the rendered size and display density; avoid loading a 2048 px wordmark into a small mobile header. Prefer SVG when the consuming platform already supports it. Transparent icon foregrounds still require platform-specific launcher/store background, safe areas and final packaging; this kit does not claim store-ready launcher assets.

## Usage rules

Preserve proportions and the gap around the yellow node. Do not rotate, stretch, add effects, recolor individual letters or move the symbol relative to the wordmark. Use one supplied color variant as a unit.

Recommended minimums are **24 px** square for the symbol, **140 px** width for the wordmark, and **180 px** width for the lockup. At favicon sizes below 24 px, recognition is limited and the node is tiny. Leave surrounding clear space equivalent to one symbol stroke width (32 units on the 256-unit symbol artboard). Built-in padding does not necessarily provide the complete external clear space.

Keep the application identity distinct from tenant-uploaded workspace logos. A brand mark is decorative identity, not a financial confirmation or status indicator. Provide accessible labels when used as an interactive control; use an empty alternative for a redundant decorative mark.

## Preview versus production

`previews/cobranzapp-brand-preview.png` shows the separate symbol, wordmark and lockup on cream and charcoal presentation surfaces. **Only previews have backgrounds.** Never use the preview board as a logo asset.

## Reproduce the exports

Requires Node.js with `sharp` and Python with Pillow. No packages were installed in this project. In the current Codex runtime:

```sh
SHARP_MODULE=/home/asepulvedadev/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp \
  node assets/brand-v2/source/export-brand.mjs
python3 assets/brand-v2/source/validate-and-package.py
```

Elsewhere, resolve `sharp` through the environment or set `SHARP_MODULE` to its module path. The export source is the geometric master; edit it before regenerating so PNGs and SVGs stay consistent. Running these commands intentionally replaces generated v2 assets; version or preserve approved assets before changing the design.

No trademark search or exclusivity/legal clearance has been performed. Approve the visual identity and review brand availability before publication.

Only the approved identity is retained in the project.
