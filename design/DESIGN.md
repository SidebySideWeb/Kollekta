---
name: Atelier Dark
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
  secondary: '#c7c5d0'
  on-secondary: '#303038'
  secondary-container: '#494851'
  on-secondary-container: '#b9b7c2'
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
  secondary-fixed: '#e4e1ed'
  secondary-fixed-dim: '#c7c5d0'
  on-secondary-fixed: '#1b1b23'
  on-secondary-fixed-variant: '#46464f'
  tertiary-fixed: '#ffdea3'
  tertiary-fixed-dim: '#f5be46'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#5d4200'
  background: '#131319'
  on-background: '#e4e1ea'
  surface-variant: '#34343b'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-margin: 24px
  gutter: 16px
  safe-area-top: 44px
  safe-area-bottom: 34px
  touch-target-min: 44px
---

## Brand & Style

This design system is engineered for a high-end wholesale fashion environment, where the focus must remain entirely on photography and garment detail. The aesthetic is rooted in **Modern Minimalism** with a strictly functional, dark-mode execution.

The brand personality is sophisticated, precise, and unobtrusive. By utilizing a flat design language with no gradients or heavy shadows, the UI recedes into the background, allowing high-resolution product imagery to provide the visual depth. The emotional response should be one of professional utility and luxury exclusivity, avoiding common consumer "gloss" in favor of a technical, studio-grade interface.

## Colors

The palette is centered around a deep obsidian base (`#14141a`) to ensure maximum contrast for photography. 

- **Primary Action:** The muted indigo-violet (`#8b7bf0`) is reserved strictly for primary calls-to-action, active toggles, and selection states. It should be used sparingly to maintain its functional signaling power.
- **Surface Hierarchy:** Depth is communicated through color shifts rather than shadows. The background is the darkest layer, with cards and raised elements becoming progressively lighter to indicate interactivity.
- **Typography:** An off-white (`#f0efec`) provides high legibility for primary information without the harshness of pure white, while muted grey-purples are used to de-emphasize secondary metadata.

## Typography

The system uses a dual-font strategy:
1. **Hanken Grotesk**: A clean, contemporary sans-serif used for all standard UI elements, headings, and body copy. It provides a modern, neutral tone that fits the high-end fashion sector.
2. **JetBrains Mono**: A monospaced font used specifically for technical data, such as product SKU codes, inventory numbers, and access credentials. This reinforces the "wholesaler/industrial" aspect of the app.

Large display titles should use tighter letter spacing for a more editorial look, while small labels and monospaced codes use expanded tracking to ensure legibility on dark backgrounds.

## Layout & Spacing

This design system employs a **Fluid Grid** model based on an 8px square rhythm. 

- **Generous Breathing Room:** High-end fashion requires white space (or in this case, "dark space"). Large margins of 24px are standard for main containers.
- **Mobile Considerations:** A minimum tap target of 44px is enforced for all interactive elements. Safe area padding must be applied to top and bottom edges to accommodate hardware notches and home indicators.
- **Breakpoints:**
  - **Mobile:** Single column layout, 16px horizontal padding.
  - **Tablet:** 12-column grid, 24px margins, 2-column image gallery.
  - **Desktop:** 12-column grid, max-width 1440px, 4-6 column image gallery depending on asset aspect ratio.

## Elevation & Depth

Depth is achieved through **Tonal Layering** rather than drop shadows. This maintains the "Flat Design" aesthetic while clearly defining hierarchy:

1. **Level 0 (Background):** `#14141a` - The primary canvas.
2. **Level 1 (Cards/Lists):** `#1e1e26` - Used for grouping content and separating product entries in a feed.
3. **Level 2 (Raised/Interactive):** `#26262f` - Used for input fields, buttons in a secondary state, or floating action bars.

**Borders:** Use a subtle 1px border (`#302f3a`) to define edges on Level 1 and Level 2 surfaces. This ensures structural integrity when elements of the same tone might overlap during scroll.

## Shapes

The shape language is strictly defined by a **Rounded (8px)** corner radius. 

- All cards, buttons, and input fields use the `0.5rem` (8px) base radius.
- Images within cards should inherit this radius or remain sharp if they are full-bleed.
- Icons should be framed within 44px square containers to ensure tap target compliance, even if the visual icon size is 24px.

## Components

### Buttons
- **Primary:** Background: `#8b7bf0`, Text: `#f0efec` (Bold). No shadow.
- **Secondary:** Background: `#26262f`, Border: `#302f3a`, Text: `#f0efec`.
- **Ghost:** No background, Text: `#a5a3ae`. For low-priority actions.

### Cards
- Background: `#1e1e26`. Border: 1px `#302f3a`. 
- Padding: 16px or 24px depending on content density.
- Imagery inside cards should have an 8px radius to match the container.

### Input Fields
- Background: `#1e1e26`. Border: 1px `#302f3a`. 
- Focus State: Border color shifts to `#8b7bf0`.
- Text: `#f0efec`, Placeholder: `#706e7a`.
- Height: 48px minimum for touch accessibility.

### Chips & Tags
- Background: `#26262f`. 
- Text: `label-caps` style for status, `code-sm` for SKU identifiers.
- Radius: 4px (Soft) to differentiate from larger UI blocks.

### Lists
- Separator: 1px solid `#302f3a`.
- Active State: Left-side 4px vertical accent bar in `#8b7bf0`.

### Branding (White-label)
- Use a minimalist geometric placeholder logo.
- All logo implementations must be monochrome (Primary Text color) to avoid clashing with fashion photography.