# michi — UPSC Current Affairs React App

`michi` is a premium, fully offline-capable Progressive Web App (PWA) designed for UPSC aspirants. It provides daily current-affairs briefs (from sources like *The Hindu* and *UPSCPrep*), subject-wise revision tools, a geography geography map quiz arcade, previous year questions (PYQs), and comprehensive settings with haptic feedback.

Built using React, Vite, TypeScript, and Tailwind CSS, the app is structured to run as a fast web application and can also be compiled into native mobile apps (Android/iOS) using Capacitor.

---

## 🚀 Key Features

* **Daily Briefing**: A dual-view interface offering a **List View** for chronological reading and a gesture-based **Card Deck View** for distraction-free swiping.
* **Revise Screen**: Organizes all imported articles by UPSC topics (Polity, Economy, Environment, History, Science & Tech, International Relations) with search and expandable lists.
* **Maps Arcade**: A built-in geography learning game covering Indian national parks and major river systems.
* **PYQ Vault**: Practice past Prelims and Mains exams with custom glassmorphic filters for Subjects and Years, search capability, bookmarks, and detailed answer descriptions.
* **Bookmarks & Profile**: Access saved articles, export bookmarks as text files, backup full study content, or import new daily current affairs sheets in JSON format.

---

## 🛠️ Technology Stack

* **Core**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
* **Build Tool & Server**: [Vite 8](https://vite.dev/)
* **Styling**: [Tailwind CSS 3](https://tailwindcss.com/) + Custom Glassmorphic design system in Vanilla CSS (`index.css`)
* **State Management**: [Zustand](https://github.com/pmndrs/zustand)
* **Mobile Bridge**: [Capacitor 8](https://capacitorjs.com/) (Android / iOS support)
* **Icons**: [FontAwesome 7 (React & SVG)](https://fontawesome.com/)
* **Data Visualization**: [D3.js v7](https://d3js.org/) & [TopoJSON](https://github.com/topojson/topojson) (for interactive maps)

---

## 💻 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed (LTS recommended).

### Installation

1. Navigate to the `app` directory:
   ```bash
   cd app
   ```
2. Install the package dependencies:
   ```bash
   npm install
   ```

### Running Locally

To run the application in development mode with hot-reloading:
```bash
npm run dev
```

*Note: The local server is configured with `host: true` in `vite.config.ts`, making it automatically accessible to other devices on your local network (e.g. `http://192.168.1.X:5173`) for testing directly on your mobile browser.*

### Production Build

To check for type errors and compile the production bundle:
```bash
npm run build
```
The optimized files will be generated in the `dist` directory.

### Preview Production Build

To run a local web server to preview the built production bundle:
```bash
npm run preview
```

---

## 📂 Project Structure

```
app/
├── android/               # Capacitor Android native project
├── ios/                   # Capacitor iOS native project
├── public/                # Static assets (fonts, icons, data, FontAwesome)
│   ├── data/              # Base map geojson & PYQ datasets
│   ├── fa/                # Local FontAwesome CSS & font assets
│   └── fonts/             # Local Nunito Web Fonts
├── src/
│   ├── components/        # UI Screen Components
│   │   ├── bookmarks/     # Saved Articles Bookmarks screen
│   │   ├── deep-dive/     # Detailed Article overlays
│   │   ├── feed/          # Home screen Feed, DeckView, and date selectors
│   │   ├── flashcards/    # Flashcard revision Overlay
│   │   ├── layout/        # Bottom Nav bar, Onboarding, and Splash screens
│   │   ├── maps-arcade/   # Geography map quiz game components
│   │   ├── profile/       # Stats, backup settings, import/export buttons
│   │   ├── pyq-vault/     # PYQ Vault screen & custom dropdown selectors
│   │   ├── revise/        # Topic-wise revision screens
│   │   └── search/        # Global search and filter chips
│   ├── constants/         # App constants and category mappings
│   ├── hooks/             # Haptic feedback and data-fetching React hooks
│   ├── stores/            # Zustand global state stores (App, Theme, Bookmarks)
│   ├── types/             # TypeScript declaration files
│   ├── App.tsx            # Root application router
│   ├── index.css          # Core CSS stylesheet, design tokens, & media queries
│   └── main.tsx           # React bootstrap entry point
├── package.json
├── tailwind.config.ts
└── vite.config.ts         # Vite builder & PWA service worker config
```

---

## 📱 Mobile App (Capacitor) Setup & Build

Capacitor bridges the React web build with native platforms. Follow these steps to build the application for **Android** and **iOS**:

### 1. Prepare Web Assets
Every time you make changes to the React code, you must compile the web project and sync the bundle to the native platforms before building:
```bash
# Compile React code to the static dist/ bundle
npm run build

# Sync compiled static assets to the native Android and iOS folders
npx cap sync
```

---

### 🤖 Android Build Steps (APK/AAB)

To run or build a production bundle (`.apk` or `.aab`) for Android devices:

1. **Open the Android project in Android Studio**:
   ```bash
   npx cap open android
   ```
2. **Sync Gradle**:
   Wait for Android Studio to finish indexing and running the initial Gradle Sync.
3. **Run on Device / Emulator**:
   * Select your connected physical device or a Virtual Device (AVD) from the device dropdown at the top.
   * Click the **Run** button (green play icon, or press `Shift + F10`) to build and run the app.
4. **Build APK (for sharing / testing)**:
   * In the top menu, go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   * Once finished, a notification popup will appear. Click **Locate** to find the output `app-debug.apk` file.
5. **Build AAB (for Google Play Store release)**:
   * Go to **Build > Generate Signed Bundle / APK...**
   * Select **Android App Bundle** and click **Next**.
   * Create or specify a keystore path, enter credentials, select the release variant, and click **Create**. The signed `.aab` file will be generated in your output directory.

---

### 🍎 iOS Build Steps (IPA)

To run or package the app for iOS (requires a macOS machine with Xcode installed):

1. **Open the iOS project in Xcode**:
   ```bash
   npx cap open ios
   ```
2. **Configure Code Signing**:
   * In the left navigator pane, select the root **App** project.
   * Select the **App** target and open the **Signing & Capabilities** tab.
   * Check **Automatically manage signing** and select your active Apple Developer Account under **Team**.
3. **Run on Simulator / iOS Device**:
   * Select your connected iPhone or a simulated iOS device from the scheme target selector dropdown at the top.
   * Click the **Run** button (play icon, or press `Cmd + R`) to compile and launch.
4. **Build and Distribute Release (.ipa)**:
   * Select **Any iOS Device (arm64)** as the build target in Xcode.
   * Go to the top menu and select **Product > Archive**.
   * Once the archive process completes, the Xcode Organizer window will pop up. 
   * Click **Distribute App** to upload the build to App Store Connect (TestFlight) or export it as an Ad-Hoc `.ipa` file for local testing.
