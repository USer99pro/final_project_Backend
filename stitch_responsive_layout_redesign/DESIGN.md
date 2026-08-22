---
name: Academic Intelligence System
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
  tertiary: '#9300a9'
  on-tertiary: '#ffffff'
  tertiary-container: '#b71bcf'
  on-tertiary-container: '#ffebfb'
  error: '#be123c'
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
  tertiary-fixed: '#ffd6fd'
  tertiary-fixed-dim: '#fbabff'
  on-tertiary-fixed: '#36003e'
  on-tertiary-fixed-variant: '#7c008e'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  surface-main: '#ffffff'
  surface-muted: '#f8fafc'
  surface-accent: '#f1f5f9'
  border-subtle: '#e2e8f0'
  border-strong: '#cbd5e1'
  success: '#10b981'
  header-gradient-start: '#020617'
  header-gradient-end: '#1e1b4b'
  insight-tint: '#eff6ff'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-section:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  metric-hero:
    fontFamily: Hanken Grotesk
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-emphasized:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  display-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  container-margin: 24px
  card-padding: 20px
  section-gap: 24px
  component-gap: 16px
  item-gap: 4px
---

## Brand & Style

The design system is engineered for high-density academic and research environments, prioritizing clarity, authority, and analytical precision. It balances the serious, institutional nature of research with a modern, high-tech aesthetic.

The visual style is **Corporate Modern with subtle Glassmorphic accents**. It utilizes a deep "Midnight Slate" foundation to ground the interface, contrasted against crisp white surfaces and vibrant semantic data layers. This approach ensures that complex datasets remain the primary focus while providing a premium, refined container for intellectual work.

**Key visual principles:**
- **Information Density:** Optimized for complex data without sacrificing legibility.
- **Trusted Authority:** A dark, structured header creates a sense of stability.
- **Analytical Vibrancy:** Using purposeful, high-chroma colors specifically for data visualization and insight discovery.

## Colors

The palette is anchored by the **Slate** scale, providing a neutral, sophisticated framework that stays out of the way of data.

- **Primary Action:** Blue-600 (`#2563eb`) is used for primary interactions, links, and active states.
- **Brand Foundation:** The deep Slate-950 (`#0f172a`) and Indigo-950/900 range define the page structure and headers, providing a high-contrast anchor for the light content area.
- **Semantic Indicators:** Emerald and Rose are reserved strictly for performance indicators (growth/decline). Fuchsia is used as a secondary data category color to distinguish research-specific trends.
- **Surface Strategy:** Use `surface-main` for all primary cards. Use `surface-muted` for structural elements like table headers or secondary regions to create depth without relying on shadows alone.

## Typography

This design system uses a dual-font approach to separate branding from utility. **Hanken Grotesk** is used for headlines and high-impact metrics, providing a sharp, contemporary feel. **Inter** is used for all functional UI elements, data tables, and body text due to its exceptional legibility at small sizes.

**Usage Notes:**
- **Data Emphasis:** Use `metric-hero` for primary stat values.
- **Category Overlines:** Use `label-caps` for table headers and grouping labels to create clear visual separation.
- **Tabular Data:** Maintain `body-base` for table content, switching to `body-emphasized` only for primary identifiers (e.g., researcher names).

## Layout & Spacing

The layout follows a **Fluid Grid** model with strict horizontal rhythmic constraints. The dashboard is designed to fill the viewport, allowing data tables and charts to expand as needed for maximum visibility.

**Breakpoints & Reflow:**
- **Desktop (1280px+):** 5-column grid for stat cards, 2-column or 3-column split for charts/tables.
- **Tablet (768px - 1279px):** 2-column grid for stat cards; full-width stacked panels for charts.
- **Mobile (<767px):** Single column stack. Padding reduces from 24px to 16px.

**Spacing Rhythm:**
Use a 4px baseline. Most components should use `component-gap` (16px) for internal spacing, while `section-gap` (24px) should separate major functional blocks (e.g., the Filter bar from the Results grid).

## Elevation & Depth

Hierarchy is established through **Tonal Layering** supplemented by extremely soft, ambient shadows.

- **Level 0 (Background):** `surface-accent` (#f1f5f9) is used for the page background to make white cards pop.
- **Level 1 (Panels):** Main cards use `surface-main` (#ffffff) with a `shadow-sm` and a 1px border of `border-subtle`.
- **Level 2 (Overlays/Tooltips):** Use high-contrast shadows (`0 8px 24px rgba(15,23,42,.10)`) to ensure tooltips and dropdowns float clearly above the data layers.
- **The Header:** Employs a dark gradient with a subtle inner border (`white/15`) to simulate a floating, high-elevation glass effect at the top of the hierarchy.

## Shapes

The design system utilizes **progressive rounding** to differentiate between small components and major layout containers. While the base roundedness is `0.5rem` (8px), the system scales up for larger elements to soften the academic tone.

- **Small Components (Buttons, Chips):** 8px (`rounded-lg`).
- **Input Fields & Tooltips:** 12px (`rounded-xl`).
- **Main Panels & Stat Cards:** 16px (`rounded-2xl`).
- **Global Header:** 24px (`rounded-3xl`) for a distinct, pill-like container feel.
- **Indicators:** Progress bars and status dots use `rounded-full`.

## Components

### Buttons & Actions
- **Primary:** Solid `blue-600` with white text. Rounded 8px.
- **Secondary:** Surface `white` with `border-strong` and `text-slate-700`. Hover state uses `surface-muted`.
- **Ghost:** No border/background, used for secondary actions in tables (e.g., "Export").

### Cards (Panels)
The fundamental building block. Every card must have a 16px radius, a 1px `border-subtle`, and 20px of internal padding. Titles should be `headline-section` with a 20px bottom margin.

### Data Tables
- **Header:** `surface-muted` background with `label-caps` text.
- **Rows:** 1px solid bottom border. Rows should not have a hover background color unless the row is clickable.
- **Cell Padding:** 12px vertical, 16px horizontal.

### Input Fields & Filters
- **Style:** 12px radius, `border-strong` stroke. 
- **Focus:** `focus:ring-2 focus:ring-blue-100` to provide a soft glow effect that matches the modern aesthetic.

### Status & Insights
- **Insights Bar:** A specific tinted surface (`insight-tint`) to differentiate automated AI findings or research summaries from raw data.
- **Growth Badges:** Small, pill-shaped badges using `success` or `error` colors with 10% opacity backgrounds for "at-a-glance" performance tracking.