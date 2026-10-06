# Spacing System Reference / 间距系统参考

This document defines the spacing scale used by the Design System Generator.

## Base Unit

The spacing system uses a **4px base unit**. All spacing values are multiples of 4px, ensuring pixel-perfect alignment on all screens.

## Spacing Scale

| Token | Multiplier | Value (rem) | Value (px) | Usage |
|-------|-----------|-------------|------------|-------|
| `--spacing-0` | 0× | 0 | 0px | Reset |
| `--spacing-px` | — | 1px | 1px | Hairline borders |
| `--spacing-0.5` | 0.5× | 0.125rem | 2px | Micro gap |
| `--spacing-1` | 1× | 0.25rem | 4px | Tight inline spacing |
| `--spacing-1.5` | 1.5× | 0.375rem | 6px | Small icon gap |
| `--spacing-2` | 2× | 0.5rem | 8px | Compact padding |
| `--spacing-2.5` | 2.5× | 0.625rem | 10px | Small element padding |
| `--spacing-3` | 3× | 0.75rem | 12px | Default inline padding |
| `--spacing-4` | 4× | 1rem | 16px | Default padding |
| `--spacing-5` | 5× | 1.25rem | 20px | Medium padding |
| `--spacing-6` | 6× | 1.5rem | 24px | Component gap |
| `--spacing-8` | 8× | 2rem | 32px | Section padding |
| `--spacing-10` | 10× | 2.5rem | 40px | Large padding |
| `--spacing-12` | 12× | 3rem | 48px | Section margin |
| `--spacing-16` | 16× | 4rem | 64px | Page section gap |
| `--spacing-20` | 20× | 5rem | 80px | Large section gap |
| `--spacing-24` | 24× | 6rem | 96px | Hero spacing |
| `--spacing-32` | 32× | 8rem | 128px | Max spacing |

## Density Modes

The spacing system supports three density modes by scaling the base unit:

| Density | Scale Factor | Base Padding | Component Gap |
|---------|-------------|-------------|---------------|
| `compact` | 0.75× | 12px | 16px |
| `comfortable` | 1.00× | 16px | 24px |
| `spacious` | 1.25× | 20px | 32px |

Implementation uses a CSS custom property multiplier:

```css
:root {
  --density-factor: 1;     /* comfortable (default) */
}

[data-density="compact"] {
  --density-factor: 0.75;
}

[data-density="spacious"] {
  --density-factor: 1.25;
}

/* Usage in components */
.card {
  padding: calc(var(--spacing-4) * var(--density-factor));
  gap: calc(var(--spacing-6) * var(--density-factor));
}
```

## Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0px | No rounding |
| `--radius-sm` | 4px | Subtle rounding |
| `--radius-md` | 8px | Default (cards, inputs) |
| `--radius-lg` | 12px | Prominent rounding |
| `--radius-xl` | 16px | Large elements |
| `--radius-2xl` | 24px | Modal, dialog |
| `--radius-full` | 9999px | Pill shape (buttons, badges) |

### Style Presets

| Preset | `--radius-md` | Feel |
|--------|--------------|------|
| `sharp` | 2px | Technical, precise |
| `rounded` | 8px | Modern, balanced (default) |
| `pill` | 9999px | Playful, soft |

## Shadow Scale

Shadows use layered values for natural depth:

```css
--shadow-sm:
  0 1px 2px oklch(0% 0 0 / 0.05);

--shadow-md:
  0 2px 4px oklch(0% 0 0 / 0.05),
  0 4px 8px oklch(0% 0 0 / 0.10);

--shadow-lg:
  0 4px 8px oklch(0% 0 0 / 0.04),
  0 8px 16px oklch(0% 0 0 / 0.08),
  0 16px 32px oklch(0% 0 0 / 0.12);

--shadow-xl:
  0 8px 16px oklch(0% 0 0 / 0.04),
  0 16px 32px oklch(0% 0 0 / 0.08),
  0 24px 48px oklch(0% 0 0 / 0.16);
```

### Dark Mode Shadows

In dark mode, use slightly higher opacity and optionally tint shadows with the brand color for a premium feel:

```css
[data-theme="dark"] {
  --shadow-md:
    0 2px 4px oklch(0% 0 0 / 0.20),
    0 4px 8px oklch(0% 0 0 / 0.30);
}
```

## Z-Index Scale

A structured z-index system prevents z-index wars:

| Token | Value | Usage |
|-------|-------|-------|
| `--z-behind` | -1 | Behind content |
| `--z-base` | 0 | Default |
| `--z-raised` | 1 | Slightly above |
| `--z-dropdown` | 10 | Dropdowns, selects |
| `--z-sticky` | 20 | Sticky headers |
| `--z-overlay` | 30 | Overlays, backdrops |
| `--z-modal` | 40 | Modals, dialogs |
| `--z-popover` | 50 | Popovers, tooltips |
| `--z-toast` | 60 | Toast notifications |

## Transition Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | 100ms ease-out | Micro-interactions (hover color) |
| `--transition-normal` | 200ms ease-in-out | Standard transitions (menus) |
| `--transition-slow` | 350ms ease-in-out | Major transitions (modals) |
| `--transition-spring` | 500ms cubic-bezier(0.34, 1.56, 0.64, 1) | Bouncy effects |

### Respecting Motion Preferences

Always wrap animations in `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
