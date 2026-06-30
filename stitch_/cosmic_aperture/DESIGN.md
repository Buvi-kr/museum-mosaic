---
name: Cosmic Aperture
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#c6c6cb'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#909095'
  outline-variant: '#45474b'
  surface-tint: '#c4c6cf'
  primary: '#c4c6cf'
  on-primary: '#2e3037'
  primary-container: '#0b0e14'
  on-primary-container: '#797b83'
  inverse-primary: '#5c5e66'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#d3bbff'
  on-tertiary: '#3f0689'
  tertiary-container: '#150037'
  on-tertiary-container: '#8d64d9'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e2eb'
  primary-fixed-dim: '#c4c6cf'
  on-primary-fixed: '#191c22'
  on-primary-fixed-variant: '#44474e'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ebdcff'
  tertiary-fixed-dim: '#d3bbff'
  on-tertiary-fixed: '#260059'
  on-tertiary-fixed-variant: '#572ba0'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 72px
    fontWeight: '700'
    lineHeight: 80px
    letterSpacing: -0.04em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
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
  unit: 8px
  safe-area: 32px
  mosaic-gap: 4px
  nebula-padding: 64px
---

## Brand & Style
The brand personality is mystical, immersive, and ethereal, designed to evoke the awe of stargazing at the Pocheon Art Valley. It targets enthusiasts of astronomy and art, inviting them into a collaborative "Space Photo Mosaic" where individual contributions form a celestial whole.

The design style is **Glassmorphism** layered over a **Minimalist** foundation. It utilizes deep, translucent surfaces to mimic the vastness of the cosmos. High-fidelity background blurs and "multiply" blend modes allow elements to bleed into one another organically, moving away from rigid structures toward a more fluid, nebular experience.

## Colors
The palette is rooted in the "Deep Space" spectrum. 
- **Cosmic Black (#020408):** The foundational void, used for global backgrounds.
- **Deep Navy (#0B0E14):** Used for primary UI surfaces and containers.
- **Star-glow White (#F8FAFC):** Reserved for high-contrast typography and essential icons.
- **Nebulous Accents:** Deep Violet (#4C1D95) and Starlight Blue (#3B82F6) are used for interactive highlights, glows, and gradient overlays that simulate gas clouds.

Color application should lean heavily on transparency (10-40% opacity) for container backgrounds to ensure background textures remain visible.

## Typography
The system uses **Inter** for its clinical precision and excellent legibility against dark, complex backgrounds. 
- **Display and Headlines:** Use tight letter spacing and bold weights to ground the ethereal visuals.
- **Body Text:** Increased line height (1.5x+) ensures readability on large-scale exhibition displays.
- **Labels:** Always uppercase with generous letter spacing to provide a technical, "instrumental" feel.

## Layout & Spacing
This system departs from a rigid grid in favor of an **Organic Overlap** model. While a standard 12-column grid provides the underlying structure for mobile controls, the exhibition display uses a "Safe Margin" approach (64px on desktop, 24px on mobile).

Elements should feel like they are floating. Spacing is asymmetrical; use variable padding to create a sense of drift. The "Mosaic" component itself uses a minimal 4px gap to maintain image density while allowing individual stars to shine.

## Elevation & Depth
Depth is created through **Luminance and Blur** rather than traditional shadows. 
- **Level 1 (Base):** Cosmic Black background.
- **Level 2 (Float):** Glassmorphism cards with a 20px backdrop blur and a 1px "Starlight Blue" border at 20% opacity.
- **Level 3 (Interactive):** Elements that require focus (QR codes, buttons) feature an outer glow (box-shadow: 0 0 15px) using the Starlight Blue or Deep Violet accent colors.

Use the "Multiply" blend mode for decorative background gradients to ensure they integrate seamlessly with the photo mosaic.

## Shapes
The shape language is **Rounded (Level 2)**. 
- Cards and containers use a 0.5rem (8px) radius to soften the technical feel.
- Interactive controls like "Upload" buttons should use a more pronounced 1rem radius to distinguish them from informational panels. 
- QR Code containers are the only exception, maintaining a sharp or very slightly rounded edge (4px) to ensure scanning reliability while encased in a glowing halo.

## Components
- **Glass Cards:** Semi-transparent containers with a subtle 1px border. Background should be `rgba(11, 14, 20, 0.6)`.
- **Glow QR Codes:** The QR code is inverted (white on dark) and housed in a container with a pulsing "Starlight Blue" outer glow to draw attention in low-light exhibition spaces.
- **Minimalist Upload Controls:** Mobile interface buttons use high-contrast Star-glow White text on a translucent Deep Violet background. Inputs are border-only with zero fill.
- **Photo Mosaic Cells:** Individual images in the mosaic feature a slight "Multiply" overlay of the primary navy color, which lifts on hover or selection to reveal the true colors of the photo.
- **Status Chips:** Small, pill-shaped indicators for "Live" or "New Upload" using a subtle blinking animation (1s ease-in-out).