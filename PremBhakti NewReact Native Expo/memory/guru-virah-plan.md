# Plan: GuruMaharajScreen + VirahiMaharajScreen Native Port

## A. Sync check (done)
- OG files at commit `503dc44` have no uncommitted changes since that sync point.
- Port from current working tree files (unchanged since sync).

## B. Read the OG screens fully

### GuruMaharajScreen.tsx (OG)
- **Imports**: `DOMPurify`, `{ doc, getDoc }` from `firebase/firestore`, `ArrowLeft`, `Loader2` from `lucide-react`, `React`, `useEffect`, `useState`, `db` from `../services/firebase`
- **State**: `content` (string), `loading` (boolean)
- **Cache**: `CACHE_KEY = "guru_maharaj_cache"` (localStorage)
- **Data flow**:
  1. On mount, check localStorage cache first → if found, set content, set loading=false
  2. If no cache or offline → fetch from Firestore: `doc(db, "app_config", "guru_maharaj")` → `getDoc(docRef)`
  3. If doc exists and has `content` → set content, save to localStorage cache
  4. Always set `loading=false` in `finally`
- **UI structure**:
  - Fixed inset-0 z-50 container with background SVG pattern (`bg-ry-sand` / dark `bg-ink-900`)
  - Header gradient `from-saffron-500 to-orange-500`, cream text, `border-b-2 border-ry-gold/40`, sticky `top-0`, rounded-b-3xl
  - Back button (ArrowLeft) with onClick=onBack
  - Header title: "Guru Maharaj Ji"
  - Main content area with:
    - Hero image: `<img src="/222.webp" alt="Guru Maharaj Ji Main" className="aspect-video w-full bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-100 dark:border-slate-700">`
    - Biography section with HTML content rendered via Tailwind `prose dark:prose-invert prose-slate max-w-none space-y-4`
    - Fallback Hindi content when loading or no Firestore data (hardcoded biography)
  - Content has `text-slate-700 dark:text-slate-300` font, `font-sans`
- **Strings (hi/en)**: Title only. Content is hardcoded Hindi in fallback; Firestore content may have either language.
- **States**: loading, content available, empty (show fallback)

### VirahiMaharajScreen.tsx (OG)
- **Same structure as Guru**, but:
  - Cache key: `CACHE_KEY = "virahi_maharaj_cache"`
  - Firestore doc: `app_config/virahi_maharaj`
  - Hero image: `<img src="/444.webp" alt="Virahi Maharaj Ji Main" ...>`
  - Header title: "Virahi Maharaj Ji"
  - Fallback Hindi content (different biography text)

## C. Screenshots (spec)
- Open `http://localhost:8090` in viewport 375×812
- Guru screen: light/dark, Hindi/English
- Virahi screen: light/dark, Hindi/English
- Compare side by side with OG web build

## D. Write the native screens

### Files to create:
1. **`src/lib/simpleHtml.tsx`** — Small HTML-to-`<Text>` renderer for tags: `p`, `br`, `b`, `strong`, `i`, `em`, `h1`-`h4`, `ul/li`, `a`. No new npm packages.
2. **`src/screens/GuruMaharajScreen.tsx`** — Native screen mirroring OG exactly
3. **`src/screens/VirahiMaharajScreen.tsx`** — Native screen mirroring OG exactly

### Shared component: `MaharajContent`
- Reads Firestore doc via `getDoc`
- Caches result via `webSet`/`webGet` using keys `guru_maharaj_cache` / `virahi_maharaj_cache`
- Renders HTML via `simpleHtml`
- Shows fallback content if no Firestore data
- Supports language toggle (hi/en) in header

### Individual screens:
- `GuruMaharajScreen`: Title "Guru Maharaj Ji", hero image `222.webp`, fallback Hindi biography
- `VirahiMaharajScreen`: Title "Virahi Maharaj Ji", hero image `444.webp`, fallback Hindi biography

### Key UI elements (mirror OG exactly):
- **Background**: Same SVG pattern (`data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' ...%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d97706' fill-opacity='1'%3E...%3C/g%3E%3C/g%3E%3C/svg%3E`), opacity 10%
- **Header gradient**: `from-saffron-500 to-orange-500` → use `theme.p[500]` / `ORANGE_500` (`#f97316`)
- **Header**: Sticky `top-0`, rounded-b-3xl, `shadow-lg`, `p-4 pt-[calc(1rem+env(safe-area-inset-top))]`, `flex items-center gap-3`
- **Back button**: `p-2 rounded-full hover:bg-white/20 transition-colors active:scale-95`, `ArrowLeft` icon
- **Main content**: `p-4 space-y-6 max-w-3xl mx-auto w-full pb-20 relative z-0`
- **Hero image**: `aspect-video w-full bg-slate-200 dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-slate-100 dark:border-slate-700`
- **Content font**: `text-slate-700 dark:text-slate-300`, `font-sans`
- **Prose content**: Match OG's `prose dark:prose-invert prose-slate max-w-none space-y-4` styling, but using our `simpleHtml` renderer instead of `dangerouslySetInnerHTML` + `DOMPurify`

### Data/Firestore guards:
- Every Firestore `getDoc` read must be guarded on web: `if (Platform.OS === "web") return;` (or we use the existing pattern where the screen fetches data in useEffect, and the browser preview blocks writes)
- Actually, the OG uses `getDoc` from `firebase/firestore` directly. The native screen should use `@react-native-firebase/firestore`'s `getDoc`. The key guard is: the browser preview should not write to Firebase. Since we're only *reading* (getDoc), there's no write guard needed for reads. But the OG pattern of checking `navigator.onLine` and skipping fetch if offline should be preserved.

### Storage keys (webStore):
- `guru_maharaj_cache`: stores the HTML content from Firestore, mirroring OG's `localStorage.getItem(CACHE_KEY)`
- `virahi_maharaj_cache`: same for Virahi
- These are NOT in the existing `BACKUP_*` constants — they are screen-local caches. They can be stored via `webSet`/`webGet` from `src/lib/webStore.ts`.

## E. Verify (all checks)

1. `npx tsc --noEmit`: clean
2. Browser preview side-by-side at `:8090`, 375×812: light/dark, hi/en
3. Every entry point opens native screen:
   - Home tile (via `screen("guru-maharaj")` / `screen("virahi-maharaj")`)
   - SideMenu items (if mapped)
   - Push with `action_type: "screen", target_screen: "guru-maharaj"` / `"virahi-maharaj"`
   - `openScreen("guru-maharaj")` / `openScreen("virahi-maharaj")`
4. NEW badges on Home clear and stay cleared (these screens don't use NEW badges — they read from app_config, not homeDataStore)
5. Back button closes screen (stack pop)
6. Remove from `NATIVE_SCREENS` → opens as WebView

## F. Finish
- Update `PROJECT-CONTEXT.md` (add these screens to native list, update sync point if needed)
- Update `HISTORY.md` (date: 2026-10-05, step 1.4:[MaharajScreens])
- Report in Hinglish; ask "commit/push kar doon?"

### Notes from HANDOFF section 6 & 4D:
- Both screens read one Firestore doc each with `getDoc`: `app_config/guru_maharaj` and `app_config/virahi_maharaj`
- Content is HTML. DO NOT add npm package. Write small native HTML-to-`<Text>` renderer in `src/lib/simpleHtml.tsx` for simple tags (`p`, `br`, `b`, `strong`, `i`, `em`, `h1-h4`, `ul/li`, `a`).
- Share one component between the two screens (the data fetching + rendering logic is shared; only the screen UI differs slightly)

### OG image assets:
- `public/222.webp` → Guru Maharaj hero image
- `public/444.webp` → Virahi Maharaj hero image
- These will be referenced from `src/assets/` in the native app