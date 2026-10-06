# Antigravity ke liye prompts (copy-paste)

Ye prompts Antigravity mein `C:\rn\mobile` folder khol kar Agent chat mein paste karne hain.

Niyam:
- Har screen ke liye **nayi chat** shuru karo.
- Ek chat mein ek hi screen.
- Pehle **Planning** mode mein plan banwao, padho, phir "approve" karo.

---

## Kaunsa kaam kis model se karwao

Model ko kaam ke hisaab se chuno. Jitna mushkil ya risky kaam, utna strong model.

- **Claude Opus** sabse strong hai. Bade aur risky kaam isse karwao.
- **Claude Sonnet** beech wale screens ke liye theek hai: data, keys, share, comments.
- **Gemini 3.1 Pro** chhote, seedhe screens ke liye theek hai.
- **Gemini Flash** se screen port **mat** karwao. Ye tez hai par galtiyan zyada karta hai.
  Sirf Prompt 4 (status check) jaise chhote kaam ke liye.

| # | Kaam | Model | Kyun |
|---|---|---|---|
| 0 | Prompt 1 (Step 0 setup) | Claude Opus | Saare screen kholne ke raaste badalte hain. Galti hui to poori app ka navigation tootega. |
| 1 | About | Gemini 3.1 Pro | Sirf static text aur icons. |
| 2 | Privacy | Claude Sonnet | "Delete Account" asli account mitata hai. Ye logic dhyan se likhna hai. |
| 3 | Terms | Gemini 3.1 Pro | Static text, plus `/privacy`, `/terms`, `/about` links. |
| 4 | Guru / Virahi Maharaj | Gemini 3.1 Pro | Ek Firestore doc padhna aur HTML dikhana. |
| 5 | Temple timings | Gemini 3.1 Pro | Mandal data pehle se hai, bas dikhana hai. |
| 6 | Our centers | Gemini 3.1 Pro | Same mandal data, map/phone/WhatsApp links. |
| 7 | Daily quotes | Claude Sonnet | Image save/share aur "last seen" keys. |
| 8 | Information | Claude Sonnet | Read/like keys, Home badge, push se ek item kholna, comments. |
| 9 | Glorification (sirf reader) | Claude Sonnet | Home ka "नई महिमाएं" badge isi par chalta hai. |
| 10 | Vaishnav calendar | Claude Opus | Tithi/date ka hisaab bilkul same copy karna hai. Choti galti = galat tithi. |
| 11 | Videos | Claude Sonnet | YouTube player, folders, share links. |
| 12 | Donate | Claude Opus | Form, UPI, receipt download, login wala user. Paise ka kaam hai. |
| 13 | Deity darshan | Claude Opus | 1.5k lines, photo viewer, pinch zoom, push params. |
| 14 | Activities | Claude Opus | Sabse bada (3k lines), Videos aur Darshan dono ke parts. |
| R | Prompt 3 (review) | Ulta model | Claude ne port kiya to Gemini 3.1 Pro se review. Gemini ne kiya to Claude Sonnet se. Review Flash se nahi. |
| S | Prompt 4 (atak jaaye) | Gemini Flash bhi chalega | Sirf `git status` padh kar batana hai, kuch badalna nahi. |

Agar Gemini 3.1 Pro kisi chhote screen mein do baar galti kare (rang, text ya spacing OG
jaisa na bane), to wahi screen nayi chat mein Claude Sonnet se karwa lo. Claude ki limit
khatam ho to bade screens (Calendar, Donate, Darshan, Activities) ruk kar baad mein karwao,
Flash se mat karwao.

---

## Prompt 1 — pehli baar (Step 0: setup)

```
You are taking over the React Native (Expo SDK 57) app in C:\rn\mobile from an earlier agent.

Before doing anything, read these files completely, in this order:
1. docs/handoff/ANTIGRAVITY-HANDOFF.md   (rules + plan — the rules in section 0 are absolute)
2. docs/context/PROJECT-CONTEXT.md
3. docs/context/WEBVIEW-BRIDGE.md
4. docs/context/HISTORY.md
5. src/lib/appNav.ts, src/navigation/types.ts, src/navigation/RootNavigator.tsx,
   src/screens/HomeScreen.tsx, src/components/SideMenu.tsx, src/lib/webStore.ts

Key rules (from section 0):
- C:\Users\damod\OneDrive\Desktop\aaaacursor is READ-ONLY. Never write, build, install,
  checkout, stash, reset or clean there.
- Never commit or push without my "yes".
- Never touch the real app com.cpbs.bhajans.
- No new packages without asking.
- No Gradle/JDK/Expo upgrades.

Task now: do ONLY "Step 0" from section 3 of the handoff:
- the NATIVE_SCREENS map in appNav
- route every screen-by-name opener (Home tiles, SideMenu, pushes, site links, quotes
  opener) through openScreen
- leave the map empty, so behaviour must not change

First show me a short plan. After I approve:
- implement it
- run `npx tsc --noEmit`
- check in the browser preview (section 5) that every Home tile and side-menu item still
  opens its web screen

Reply to me in simple Hinglish. At the end tell me what you did, what you tested and what
is left, then ask before commit/push.
```

---

## Prompt 2 — ek screen port karna (har screen ke liye, naam badal kar)

`<SCREEN>` ki jagah screen ka naam likho. Model upar wali table se chuno. Order handoff ke
section 6 mein hai ([ANTIGRAVITY-HANDOFF.md](ANTIGRAVITY-HANDOFF.md), "## 6. Recommended order"):
About → Privacy → Terms → Guru/Virahi → Temple timings → Centers → Quotes → Information →
Glorification → Calendar → Videos → Donate → Darshan → Activities.

```
Read docs/handoff/ANTIGRAVITY-HANDOFF.md completely (rules in section 0 are absolute),
then docs/context/PROJECT-CONTEXT.md and the latest entries of docs/context/HISTORY.md.

Task: port the <SCREEN> screen from the OG app to a native React Native screen, following
section 4 ("Porting one screen") step by step, and the notes for this screen in section 6.

Requirements:
- A. Do the sync check first (git log + git status on the OG files, read-only), and port
  from the CURRENT files in C:\Users\damod\OneDrive\Desktop\aaaacursor (read-only).
- B. Read the OG screen file and all its local imports fully. Before coding, write a plan
  that lists:
  - every state, data read/write and localStorage key
  - every hi/en string
  - every UI state
- C. Open the OG screen in the browser preview at http://localhost:8090 (375x812) and take
  screenshots in light/dark and Hindi/English. They are the spec.
- D. The screen must look and behave EXACTLY like the OG: same colours from src/theme,
  same lucide icons, same texts, same spacing. No redesign.
  - Reuse homeDataStore data.
  - Use the same storage keys via webStore.
  - Guard every Firestore write with Platform.OS === "web".
- E. Run every check in section 4E and the "Definition of done" in section 8. Compare
  side by side with the OG at :8090 in the same viewport.
- F. Update PROJECT-CONTEXT.md and HISTORY.md.

Do not add npm packages without asking me. Do not build an APK. Do not touch the phone
unless I say so.

First show me the plan and wait for my approval. Reply in simple Hinglish. At the end:
- what was done
- what you tested and how (with screenshots of OG vs native)
- what can only be tested on the phone
- then ask "commit/push kar doon?"
```

---

## Prompt 3 — doosre model se review karwana (screen port hone ke baad)

Ye prompt doosre model ko do. Agar port Gemini ne kiya to review Claude se karwao, aur ulta.

```
Read docs/handoff/ANTIGRAVITY-HANDOFF.md (section 0 rules are absolute).

Review the uncommitted changes in C:\rn\mobile (git diff + new files) that port the
<SCREEN> screen to native. Do NOT change code yet. Only report.

Check against the OG file in C:\Users\damod\OneDrive\Desktop\aaaacursor (read-only):
1. Every string (hi + en), icon, colour, spacing and UI state matches the OG.
2. The same localStorage/webStore keys are read and written as in the OG.
3. Every Firestore/REST read matches the OG. Every write is guarded for the web preview.
4. Every entry point opens the native screen: Home tile, menu, banner, push with params,
   site link.
5. Dark mode, the Android back button, empty/loading/error states.
6. No hardcoded colours, no new packages, no duplicated data fetching (homeDataStore
   reuse).
7. `npx tsc --noEmit` is clean.
8. Open both screens side by side in the browser preview (OG on :8090, app on :8081, at
   375x812) and list every visual difference.

Give me a numbered list of problems, most serious first, each with the file and line.
Reply in simple Hinglish.
```

---

## Prompt 4 — galti ho jaaye / agent atak jaaye

```
Stop. Run `git status` and `git diff --stat` in C:\rn\mobile and tell me exactly which
files you changed. Do not change or delete anything.

Also confirm, by running `git -C C:\Users\damod\OneDrive\Desktop\aaaacursor status --short`,
that you did not change anything in aaaacursor. Do not fix anything there yourself; only
report.

Reply in simple Hinglish.
```

Agar RN mein sab kharab ho jaaye aur pichhli commit par wapas jaana ho, to ye agent se mat karwao. Pehle kisi ko dikha lo. (`git restore` / `git checkout --` changes hamesha ke liye mita dete hain.)

---

## Tips (Hinglish)

- **Model chunna:** bade screens (Darshan, Activities, Donate, Calendar) ke liye Claude
  (Opus/Sonnet) behtar hai. Chhote static screens (About, Terms, Guru/Virahi)
  Gemini 3.1 Pro se karwa sakte ho. Poori list upar "Kaunsa kaam kis model se karwao" mein hai.
- **Planning mode:** hamesha plan pehle padho. Agar plan mein aaaacursor mein likhna,
  `npm install` ya Gradle/Expo upgrade dikhe, to approve mat karna.
- **Preview:** dono terminals (`npm run web:preview`, `npm run web`) chalte rehne do.
  Agent browser mein khud check karega.
- **Commit:** har screen ke baad agent poochega. Pehle khud browser mein screen dekh lo,
  phir "haan" bolo.
- **Ek baar mein ek screen.** Do screens ek saath karwane se galtiyan badhti hain.
- **Privacy screen ka "Delete Account" button:** ye asli account delete karta hai. Agent ko
  kabhi asli account par ise dabane mat dena. Test ke liye apna ek alag test account
  banana hoga; agent poochega.
- **Naya package ya permission:** agar agent kahe ki naya package ya permission (jaise mic)
  chahiye, to iska matlab naya APK build hai. Pehle samjho, phir haan bolo.
- **Phone test:** sab screens ho jaane ke baad ek saath karna. Tab APK banegi (~12–15 min).
