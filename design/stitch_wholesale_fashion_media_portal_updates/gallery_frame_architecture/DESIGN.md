---
name: Gallery Frame Architecture
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#005a89'
  on-tertiary: '#ffffff'
  tertiary-container: '#0073ae'
  on-tertiary-container: '#e7f2ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  canvas-mist: '#F8FAFC'
  surface-white: '#FFFFFF'
  body-ink: '#334155'
  slate-hairline: '#E2E8F0'
  status-positive: '#765B00'
  status-positive-container: '#FFDF93'
  status-danger: '#BA1A1A'
  status-danger-container: '#FFDAD6'
typography:
  display-hero:
    fontFamily: Public Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.025em
  display-hero-mobile:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Public Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.025em
  headline-md:
    fontFamily: Public Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: -0.02em
  title-md:
    fontFamily: Public Sans
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-editorial:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
    letterSpacing: '0'
  body-default:
    fontFamily: Public Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  body-micro:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: '0'
  label-eyebrow:
    fontFamily: Public Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-button:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-tag:
    fontFamily: Public Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.025em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

### Brand Personality & Audience
The design system serves luxury fashion wholesale buyers, studio directors, and showroom merchandisers. The visual voice is architectural, calm, and exacting. It operates under a strict foundational philosophy: **"The Platform is the Frame, Not the Art."** The UI deliberately recedes into the background, providing an unadorned structural armature where lookbooks, garment textiles, and raw photography retain absolute visual authority without color tint interference.

### Visual Style
The aesthetic fuses **Minimalism** and **Corporate Precision** with an editorial eye. Rather than heavy ornamentation, the system relies on disciplined whitespace, fine hairlines, pure neutral canvases, and crisp typographic hierarchy. Chroma is preserved for intentional utility—focus states, confirmed selections, and high-priority transactions. The emotional takeaway is clarity, efficiency, and quiet prestige.

## Colors

### Palette Philosophy
The palette functions across two coordinated planes:
1. **Architectural Grayscale**: Studio Mist (`#F8FAFC`) forms the ambient stage; Pure White (`#FFFFFF`) serves as elevated backing cards and image display mats; Deep Slate (`#0F172A`) anchors navigation bars, bold section identifiers, and key dark buttons; Body Ink (`#334155`) handles legible reading copy, and Slate Hairline (`#E2E8F0`) establishes subtle physical structure.
2. **Interactive Chromas**: Cobalt Blue (`#2563EB`) commands primary interactive actions (submitting orders, primary line sheet exports, upload triggers). Sky Cyan (`#0284C7`) is strictly dedicated to selection bounds, active ring outlines, and gallery focus frames.

### Color Rules & Application
- **Zero Color Bleed**: No colored tints or gradients may be applied over media preview frames. All product imagery must rest directly against Pure White (`#FFFFFF`) or transparent cutout containers.
- **Accessible Contrast**: Muted Caption (`#64748B`) is reserved for tertiary metadata, EXIF details, and inactive icons, maintaining minimum contrast against light backdrops. All interactive text links and body paragraphs use Deep Slate (`#0F172A`) or Body Ink (`#334155`).

## Typography

### Structural Hierarchy
The typography system uses **Public Sans** across all structural tiers to deliver an authoritative yet neutral Scandinavian editorial presence. Its geometric clarity matches the structural 8px rhythm of showroom collection tables without distracting from haute-couture thumbnails.

### Stylistic Instructions
- **Eyebrows & Section Indices**: Always set labels, specimen counters, and categorizations in `label-eyebrow` using full uppercase rendering with `0.05em` letter spacing (`tracking-wider`).
- **Technical Metadata**: Technical EXIF properties (e.g., color profiles, aspect ratios `4:5`, raw dimensions) should be paired with monospace system fallbacks at `11px` (`0.6875rem`) to signal machine-level data clearly.
- **Editorial Legibility**: Run body copy within `body-editorial` at a fixed line length not exceeding 68 characters.

## Layout & Spacing

### Grid & Layout System
The layout implements a **12-column responsive fluid grid** pinned to a maximum container width of `56rem` (`896px` max width) for focused curation pipelines, expanding to full-bleed utility grids for high-density multi-SKU linesheets.
- **Desktop (>= 1024px)**: 12 columns, 24px (`space-lg`) gutters, 32px (`space-xl`) outer page padding.
- **Tablet (768px – 1023px)**: 8 columns, 16px (`space-md`) gutters, 24px outer margins.
- **Mobile (< 768px)**: 4 columns, 12px gutters, 16px outer margins. Safe area insets (`env(safe-area-inset-bottom)`) apply systematically to fixed navigation chrome.

### Spacing Cadence
All spatial relationships conform to a **strict 8px base rhythm** with an allowed 4px micro increment:
- `space-xs` (4px): Inset badges, tight tag padding, dot separator margins.
- `space-sm` (8px): Icon-to-text separation, stack gaps, card metadata pairings.
- `space-md` (16px): Standard internal card padding, modal body spacing, button cluster gaps.
- `space-lg` (24px): Section separation, hero container padding.
- `space-xl` (32px): Clear-space markers around institutional logos and macro grid dividers.

## Elevation & Depth

### Atmospheric Restraint
The design relies heavily on **surface-container tiers** and **hairline boundaries** rather than stacked drop shadows. Ambient depth is achieved through slight tonal shifts between the base page (`#F8FAFC`) and foreground cards (`#FFFFFF`).

### Shadow Specifications
- **Level 0 (Flat Ground)**: Baseline `box-shadow: none` backed by Slate Hairline borders (`1px solid #E2E8F0`).
- **Level 1 (Hover & Interactive Cards)**: `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`. Barely perceptible; indicates cursor affordance.
- **Level 2 (Dropdowns & Popovers)**: `box-shadow: 0 4px 12px 0 rgba(15, 23, 42, 0.06), 0 1px 3px 0 rgba(15, 23, 42, 0.04)`. Crisp separation over adjacent gallery cells.
- **Level 3 (Modal Dialogs & Drawers)**: `box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.12)`.
- **Top / Bottom Chrome**: Floating navigation bars leverage `backdrop-filter: blur(16px)` with an `85%` opacity white fill (`rgba(255, 255, 255, 0.85)`) paired with a feather shadow `0 1px 8px rgba(0, 0, 0, 0.04)`.

## Shapes

### Form Language
The shape philosophy favors sharp, tailored geometry reminiscent of printed lookbooks and architectural vitrines. A modest roundedness level (`roundedness: 1` — base `0.25rem` / `4px`) balances technical rigor with modern software expectations.

### Corner Radius System
- **Micro Radii (`2px` / `0.125rem`)**: Status tags, small technical counters, inner progress bars.
- **Standard UI Elements (`4px` / `0.25rem`)**: Action buttons, text input fields, media presentation cards, selection tiles, linesheet rows.
- **Structural Containers (`8px` / `0.5rem`)**: Master view panels, sheet headers, modal surfaces.
- **Pills (`9999px`)**: Filter chips, avatar profile frames, verified badges, and quick-scroll dock controls.

## Components

### Buttons
- **Primary Action**: Solid Cobalt Blue (`#2563EB`) background, Pure White (`#FFFFFF`) text, `4px` border radius, `12px` SemiBold font. Height `36px` (`h-9`), horizontal padding `16px`. Hover state applies `opacity: 0.92`. Focus ring: `2px solid #0284C7` with a `2px` offset.
- **Structural / High Contrast**: Solid Deep Slate (`#0F172A`) fill with white text for file uploads and publishing actions.
- **Secondary / Ghost**: Pure White surface, Slate Hairline (`#E2E8F0`) border, Body Ink (`#334155`) text. Hover state switches background to Studio Mist (`#F8FAFC`).
- **Icon Actions**: Dimensions `32px × 32px`, centered 16px icon, rounded-full (`9999px`) or `4px` corner, background transparent with hover transitioning to `#F1F5F9`.

### Chips & Badges
- **Status Pills**: Pill-shaped (`rounded-full`), height `20px`, internal padding `2px 8px`. Typography: `label-tag`.
  - *Approved / In Stock*: Light amber container (`#FFDF93`) with Dark Bronze ink (`#241A00`).
  - *Rejected / Out of Stock*: Soft red container (`#FFDAD6`) with Crimson ink (`#93000A`).
  - *Metadata / Spec Tag*: Studio Mist container with Deep Slate ink and Slate Hairline border.

### Input Fields & Controls
- **Text & Search Inputs**: Height `36px`, Pure White background, `1px solid #E2E8F0`, rounded `4px`, padding `8px 12px`. Placeholder colored with Muted Caption (`#64748B`). On focus: border shifts immediately to Cobalt Blue (`#2563EB`) with a subtle `2px` Sky Cyan halo (`#0284C7/30`).
- **Checkboxes & Radios**: `16px × 16px` square (`rounded: 2px` for checkbox, circular for radio). Border `1.5px solid #CBD5E1`. When selected: fill Cobalt Blue (`#2563EB`) with white vector check icon. Selection rings around cards trigger a `2px` solid Sky Cyan (`#0284C7`) container border.

### Cards & Media Frames
- **Wholesale Gallery Cards**: Pure White (`#FFFFFF`) interior surface with a `1px solid #E2E8F0` frame. Padding `12px` or flush-edge for media. Images conform to strict aspect ratios (`4:5` vertical lookbook, `1:1` SKU packshot). Zero edge filters or gradients over the preview plane.
- **Floating Bar / Linesheet Docks**: Fixed bottom dock floating `16px` above the viewport edge, bounded by `rounded-full`, backdrop blur `16px`, bordered with `#E2E8F0`, lifting content with Level 2 elevation.