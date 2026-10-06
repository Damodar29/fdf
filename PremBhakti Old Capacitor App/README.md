# Prem Bhakti (cbps-admin)

The official mobile app and admin dashboard project for CPBS. 
Built with modern web technologies and packaged for mobile using Capacitor.

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** TailwindCSS
- **Mobile Runtime:** Capacitor 7
- **Backend / Database:** Firebase (Firestore, Storage, Functions, Hosting)

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Android Studio (for Android builds)
- Xcode (for iOS builds - macOS only)

### Installation
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. The `postinstall` script will automatically run `patch-package` to apply any custom plugin patches.

---

## 💻 Available Scripts

### Development
Start the local Vite development server:
```bash
npm run dev
```

### Production Build
Build the web assets for production (generates `dist/`):
```bash
npm run build
```

### Mobile (Android) Sync
Copy your built web assets into the native Android project and update Capacitor plugins:
```bash
npm run build
npm run cap:sync:android
```
After syncing, you can open Android Studio to build the APK/AAB or run on a device:
```bash
npx cap open android
```

---

## 🎨 App Icon & Notification Artwork Workflow

We use a custom, automated workflow to generate PWA icons and crop the exact artwork required for the native Android Lockscreen Media Player.

**Step 1: Adjust Crop Area**
```bash
npm run setup-icon
```
* Opens a visual crop tool in your browser.
* Shows a live preview of how the Android Lockscreen will look.
* Adjust the box and click **Save & Close**.

**Step 2: Generate Final Assets**
```bash
npm run generate-icons
```
* Automatically reads the saved coordinates.
* Generates all `.webp` PWA icons in `public/icons/`.
* Generates `public/notification-icon.png`.
* Generates the Base64 artwork payload in `src/iconBase64.ts`.

---

## ☁️ Firebase Functions

The backend logic resides in the `functions/` directory.

```bash
cd functions
npm install
```
* **Serve locally:** `npm run serve` (Starts Firebase Emulators)
* **Deploy to Production:** `npm run deploy`

---

## 🌐 Cloudflare Workers

| Folder | Worker | Purpose |
|---|---|---|
| `share-preview-worker/` | `share-preview` | Share links (`/v/*`): redirects people, serves link previews |
| `workers/` | `github-cdn` | GitHub release CDN proxy |
| `b2-worker/` | `b2-video-proxy` | Media subdomains → private B2 bucket |

Deploy from the Worker's folder with `node wr.mjs deploy`. `wr.mjs` uses a login stored only in this repo (`.wrangler-auth/`, gitignored), because the Workers are in a different Cloudflare account than this machine's global `wrangler login`. If it has expired: `node wr.mjs login --browser=false`. Details in [AGENTS.md](AGENTS.md).

---

## 📁 Project Structure

* `/src` - React components, contexts, and main frontend logic.
* `/public` - Static assets, generated icons, and HTML entry points.
* `/scripts` - Custom automation scripts (Icons, AWS/B2 Backups, Migration).
* `/android` - Native Capacitor Android project.
* `/functions` - Firebase Cloud Functions (Node.js).
* `/patches` - Custom fixes for NPM dependencies applied via `patch-package`.
