# YouTube Time Tracker

A premium, accessibility-first Chrome extension designed to help you take control of your YouTube viewing habits. It monitors your watch time with high precision, blocks digital noise, and encourages healthy, productive breaks with motivational cues.

## 🚀 Key Features

### 1. Advanced Shorts Blocker
- **Intelligent De-clutter**: Automatically removes distraction-heavy Shorts segments from your Home feed, Subscription feed, and Sidebar.
- **Direct Block**: If you navigate directly to a `/shorts/` URL, the extension intercepts it with a custom "SHORTS BLOCKED" overlay.
- **Focused Navigation**: Automatically reorders the YouTube sidebar to prioritize content over mindless discovery.

### 2. Stats & Analytics Dashboard
- **Channel Attribution**: Now tracks and displays the **Channel Name** for every video in your history.
- **Dynamic Visuals**: Beautiful bar graphs for 7-day trends and conic-gradient pie charts for weekly distribution.
- **Quick Insights**: Instantly see your highest activity days and average watch time per video.

### 3. High-Performance History & Navigation
- **Infinite Scrolling**: Silky smooth rendering for thousands of entries. Loads content in batches to prevent UI lag.
- **Date-Based Navigation**: A premium glassmorphism-styled date navigator with navigation arrows and a calendar popover.
- **Custom Retention Policy**: Set your own data storage limits (7 days to 1 Year or Unlimited). Automatic background cleanup keeps your dataset lean.
- **One-Click Resume**: Click any video in your history to jump back to exactly where you left off.

### 4. Smart Break Reminder
- **Live Countdown Badge**: A dynamic timer badge on the toggle button shows you exactly how much time is left until your next break.
- **High Urgency States**: The badge turns red and counts down in seconds when you're within the last minute of your session.
- **Focused Intervention**: A fully focus-trapped modal pauses your video and provides a moment of mindfulness with motivational quotes and custom "Go to Work" prompts.

### 5. Secure Backup & Sync
- **IndexedDB Powered**: Robust local database support for high-capacity backups (100% private).
- **Periodic Autobackup**: Automatically creates a safety backup of your history and settings based on your schedule.
- **Manual Import/Export**: Export your data to JSON for safe-keeping or migration across devices.
- **Double-Counting Protection**: Intelligent background sync ensures that "Time on YouTube" reflects real clock time, even with 10+ tabs open at once.

### 6. Premium UI/UX
- **Native Aesthetic**: A theme-aware interface with glassmorphism effects that blends perfectly with YouTube's styles.
- **Total Scroll Management**: Automatically hides the YouTube scrollbar and locks page scrolling when the sidebar or modals are active.
- **Draggable & Resizable**: Move the toggle button anywhere and pull the sidebar width to suit your workspace (300px to 800px).

---

## 🛠 Technical Architecture

The project is built with a **Domain-Driven Design (DDD)** folder structure to ensure maximum reliability and clean code separation.

- **`src/shared/`**: Centralized theme tokens, state management, and IndexedDB wrappers.
- **`src/shorts-blocker/`**: Dedicated logic for DOM manipulation and navigation interception.
- **`src/stats-tracker/`**: High-performance UI rendering, batch processing, and precisely-timed tracking engines.
- **`src/break-reminder/`**: Temporal logic for session monitoring and background quote pre-fetching.
- **`src/init/`**: Responsive design overrides and bootstrapping logic.

### Optimization & Build
To maintain speed and stability, the project uses a custom **`build.js`** environment:
- Concatenates 17+ modular source files into optimized `dist/content.js` and `dist/background.js` bundles.
- Enforces a strict **300-line maintainability limit** across all source files.
- Uses **ES6+ features** and leverages **Service Worker bundling** for maximum reliability in Manifest V3.

---

## 📦 Installation (Development)

1. Clone this repository or download the source code.
2. Ensure you have [Node.js](https://nodejs.org/) installed.
3. Run the optimized build script:
   ```bash
   node build.js
   ```
4. Open Chrome and head to `chrome://extensions`.
5. Enable **Developer mode** and "Load unpacked".
6. Select the project root folder.

---

## ⚙️ Customization

Open the Sidebar and click the **Settings** icon to:
- Toggle the **Shorts Blocker** and **Break Reminder**.
- Fine-tune your **Reminder Interval** (5 to 120 minutes).
- Set your **Data Retention Duration** (7 days to Unlimited).
- Configure your **Periodic Backup** intervals and **Work URL**.
- Clear your entire local history with an accessible confirm-click.

---

## 🔒 Privacy & Accessibility

- **100% Local**: All data, including history, backups, and settings, stays on your device.
- **Unlimited Storage**: Leverages high-capacity browser systems (IndexedDB) and removing the standard 10MB quota for a seamless long-term experience.
- **No External Tracking**: No telemetry or third-party tracking. Quotes are fetched anonymously.
- **Accessibility First**: Implements ARIA roles, focus trapping, and keyboard-standard navigation for all interactive components.
