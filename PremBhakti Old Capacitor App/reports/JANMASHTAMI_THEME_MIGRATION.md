# Janmashtami Theme — Migration Guide

**App:** Shri Chaitanya Prem Bhakti Sangh ("Prem Bhakti" / CPBS)
**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 3.4 · Capacitor 7 (Android) · Firebase 12
**Status:** Complete — typecheck clean (`tsc --noEmit` exits 0). One manual step remains: `npm run fonts:fetch` (see [Required manual step](#required-manual-step-before-you-ship)).

---

## 1. What this was

A complete visual transformation of the app into a premium, temple-inspired Janmashtami identity — Krishna blue, temple gold, peacock green, cream — **without changing a single piece of behaviour**. Every route, API call, Firebase interaction, Capacitor bridge, and the self-hosted OTA update flow is byte-for-byte unchanged. This was a reskin of the presentation layer only.

The guiding intent was *divine and elegant, never cartoonish or cheap*. Decoration is deliberately restrained: one ornament per region, and the signature temple arch appears in only three sanctioned places.

### Non-negotiables that were honoured

- **No logic touched.** `App.tsx` (routing), `services/firebase.ts`, `capacitor.config.json`, and `ota-push.mjs` / `ota-predeploy.mjs` are all confirmed unchanged.
- **Prop contracts preserved.** Where a component was rebuilt (Header, BottomNav), the old file was turned into a re-export shim so no call site needed editing.
- **Hindi text preserved.** All Devanagari string literals survived intact (verified: zero mojibake across every changed file).
- **Brand colours kept as-is.** PhonePe, WhatsApp, Google, Instagram, and YouTube brand colours are intentionally *not* tokenised — they must stay recognisable.

---

## 2. Architecture — the design system

Everything visual now flows from one source of truth in `src/theme/`, surfaced through a single barrel import.

```
src/theme/
├── index.ts        ← barrel: import everything from "@/src/theme"
├── colors.ts       ← krishna / gold / peacock / cream / ink ramps + semantic roles
├── typography.ts   ← font stacks + textRole helpers
├── spacing.ts      ← spacing scale
├── radius.ts       ← corner radii (sm / md / card / panel)
├── shadows.ts      ← elevation
├── animations.ts   ← motion primitives (durations, easings, keyframe class names)
├── decorations.ts  ← ornament placement recipes
├── theme.ts        ← composed theme object
└── tokens.css      ← CSS custom properties (--jm-*) for the ~102 inline style sites
```

There are **two** parallel token surfaces, by design:

1. **TypeScript tokens** (`colors.ts` etc.) — consumed by Tailwind's config and by component recipes at authoring time.
2. **CSS custom properties** (`tokens.css`, `--jm-*`) — for the roughly 102 inline `style={{ color, background, fill, borderColor }}` sites across the app that Tailwind utilities cannot reach. These now read `var(--jm-*)` instead of a hardcoded hex, so there is still exactly one source of truth.

### Recipes (composable class bundles)

Import from `@/src/theme` and combine:

- `card` — surface, border, radius, shadow for content cards
- `button` — combine a variant with `button.base` (e.g. `` `${button.base} ${button.primary}` ``); `button.icon` carries `min-w-touch min-h-touch`
- `chip` — pills / tags
- `screen` — `.page` = `bg-paper min-h-full`
- `control` — form inputs; `control.base` already includes `w-full min-h-touch px-4` plus a gold focus ring

The 44px minimum touch target and the focus ring are **baked into the primitives**, so you get accessibility for free by using them.

### Primitives & ornaments

- `components/JanmashtamiHeader.tsx` and `components/JanmashtamiBottomNav.tsx` are the real implementations. The old `Header.tsx` / `BottomNav.tsx` are now thin re-export shims.
- `src/components/Card.tsx` and `src/components/SectionHeader.tsx` are shared building blocks.
- `src/assets/janmashtami/` holds 10 SVG ornament components (Krishna silhouette, peacock feather, lotus corner, flute divider, makhan handi, golden mandala, temple border, festival sparkles, etc.), all pure SVG — no raster assets, so they scale crisply and cost almost nothing in the bundle.

---

## 3. Colour tokens

Brand ramps (fixed — they do **not** flip in dark mode):

| Role | Token | Hex |
|------|-------|-----|
| Primary — Krishna Blue | `krishna-600` | `#0B2E6B` |
| Royal Temple Blue | `krishna-500` | `#103A8C` |
| Golden Accent | `gold-300` | `#FFD54F` |
| Deep Gold | `gold-500` | `#D4A017` |
| Gold text on cream (AA-safe) | `gold-700` | `#8A660F` |
| Peacock Green | `peacock-500` | `#157A6E` |
| Page cream | `cream-50` | `#FFF8E7` |
| Raised cream (cards) | `cream-25` | `#FFFDF7` |
| Border gold | `edge-gold` | `#E8C878` |

Semantic roles (these **do** flip under `.dark`, via `tokens.css`): `--jm-surface-page`, `--jm-surface-raised`, `--jm-surface-sunken`, `--jm-text-primary`, `--jm-text-secondary`, `--jm-border-card`, plus status colours `success` / `error` / `warning` / `info`.

Dark mode surfaces:

| Role | Light | Dark |
|------|-------|------|
| Page background | `#FFF8E7` | `#071529` (ink-900) |
| Card / raised | `#FFFDF7` | `#0F2242` (ink-800) |
| Primary text | `#1D2433` | `#F7F7F7` |
| Accent | `#8A660F` | `#FFD54F` |

Dark mode is class-based (`darkMode: "class"` in `tailwind.config.js`); the `.dark` class is toggled on `documentElement` from `context/SettingsContext.tsx`.

---

## 4. Typography — read this before editing text

Four Latin faces plus two Devanagari faces are self-hosted (offline-first — see [§6](#required-manual-step-before-you-ship)):

| Family | Tailwind class | Use for | Weights available |
|--------|----------------|---------|-------------------|
| **Cinzel** | `font-display` | Display / hero titles | 400 / 600 / 700 |
| **Marcellus** | `font-heading` | Section headings | **400 only** |
| **Inter** | `font-body` | Body copy, UI | full range |
| **Cormorant Garamond** | `font-serif` (decorative) | Pull-quotes, flourishes | multiple |
| **Noto Sans Devanagari** (+ display) | `font-hindi` / `font-hindi-display` | **All** Hindi text | multiple |

Two rules that will bite you if ignored:

1. **Marcellus ships Regular (400) only.** Never put `font-bold` or `font-semibold` on `font-heading` — the browser will synthesise a fake bold that looks wrong. If you need a heavier heading, use `font-display` (Cinzel has 600/700).
2. **Latin faces have no Devanagari glyphs.** Any Hindi text must use `font-hindi` / `font-hindi-display`, or it falls back to a system font mid-sentence. Detect Hindi with the regex `/[ऀ-ॿ]/`; the codebase already branches on an `isHindi` flag in most places.

> **A note on `index.html`:** a global `font-bold` used to sit on `<body>`, forcing *every* string in the app to weight 700 and flattening all typographic hierarchy. It has been replaced with `font-body`; weight is now expressed per role. This is why headings finally read as heavier than body copy.

---

## 5. How to theme a new screen (the convention)

1. Start from a recipe: `screen` for the page wrapper, `card` for content blocks, `button`/`control`/`chip` for interaction. You inherit touch targets, focus rings, and dark mode automatically.
2. Never hardcode a colour. Use a Tailwind token class (`text-krishna-600`, `bg-cream-50`, `border-edge-gold`) or, for inline styles, a CSS variable (`var(--jm-text-primary)`).
3. Headings use `font-display` (bold) or `font-heading` (regular); body uses `font-body`; Hindi uses `font-hindi*`.
4. One ornament per region. The temple arch (`.jm-arch`) is reserved for the active nav tab, the featured section crown, and the darshan tile — nowhere else.
5. Let dark mode happen on its own. Prefer semantic tokens (`text-content-primary`, `bg-paper`) that flip via `.dark`; only reach for a `dark:` variant when a fixed ramp value genuinely needs one.

### Things you should **not** "fix"

- **`ry-gold` / `ry-cream` / `ry-maroon` / `ry-brown` / `ry-sand` classes** (~717 usages). These legacy names were **repointed** in `tailwind.config.js` to Janmashtami values — they render correctly. Leave them; a mass rename is pure risk for zero visual gain.
- **Brand-colour hex** (PhonePe `#5f259f`/`#4e1e82`/`#a874e6`, WhatsApp `#25D366`/`#20bd5a`, Google, Instagram, YouTube). Kept deliberately.
- **SVG illustration fills** (e.g. the lotus artwork in `AavirbhavMahotsavSection`). That is art, not theme — remapping it would wreck the illustration.

---

## 6. Required manual step (before you ship)

**The font binaries are not in git and must be fetched once, on a machine with network access:**

```bash
npm run fonts:fetch        # downloads the 6 typefaces into public/fonts/
npm run fonts:check        # validates what's on disk (safe to wire into predeploy)
```

Why this is a separate step, and why it matters:

- This is an **offline-first Capacitor app**. `fonts.googleapis.com` is unreachable inside the device WebView with no connection, so the fonts must be *bundled*, not linked remotely.
- The binaries are large and regenerable, so they are intentionally **not committed**. `public/fonts/` currently contains only `comicbd.ttf` (kept on disk but no longer referenced) and `fonts.css`.
- The fetch script (`scripts/fetch-janmashtami-fonts.mjs`) validates every download against real font magic-numbers. This guards against a bug that existed *before* this migration, where eleven `*.woff2` files in `public/fonts/` were actually 1.6 KB "404 Not Found" HTML pages that had been silently shipped to every install. The script now refuses to write anything that isn't a real font. Flags: `--force` (re-download all), `--check` (validate only), `--ttf` (full-coverage TTFs at ~2 MB more).

**If you build without running this**, the app still works — `@font-face` simply falls through to system fonts and typography looks generic until the fetch runs. It is not a crash, but you do not want to ship it that way.

---

## 7. Verifying & building

| Check | Command | Runs in CI / here? |
|-------|---------|--------------------|
| Type safety | `npx tsc --noEmit` | ✅ Yes — currently exits 0 |
| Fonts present | `npm run fonts:check` | On your machine |
| Production build | `npm run build` | **Windows/your machine only** |

> **Why the build can't be verified in a Linux sandbox:** Vite uses esbuild, whose binary is platform-specific. `node_modules` here was populated by an `npm install` on Windows, so it holds the Win32 esbuild binary, which won't execute under Linux. This is an environment limitation, not a code problem — run `npm run build` on your normal dev machine. (Do **not** re-run `npm install` inside a Linux environment to work around it; that would swap the binary and break your Windows setup.)

The OTA push flow (`npm run ota:push`) is untouched and continues to work exactly as before.

---

## 8. PWA / status-bar colour

- `index.html` `theme-color`: `#5D1B1B` (old maroon) → `#0B2E6B` (Krishna blue). This is the pre-JS floor so the very first paint isn't a maroon flash; `App.tsx` still rewrites it to match the live gradient header once React mounts.
- `public/manifest.json`: `theme_color` → `#0B2E6B`, `background_color` → `#071529`.
- `vite.config.ts` PWA manifest: same two values.

---

## 9. Theme default & rollback

The app now ships with `janmashtami` as the default palette (`DEFAULT_THEME_COLOR` in `utils/theme.ts`). Existing installs already have a palette persisted in `localStorage` (`cpbs_theme_color`, usually `"cyan"` from a previous forced update), so a one-shot migration in `context/SettingsContext.tsx` pushes them onto the Janmashtami default exactly once (guarded by the `cpbs_janmashtami_theme_v1` flag). After that first launch, whatever the user picks in Settings is respected forever.

The user-facing palette picker in Settings and Onboarding is fully intact — only the *accent* family varies with it; the cream surfaces, gold edges, ink neutrals, typography, and ornament are fixed, so every palette choice still lands inside the festival design.

**To revert the default** (should you ever need to): change `DEFAULT_THEME_COLOR` back in `utils/theme.ts` and remove the `janmashtami` entry from `THEME_PALETTES`. Because behaviour was never touched, there is nothing else to unwind.

---

## 10. Accessibility & motion

- **Touch targets:** 44px minimum, baked into `button.base` / `control.base` / `button.icon` and the `.jm-touch` helper.
- **Focus:** a visible 3px gold `:focus-visible` ring is defined globally in `tokens.css` (and correctly *not* gated behind a hover/pointer media query, so keyboard users on touch devices and TV remotes get it too).
- **Contrast:** gold text on cream uses `gold-700` (`#8A660F`) to clear WCAG AA; a `prefers-contrast: more` block strengthens edges and text further.
- **Reduced motion:** `tokens.css` has a comprehensive `prefers-reduced-motion` guard that clamps all animation/transition to ~0, neutralises the stagger ladder, and removes purely decorative ambient layers outright (`.jm-ambient { display: none !important }`). Decorative motion is additionally class-gated so it never becomes a needless composited layer on the low-end Android devices this app targets.

---

## 11. Recommended follow-ups

- Run `npm run fonts:fetch` (the one required step above).
- Run `npm run build` on Windows to confirm the production bundle.
- The repo's `AGENTS.md` notes a `graphify update .` step to keep the knowledge graph current after code changes — run it at your convenience.
- **UTF-8 warning for future edits:** per `AGENTS.md`, never edit these `.tsx`/`.ts` files with bare PowerShell `Get-Content`/`Set-Content` — it corrupts the Devanagari into mojibake. Use the editor tools (UTF-8 safe). This migration used only UTF-8-safe edits.

See `JANMASHTAMI_THEME_CHANGELOG.md` for the file-by-file change list, and `JANMASHTAMI_THEME_AUDIT.md` for the original pre-migration audit.
