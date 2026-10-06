# Janmashtami Theme — Visual Audit

**App:** Prem Bhakti / CPBS (Chaitanya Prem Bhakti Sangh) · `com.cpbs.bhajans`
**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 3.4 · Capacitor 7 (Android) · Firebase 12
**Audited:** 2026-08-22 · version 45.0.1
**Surface:** 109 `.tsx` files · 6,564 `className` attributes · 1 stylesheet

---

## 1. How styling actually works here

Before any inventory, the single most important architectural fact: **this app has essentially no CSS.** There is exactly one authored stylesheet, `index.css` (445 lines), and it contains only Tailwind directives, keyframes, scrollbar rules and a 25-child stagger ladder. Every visual decision in the product lives in inline Tailwind utility strings inside TSX.

That has one consequence that shapes this entire migration: **there is no stylesheet to rewrite.** Re-theming means either editing ~9,400 individual utility class usages by hand, or changing what the existing class names *resolve to*. The migration plan in section 9 does the latter wherever it is safe and the former wherever it is visible.

The second important fact: the app already has a **runtime theme engine**. `utils/theme.ts` exposes `applyThemeColor()`, which writes `--color-primary-50`…`--color-primary-900` onto `document.documentElement`. `tailwind.config.js` maps the `saffron-*` family onto those variables. `SettingsContext.tsx:423` applies the user's saved choice, persisted as `cpbs_theme_color`. Users pick from 16 palettes in both Settings and Onboarding. Any theme work must go *through* this engine rather than around it — Phase 13 forbids removing features.

---

## 2. Screen inventory

Navigation is a **custom state machine**, not react-router. `activeTab: AppTab` plus a `tabHistory` stack drive the five bottom tabs; overlay screens are booleans (`isSettingsOpen`, `isProfileOpen`, `isSideMenuOpen`, …) pushed onto `window.history` so the Android back button works. `Header` and `BottomNav` are rendered once, globally, in `App.tsx` (lines 1975 and 2166).

### Primary tabs

| Tab | Label (en / hi) | Component |
|---|---|---|
| `home` | Home / होम | `components/HomeScreen.tsx` |
| `songs` | Bhajans / भजन | `components/BhajanList.tsx` |
| `books` | Books / ग्रंथ | `components/BookList.tsx` |
| `lectures` | Audio / ऑडियो | `components/LectureList.tsx` |
| `library` | History / इतिहास | `components/HistoryList.tsx` |

### Content & devotional screens

`ActivitiesScreen` · `DailyDarshanScreen` · `DailyQuotes` · `EventsScreen` · `VideosScreen` · `AudioScreen` · `SevaCenterScreen` (centers) · `DonateScreen` · `TempleTimingsScreen` · `InformationScreen` · `HistoryAuthorsScreen` · `GuruMaharajScreen` · `VirahiMaharajScreen` · `AboutScreen` · `AavirbhavMahotsavSection` · `HorizontalGallery`

### Readers & players

`BhajanReader` · `BookReader` · `AudioPlayer` · `MiniPlayer` · `QueueManager` · `YouTubePlayer` · `DownloadedList` · `DownloadManager`

### Account, settings, system

`ProfileScreen` · `SettingsScreen` · `OnboardingScreen` · `SideMenu` · `SplashScreen` · `NotificationsPermissionScreen` · `PrivacyPolicyScreen` · `TermsOfServiceScreen` · `DeveloperOptions` · `AppUpdaterScreen` · `ForceUpdateScreen` · `ForceOtaUpdateScreen` · `GlobalErrorBoundary` · `OfflineBanner` · `SmartAppBanner`

### Social embeds

`screens/YouTubeScreen` · `screens/InstagramScreen` · `screens/FacebookScreen`

### Modals & overlays

`FeedbackModal` · `GlorificationModal` · `ThankYouPopup` · `QuotePopup` · `CommentsModal` · `DownloadConfirmModal` · `ProfilePreviewModal` · plus three modals defined inline in `HomeScreen` (help, external-link confirm, and a duplicate of the SideMenu tour dialog).

### Admin

Two parallel trees — `components/admin-panel/**` (13 managers) and `src/components/admin-panel/**` (10 managers). Visually these are a **different application**: near-100% stock slate/blue/emerald/indigo with zero brand tokens.

---

## 3. Component inventory — what exists, what is missing

**What exists:** `components/ui/` holds three files, `button.tsx`, `drawer.tsx`, `sonner.tsx`.

**What is missing:** everything else. There is no `Card`, no `Section`, no `SectionHeader`, no `Heading`, no `Badge`, no `Input`, no `Typography` primitive anywhere in the project. The two files matching `*Card*.tsx` (`profile/FamilyMemberCard`, `profile/ProfileCompletionCard`) are domain components, not primitives.

Consequently cards are hand-rolled: the pattern `rounded-*` co-occurring with `shadow`/`border` appears **502 times across 72 files**. Buttons likewise — raw `<button className="…">` appears **883 times across 91 files**.

### The dead shadcn layer

`components/ui/button.tsx` is a stock shadcn + `class-variance-authority` component with 6 variants and 4 sizes. It is **100% dead code** — grepping `buttonVariants`, `{ Button }` and `ui/button` returns matches only inside the file itself. `drawer.tsx` is also never imported. Only `sonner.tsx` is live (`index.tsx:38`).

Worse, it could not work if it were used: its variants reference `bg-primary`, `text-primary-foreground`, `ring-ring` and `border-input`, and **none of those tokens are defined** in `tailwind.config.js`. The theme uses `ry-*`/`jm-*`/`saffron-*`; the shadcn CSS-variable scale was never installed. This is a latent trap for anyone who reaches for `<Button>`.

---

## 4. Colour usage map

**~9,422 un-themed colour usages against 1,321 themed ones — a 7:1 ratio.**

### 4a. Brand tokens (defined in `tailwind.config.js`)

| Token | Value | Usages |
|---|---|---|
| `saffron-*` | `var(--color-primary-N)` | **603** |
| `ry-gold` | `#D4AF37` | **529** |
| `ry-cream` | `#F9F3E5` | 98 |
| `ry-maroon` | `#5D1B1B` | 44 |
| `ry-sand` | `#F2EBDA` | 33 |
| `ry-brown` | `#4A3B32` | 13 |
| `jm-accent` | `#fbbf24` | 1 |
| `jm-primary` | `#0f172a` | **0 — dead** |
| `jm-secondary` | `#0d9488` | **0 — dead** |

Only `saffron-*` is CSS-variable-backed and therefore runtime-themeable. Every `ry-*` token is baked hex, which is why the user's palette picker visibly fails to change most of the app.

### 4b. Stock Tailwind palette — the real design system

| Palette | Usages |
|---|---|
| **slate** | **5,871** |
| blue | 764 |
| red | 679 |
| pink | 362 |
| emerald | 284 |
| green | 196 |
| amber | 173 |
| rose | 171 |
| indigo | 157 |
| orange | 152 |
| purple | 114 |
| neutral / gray / yellow / teal / zinc / others | ~185 |

`slate` alone is **64% of all colour utilities**. Heaviest shades: `text-slate-400` (689), `bg-slate-800` (563), `text-slate-500` (501), `border-slate-700` (500), `border-slate-200` (394).

This is the highest-leverage finding in the audit. Slate is a *blue-tinted* neutral, which means it can be redefined toward Krishna blue without any of the 5,871 call sites changing, and without hue clashes.

### 4c. Raw hex — 212 occurrences across 39 files

| Hex | Count | Role |
|---|---|---|
| `#bc8d31` | **66** | undeclared shadow brand gold |
| `#2a0808` | **22** | undeclared dark maroon surface |
| `#3a1010` | 10 | maroon surface |
| `#d4af37` | 9 | literal duplicate of `ry-gold` |
| `#8eaa39` / `#7c912f` / `#743629` | 17 | Aavirbhav green/brown, unrelated to any theme |
| `#0b1d3a` / `#0a2647` | 8 | navy — already Janmashtami-adjacent |
| brand marks (`#5f259f`, `#fbbc05`, `#ea4335`, `#4285f4`, `#34a853`) | 12 | PhonePe / Google — **must not be re-themed** |

**There are at least eight distinct golds in play:** `#D4AF37`, `#bc8d31`, `#e5a423`, `#a0782a`, `#a67c2b`, `#a67a26`, `#ffc230`, plus `saffron-500`. `#bc8d31` — the most-used gold in the app — has no token at all and is concentrated in `BackupRestoreSection` (20), `AudioScreen` (18), `FeedbackModal` (15).

### 4d. Colliding gold systems

**27 files render `ry-gold` and `saffron-*` side by side**, so two competing golds appear in the same viewport. Worst: `SettingsScreen` (65 / 1), `BookList` (22 / 12), `InformationScreen` (15 / 3), `Header` (14 / 1), `AudioScreen` (1 / 99), `BhajanReader` (1 / 37).

### 4e. Inline styles

237 `style={{…}}` occurrences, of which ~102 set a colour property (`color` 33, `fill` 31, `backgroundImage` 22, `backgroundColor` 14, `background` 7, `borderColor` 6, `border` 5). Concentrated in `SettingsScreen` (20), `DonateScreen` (12), `MandalManager` (10). These bypass Tailwind entirely and cannot be re-themed by token remapping — they need hand edits.

---

## 5. Typography usage map

### The core problem

`index.css:51` sets, on `body`:

```css
font-family: "Comic Sans MS", cursive !important;
```

And `tailwind.config.js:42-48` defines:

```js
hindi:  ['"Comic Sans MS"', 'cursive'],
sans:   ['"Comic Sans MS"', 'cursive'],
logo:   ['"Comic Sans MS"', 'cursive'],
serif:  ['"Playfair Display"', "Georgia", "serif"],
inter:  ['"Comic Sans MS"', 'cursive'],
```

**Four of the five font utilities are aliases for the same face.** `font-hindi`, `font-sans`, `font-logo` and `font-inter` are visually identical no-ops. `font-inter` has **zero usages**. `font-serif` is the only utility that changes anything, and it names Playfair Display — a font that **is not shipped**, so it silently renders Georgia.

A devotional Krishna-consciousness app currently renders its entire scripture, bhajan and lecture corpus in Comic Sans. This is the single largest brand defect in the product.

### Font files on disk

`public/fonts/` contains `comicbd.ttf` (117 KB, real) and **eleven 1.6 KB `.woff2` stubs** — NotoSans ×4, NotoSansDevanagari ×4, Comfortaa ×4, DancingScript ×1. All are placeholders that were never populated; none is referenced by `fonts.css`, which declares only Comic Sans. Devanagari therefore renders through the Android system fallback today, because Comic Sans is `unicode-range`-limited to `U+0000-024F`.

### Hierarchy

| Utility | Usages | Files |
|---|---|---|
| `font-bold` | **1,212** | 92 |
| `text-lg` | 166 | 63 |
| `text-xl` | 79 | 45 |
| `text-2xl` | 37 | 18 |
| `font-hindi` / `serif` / `logo` / `inter` | 71 | 21 |

There is **no hierarchy discipline**. Heading level and visual size are fully decoupled — `<h1>`, `<h2>`, `<h3>`, `<p>` and `<span>` each carry independent ad-hoc sizing. Two adjacent HomeScreen sections prove it: `:1322` is `<h3 className="text-2xl font-bold">` and `:1400` is `<h2 className="text-2xl font-bold">` — identical visuals, arbitrary semantics.

Card titles range across `text-xl` (BhajanList), `text-lg` (BookList groups), `text-[13px]` (LectureList, BookList rows) and unsized (CategoryList) for the same semantic level.

29 inline `fontFamily` overrides across 17 files bypass Tailwind; `HomeScreen` alone has 7, six of them re-asserting Comic Sans. `HomeScreen:1697-1698` applies both `font-serif` *and* a redundant inline Playfair declaration to the same element.

---

## 6. Icon inventory

`lucide-react` 0.475.0, imported in **95 files** — consistent and near-universal. Convention is `size={NN}` with `strokeWidth={1.5}` on the 48px home tiles.

Exceptions worth noting: **19 inline `<svg>` across 13 files**, including the tilak logo in `Header.tsx:91-106` and a bespoke `FlowerSVG` in `AavirbhavMahotsavSection.tsx` — the only genuinely decorative vector asset in the codebase, and the closest thing to an existing ornament system.

**Emoji used as UI icons** in `admin-panel/InfoScreenManager.tsx:513,524,535` (📞 🔗 📍 — should be lucide `Phone`/`Link`/`MapPin`), `AuthorManager.tsx:558` and `FilterCategoryManager.tsx:528` (🔧), and embedded in Hindi headings in `VirahiMaharajScreen.tsx:98-123` and `GuruMaharajScreen.tsx`.

Not part of the design system, do not touch: `icons/` at repo root is the PWA icon source (consumed by `vite.config.ts` and `manifest.json`), and `src/iconBase64.ts` is a generated base64 WebP used solely for Android media-notification artwork (`context/AudioContext.tsx:39`).

---

## 7. Navigation chrome

### Header (`components/Header.tsx`, 195 lines)

Fixed, `z-30`, honours `env(safe-area-inset-top)`, hidden in landscape, height driven by a `uiScale` setting. Background is `bg-gradient-to-r from-saffron-500 to-orange-500` — **an orange gradient**, the most off-brand surface in the app for a Krishna theme. Contains a gold tilak SVG, a two-line lockup ("Shree Chaitanya" / "Prem Bhakti Sangh"), a hamburger, a profile button with approval-status dot, and a settings gear.

Latent bug: the subtitle is `text-ry-maroon/80` — dark maroon on a mid-orange gradient, already poor contrast, and it would become invisible on a dark blue header. Must be fixed as part of the redesign, not carried over.

### BottomNav (`components/BottomNav.tsx`, 158 lines)

Fixed bottom in portrait, becomes a 20-unit left rail in landscape. `bg-ry-sand dark:bg-[#2A0808]` — sand/maroon, not Krishna blue. Five tabs in order Books · Audio · Home · Bhajans · History. Active state is `-translate-y-1` plus a 6px gold dot and a label that expands from `scale-0`. Includes an SVG turbulence noise texture overlay. **Only 4 `dark:` occurrences** in always-visible chrome.

The Home tab is structurally identical to the other four — the brief asks for it to feel special.

---

## 8. Current design problems

**Typography is the headline failure.** Comic Sans across the entire devotional corpus, four font utilities aliased to one face, a named `font-serif` pointing at an unshipped font, no type scale, and `font-bold` applied 1,212 times as a substitute for hierarchy.

**Three parallel colour systems compete.** `ry-*` (baked hex), `saffron-*` (CSS variables), and raw hex `#bc8d31`/`#2a0808`. They collide in 27 files. Because only `saffron-*` is variable-backed, the user-facing palette picker appears broken — it changes a minority of the interface.

**No design system exists.** 502 hand-rolled cards, 883 raw buttons, 7 competing radius scales (`rounded` through `rounded-3xl` plus arbitrary values, used interchangeably at the same semantic level), 8 shadow variants, and 52 coloured shadows of which only 8 use brand tokens.

**The home screen is a flat wall of 24 tiles with no section headers.** Nothing groups Activities, Darshan, Calendar, Donate, Media, Centers, Books, Audios and Social. Tile order shows repeated ad-hoc insertion (the source comments misnumber themselves, jumping 6 → "Past Event Media" → 7 → 12). `SocialCard` is defined but never rendered — dead code.

**The home tiles are already Janmashtami-coloured, but as literals.** `border-amber-400/50`, `rgba(251,191,36,0.4)`, `text-teal-700/900`, `dark:from-[#0B1D3A] dark:to-[#0A2647]` — that *is* a blue/gold/peacock palette, duplicated across five card bodies as raw hex instead of expressed through the three `jm-*` tokens that were defined for exactly this purpose. It is also completely divorced from the `ry-*` maroon/cream register used by every other screen, so the home screen and the rest of the app look like different products.

**Dark mode is incomplete.** 4,194 `dark:` usages, but real gaps in `SplashScreen`, `NotificationsPermissionScreen`, `Banner`, `YouTubePlayer`, `screens/YouTubeScreen`, `BackblazeManager`, and all three `components/ui/*` primitives. `BottomNav` (4) and `MiniPlayer` (1) are always-visible chrome with essentially no dark treatment. `HomeScreen:1531` uses `bg-white` with no dark variant — a visible bug.

**The admin panel is a second, unstyled application** — 23 managers in two directory trees using stock slate/blue/emerald with no brand tokens.

**Accessibility gaps.** Focus rings are gated behind `@media (hover: hover) and (pointer: fine)`, so touch users get none. No `prefers-reduced-motion` handling anywhere, despite a 25-step stagger ladder and infinite `animate-twinkling-stars`/`animate-glow`/`animate-audio-bar` loops. Several icon-only buttons lack `aria-label`.

---

## 9. Theme migration plan

The strategy is **token indirection first, hand-craft second**. Editing 9,400 utility usages by hand would be both infeasible and the single most likely way to break a working app. Instead we change what the existing names mean, then hand-build the surfaces the user actually looks at.

### Layer 1 — Redefine, don't rewrite

| Move | Re-skins | Risk |
|---|---|---|
| Remap `slate-50…950` to a Krishna-blue-tinted "temple ink" ramp | **5,871 usages** | Low — slate is already blue-tinted |
| Repoint `ry-gold` → `#D4A017`/`#FFD54F`, `ry-cream` → `#FFF8E7`, `ry-sand` → card cream, `ry-maroon` → Krishna blue, `ry-brown` → secondary text | **717 usages** | Low — pure config change |
| Add `janmashtami` to `THEME_PALETTES` and make it the default | **603 `saffron-*` usages** | Low — engine already exists |
| Give `jm-primary`/`jm-secondary`/`jm-accent` real Janmashtami values | activates 3 dead tokens | None |

This alone re-skins roughly **7,200 usages without touching a single component file.**

### Layer 2 — Design system (`src/theme/`)

`colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts`, `shadows.ts`, `animations.ts`, `decorations.ts`, `theme.ts`, `tokens.css`. Tailwind consumes these so there is one source of truth, and `tokens.css` exposes them as CSS variables for the inline-style call sites that Tailwind cannot reach.

### Layer 3 — Typography

Replace the Comic Sans stack with Cinzel (display) / Marcellus (subhead) / Inter (body) / Cormorant Garamond (decorative), each with a real fallback chain so nothing breaks when a binary is absent. Keep `font-hindi` as a *distinct* Devanagari-first stack rather than a fourth alias, and preserve the `unicode-range` split so Hindi keeps rendering correctly. Retire `font-inter` (0 usages) by aliasing it to the body stack.

### Layer 4 — Decorations (`src/assets/janmashtami/`)

Eight SVG components: peacock feather divider, flute divider, temple border, golden mandala, Krishna silhouette, makhan handi, lotus corner, festival sparkles. SVG only, lazily mountable, `aria-hidden`, and skipped under `prefers-reduced-motion`.

### Layer 5 — Chrome and primitives

New `JanmashtamiHeader.tsx` and `JanmashtamiBottomNav.tsx` with **byte-identical prop interfaces**, wired in by turning `Header.tsx`/`BottomNav.tsx` into re-export shims. `App.tsx` is not touched, so routing and history behaviour carry zero risk. A real `Card` primitive with variants absorbs the 502 hand-rolled cards progressively.

### Layer 6 — Targeted hand work

`HomeScreen` sectioning and tile restyle; the 212 raw hex occurrences (starting with `#bc8d31` ×66 and `#2a0808` ×22, while explicitly preserving PhonePe/Google brand marks); the ~102 inline colour styles; dark-mode gaps; the accessibility floor.

### Explicitly out of scope

Business logic, routing, Firebase, Capacitor plugins, the OTA pipeline (`ota-push.mjs` / `ota-predeploy.mjs` / `useAppConfig.ts`), `icons/`, `src/iconBase64.ts`, and third-party brand colours.

---

## 10. Sequencing

1. Design system + Tailwind remap (Layers 1–2) — largest visual delta, lowest risk.
2. Typography (Layer 3).
3. Decorations (Layer 4).
4. Header, BottomNav, Card (Layer 5).
5. HomeScreen (Layer 6).
6. Screen sweep, dark mode, accessibility.
7. `tsc --noEmit` + `vite build` verification.
