<!--
Diese Brand Guide wird aktuell von `sameview-web` und `sameview-website` verwendet.
Die Dateien `docs/BRAND_GUIDE.md` müssen in beiden Projekten inhaltlich identisch bleiben.
Änderungen sind daher grundsätzlich in beiden Repositories nachzuziehen.
Die Projekte teilen keinen gemeinsamen Code und keine gemeinsamen Assets;
lediglich die Markenrichtlinien werden synchron gepflegt.
-->

# Brand

Name:
SameView

Tagline:
Recreate your photos

Domain:
sameview.app

## Social Media

Instagram:
@sameviewapp

TikTok:
@sameviewapp

YouTube:
@sameviewapp

## Tone Of Voice

* ruhig
* modern
* sachlich
* praezise
* vertrauenswuerdig

Nicht:

* laut
* aggressiv
* uebertrieben
* clickbait

## Visual Principles

* Mobile first
* Minimalistic
* Modern
* Privacy focused

## Typography

### Primary Typeface

Name:
None — SameView's typography standard is the operating system's default UI
font, delivered via Tailwind CSS v4's built-in `font-sans` stack. No custom
font file, font package, or external font provider is used. This is the
current, intentional shared typography standard, not a placeholder.

Usage:
All headings, body copy, navigation, and buttons across the entire site.

Fallback stack (= the full active stack, since no custom font precedes it):
`ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
'Segoe UI Symbol', 'Noto Color Emoji'`

### Secondary / Monospace

Used for `<code>` / `<pre>` in markdown content only
(`src/styles/markdown-content.css`):
`ui-monospace, monospace` (falls back to Tailwind's default mono stack
elsewhere: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
'Liberation Mono', 'Courier New', monospace`).

### Font Weights

- 400 (normal) — default body text
- 600 (semibold) — `.prose th`, `.prose h3`
- 700 (bold) — `.heading-major`, `.heading-secondary`, `.heading-block`, `.prose h2`
- 800 (extrabold) — `.prose h1`

Italic is used only for `.prose blockquote` (markdown content).

### Font Hosting

- The current shared SameView typography standard is the system font stack —
  no web font request is made to any provider.
- No external font provider or font CDN is used.
- If a custom web font is introduced in the future, it must be hosted and
  served locally within each project (e.g. under `public/` or
  `src/assets/`), with no dependency on Google Fonts, Adobe Fonts, or any
  other third-party domain.
- Only the font weights and formats actually required by the product may be
  included.
- Font licensing must be verified to permit local web embedding before any
  font file is added.

### Cross-Product Usage

This typography definition is the shared standard for:

- `sameview.app`
- `web.sameview.app`

Each project implements the typography independently in its own styles and
configuration. The projects do not share CSS automatically.

## Brand Colors

Source of truth: `app/src/main/java/com/isardomains/sameview/ui/theme/Color.kt`
GPS colors: `app/src/main/java/com/isardomains/sameview/ui/camera/GpsGuidanceChip.kt`
Splashscreen: `app/src/main/res/values/themes.xml` + `app/src/main/res/values-v31/themes.xml`

SameView is a dark-only app. There is no light mode. All colors below are from the
active dark color scheme. The light color scheme defined in Theme.kt is never applied.

---

## Brand Identity Color

HEX: #0D1424

"#0D1424 ist die Farbe, die SameView ist."

Verwendung:
- Splashscreen background (vollflächig, erster visueller Eindruck)
- Deepest app background (fullscreen root surface, dominiert alle Screens)
- Android system splashscreen background (API 29+)
- Adaptive launcher icon background layer
- Material3 `background` in the dark color scheme
- Dominante Flächenfarbe über alle App-Screens (Camera, Compare, Settings, About)
- Dark hero sections on the website
- Page backgrounds for dark-mode website sections
- Social Media backgrounds

---

## Brand Accent Color

HEX: #4F8CFF

"#4F8CFF ist die Farbe, die SameView macht."

Verwendung:
- CTA Buttons (Hero buttons on the website)
- Links / interactive text (website)
- Slider active track and thumb (CameraScreen)
- Interactive element highlight
- About screen feedback action text
- Active state indicators
- Material3 `primary` in the dark color scheme
- Settings selected segment fill (at 22% opacity: #384F8CFF)
- Active compare badge background (at 90% opacity: #E64F8CFF)

---

## Background Colors

- **App Background** — #0D1424
  Deepest layer. Root surface behind all screens.

- **Surface** — #17202F
  Cards, tiles, compare viewports, settings card surfaces, about card surface,
  compare letterbox background. Material3 `surface`.

- **Elevated Surface** — #1E2C40
  Inner tile areas, section headers above surface level, permission icon containers,
  about icon container, settings segmented control surface.

- **Legacy Variant** — #1A1D24
  Defined as `SameViewAppSurfaceVariant`. Marked as legacy in source, kept for
  compatibility. Not recommended for new UI or website use.

---

## Text Colors

- **Primary** — #FFFFFF
  All primary labels, titles, button text, icon tints. Material3 `onBackground` and
  `onSurface`.

- **Secondary** — #C7CCD6
  Secondary labels, captions, about body/footer text, settings secondary text,
  Material3 `onSurfaceVariant`.

- **Section Heading** — #E8EEF8
  Settings card section headings only. Slightly warmer/brighter than secondary.

---

## Structural Colors

- **Divider** — #2A3445
  Horizontal separator lines. Material3 `outlineVariant`.

- **Slider Inactive Track** — #666666
  Opacity slider inactive track. Material3 `surfaceVariant`.

---

## GPS Guidance Colors

Used exclusively by the GPS proximity chip on the CameraScreen.
Semantics: how close the user is to the original photo location.

- **Near** — #4CAF50
  Distance ≤ 20 m (or ≤ 2× GPS accuracy radius). Material Green 500.

- **Medium** — #FF9800
  Distance ≤ 100 m with accuracy ≤ 50 m. Material Orange 500.

- **Far** — #F44336
  Distance > 100 m. Material Red 500.

- **Neutral** — no color accent
  GPS fix insufficient or accuracy too low (> 100 m). Chip shown without color.

---

## Splashscreen

- **Splash Background** — #0D1424
  Full-screen color shown by Android OS before first Compose frame. Identical to
  App Background. Prevents white flash on all API levels.

- **Launcher Icon Background** — #0D1424
  Adaptive icon background layer (`drawable/ic_launcher_background.xml`).
  Foreground layer contains the SameView two-frame logo in white/blue/yellow.

---

## Website Usage Guidelines

The website uses Tailwind CSS with class-based dark mode. The following mappings
align the website with the Android app color system.

Leitprinzip: Die Website soll die App widerspiegeln. #0D1424 (Brand Identity Color)
dominiert die Fläche. #4F8CFF (Brand Accent Color) wird bewusst sparsam eingesetzt —
ausschließlich für CTAs, Links und aktive Zustände. Keine blau-dominante Website.

- **Dark page background / hero sections** → #0D1424 (Brand Identity Color)
- **Cards / content panels** → #17202F (Surface)
- **Elevated card inner areas** → #1E2C40 (Elevated Surface)
- **Primary text on dark** → #FFFFFF
- **Body / secondary text on dark** → #C7CCD6
- **Dividers / borders on dark** → #2A3445
- **Hero buttons / primary CTAs** → #4F8CFF (Brand Accent Color) — sparsam einsetzen
- **Links / interactive text** → #4F8CFF (Brand Accent Color)

---

## Website / App Color Discrepancies

The following discrepancies exist between the current website and the Android app.

| Element | Website (current) | App (correct) |
|---|---|---|
| Accent / theme color | #3b82f6 (Tailwind blue-500) | #4F8CFF |
| Dark background | Tailwind default black / `white/3` | #0D1424 |
| Card surface | `white/3` on dark | #17202F |
| Elevated card | not defined | #1E2C40 |
| Secondary text | `gray-400` / `gray-300` | #C7CCD6 |

Recommended replacements:
- Replace `#3b82f6` and `#2563eb` / `#1d4ed8` with `#4F8CFF` for accent/links.
- Replace generic dark backgrounds with `#0D1424` for consistency with the app.
- Replace Tailwind card surfaces with `#17202F` where the website renders dark cards.

## Brand Assets

Logo-Dateien und App-Icon-Dateien:

* public/assets/favicon.png

Weitere vorhandene visuelle Assets:

* public/assets/screenshots/iphone/1.png
* public/assets/screenshots/ipad/1.png

Hinweis:
Die Screenshot-Dateien stammen noch aus der bestehenden Website-Struktur und sollten nur als aktuelle Website-Assets betrachtet werden, nicht automatisch als finale Store- oder Produkt-Screenshots.

Die sechs Built-in-Branding-Symbole (`heart`, `star`, `camera`, `home`, `pin`, `fire`; siehe `IMPORTED_COMPARISON_V1.md` Session Branding) sind keine markeneigenen Assets, sondern stammen aus Font Awesome Free und werden lokal mit dem Build gebündelt (kein CDN, kein nachgeladener Webfont).
