# cobranzapp — Application Assets

Separate transparent assets copied unchanged from the user-approved v2 identity.

| Name | Contents |
|---|---|
| `cobranzapp-isotype` | Symbol only |
| `cobranzapp-wordmark` | Brand name only |
| `cobranzapp-lockup` | Symbol and brand name together |

Each is supplied as an SVG vector and a transparent RGBA PNG. Files without a suffix use charcoal with the yellow collection node and are intended for light surfaces. Files ending in `-dark` use cream with the same yellow node and are intended for dark surfaces. **Neither variant has a background.** The wordmark alone contains no yellow node because the symbol is deliberately separate.

The main isotype PNG is 512 × 512 px. The name and lockup PNGs are 1024 px wide. Additional 32/48/128/256 px transparent symbols are in `icon-sizes/`. A multi-size transparent web favicon is included.

Prefer SVG where supported; otherwise select a PNG appropriate to the display density. Native launcher/store icons still need the platform-specific background and safe areas; these are transparent brand masters, not submission-ready launcher packages. Do not use a preview board as an asset.

`manifest.json` records dimensions, colors and checksums. The six main PNGs were checked for true alpha and unclipped bounds; all copies match the approved source bytes. No application was implemented. Brand availability/trademark clearance remains unverified.
