---
name: prem-bhakti-ui
description: House UI rules for the Prem Bhakti (CPBS) app — Janmashtami design tokens, recipes, fonts, Hindi text, dark mode, touch targets, toasts, and how to check a screen at phone width. Use for any UI change in this repo (new screen, component, restyle, bug in layout or colours) before writing JSX or CSS; general design skills (frontend-design, redesign-skill, emil-design-eng) apply inside these rules.
---

# Prem Bhakti UI rules

The app is a devotional app for Shri Chaitanya Prem Bhakti Sangh: React 19 + Vite + Tailwind 3.4, shipped as a Capacitor 7 Android app and as a PWA. Most users are on low-end Android phones, many read Hindi. The look is the **Janmashtami theme** — Krishna blue, temple gold, peacock green, cream — "divine and elegant, never cartoonish". Full background: `reports/JANMASHTAMI_THEME_MIGRATION.md`.

## 1. Before you change anything

- Change only what was asked. Keep each element's structure: asked to "apply the theme colour" to a button or icon, colour the icon/text/border — don't turn it into a filled button (AGENTS.md, "UI Modification Rules").
- Never touch behaviour while restyling: routing in `App.tsx`, Firebase calls, Capacitor bridges, OTA code.
- Files with Devanagari text must be edited with UTF-8-safe tools — never bare PowerShell `Get-Content`/`Set-Content` (AGENTS.md).

## 2. Build from the design system

Everything visual comes from `src/theme/` (import from `@/src/theme` or a relative path to `src/theme`):

| Need | Use |
|---|---|
| Page wrapper | `screen.page` (`bg-paper min-h-full`), `screen.content` for padding and max width |
| Content block | `card.base`, `card.interactive` for tappable cards |
| Buttons | `` `${button.base} ${button.primary}` `` — variants `primary`, `royal`, `secondary`, `ghost`, `danger`; icon buttons `button.icon` |
| Tags / pills | `` `${chip.base} ${chip.gold}` `` — also `peacock`, `royal`, `neutral` |
| Inputs | `control.input`, `control.label` |
| Text | `textRole.*` — `display`, `screenTitle`, `sectionTitle`, `cardTitle`, `cardSubtitle`, `body`, `reading`, `verse` |
| Motion | `src/theme/animations.ts` durations/easings; keyframe classes in `src/theme/tokens.css` |
| Shared pieces | `src/components/Card.tsx`, `src/components/SectionHeader.tsx`, ornaments in `src/assets/janmashtami/` |

Colour rules:
- Never hardcode a hex. Use token classes (`text-krishna-600`, `bg-cream-50`, `border-edge-gold`, `text-gold-700`) or, in inline styles, CSS variables (`var(--jm-text-primary)`).
- Prefer semantic classes that flip in dark mode by themselves: `bg-surface-page|raised|sunken`, `text-content-primary|secondary|muted|accent`. Add a `dark:` variant only when a fixed ramp colour truly needs one.
- Gold text on cream must be `gold-700` (`#8A660F`) or darker for contrast.
- Leave alone: legacy `ry-gold` / `ry-cream` / `ry-maroon` / `ry-brown` / `ry-sand` classes (already mapped to the new palette), brand colours (PhonePe, WhatsApp, Google, Instagram, YouTube), and SVG illustration fills.
- Ornament restraint: one ornament per region. The temple arch (`.jm-arch`) is only for the active nav tab, the featured section crown and the darshan tile.

## 3. Type and Hindi

Font stacks are defined in `src/theme/typography.ts` (the code wins if a report in `reports/` disagrees):

| Class | Stack | For |
|---|---|---|
| `font-display`, `font-heading`, `font-decorative` | Playfair Display → Georgia → serif, Devanagari via Noto Serif Devanagari | Screen titles, headings, verses |
| `font-body` (also `font-sans`, `font-inter`) | Roboto (the phone's UI font) + Noto Sans Devanagari | UI and reading |
| `font-hindi`, `font-hindi-display` | Devanagari-first stacks | Mostly-Hindi text |

- Only the two Devanagari faces are bundled (`public/fonts/fonts.css`); Latin text uses the device's fonts. This is an offline-first app: never link Google Fonts or any remote font — a new face must be self-hosted in `public/fonts/`.
- Screens branch on language with `const { settingsLanguage } = useSettings(); const isHindi = settingsLanguage === "hi";`. Every user-facing string needs both versions: `isHindi ? "…हिंदी…" : "English"`.
- Hindi runs longer and taller than English — leave room (no fixed heights on text rows, allow wrapping, check line-height).

## 4. Interaction

- Touch targets at least 44px: `min-h-touch` / `min-w-touch` (already inside `button.base`, `button.icon`, `control.input`).
- Keep the global gold `:focus-visible` ring; don't remove outlines.
- Messages to the user: `const { showToast } = useToast();` then `showToast(message, "success" | "error" | "info")` (`context/ToastContext.tsx`). Errors say what happened and what to do, in both languages.
- Icons: `lucide-react`. Animation: framer-motion or the CSS classes in `tokens.css`; animate transform/opacity only, and respect the existing `prefers-reduced-motion` guard.
- The Android back button is handled in `App.tsx`; needing 3 presses to exit from Home is intentional.
- Safe areas: header `components/JanmashtamiHeader.tsx`, bottom nav `components/JanmashtamiBottomNav.tsx` — check existing `env(safe-area-inset-*)` use before adding more.

## 5. Check it before saying it's done

1. `npx tsc --noEmit` passes.
2. Run the dev server (`npm run dev`, http://localhost:3000; in Claude Code use the browser preview's `web-dev` config) and look at the screen at **375×812**, in **light and dark**, in **English and Hindi**.
3. Look for: text overflowing or clipped (Hindi especially), hardcoded colours that don't flip in dark mode, targets under 44px, content under the header or bottom nav, and console errors.
4. Share a screenshot as proof when the tool allows it.

Related skills: `frontend-design`, `redesign-skill`, `emil-design-eng`, `mobile-native`, `safe-area-handling`, `web-design-guidelines`, and `prem-bhakti-ship` for checks and release.
