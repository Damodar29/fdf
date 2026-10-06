# Dark Mode Guide / 暗色模式指南

This document describes the dark mode implementation strategy used by the Design System Generator.

## Strategy: Semantic Token Swapping

The design system uses **semantic tokens** that automatically resolve to the correct color in both themes. This means:
- Components NEVER reference primitive color tokens directly.
- Components use semantic tokens like `--color-bg-primary` instead of `--color-neutral-50`.
- Theme switching only changes the mapping of semantic tokens, not the components.

## Implementation Approach

### Level 1: CSS `light-dark()` Function (Preferred)

The modern `light-dark()` CSS function automatically selects between two values based on the inherited `color-scheme`. This is the cleanest approach:

```css
:root {
  color-scheme: light dark;

  /* Semantic tokens using light-dark() */
  --color-bg-primary:    light-dark(var(--color-neutral-50), var(--color-neutral-950));
  --color-bg-secondary:  light-dark(var(--color-neutral-100), var(--color-neutral-900));
  --color-bg-tertiary:   light-dark(var(--color-neutral-200), var(--color-neutral-800));
  --color-text-primary:  light-dark(var(--color-neutral-900), var(--color-neutral-50));
  --color-text-secondary: light-dark(var(--color-neutral-600), var(--color-neutral-400));
  --color-text-muted:    light-dark(var(--color-neutral-400), var(--color-neutral-500));
  --color-border:        light-dark(var(--color-neutral-200), var(--color-neutral-800));
}
```

**Browser support**: `light-dark()` is supported in Chrome 123+, Firefox 120+, Safari 17.5+.

### Level 2: Manual `[data-theme]` Attribute Override

For JavaScript-controlled theme switching (toggle button), add explicit overrides:

```css
/* Light theme (also works as default) */
:root,
[data-theme="light"] {
  color-scheme: light;
  --color-bg-primary:    var(--color-neutral-50);
  --color-bg-secondary:  var(--color-neutral-100);
  --color-text-primary:  var(--color-neutral-900);
  --color-text-secondary: var(--color-neutral-600);
  --color-border:        var(--color-neutral-200);
}

/* Dark theme */
[data-theme="dark"] {
  color-scheme: dark;
  --color-bg-primary:    var(--color-neutral-950);
  --color-bg-secondary:  var(--color-neutral-900);
  --color-text-primary:  var(--color-neutral-50);
  --color-text-secondary: var(--color-neutral-400);
  --color-border:        var(--color-neutral-800);
}
```

### Level 3: OS Preference Media Query (Fallback)

Respect the user's OS preference as a baseline:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --color-bg-primary: var(--color-neutral-950);
    /* ... dark token values ... */
  }
}
```

## Complete Semantic Token Map

### Background Tokens

| Token | Light Value | Dark Value | Usage |
|-------|-----------|-----------|-------|
| `--color-bg-primary` | neutral-50 | neutral-950 | Main page background |
| `--color-bg-secondary` | neutral-100 | neutral-900 | Card backgrounds, sidebars |
| `--color-bg-tertiary` | neutral-200 | neutral-800 | Hover states, subtle backgrounds |
| `--color-bg-inverse` | neutral-900 | neutral-50 | Inverted sections |

### Text Tokens

| Token | Light Value | Dark Value | Usage |
|-------|-----------|-----------|-------|
| `--color-text-primary` | neutral-900 | neutral-50 | Headings, body text |
| `--color-text-secondary` | neutral-600 | neutral-400 | Descriptions, labels |
| `--color-text-muted` | neutral-400 | neutral-500 | Placeholders, hints |
| `--color-text-inverse` | neutral-50 | neutral-900 | Text on inverse backgrounds |

### Interactive Tokens

| Token | Light Value | Dark Value | Usage |
|-------|-----------|-----------|-------|
| `--color-primary-surface` | primary-50 | primary-950 | Primary tinted backgrounds |
| `--color-primary-hover` | primary-700 | primary-400 | Primary hover states |
| `--color-on-primary` | white | white | Text on primary-colored backgrounds |

### Border & Divider Tokens

| Token | Light Value | Dark Value | Usage |
|-------|-----------|-----------|-------|
| `--color-border` | neutral-200 | neutral-800 | Default borders |
| `--color-border-strong` | neutral-300 | neutral-700 | Emphasized borders |
| `--color-border-focus` | primary-500 | primary-400 | Focus ring color |

### Shadow Adjustments

In dark mode, shadows need higher opacity because they're less visible against dark backgrounds:

```css
[data-theme="dark"] {
  --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.15);
  --shadow-md: 0 2px 4px oklch(0% 0 0 / 0.15),
               0 4px 8px oklch(0% 0 0 / 0.25);
  --shadow-lg: 0 4px 8px oklch(0% 0 0 / 0.12),
               0 8px 16px oklch(0% 0 0 / 0.20),
               0 16px 32px oklch(0% 0 0 / 0.30);
}
```

## Theme Toggle JavaScript

Include this minimal JavaScript for the theme toggle button:

```javascript
function initThemeToggle() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;

  // Check saved preference, then OS preference
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  root.setAttribute('data-theme', theme);

  toggle?.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}

document.addEventListener('DOMContentLoaded', initThemeToggle);
```

## Dark Mode Design Principles

1. **Don't just invert**: Dark mode is NOT white→black inversion. Use elevation (lighter surfaces for higher z-index).
2. **Reduce contrast slightly**: Pure white text (#fff) on pure black (#000) causes eye strain. Use neutral-50 on neutral-950 instead.
3. **Desaturate slightly**: Colors that work in light mode may feel too vibrant in dark mode. The OKLCH palette handles this naturally via chroma adjustments.
4. **Increase shadow opacity**: Shadows disappear against dark backgrounds. Use 2–3× higher opacity in dark mode.
5. **Test both themes**: Every component should look intentional in both themes, not just "acceptable".

## Meta Tag

Always include the color-scheme meta tag for proper browser integration (scrollbar colors, form controls):

```html
<meta name="color-scheme" content="light dark">
```
