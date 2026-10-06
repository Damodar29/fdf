# Janmashtami Theme — Changelog

All notable changes from the Janmashtami visual transformation of the CPBS "Prem Bhakti" app. This release is **presentation-only**: no routing, API, Firebase, Capacitor, or OTA behaviour was changed. Type safety verified with `tsc --noEmit` (exit 0).

Date: 2026-08-22

---

## Added

**Design system (`src/theme/`)**

- `index.ts` — barrel export for the whole system (`@/src/theme`).
- `colors.ts` — krishna / gold / peacock / cream / ink ramps plus semantic role tokens.
- `typography.ts` — font stacks and per-role weight helpers (`textRole`).
- `spacing.ts`, `radius.ts`, `shadows.ts` — spacing, corner-radius, and elevation scales.
- `animations.ts` — motion durations, easings, and keyframe class names.
- `decorations.ts` — ornament placement recipes (decoration discipline).
- `theme.ts` — composed theme object.
- `tokens.css` — `--jm-*` CSS custom properties for ~102 inline-style sites Tailwind can't reach; includes the dark-mode role flips, the global `:focus-visible` ring, a `prefers-contrast: more` block, and the `prefers-reduced-motion` guard.

**Primitives & shared components**

- `components/JanmashtamiHeader.tsx` — rebuilt header (real implementation).
- `components/JanmashtamiBottomNav.tsx` — rebuilt bottom navigation (real implementation).
- `src/components/Card.tsx`, `src/components/SectionHeader.tsx` — shared building blocks.

**Ornaments (`src/assets/janmashtami/`, all pure SVG)**

- 10 ornament components: `KrishnaSilhouette`, `PeacockFeatherDivider`, `PeacockFeatherEye`, `LotusCorner`, `FluteDivider`, `MakhanHandi`, `GoldenMandala`, `TempleBorder`, `FestivalSparkles`, plus the `Ornament` wrapper — with `index.ts` and `types.ts`.

**Typography tooling**

- `scripts/fetch-janmashtami-fonts.mjs` — validated, offline-first font downloader (magic-number checks, `--force` / `--check` / `--ttf` modes).
- `package.json` scripts: `fonts:fetch` and `fonts:check`.

**Theme palette**

- New `"janmashtami"` value in the `ThemeColor` union (`types.ts`) — now the default.
- `janmashtami` palette in `THEME_PALETTES` (`utils/theme.ts`), derived from the `krishna[]` tokens so the accent family can't drift from the Tailwind ramp.
- `DEFAULT_THEME_COLOR` export (`utils/theme.ts`).

**Docs**

- `JANMASHTAMI_THEME_MIGRATION.md`, `JANMASHTAMI_THEME_CHANGELOG.md` (this file). (`JANMASHTAMI_THEME_AUDIT.md` was produced during the audit phase.)

---

## Changed

**Global**

- `index.html`: removed the app-wide `font-bold` from `<body>` (it flattened all typographic hierarchy) → `font-body`; body classes moved to semantic tokens (`bg-cream-50 dark:bg-ink-900 text-content-primary`). `theme-color` `#5D1B1B` → `#0B2E6B`.
- `tailwind.config.js`: added Janmashtami token families; **repointed** the legacy `ry-gold` / `ry-cream` / `ry-maroon` / `ry-brown` / `ry-sand` classes to Janmashtami values (so ~717 existing usages render on-theme with no edits).
- `index.css`, `public/fonts/fonts.css`: `@font-face` and base rules rewritten for the new typefaces.

**PWA**

- `public/manifest.json`: `theme_color` → `#0B2E6B`, `background_color` → `#071529`.
- `vite.config.ts`: PWA manifest `theme_color` / `background_color` → same values.

**Theme default**

- `context/SettingsContext.tsx`: replaced the old one-shot "force cyan" migration with a one-shot push to `DEFAULT_THEME_COLOR` (Janmashtami), guarded by a new `cpbs_janmashtami_theme_v1` flag; user choice is respected on every launch after the first.
- `utils/theme.ts`: `applyThemeColor` fallback changed from `deepBlue` to `DEFAULT_THEME_COLOR`; `janmashtami` excluded from the "surprise me" random set.

**Screens & components migrated to theme tokens** (hardcoded hex / off-theme classes → tokens)

- Home & shell: `HomeScreen.tsx` (full redesign incl. HeroCarousel), `Header.tsx` / `BottomNav.tsx` (→ re-export shims), `SplashScreen.tsx`, `SideMenu.tsx`.
- Content: `AudioScreen.tsx`, `VideosScreen.tsx`, `LectureList.tsx`, `BhajanReader.tsx`, `BookList.tsx`, `DailyDarshanScreen.tsx`, `EventsScreen.tsx`, `ActivitiesScreen.tsx`.
- Info & people: `InformationScreen.tsx`, `AboutScreen.tsx`, `GuruMaharajScreen.tsx`, `VirahiMaharajScreen.tsx`, `TempleTimingsScreen.tsx`, `SevaCenterScreen.tsx`.
- Account & flows: `ProfileScreen.tsx`, `SettingsScreen.tsx`, `FeedbackModal.tsx`, `DonateScreen.tsx`, `NotificationsPermissionScreen.tsx`, `profile/OnboardingWizard.tsx`, `profile/SuccessAnimation.tsx`.
- Admin: `AdminPanel.tsx`, `BackupRestoreSection.tsx`, `BannerContainer.tsx`, `AppUpdaterScreen.tsx`, `src/components/admin-panel/DevoteeProfileManager.tsx`, `src/components/admin-panel/MandalAdminPanel.tsx`.

---

## Removed

- `download-fonts.sh` — obsolete Comic Sans "no download needed" stub.
- Inline `font-family: "Comic Sans MS"` on the `BookList` header (off-brief / cartoonish).
- The global `font-bold` on `<body>` (see Changed).

---

## Fixed

- **Typographic hierarchy** — headings can now read heavier than body copy (previously impossible with body-wide `font-bold`).
- **Keyboard focus visibility** — the `:focus-visible` ring is no longer gated behind `(hover: hover) and (pointer: fine)`, so keyboard users on touch devices, tablets with Bluetooth keyboards, and TV remotes now get a visible focus indicator.
- **Font-download safety (latent bug)** — the new fetch script validates font magic-numbers, preventing a recurrence of the earlier state where eleven `*.woff2` files were actually "404 Not Found" HTML pages shipped to every install.
- **First-paint colour flash** — `index.html` `theme-color` set to Krishna blue up front, so the status bar no longer flashes the old maroon before React mounts.

---

## Preserved (intentionally not changed)

- **Behaviour:** `App.tsx`, `services/firebase.ts`, `capacitor.config.json`, `ota-push.mjs`, `ota-predeploy.mjs` — all confirmed unchanged.
- **Prop contracts:** old `Header` / `BottomNav` import paths and export names kept via shims.
- **Hindi text:** all Devanagari literals intact (zero mojibake across changed files).
- **Third-party brand colours:** PhonePe (`#5f259f` / `#4e1e82` / `#a874e6`), WhatsApp (`#25D366` / `#20bd5a`), Google, Instagram, YouTube — kept as raw hex so they stay recognisable.
- **SVG illustration art** (e.g. `AavirbhavMahotsavSection` lotus) — treated as artwork, not theme.
- **Legacy `ry-*` classes** — repointed, not removed.
- **`utils/theme.ts` palette-picker engine** — the user-facing palette feature is fully intact; only the accent family varies with it.
- **`public/fonts/comicbd.ttf`** — left on disk though no longer referenced.

---

## Verification

- `npx tsc --noEmit` → exit 0.
- Change scope reviewed with `git diff --ignore-all-space`: 56 files with real content changes; the remaining ~230 files in the raw diff are pure CRLF↔LF line-ending noise with zero content change.
- Confirmed no routing / Firebase / Capacitor / OTA / service-worker file appears in the real-change set.
- Devanagari integrity confirmed (mojibake scan clean).

## Follow-ups required before release

1. `npm run fonts:fetch` — download the six typefaces into `public/fonts/` (they are not committed).
2. `npm run build` — run on Windows (esbuild is platform-specific; a Linux sandbox can't execute the Windows binary).

See `JANMASHTAMI_THEME_MIGRATION.md` for full rationale and conventions.

---

# Second pass — "make it delightful"

Date: 2026-08-22

The first pass applied the theme correctly but the result was underwhelming: the splash was still
a template (stock photograph, two inset gold rectangles, a logo stroke-draw, three bouncing dots),
and the home grid was bare icons on cream paper. This pass spends the theme's boldness in one place
rather than spreading more gold everywhere. Five files, presentation-only, `tsc --noEmit` exit 0.

The three moods on the table — midnight birth, dawn temple darshan, peacock-and-flute restraint —
are used as a single **time-of-day journey** rather than as alternatives: the splash is midnight
(Krishna is born at midnight), home opens at dawn, and the chrome stays restrained throughout.

## Changed

**`components/SplashScreen.tsx` — rewritten (241 added / 97 removed)**

- Removed `url(/background3.webp)` and its `bg-black/60` + `bg-white/30` scrims, both
  `border-ry-gold` inset rectangles, the `#d4af37` "C" logo draw, and the three bouncing dots.
- The sky is now painted from `bg-jm-night` plus one radial gold bloom, so there is no image
  decode before first paint.
- `GoldenMandala` blooms open as a **halo** behind the tilak at ~0.30 opacity, drifting once every
  120 s. The tilak fills from a three-stop gold gradient as if a lamp were being lit.
- Ambient `FestivalSparkles` at the edges, and a `MakhanHandi` swaying from the top edge on a 13 s
  cycle. Both gated on `!isLowEnd` and killed by `jm-ambient` under reduced motion.
- The dot spinner is replaced by a breathing invocation — "Jai Shri Krishna" / "जय श्री कृष्ण".
  A bespoke opening screen should not end in the loader every app ends in.
- Entrance runs on a named `BEAT` map (halo 120 ms → tilak 320 → title 660 → divider 840 →
  subtitle 980 → invocation 1140), finishing inside `App.tsx`'s ~1.4 s budget; the exit scale is
  380 ms, under the parent's 400 ms removal delay.
- The once-per-day intro-sound effect (4 AM IST logical day, `cpbs_intro_sound_date`) is preserved
  verbatim. `SplashScreenProps` unchanged.

**`components/HomeScreen.tsx` — tile interiors (136 added / 19 removed)**

- New `TileNiche` — every icon tile now holds a pointed **temple alcove**, the third and final
  sanctioned appearance of the signature arch alongside the active nav tab and the section crown.
  Implemented as an inline `viewBox` SVG rather than the existing `.jm-arch` class, because
  `clip-path: path()` takes absolute user units and is only correct at exactly 100 × 100 px, so it
  cannot scale with a grid-sized tile. `preserveAspectRatio="xMidYMax meet"` seats the arch on the
  bottom edge and insets it from the sides on a 4:3 tile, so it reads as set *into* the card.
- New `TileIconInterior` — the alcove, a soft interior bloom (skipped on low-end devices), the
  icon, and a small gold **threshold** step beneath it. Wired into both `GlassCard` and
  `SlideshowCard`'s icon fallback, so Donate, Calendar and every sibling get it.
- No gradients or SVG `id`s in either, so ~15 tiles can mount without definition collisions.
- A **dawn wash** gradient now spills warm lamplight from under the header instead of the screen
  starting on cold paper — one layer, no extra DOM.

**`components/JanmashtamiHeader.tsx`** — the splash's halo is carried through behind the tilak at
`haloSize = round(scaledTilakHeight × 0.25 × 16 × 1.9)`, so it tracks `uiScale` instead of drifting
when the user changes text size. This is the one thread tying the opening screen to every screen
after it.

**`components/JanmashtamiBottomNav.tsx`** — the same gold threshold from inside the tiles now sits
under the active tab's label. Repeating one small device in two places turns it into the app's
vocabulary rather than a flourish, and gives the arch above it something to stand on.

**`src/theme/decorations.ts`** — `ornamentUsage`'s value type widened with an optional
`ceremonialException`, and the splash halo recorded against `goldenMandala`. The 0.08 cap exists to
stop pattern competing with body text; the splash has no body text, so the exception is documented
rather than silently taken.

## Deliberately not done

- **No new home "welcome band."** It would have duplicated the existing first-section eyebrow and
  cluttered the busiest surface. Atmosphere (the dawn wash) beat furniture.
- **No `jm-gold-text` on the 14 px header wordmark** — the gradient's `#B08313` bottom stop reads
  muddy on dark blue at that size.
- **No `KrishnaSilhouette` on the splash and no `LotusCorner` inside tiles** — one ornament per
  region. Chanel's rule: remove one accessory.
- **`PeacockFeatherDivider` on the splash, not the flute**, so the flute stays the bottom nav's
  own signature.

## Verification

- `npx tsc --noEmit` → exit 0.
- `git diff --ignore-all-space --numstat` shows real content changes in exactly five files:
  `SplashScreen.tsx`, `HomeScreen.tsx`, `decorations.ts`, `JanmashtamiHeader.tsx`,
  `JanmashtamiBottomNav.tsx`. Zero real change in `App.tsx` or in any Capacitor, Firebase, OTA,
  service-worker, routing or Vite config file — everything else in `git status` is CRLF↔LF noise.
- Prop contracts byte-identical: `SplashScreenProps`, `HeaderProps`, `BottomNavProps`.
- Devanagari mojibake scan clean (0 × U+FFFD across all five files).
- Marcellus (`font-heading`) never paired with `font-bold` / `font-semibold`.
- Devanagari on `font-body` confirmed safe: every Latin stack in `src/theme/typography.ts` lists a
  Noto Devanagari face after its Latin faces, and the Latin `@font-face` rules in
  `public/fonts/fonts.css` are clamped to `unicode-range: U+0000-024F`, so Devanagari falls through
  to Noto by design.
- All new motion is transform/opacity only; ambient layers carry `jm-ambient` and are additionally
  gated on `useDevicePerformance().isLowEnd`.

## Known issue, not addressed

Several home tiles still pull artwork from `/rathyatratheme/` — a different festival — e.g.
`OUR_ACTIVITIES_ICON = "/rathyatratheme/Activities.webp?v=2"`. Replacing that art is an asset task,
not a code one.

## Preview

`JANMASHTAMI_DESIGN_PREVIEW.html` (repo root, not imported by the app — safe to delete) is a
standalone reproduction of the new splash and tile grid with Replay, Devanagari and dark-mode
toggles. It exists because `vite build` cannot run in a Linux sandbox (the installed esbuild binary
is Win32-only), so it is the only way to see the result before building on Windows. It loads the six
typefaces from Google Fonts, which also previews the type before `npm run fonts:fetch` has run.

---

# Third pass — Comfortaa as the app's single Latin typeface

The app owner asked for Comfortaa back, "everything, including the lockup". Worth recording what the
starting state actually was: **Comfortaa was never live.** `public/fonts/` held four files named
`Comfortaa-*.woff2` that were each a 1.6 KB Google 404 page, and no `@font-face` pointed at any of
them, so every screen fell through to Comic Sans (and, after the first pass, to Inter's fallback
chain). So this was not a revert — it is the first time Comfortaa has genuinely been declared.

## Changed

**`src/theme/typography.ts`** — the four Latin roles (`display`, `heading`, `body`, `decorative`)
now all resolve to one `latinStack` naming `"Comfortaa"`. The roles are kept as separate keys, not
collapsed, so every `font-display` / `font-heading` / `font-body` / `font-decorative` call site in
the app keeps working untouched and the roles can be re-split later without editing a component.
This is the same "repoint, don't remove" strategy already used for the ~717 legacy `ry-*` colour
classes.

**`index.css`** — `body { font-family: "Inter", … }` → Comfortaa. This was the important one: it is
the default every element without an explicit `font-*` utility inherits, which is most of the app.
It is now byte-identical to `latinStack`, including `"Noto Sans Devanagari"` in second position.

**`public/fonts/fonts.css`** — a new Comfortaa `@font-face`, `font-weight: 300 700` (one variable
file covers every weight), with the same `unicode-range` clamp the other Latin faces carry. Cinzel,
Marcellus, Inter and Cormorant Garamond are left declared but are no longer named by any stack, so a
browser never downloads them and a revert is a one-file edit to `typography.ts`.

**`scripts/fetch-janmashtami-fonts.mjs`** — Comfortaa added as the first target, with the usual
Google-CSS2-then-GitHub-raw candidate list. Its failure message now says explicitly that if only
Comfortaa fails, nothing renders in its intended face.

**`tailwind.config.js`** — the five legacy font keys stay repointed; their trailing comments were
lying (`sans: // Comic Sans → Inter`) and now name Comfortaa.

## Two knock-on fixes the switch forced

**No italic anywhere.** Comfortaa has no true italic, and synthesised oblique on a rounded geometric
face looks broken. All 14 `italic` usages are removed: two decorative lines on the splash and home
screen, three in `AboutScreen` (the Sanskrit sampradaya name now takes gold + medium weight instead,
which is the theme's own emphasis language), and nine muted-placeholder empty states in the admin
panels, where `text-slate-400` was already carrying the "this is a placeholder" signal on its own.

**Hierarchy had to move into weight.** Previously a heading read as a heading even at the same size,
because Marcellus is a serif and Inter is a sans — the letterforms did the work. With one family
that signal is gone, so `textRole.sectionTitle` now carries `font-semibold` and `cardTitle`
`font-medium`. The old "never set `font-bold` on `font-heading`" rule is obsolete: Marcellus shipped
Regular only, but Comfortaa has real 500/600/700.

Tracking was also pulled in, because Comfortaa has wide sidebearings built in where Cinzel's
capitals needed the extra air: `jm-display` 0.02em → 0.01em, `jm-overline` 0.2em → 0.16em, the
splash subtitle 0.34em → 0.24em, the splash invocation 0.2em → 0.14em, and the header's second
lockup line 0.2em → 0.16em.

## Devanagari is untouched

`font-hindi` / `font-hindi-display` still resolve to Noto Sans / Noto Serif Devanagari, and the
`unicode-range` clamp on the Latin faces means Hindi text can never land in Comfortaa even if a
component applies the wrong class. Comfortaa has no Devanagari coverage at all, so this safety net is
load-bearing, not belt-and-braces.

## Verification

`npx tsc --noEmit` → exit 0. `git diff --ignore-all-space --numstat` shows no change to `App.tsx`,
`vite.config.ts`, routing, Capacitor, Firebase or the OTA flow.

## Still required on Windows

`npm run fonts:fetch` — `public/fonts/` currently contains only `comicbd.ttf` and `fonts.css`, i.e.
**no font binaries at all**, so until this runs the app renders in the system sans, not Comfortaa.
The script cannot run in the Linux sandbox (no network egress). Then `npm run build`.

---

# Fourth pass — dark mode across every screen

Dark mode was never broken in its *plumbing*. `darkMode: "class"` is set, `SettingsContext` toggles
`.dark` on the document root, the `ink` ramp and `surface.dark` tokens exist, and the page floor
(`.dark .bg-paper`) already paints the Vrindavan night sky. What was missing was call-site coverage:
several hundred elements carried a light utility with no `dark:` counterpart, so they stayed
light-on-light when the rest of the app went dark. Grey-on-white body text became grey-on-navy;
white cards stayed white.

## Counting it properly first

A line-based `grep` for light utilities returned roughly 1,400 hits, which is alarming and useless —
most were already paired, just on a different physical line of a multi-line `className`. So the audit
was rewritten around a real parser (`class_exprs`) that finds every `className=` and captures the
*whole* attribute value, brace-balancing `{…}` and quote-matching `"…"`. That way a template literal
with a ternary spanning six lines is judged as one expression, which is how Tailwind actually sees it.

Against that, the true count was **112 unpaired utilities across 36 files** — a tractable, real
number rather than a scary one.

## The mapping, and why it is safe

| light | dark |
|---|---|
| `bg-gray-50` `bg-slate-50` `bg-gray-100` `bg-slate-100` | `dark:bg-ink-900` |
| `bg-gray-200` `bg-slate-200` | `dark:bg-ink-700` |
| `text-gray-900` `text-slate-900` | `dark:text-cream-50` |
| `text-gray-800` `text-slate-800` | `dark:text-cream-100` |
| `text-gray-700` `text-slate-700` | `dark:text-ink-200` |
| `text-gray-600` `text-gray-500` `text-slate-600` `text-slate-500` | `dark:text-ink-300` |
| `text-gray-400` `text-slate-400` | `dark:text-ink-400` |
| `border-gray-200/300` `border-slate-200/300` | `dark:border-ink-700` |

This works because the `ink` ramp is **luminance-matched step-for-step against Tailwind's slate** (see
the docblock in `src/theme/colors.ts`): only the hue moves toward Krishna blue. So substituting ink
for slate at the same step cannot change a contrast ratio, which makes even a mis-targeted
substitution visually neutral rather than a regression. Spot-checked by hand: `ink-300` on `ink-800`
≈ 9.9:1, `ink-400` on `ink-800` ≈ 5.8:1, `cream-50` on `ink-800` ≈ 14.9:1.

The fixer is **insert-only**. It never rewrites or removes a light utility, it only appends the dark
counterpart immediately after it. Light mode therefore cannot regress, by construction. Result:
**693 insertions across 69 files**, and re-running the fixer produces zero further changes.

## `bg-white` had to be done by hand

The first attempt included `bg-white → dark:bg-ink-800` in the automated map. That was applied to
three files as a trial and the diff was read before rolling out — which caught it being wrong.
`bg-white` is only a "light surface" when it *isn't* sitting on an intentionally dark, coloured, or
photographic background. The trial produced false positives on a story-viewer progress bar over a
black overlay, and on pagination dots where the inactive `bg-white/40` sibling correctly didn't match,
so pairing only the active dot would have looked visibly broken.

So `bg-white` was pulled from the map and all 32 sites were classified individually. **14 were paired**
to `dark:bg-ink-800` (modal panels in `BackblazeManager`, form inputs in `GalleryUI`, avatar plates in
`ProfileScreen`, the `SmartAppBanner` icon plate, and the middle avatar ring in the Facebook and
Instagram screens — those last were unambiguous, because the outer and inner rings around them
already carried `dark:bg-slate-800` / `dark:bg-slate-900`, so a dark-aware surface was clearly the
author's intent).

**18 were deliberately left white**, because white is the point: two story progress bars, two sets of
pagination dots, six toggle knobs, three badges that pair white with `text-rose-600`/`text-blue-600`
over images, the CTA pill on `Banner`'s coloured background, the glowing dot on the home screen, the
**QR-code plate in `DonateScreen`** (it must stay white to remain scannable) and the **PDF render
canvas in `BookReader`** (white is the paper; darkening it makes black PDF ink unreadable).

## Hover and active states

The insert-only fixer's lookbehind deliberately skips variant-prefixed utilities, so `hover:bg-gray-50`
was invisible to it. That is a real bug class here — the app runs on desktop and Android TV with D-pad
focus, so hover fires, and a light hover tint on a dark card reads as a white flash. A separate audit
found 23 such sites; 22 were fixed. Sites whose base was already dark-aware (`dark:bg-slate-700/800`)
got `dark:hover:bg-ink-600` so the hover is a *lift*; sites with no base background (transparent on
the dark page) got `dark:hover:bg-ink-700`. One semantic-colour instance in `GalleryUI` was fixed the
same way (`hover:bg-green-100` → `dark:hover:bg-green-900/40`).

`Banner.tsx:54` is the single intentional exception: its base is `bg-white` in both modes because the
pill sits on a saturated brand-coloured banner. For the same reason the inline `color: "#ffffff"` on
that banner is correct and was left alone.

## Deliberately out of scope

**Alpha utilities.** `bg-white/10`, `bg-white/40`, `border-slate-200/20` and friends are translucent
overlays — scrims, glass, hairlines over imagery. They composite against whatever is behind them and
are correct in both modes. The audit's remaining 68 "unpaired" hits are all of this kind, plus the 18
intentional white surfaces above. There are no real unpaired bugs left.

**The 2,418 paired-but-off-palette usages.** Plenty of call sites pair a light utility with
`dark:bg-gray-800` or `dark:text-slate-300` rather than the theme's `ink`/`cream` tokens. These
already *work* in dark mode; converting them is a palette-consistency exercise with real regression
surface and no functional gain, so it is left as a separate, optional task.

## Verification

`npx tsc --noEmit` → exit 0, run after each stage. **731 dark-mode class insertions** in total
(693 automated + 14 `bg-white` + 23 hover/active + 1 semantic).

One correction to the previous section's claim that `App.tsx` was untouched: it is untouched by the
*Comfortaa* pass, but the dark-mode pass added exactly two `dark:text-ink-400` tokens to the landscape
search bar's icon and clear button. Both are className-only; no logic, routing, Capacitor, Firebase or
OTA code changed anywhere in this pass.
