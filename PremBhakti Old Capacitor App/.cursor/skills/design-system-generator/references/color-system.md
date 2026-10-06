# Color System Reference / 调色板系统参考

This document describes the OKLCH-based color generation algorithm used by the Design System Generator.

## Why OKLCH?

OKLCH (Oklab Lightness-Chroma-Hue) is a perceptually uniform color space. Unlike HSL:
- **Perceptually uniform lightness**: L=50% looks equally bright across all hues.
- **Predictable chroma**: Increasing chroma always increases saturation visually.
- **Hue stability**: Changing lightness doesn't shift perceived hue (no "hue shift" problem of HSL).

This makes OKLCH ideal for generating accessible, consistent color palettes algorithmically.

## OKLCH Basics

```
oklch(L% C H)
  L = Lightness:  0% (black) → 100% (white)
  C = Chroma:     0 (gray) → ~0.4 (max saturation, varies by hue)
  H = Hue:        0°–360° (red=25, orange=70, yellow=90, green=145, cyan=195, blue=265, purple=300, pink=350)
```

## Hex to OKLCH Conversion

When the user provides a hex color, use this mental model for conversion:

| Hex Range | Approximate OKLCH |
|-----------|-------------------|
| `#ef4444` (red) | `oklch(63% 0.25 25)` |
| `#f97316` (orange) | `oklch(72% 0.20 55)` |
| `#eab308` (yellow) | `oklch(80% 0.19 90)` |
| `#22c55e` (green) | `oklch(72% 0.19 145)` |
| `#06b6d4` (cyan) | `oklch(72% 0.15 195)` |
| `#3b82f6` (blue) | `oklch(62% 0.22 265)` |
| `#6366f1` (indigo) | `oklch(55% 0.25 270)` |
| `#8b5cf6` (violet) | `oklch(57% 0.24 295)` |
| `#ec4899` (pink) | `oklch(65% 0.24 350)` |

For precise conversion, use the CSS `oklch()` function value. All modern browsers support it natively.

## 10-Step Palette Generation Algorithm

Given a base color `oklch(L_base C_base H)`, generate a 10-step palette by varying Lightness:

```
Step    Lightness    Chroma Adjustment       Purpose
──────────────────────────────────────────────────────
  50    97%          C_base × 0.10           Subtle background
 100    95%          C_base × 0.20           Light background
 200    90%          C_base × 0.35           Hover background
 300    82%          C_base × 0.55           Border light
 400    71%          C_base × 0.75           Border / icon
 500    62%          C_base × 1.00           ← Base (brand color maps here)
 600    55%          C_base × 0.95           Primary action
 700    47%          C_base × 0.85           Primary hover
 800    37%          C_base × 0.70           Strong emphasis
 900    27%          C_base × 0.55           High contrast
 950    18%          C_base × 0.40           Near-black tinted
```

### Rules:
1. **Clamp Lightness**: Never go below 10% or above 98%.
2. **Clamp Chroma**: Ensure chroma stays within the gamut for the given hue. If `C > 0.35`, cap at `0.35`.
3. **Hue stays constant**: H does not change across the scale.
4. **Brand color alignment**: Adjust the scale so the user's original color maps as closely as possible to step 500 or 600.

### Example: `#6366f1` (Indigo)

Base: `oklch(55% 0.25 270)`

```css
--color-primary-50:  oklch(97% 0.025 270);
--color-primary-100: oklch(95% 0.050 270);
--color-primary-200: oklch(90% 0.088 270);
--color-primary-300: oklch(82% 0.138 270);
--color-primary-400: oklch(71% 0.188 270);
--color-primary-500: oklch(62% 0.250 270);  /* ← brand color */
--color-primary-600: oklch(55% 0.238 270);
--color-primary-700: oklch(47% 0.213 270);
--color-primary-800: oklch(37% 0.175 270);
--color-primary-900: oklch(27% 0.138 270);
--color-primary-950: oklch(18% 0.100 270);
```

## Neutral Palette Generation

To create a brand-tinted neutral scale:

1. Take the brand color's **Hue** (H).
2. Set **Chroma** to a very low value: `0.01` to `0.025` (just enough for a subtle warmth/coolness).
3. Generate the same 10-step Lightness scale.

```css
/* For brand hue = 270 (indigo-tinted neutrals) */
--color-neutral-50:  oklch(98% 0.015 270);
--color-neutral-100: oklch(96% 0.015 270);
--color-neutral-200: oklch(91% 0.012 270);
--color-neutral-300: oklch(83% 0.012 270);
--color-neutral-400: oklch(71% 0.010 270);
--color-neutral-500: oklch(55% 0.010 270);
--color-neutral-600: oklch(45% 0.010 270);
--color-neutral-700: oklch(37% 0.012 270);
--color-neutral-800: oklch(27% 0.012 270);
--color-neutral-900: oklch(20% 0.015 270);
--color-neutral-950: oklch(13% 0.015 270);
```

## Semantic Color Generation

Derive semantic colors using fixed hue ranges, with Chroma and Lightness tuned for each role:

```
Semantic    Target Hue    Base L    Base C     Contrast Text
─────────────────────────────────────────────────────────────
Success     142–148°      65%       0.19       white
Warning     80–90°        78%       0.17       neutral-900
Error       20–30°        63%       0.24       white
Info        225–240°      62%       0.18       white
```

For each semantic color, generate 5 tokens:

```css
--color-success-light:    oklch(92% 0.06 145);    /* Subtle bg */
--color-success:          oklch(65% 0.19 145);    /* Default */
--color-success-dark:     oklch(45% 0.15 145);    /* Emphasis */
--color-success-contrast: oklch(99% 0.01 145);    /* Text on success bg */
--color-success-subtle:   oklch(97% 0.03 145);    /* Very light bg */
```

## Accessibility Validation

After generating all palettes, validate these contrast pairs meet WCAG 2.2 AA:

| Usage | Foreground | Background | Required Ratio |
|-------|-----------|------------|----------------|
| Body text | `text-primary` | `bg-primary` | ≥ 4.5:1 |
| Large text | `text-primary` | `bg-primary` | ≥ 3:1 |
| UI elements | `primary-600` | `bg-primary` | ≥ 3:1 |
| Button text | `white` | `primary-600` | ≥ 4.5:1 |
| Error text | `error` | `bg-primary` | ≥ 4.5:1 |

If a generated color fails contrast, adjust its Lightness up or down by 3-5% until it passes. Always prefer adjusting the **foreground** color over the background.
