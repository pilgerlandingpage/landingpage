---
name: Luxury Real Estate Design System
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1c1c'
  surface-container: '#1f2020'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#343535'
  on-surface: '#e4e2e2'
  on-surface-variant: '#c4c7c7'
  inverse-surface: '#e4e2e2'
  inverse-on-surface: '#303030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c9c6c5'
  primary: '#c9c6c5'
  on-primary: '#313030'
  primary-container: '#0a0a0a'
  on-primary-container: '#7b7979'
  inverse-primary: '#5f5e5e'
  secondary: '#e9c176'
  on-secondary: '#412d00'
  secondary-container: '#604403'
  on-secondary-container: '#dab36a'
  tertiary: '#c6c6c7'
  on-tertiary: '#2f3131'
  tertiary-container: '#080a0a'
  on-tertiary-container: '#78797a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c9c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#ffdea5'
  secondary-fixed-dim: '#e9c176'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5d4201'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#131314'
  on-background: '#e4e2e2'
  surface-variant: '#343535'
typography:
  display-xl:
    fontFamily: Noto Serif
    fontSize: 80px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Noto Serif
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Noto Serif
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
    letterSpacing: 0em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '300'
    lineHeight: '1.6'
    letterSpacing: 0.05em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0.03em
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.2em
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 32px
  margin-edge: 64px
  section-gap: 160px
---

## Brand & Style

The design system is engineered to evoke the feeling of a high-end editorial magazine and a private concierge service. It targets a discerning ultra-high-net-worth audience where the digital experience must mirror the exclusivity of the physical assets. 

The visual style is a fusion of **Minimalism** and **Glassmorphism**, characterized by:
- **Cinematic Scale:** Utilizing full-bleed, high-resolution architectural photography as a structural element rather than decoration.
- **Respiro Visual:** Extreme whitespace used as a luxury commodity, ensuring every element has the "room to breathe" expected in premium environments.
- **Sophisticated Contrast:** The juxtaposition of deep shadows and shimmering metallics to create a sense of depth and prestige.

## Colors

The palette is anchored in **Deep Obsidian**, providing a cinematic backdrop that allows photography to pop. **Champagne Gold** is used sparingly as a "prestige accent" for interactive elements and highlights, suggesting quality and craftsmanship.

**Pearl White** serves as the primary typography color for maximum legibility against dark backgrounds, while **Muted Slate** provides a softer hierarchy for secondary information and structural lines, preventing the UI from feeling overly harsh.

## Typography

This design system utilizes a high-contrast typographic pairing to balance heritage with modernity. 

- **Headlines:** `Noto Serif` provides an editorial, authoritative voice. Large-scale displays should use "Optical Sizing" where available to maintain thin serifs.
- **Body & UI:** `Plus Jakarta Sans` offers a clean, geometric counterpoint. Wide letter-spacing (tracking) is applied to body text and labels to enhance the sense of openness and "modern luxury" readability.

## Layout & Spacing

The design system employs a **Fixed Grid** model within a 1440px container for desktop, centered to create generous side margins. 

- **Rhythm:** A strict 8px base unit is used, but for layout-level spacing, we favor large multiples (e.g., 160px section gaps) to enforce the cinematic feel.
- **Margins:** Intentional "dead zones" are encouraged to draw the eye toward the center of the content or specific property features.
- **Fluidity:** Within property galleries, imagery should break the grid and go full-bleed to immerse the user in the environment.

## Elevation & Depth

Hierarchy is established through **Glassmorphism** and **Subtle Tonal Layers** rather than heavy shadows.

- **Surface Layers:** The base layer is Deep Obsidian (#0A0A0A). Floating panels use a 5% Pearl White overlay with a 20px backdrop blur to create a frosted glass effect.
- **Shadows:** Where used (primarily on cards), shadows must be extra-diffused (40px+ blur) with very low opacity (15%) and tinted with the Deep Obsidian color to appear as ambient occlusion rather than a drop-shadow.
- **Dividers:** Use 1px "Hairline" dividers in Muted Slate (#4A4A4A) at 30% opacity to separate content sections without interrupting the visual flow.

## Shapes

The design system adopts a **Sharp (0)** roundedness philosophy. 

Square corners evoke architectural precision, custom masonry, and structured elegance. This sharp aesthetic applies to all primary components including buttons, input fields, and image containers. Exceptions are made only for small functional icons or status indicators where a circle is required for universal recognition.

## Components

### Buttons
- **Primary:** Champagne Gold gradient with a subtle metallic sheen. Text is Obsidian for contrast. No borders.
- **Ghost:** 1px Champagne Gold border, transparent background, Gold text. On hover, a subtle glass fill appears.
- **Interaction:** Micro-transitions should be slow and fluid (300ms+) to maintain a calm, premium feel.

### Cards
- **Property Cards:** Full-bleed imagery with a bottom-up Obsidian gradient overlay. Text (Price, Location) is overlaid in White and Gold.
- **In-Card Padding:** Generous (32px or more) to ensure metadata does not feel crowded.

### Form Inputs
- **Style:** Underline-only inputs using Muted Slate. Labels move to a "Label-Caps" style above the line when active.
- **Focus State:** The underline transitions to Champagne Gold.

### Property Features
- **Dividers:** Elegant, thin-line dividers that span the width of the container but fade out at the edges to maintain whitespace continuity.
- **Imagery:** Full-width cinematic sections with "Parallax" scrolling effects to emphasize the scale of the properties.

### Additional Components
- **Curated Collection List:** Minimalist lists with large index numbers (e.g., 01, 02) in Muted Slate.
- **Navigation:** A persistent, glassmorphic top-bar with ultra-thin gold accents on active states.