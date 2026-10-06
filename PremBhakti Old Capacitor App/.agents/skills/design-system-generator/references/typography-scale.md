# Typography Scale Reference / 字体比例系统参考

This document defines the typography scale system used by the Design System Generator.

## Type Scale

The default scale uses a **Major Third** ratio (1.250). Each step multiplies the base size by 1.25.

### Scale Table

| Token Name | Scale | Size (rem) | Size (px) | Usage |
|-----------|-------|-----------|-----------|-------|
| `--font-size-xs` | -2 | 0.64rem | 10.24px | Captions, fine print |
| `--font-size-sm` | -1 | 0.80rem | 12.80px | Small text, labels |
| `--font-size-base` | 0 | 1.00rem | 16.00px | Body text (base) |
| `--font-size-md` | 1 | 1.25rem | 20.00px | Large body, subheadings |
| `--font-size-lg` | 2 | 1.563rem | 25.00px | Section headings (h4) |
| `--font-size-xl` | 3 | 1.953rem | 31.25px | Page headings (h3) |
| `--font-size-2xl` | 4 | 2.441rem | 39.06px | Major headings (h2) |
| `--font-size-3xl` | 5 | 3.052rem | 48.83px | Hero headings (h1) |
| `--font-size-4xl` | 6 | 3.815rem | 61.04px | Display text |

### Formula
```
size = base_size × ratio^step
     = 1rem × 1.25^step
```

### Alternative Scales

If the user requests a different feel:

| Scale Name | Ratio | Feel |
|-----------|-------|------|
| Minor Second | 1.067 | Very tight, compact UIs |
| Major Second | 1.125 | Subtle, dense content |
| Minor Third | 1.200 | Gentle, readable |
| **Major Third** | **1.250** | **Default — balanced** |
| Perfect Fourth | 1.333 | Dramatic, editorial |
| Augmented Fourth | 1.414 | Bold, impactful |
| Golden Ratio | 1.618 | Classic, spacious |

## Font Weight Scale

| Token | Value | CSS Keyword | Usage |
|-------|-------|-------------|-------|
| `--font-weight-thin` | 100 | Thin | Decorative only |
| `--font-weight-light` | 300 | Light | De-emphasized text |
| `--font-weight-regular` | 400 | Normal | Body text |
| `--font-weight-medium` | 500 | Medium | Subtle emphasis |
| `--font-weight-semibold` | 600 | Semi-Bold | Headings, labels |
| `--font-weight-bold` | 700 | Bold | Strong emphasis |
| `--font-weight-extrabold` | 800 | Extra-Bold | Hero text |

## Line Height Scale

Line heights are unitless values (relative to font size):

| Token | Value | Usage |
|-------|-------|-------|
| `--line-height-none` | 1 | Single line elements (badges) |
| `--line-height-tight` | 1.25 | Headings |
| `--line-height-snug` | 1.375 | Subheadings |
| `--line-height-normal` | 1.5 | Body text (default) |
| `--line-height-relaxed` | 1.625 | Long-form reading |
| `--line-height-loose` | 2 | Spacious text |

## Letter Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--letter-spacing-tighter` | -0.05em | Large display text |
| `--letter-spacing-tight` | -0.025em | Headings |
| `--letter-spacing-normal` | 0em | Body text |
| `--letter-spacing-wide` | 0.025em | Small text for readability |
| `--letter-spacing-wider` | 0.05em | Labels, button text |
| `--letter-spacing-widest` | 0.1em | All-caps text |

## Font Family Stacks

### Default Stacks

```css
--font-family-sans:  'Inter', 'Noto Sans SC', system-ui, -apple-system, sans-serif;
--font-family-serif: 'Noto Serif', 'Noto Serif SC', Georgia, 'Times New Roman', serif;
--font-family-mono:  'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
```

### Google Fonts Recommendations

Popular pairings that work well for design systems:

| Heading Font | Body Font | Style |
|-------------|-----------|-------|
| Outfit | Inter | Modern, clean |
| Space Grotesk | DM Sans | Technical, geometric |
| Sora | Nunito Sans | Friendly, rounded |
| Playfair Display | Source Sans 3 | Elegant, editorial |
| Plus Jakarta Sans | Plus Jakarta Sans | Versatile, professional |

### Chinese Font Support

When `font-family` includes a Chinese font, add the appropriate Noto CJK font:

```css
/* For Simplified Chinese projects */
--font-family-sans: 'Inter', 'Noto Sans SC', system-ui, sans-serif;

/* For Traditional Chinese projects */
--font-family-sans: 'Inter', 'Noto Sans TC', system-ui, sans-serif;

/* For Japanese projects */
--font-family-sans: 'Inter', 'Noto Sans JP', system-ui, sans-serif;
```

## Responsive Typography

Include fluid typography using `clamp()`:

```css
--font-size-base: clamp(0.875rem, 0.8rem + 0.25vw, 1rem);
--font-size-3xl: clamp(1.953rem, 1.5rem + 1.5vw, 3.052rem);
--font-size-4xl: clamp(2.441rem, 1.8rem + 2vw, 3.815rem);
```

Only apply `clamp()` to sizes `lg` and above. Smaller sizes should stay fixed for readability.
