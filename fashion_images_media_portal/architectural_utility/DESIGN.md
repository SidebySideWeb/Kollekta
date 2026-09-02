---
name: Architectural Utility
colors:
  surface: '#131319'
  surface-dim: '#131319'
  surface-bright: '#39383f'
  surface-container-lowest: '#0e0e13'
  surface-container-low: '#1b1b21'
  surface-container: '#1f1f25'
  surface-container-high: '#2a2930'
  surface-container-highest: '#34343b'
  on-surface: '#e4e1ea'
  on-surface-variant: '#c9c4d5'
  inverse-surface: '#e4e1ea'
  inverse-on-surface: '#303036'
  outline: '#928f9e'
  outline-variant: '#484553'
  surface-tint: '#c8bfff'
  primary: '#c8bfff'
  on-primary: '#2e128f'
  primary-container: '#9080f6'
  on-primary-container: '#270289'
  inverse-primary: '#5d4cbf'
  secondary: '#c7c6c4'
  on-secondary: '#2f312f'
  secondary-container: '#464745'
  on-secondary-container: '#b5b5b2'
  tertiary: '#f5be46'
  on-tertiary: '#412d00'
  tertiary-container: '#b9890a'
  on-tertiary-container: '#382700'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e5deff'
  primary-fixed-dim: '#c8bfff'
  on-primary-fixed: '#190064'
  on-primary-fixed-variant: '#4532a5'
  secondary-fixed: '#e3e2df'
  secondary-fixed-dim: '#c7c6c4'
  on-secondary-fixed: '#1b1c1a'
  on-secondary-fixed-variant: '#464745'
  tertiary-fixed: '#ffdea3'
  tertiary-fixed-dim: '#f5be46'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#5d4200'
  background: '#131319'
  on-background: '#e4e1ea'
  surface-variant: '#34343b'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  max_width: 1600px
  gutter: 24px
---

## Brand & Style
This design system is engineered for the high-stakes environment of wholesale fashion procurement. The brand personality is clinical, efficient, and sophisticated, favoring a "tools-not-toys" philosophy. It utilizes a **Minimalist-Corporate** hybrid style with a dark, low-fatigue color palette. 

The aesthetic is characterized by high-density information layouts that remain legible through generous whitespace and strict structural alignment. Visual interest is derived from the rhythm of the grid and the precision of the typography rather than decorative elements. The UI stays in the background to allow high-resolution product imagery to serve as the primary visual focus.

## Colors
The palette is centered around a deep obsidian foundation to minimize eye strain during long-form inventory reviews. 

- **Primary (Indigo-Violet):** Reserved strictly for "Hero" actions, active navigation states, and critical interactive indicators.
- **Surface Hierarchy:** The background uses `#14141a`. Content resides on `#1e1e26` cards, while hover states or elevated utility panels use `#26262f`.
- **Borders:** A consistent `#302f3a` is used for all structural divisions to maintain a crisp, blueprint-like feel.
- **Typography:** Primary information uses the off-white `#f0efec` for high contrast without the harshness of pure white. Secondary and faint tiers reduce visual noise for metadata and timestamps.

## Typography
The system employs a dual-font strategy:
1. **Hanken Grotesk:** A clean, contemporary sans-serif used for all primary UI elements and reading experiences. It provides a professional, sharp look that scales well from large headlines to small body text.
2. **Geist (Monospace):** Used specifically for SKU numbers, product codes, dimensions, and technical specifications. The monospaced nature ensures that alphanumeric strings are easy to parse and compare vertically in lists.

All labels for data fields should use the `label-caps` style to distinguish them clearly from the user data they describe.

## Layout & Spacing
The layout follows a **Fixed Grid** model with a maximum content width of 1600px. This ensures that on ultra-wide monitors, lines of text do not become unreadable and controls remain within the user's periphery.

- **Grid:** A 12-column system is used for desktop, 8-column for tablet, and 4-column for mobile.
- **Rhythm:** A strict 8px linear scale governs all padding and margins. 
- **Density:** We utilize "Generous" spacing (`md` / 24px) between major card elements and "Compact" spacing (`sm` / 12px) within card internals to maximize information density without clutter.
- **Alignment:** Content is centered in the viewport once the 1600px threshold is reached.

## Elevation & Depth
This design system avoids traditional shadows in favor of a **Tonal Layering** approach. Depth is communicated through color luminance rather than faux-lighting effects.

- **Level 0 (Base):** Background (`#14141a`) is the lowest point.
- **Level 1 (Surface):** Content cards (`#1e1e26`) with a 1px solid border (`#302f3a`).
- **Level 2 (Raised):** Hover states, tooltips, and modal surfaces (`#26262f`).

Interactive elements should not "float" or cast shadows; they should feel like precisely cut plates of material stacked on top of one another.

## Shapes
The shape language is disciplined and geometric. A standard **8px (roundedness: 2)** corner radius is applied to all cards, buttons, and input fields. 

This specific radius strikes a balance between the clinical feel of sharp corners and the overly casual nature of pill-shaped buttons. It reinforces the professional tone of the portal. Larger containers (like modals) may use `rounded-xl` (24px) for a slightly softer appearance, but internal components must strictly adhere to the 8px standard.

## Components
- **Buttons:** 
  - *Primary:* Background Indigo-Violet, text White. No shadow.
  - *Secondary:* Transparent background, 1px border `#302f3a`, text `#f0efec`.
- **Input Fields:** Background `#1e1e26`, border `#302f3a`. On focus, the border changes to Indigo-Violet. 
- **Product Cards:** Solid `#1e1e26` background. Product images should have a subtle 1px inner stroke to separate them from the dark card background if the image itself contains dark colors.
- **Chips/Status:** 
  - *Success:* Background opacity 10% of `#5cb896`, text `#5cb896`.
  - *Danger:* Background opacity 10% of `#d97070`, text `#d97070`.
- **Data Tables:** Row separators use 1px solid `#302f3a`. Headers use `label-caps` typography and `#706e7a` text color. Hovering over a row changes its background to `#26262f`.
- **SKU Tags:** Monospaced Geist font, small padding, background `#26262f`, border `#302f3a`.