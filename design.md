# Visual Design and User Experience — Warm Bento, Mobile First

> **Status:** Visual direction, application name, isotype and bold geometric wordmark approved by the user; detailed UI specifications remain proposals, v0.8.
> **Updated:** 2026-10-11.
> **Scope:** Visual language, navigation, responsive composition, components, branding presentation, accessibility and interaction states only. No UI has been built.

## 1. Direction and source

Use [the user's Aura personal-finance reference](https://personal-finance.aura.build/) as the visual anchor for the entire application: a warm, rounded **bento** composition with dark framing, cream work surfaces, yellow accents, mint financial highlights and confident typography. This replaces the former generic blue/white visual proposal.

Adapt the language to lending/collection tasks; do not reproduce a promotional collage as an operational screen. Design the phone experience first, then expand it for tablets and desktop. A shrunken desktop dashboard is not the mobile design.

### Reference observations versus application proposals

The reference was inspected in its rendered preview on 2026-10-11, at approximately 1054×900 and at 390×844. Its embedded design uses warm cream/yellow panels against dark surroundings, mixed-size rounded cards, mint charts, compact pills and dark action buttons. Computed styles include system sans-serif, 24-unit outer card radii, 12/16-unit inner radii, and capsule-shaped elements. At phone width, major panels stack while some small cards remain paired. [Visual reference](https://personal-finance.aura.build/)

Exact app hierarchy, tokens, component dimensions, themes and mobile rules below are **our proposals**. No claim is made that the reference has been fully accessibility-, performance- or interaction-tested.

### Carry over / do not carry over

| Carry over | Adapt or omit |
|---|---|
| Dark frame + warm light cards | Keep working data on opaque, readable surfaces |
| Warm yellow emphasis and mint highlights | Assign clear semantic roles instead of arbitrary decoration |
| Rounded bento cards and confident amounts | Mobile cards grow with content; no rigid square tiles |
| Pills, restrained charts and crisp icons | Increase tap areas and label important actions |
| Editorial contrast and spacious rhythm | Prioritize operational tasks over promotional imagery |

Do not copy the reference's logo, photographs, futuristic portrait, currency/examples, marketing claims, wallet/investment features or animated background. No AI assistant, decorative chatbot, unsupported predictions or unrelated personal-finance features enter the app through this reference.

## 2. Overall visual language

- **Mood:** premium but approachable; warm, calm and practical, not a bank trading terminal.
- **Composition:** rounded work cards framed by dark neutral space; one clear focal card per screen.
- **Default proposed appearance:** dark outer canvas/navigation with cream operational cards, yellow action emphasis and mint secondary highlights.
- **Daylight proposal:** an optional pale canvas variant retains dark anchor cards, the same warm palette and identical component hierarchy for field readability. This is not a second unrelated design system.
- **Decoration:** flat opaque surfaces, restrained borders/shadows, no blur behind financial information. Dotted texture may appear only in sparse non-working branding areas, never behind forms, addresses or amounts.
- **Hierarchy:** important amount → descriptive label → state/freshness → task action. Do not compete with the next operational action using unrelated dashboard charts.
- **Consistency:** every role, screen and breakpoint uses the same spacing, typography, radius, icon and status language.

## 3. Proposed semantic palette

These tokens deliberately follow the reference's warm/dark/mint family. Hex values are proposals for the app, not a claim that all reference styles are identical.

| Token | Value | Intended use |
|---|---|---|
| `canvas-dark` | `#171717` | Default outer frame, navigation and dark anchor cards |
| `surface-dark-raised` | `#262626` | Dark sheets and secondary framing |
| `surface-cream` | `#FFEDD5` | Primary operational cards |
| `surface-light` | `#FFF7ED` | Forms and daylight canvas |
| `surface-yellow` | `#FEF9C3` | Bounded emphasis/summary cards |
| `accent-yellow` | `#FBBF24` | Primary emphasis, active navigation and selected actions |
| `accent-yellow-soft` | `#FDE68A` | Selected chips and decorative highlights |
| `surface-mint` | `#D1FAE5` | Calm confirmed-progress/report surfaces |
| `text-on-light` | `#171717` | Main text on cream/yellow/mint surfaces |
| `text-muted-on-light` | `#57534E` | Secondary labels on light surfaces |
| `text-on-dark` | `#FFFBEB` | Main text on dark surfaces |
| `text-muted-on-dark` | `#D6D3D1` | Secondary labels on dark surfaces |
| `success-on-light` | `#047857` | Confirmed state and chart marks on mint/cream |
| `warning-on-light` | `#92400E` | Pending/review state on pale yellow |
| `error-on-light` | `#B91C1C` | Error/destructive text on light surfaces |
| `error-on-dark` | `#FCA5A5` | Error indication on dark surfaces |

Yellow branding is **not** a financial success indicator. Mint is a supporting surface; confirmation still needs an explicit label/icon. Use surface-specific text colors rather than one foreground color for the whole screen. Tenant accent changes must preserve accessible pairs and never redefine success/pending/error meaning.

### Contrast checks performed on proposed pairs

Static sRGB color-pair calculations were performed; they are not a completed UI accessibility audit.

| Foreground / background | Calculated contrast |
|---|---:|
| `#171717` / `#FFEDD5` | 15.65:1 |
| `#57534E` / `#FFEDD5` | 6.66:1 |
| `#171717` / `#FBBF24` | 10.74:1 |
| `#047857` / `#D1FAE5` | 4.84:1 |
| `#92400E` / `#FEF9C3` | 6.60:1 |
| `#B91C1C` / `#FFEDD5` | 5.65:1 |
| `#FFFBEB` / `#171717` | 17.29:1 |
| `#D6D3D1` / `#171717` | 12.04:1 |

Target at least 4.5:1 for normal text and 3:1 for essential UI/graphical boundaries, with appropriate screen-reader/interaction alternatives. Recheck every actual component, transparency, chart and tenant palette during implementation. [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

## 4. Typography, spacing, shape and icons

| Element | Proposed specification |
|---|---|
| Typeface | Platform/system sans-serif; use a consistent visual hierarchy across platforms |
| Body and form text | 16 logical units, regular/medium, comfortable 1.4–1.5 line height |
| Supporting label | 14 logical units; important address/state text is not tiny fine print |
| Screen title | 24–28 logical units, semibold |
| Card title | 18–20 logical units, medium/semibold |
| Main financial value | 28–36 logical units on phone; scale up only when space permits |
| Numeric alignment | Tabular numerals; clear currency and unit labels |
| Spacing scale | 4, 8, 12, 16, 24, 32, 48 logical units |
| Phone gutter | 16 logical units; 24 when space allows |
| Card padding/gap | 16–24 padding; 12–16 gap on phone |
| Outer card radius | 24 logical units |
| Nested card/control radius | 12–16 logical units; pills fully rounded |
| Primary control height | 52–56 logical units |
| Touch area | At least 48×48 logical units; a small glyph still receives a full hit area |
| Icon family | One consistent outline vector style; typical 20/24-unit glyphs and consistent stroke weight |
| Borders/shadows | Subtle structural separation; never rely on a faint border as the only input/focus cue |

No emoji as structural icons; no letter-spaced all-caps paragraphs. Do not squeeze amounts to fit a rigid tile, clip currency, truncate money with ellipses or reduce critical text below readable size. At large text settings, stack labels/values and let cards grow vertically.

## 5. Mobile-first responsive composition

Phone layout is the baseline—not a breakpoint added after desktop. Design around 360–430 logical-unit widths and test narrower layouts/text scaling as well.

| Width class | Composition | Navigation |
|---|---|---|
| Compact phone, below 390 | One primary column; small paired KPIs only if labels/amounts genuinely fit | Labeled bottom tabs; contextual back navigation |
| Standard phone, 390–599 | One task column; optional two compact KPI cards; full-width task cards | Same bottom navigation, no desktop sidebar |
| Tablet, 600–1023 | Selected two-column panels or list/detail where useful | Adaptive rail when space permits; task priority unchanged |
| Desktop, 1024+ | Sidebar and intentional bento grid; main work area plus secondary insight panel | Persistent sidebar with stable active state |

- Large-font settings can force one column regardless of width. Width class does not override content fit.
- Keep primary action within comfortable reach; respect status bar/notch/home-indicator safe areas.
- Lists and forms remain vertically scrollable with content insets for fixed tabs/actions. Never cover the final row or error message.
- In payment forms, the review/confirm action sits above the keyboard or in a keyboard-aware footer; no overlap with the amount input.
- Replace dense desktop rows with meaningful borrower/loan cards on phone. Do not make page-wide horizontal scrolling the default.
- Landscape preserves readable content and access to actions; do not simply crop the portrait screen.
- Maps/charts are secondary views with a usable list/table/text alternative.

## 6. Role-specific navigation and home screens

| Role | Primary phone tabs | Home focus |
|---|---|---|
| Collector | Today, Routes, Customers, More | Next assigned task, cash status, pending synchronization |
| Supervisor | Overview, Team, Routes, Exceptions, More | Scoped exceptions, route progress, cash discrepancies |
| Tenant owner | Overview, Portfolio, Customers, Operations, More | Portfolio summary, cash position and required reviews |
| Customer | My obligations, Receipts, Profile | Own balances, upcoming obligations and payment evidence only |

Loan details, document review, receipts, risk cases, reports and settings are contextual destinations. Active tabs use a bounded yellow treatment with label and icon; inactive labels remain readable on the dark bar.

### Collector phone composition

```text
Workspace identity                 Session/menu
Today                              Sync status

[ Dark anchor: today's confirmed collection ]
[ Mint compact summary ] [ Yellow pending summary ]

[ Cream: next assigned stop                    ]
[ Borrower • selected address • task status    ]
[ Contextual primary action                    ]

[ Cream: today's ordered route/task list       ]

Today           Routes          Borrowers      More
```

This is a textual composition guide, not an implemented mockup. Dashboard values must reflect real permitted metrics later; no decorative fake money or unrelated personal-spending categories.

Supervisor uses the same shell but prioritizes exception cards; owner uses the same visual grammar with portfolio/report cards. The customer receives a reduced self-service view, never an internal dashboard. Do not give each role a different design identity.

## 7. Core component specification

| Component | Appearance and behavior |
|---|---|
| Anchor metric card | Dark surface, warm light text, strong amount, concise label and cutoff/freshness; restrained yellow emphasis |
| Supporting metric card | Cream, mint or pale-yellow surface; smaller amount; short explicit label; content-driven height |
| Borrower/loan list card | Cream surface, identity/task hierarchy, amount and labeled state; selected card visibly distinct |
| Route-stop card | Number/order marker, address, due work, availability state and one contextual action; no decorative portrait background |
| Primary button | Yellow with dark text on dark framing; dark with cream text inside a light work card; one primary action per decision area |
| Secondary/destructive button | Lower-emphasis secondary action; clearly labeled destructive action with semantic red, never disguised as primary yellow |
| State pill | Compact text + icon; success/mint, pending/yellow, error/red; status is not color alone |
| Input | Opaque light surface, visible label, readable entered value, clear focus/validation state; comfortable amount keypad |
| Detail section | Rounded card or clear grouped rows; expandable noncritical details rather than an endless phone form |
| Bottom sheet/dialog | Rounded opaque surface, clear heading, visible close/cancel and comfortable actions; grow to full-screen when content needs it |
| Receipt panel | Clean cream/light composition, prominent reference and explicit confirmed/provisional state; print/share treatment remains readable |
| Chart | Restrained green/mint/yellow family, labeled units/cutoff, touch-accessible details and adjacent summary/table |
| Branding preview | Workspace name/logo, selected accent, sample navigation/card/button shown together; do not preview only a color swatch |

Card tint has a purpose: cream for work, dark for anchor, mint for a bounded positive/confirmed summary, yellow for focus/pending. Avoid turning every dashboard into a random multi-color mosaic.

## 8. Screen-specific design requirements

| Screen | Required visual hierarchy |
|---|---|
| Sign-in / workspace selection | Warm light form inside dark framing; recognizable workspace identity; no distracting promotional imagery |
| Onboarding | One understandable step at a time, progress and save state; visual branding preview with readable validation |
| Borrower dossier | Assigned borrower header, relevant contact/address and active obligations; tabs/sections for history/documents; role-filtered details |
| Loan preview / detail | Distinct labels for nominal amount, charges, net amount delivered and total repayment; installment list and review state |
| Route list / detail | Next task and ordered stops first; list-to-map toggle as a secondary option; unavailable actions show a clear reason |
| Payment capture | Borrower and amount are dominant; method selector, review step and explicit result; no chart competes for space |
| Receipt / acknowledgment | Reference, amount, time and state; provisional information must not look like a confirmed payment |
| Supervisor exceptions | Severity, source evidence, responsible person and review state; separate review/resolve actions |
| Internal risk record | Neutral factual label, reason/review state and permitted actions; never a stigmatizing visual badge |
| Reports | Metric/unit/cutoff/filters before charts; readable comparison period and table/text alternative |
| Settings | Grouped labeled controls, preview where helpful, explicit save/effective-date/approval feedback |

The business/legal meaning and authorization of fields belong to the linked domain/financial/security documents. This document specifies presentation only.

## 9. States, feedback and motion

Every major screen/component needs loading, empty, error, denied, offline, stale, pending, confirmed and reconciliation-required variants where applicable.

- Use bounded skeletons matching eventual layout; no indefinite full-screen spinner over available cached information.
- Offline/stale banners show state and last refreshed time, with a visible retry/sync entry point.
- Pending capture uses explicit “Pending confirmation” or provisional labeling, not green “Paid” styling.
- Unavailable actions expose their reason; a disabled control is not unexplained low-opacity decoration.
- Validation sits beside its field; preserve safe entered values after recoverable errors.
- Payment action gives immediate press feedback and a submission state; prevent repeated taps without hiding the outcome.
- Use an opaque receipt/result panel for financial confirmation, not only a disappearing toast.
- Micro-interactions: approximately 150–250 ms, opacity/color and subtle transition only; no animated amount counters during collection entry.
- Respect reduced motion; no parallax, autoplay background scenes, continuous glow or moving financial totals.

Toda interfaz y comunicación visible para el público usa español colombiano neutral (`es-CO`). Los identificadores técnicos internos pueden permanecer en inglés. Esta decisión de idioma no cambia el sistema visual.

### Public landing hero: shared desktop and phone scroll experience

The user requested the desktop hero effect on mobile as well. This is a marketing-only exception to the operational-screen motion limits above: native vertical scrolling drives the existing illustration's pan/zoom, four story beats and route progress on both desktop and portrait phones. It is not a new video, WebGL scene or generated asset, and does not animate financial totals.

On phones, shorten the scroll distance and adapt typography, overlays and progress spacing to the viewport. Keep ordinary touch scrolling and direct navigation to plans; never intercept wheel/touch input or force the visitor to finish the sequence. Animate transforms/opacity through one coalesced animation-frame callback, not React state per scroll event. Measure progress against the actual sticky frame to avoid using a changing mobile browser chrome height. Serve the existing compressed WebP at its native resolution: viewport-width image variants undersample a tall portrait cover, while upscaled variants would increase decoder memory without adding source detail.

Reduced-motion preference and short phone/landscape viewports use a static, readable four-card layout. Switching that preference or rotating the device must correctly restore the animated scene index. Desktop behavior and the Colombia hero/Cúcuta footer wording remain unchanged. Browser emulation verifies layout and state transitions; smoothness on physical Android/iOS hardware remains a release-review item.

## 10. Tenant branding presentation

### Application identity: cobranzapp

The user confirmed the lowercase name **cobranzapp** and approved the open rounded-square **C** with a detached yellow collection-stop square. The approved identity uses circular bowls, heavy straight stems and flat-cut terminals. Lettering uses an 18-unit stroke, with spacing and stem lengths adjusted for the bold weight. No font dependency, borrowed source logo, gradient or financial cliché is embedded.

The [v2 brand kit](assets/brand-v2/README.md) contains transparent SVG/PNG isotype, wordmark and combined horizontal lockup separately. The primary variant uses charcoal `#171717` with a yellow `#FBBF24` node; the reversed variant uses cream `#FFEDD5` with the same yellow node. Single-color charcoal and white variants are included. Only the approved identity is retained.

The user approved v2 and requested separated files for application use. The [application asset pack](assets/brand-app/README.md) exposes symbol, name and combined artwork as individual transparent PNG/SVG files, with named light-surface and dark-surface variants. Artwork is copied unchanged from v2.

Use the isotype in compact navigation and favicon/launcher foreground contexts. Use the combined lockup in onboarding and generous headers; do not squeeze the full name into a small icon. Recommended minimums: 24 px square isotype, 140 px wordmark width, 180 px combined width. Reserve clear space of at least one isotype stroke width, equivalent to one-eighth of the isotype's 256-unit artboard. A small standalone brand mark is not a touch target; interactive containers retain the app's 48 px target rule.

All production exports have true transparency. Store/launcher artwork may need a platform-specific opaque background and safe-area treatment; these transparent masters are not a claim of store-ready app icons. The preview board has colored presentation surfaces and is not a production export. Trademark clearance remains pending; the user has approved the visual identity.

### Tenant identity

Workspace branding changes logo, name and a validated accent while preserving the warm neutral base, component structure and semantic status palette. Preview dark framing and daylight appearance, navigation, buttons, cards and receipts together.

Keep workspace identity visible in the header and tenant-switch transition. Use a text fallback when a logo is absent/unreadable; constrain logo dimensions without distorting proportions. Branding cannot make pending and confirmed events indistinguishable.

## 11. Visual validation and completion criteria

All items below are future design/implementation acceptance criteria, **not completed UI tests**.

- [ ] Review collector, supervisor and owner flows on phone before desktop compositions.
- [ ] Check 360/375/390/430 widths, tablet, desktop and landscape; additionally check narrow widths and largest system text settings.
- [ ] Verify source resemblance through palette, bento framing, radius and hierarchy—not copied imagery or feature names.
- [ ] Test actual text/control/chart contrasts, focus, semantic states and every tenant-accent combination.
- [ ] Test screen-reader labels/order, keyboard web use, reduced motion and appropriate status announcements.
- [ ] Verify comfortable tap targets, safe areas, keyboard-aware actions and no fixed-bar content occlusion.
- [ ] Verify long names/addresses and large money values do not truncate critical information.
- [ ] Review dark framing and proposed daylight variant under field conditions.
- [ ] Confirm loading/offline/pending/provisional screens are visibly distinct from confirmed outcomes.
- [ ] Review all core screen designs with the user before constructing components or code.

## 12. Related documents

- [Product and scope](docs/product.md)
- [Domain](docs/domain.md)
- [Field operations](docs/operations.md)
- [Financial meaning of displayed amounts](docs/financial-rules.md)
- [Security and scoped visibility](docs/security.md)
- [Documentation index](README.md)
