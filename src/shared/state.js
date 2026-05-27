// === Global State & Storage Persistence ===

// Cross-browser compatibility (Chrome / Firefox / Edge)
const storage = chrome?.storage || browser.storage;
const runtime = chrome?.runtime || browser.runtime;

function getDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Global State (initialized with defaults)
let allHistory = {};
let shortsBlockerSettings = { enabled: true };
let breakSettings = {
  enabled: true,
  intervalValue: 15,
  intervalUnit: "minutes",
  workUrl: "https://www.google.com",
};
let dislikeCountSettings = { enabled: true };
let backupSettings = {
  enabled: true,
  intervalValue: 24,
  intervalUnit: "hours",
  intervalHours: 24,
  backupOnClose: true,
  maxBackups: 10,
  reminderEnabled: true,
  reminderInterval: 24,
  reminderUnit: "hours",
  lastReminderTime: 0,
};
let retentionSettings = {
  duration: 7, // Default 7 days
};
let smartFullscreenSettings = {
  enabled: true,
};
let keybindSettings = {
  toggleSidebar: "Alt+S",
  toggleFloating: "Alt+F",
  toggleDislike: "Alt+D",
  toggleShorts: "Alt+B",
  navHistory: "Alt+Q",
  navAnalytics: "Alt+W",
  navChannels: "Alt+E",
  navBackup: "Alt+R",
  navSettings: "Alt+T",
  navShortcuts: "Alt+Y",
  manualBackup: "Alt+I",
  toggleOpacity: "Alt+U"
};
let opacitySettings = {
  enabled: false,
  value: 0.5,
};

let selectedDayFilter = "today"; // 'today', 'yesterday', 'all', or 'YYYY-MM-DD'
let activeView = "history"; // 'history', 'analytics', or 'settings'
let lastVideoId = "";
let currentUid = "";
let lastWatchTimeUpdate = Date.now();
let isStatsOpen = false;
let lastRenderedView = "";
let lastRenderedFilter = "";
let lastVideoCount = -1;
let continuousWatchStart = null;
let breakModalShown = false;
let preFetchedQuote = null;
let isFetchingQuote = false;
let deletedUids = new Set();
let fullSortedVideos = [];
let loadedVideoCount = 0;
const historyPageSize = 50;
let isInfiniteScrolling = false;

/**
 * Initializes state from storage.local
 * Handles migration from localStorage if necessary.
 */
async function initState() {
  return new Promise((resolve) => {
    safeStorageGet(
      [
        "ytt_history",
        "ytt_shorts_settings",
        "ytt_break_settings",
        "ytt_dislike_settings",
        "ytt_backup_settings",
        "ytt_retention_settings",
        "ytt_smart_fullscreen_settings",
        "ytt_keybind_settings",
        "ytt_opacity_settings",
        "ytt_migrated",
      ],
      (data) => {
        let history = data.ytt_history;
        let shortsSettings = data.ytt_shorts_settings;
        let bSettings = data.ytt_break_settings;

        // 1. Migration from legacy localStorage (one-time)
        if (!data.ytt_migrated) {
          try {
            const localHistory = localStorage.getItem("ytt_history");
            if (localHistory) history = JSON.parse(localHistory);

            const localShorts = localStorage.getItem("ytt_shorts_settings");
            if (localShorts) shortsSettings = JSON.parse(localShorts);

            const localBreak = localStorage.getItem("ytt_break_settings");
            if (localBreak) bSettings = JSON.parse(localBreak);

            // Mark as migrated and cleanup old keys
            localStorage.removeItem("ytt_history");
            localStorage.removeItem("ytt_shorts_settings");
            localStorage.removeItem("ytt_break_settings");
            safeStorageSet({ ytt_migrated: true });
          } catch (e) {
            console.error("Migration failed:", e);
          }
        }

        // 2. Failsafe Recovery (if chrome.storage.local was wiped due to extension removal)
        if (!history || Object.keys(history).length === 0) {
          try {
            const failsafe = localStorage.getItem("ytt_failsafe_backup");
            if (failsafe) {
              const parsed = JSON.parse(failsafe);
              if (parsed && (parsed.allHistory || parsed.ytt_history)) {
                console.log("YouTube Time Tracker: Found failsafe backup. Requesting restore...");
                
                // Request background to import this backup properly (populates storage.local & IndexedDB)
                safeSendMessage({
                  action: "RESTORE_FROM_FAILSAFE",
                  data: parsed
                });
                
                // Temporarily apply to local memory so UI can render immediately
                history = parsed.allHistory || parsed.ytt_history;
                if (parsed.shortsBlockerSettings) shortsSettings = parsed.shortsBlockerSettings;
                if (parsed.breakSettings) bSettings = parsed.breakSettings;
              }
            }
          } catch (e) {
            console.error("Failsafe recovery failed:", e);
          }
        }

        // Apply history
        allHistory = history || {};

        const todayKey = getDayKey();
        if (!allHistory[todayKey]) {
          allHistory[todayKey] = {
            watchTime: 0,
            videos: [],
            sessionStart: Date.now(),
          };
        }

        // Apply settings
        if (shortsSettings) shortsBlockerSettings = shortsSettings;
        if (bSettings) {
          // Handle migration from intervalMinutes
          if (
            bSettings.intervalMinutes !== undefined &&
            bSettings.intervalValue === undefined
          ) {
            bSettings.intervalValue = bSettings.intervalMinutes;
            bSettings.intervalUnit = "minutes";
          }
          breakSettings = { ...breakSettings, ...bSettings };
        }
        if (data.ytt_dislike_settings) {
          dislikeCountSettings.enabled =
            data.ytt_dislike_settings.enabled ?? true;
        }
        if (data.ytt_backup_settings) {
          backupSettings = { ...backupSettings, ...data.ytt_backup_settings };
        }
        if (data.ytt_retention_settings) {
          retentionSettings = {
            ...retentionSettings,
            ...data.ytt_retention_settings,
          };
        }
        if (data.ytt_smart_fullscreen_settings) {
          smartFullscreenSettings = {
            ...smartFullscreenSettings,
            ...data.ytt_smart_fullscreen_settings,
          };
        }
        if (data.ytt_keybind_settings) {
          keybindSettings = {
            ...keybindSettings,
            ...data.ytt_keybind_settings,
          };
        }
        if (data.ytt_opacity_settings) {
          opacitySettings = {
            ...opacitySettings,
            ...data.ytt_opacity_settings,
          };
        }

        console.log("YouTube Time Tracker: State initialized from storage.");
        resolve();
      },
    );
  });
}

/**
 * Safely sends a message to the background script.
 * Handles "Extension context invalidated" errors gracefully.
 */
function safeSendMessage(message, callback) {
  try {
    if (runtime && runtime.id) {
      runtime.sendMessage(message, (response) => {
        if (runtime.lastError) {
          const errorMsg = runtime.lastError.message;
          // Ignore common harmless errors during reload/unload
          if (
            errorMsg.includes("context invalidated") ||
            errorMsg.includes("message port closed") ||
            errorMsg.includes("Receiving end does not exist") ||
            errorMsg.includes("asynchronous response")
          ) {
            return;
          }
          console.error("YTT: Runtime error in callback:", errorMsg);
        }
        if (callback) callback(response);
      });
    }
  } catch (e) {
    if (e.message.includes("context invalidated")) {
      window.yttContextInvalidated = true;
    } else {
      console.error("YTT: Failed to send message:", e);
    }
  }
}

/**
 * Safely reads from storage.local.
 * Handles context invalidation.
 */
function safeStorageGet(keys, callback) {
  try {
    if (window.yttContextInvalidated) return;
    storage.local.get(keys, (data) => {
      if (runtime.lastError) {
        if (runtime.lastError.message.includes("context invalidated")) {
          window.yttContextInvalidated = true;
          return;
        }
        console.error("YTT: Storage get error:", runtime.lastError.message);
      }
      if (callback) callback(data);
    });
  } catch (e) {
    if (e.message && e.message.includes("context invalidated")) {
      window.yttContextInvalidated = true;
    } else {
      console.error("YTT: Failed to get storage:", e);
    }
  }
}

// Runtime message listener for instant syncing & failsafe
runtime.onMessage.addListener((request) => {
  if (request.action === "HISTORY_UPDATE") {
    allHistory = request.allHistory;
    // Only re-render if the stats panel is actually open
    if (isStatsOpen) {
      renderStats();
    }
  } else if (request.action === "SYNC_FAILSAFE") {
    updateFailsafeBackup(request.data);
  }
});

function updateFailsafeBackup(data) {
  try {
    if (data) {
      // Mirror the latest backup to localStorage for persistence across uninstalls
      localStorage.setItem("ytt_failsafe_backup", JSON.stringify(data));
    }
  } catch (e) {
    console.error("YTT: Failed to update failsafe backup:", e.message);
  }
}

/**
 * Safely writes to storage.local.
 * Handles context invalidation.
 */
function safeStorageSet(items, callback) {
  try {
    if (window.yttContextInvalidated) return;
    storage.local.set(items, () => {
      if (runtime.lastError) {
        if (runtime.lastError.message.includes("context invalidated")) {
          window.yttContextInvalidated = true;
          return;
        }
        console.error("YTT: Storage set error:", runtime.lastError.message);
      }
      if (callback) callback();
    });
  } catch (e) {
    if (e.message && e.message.includes("context invalidated")) {
      window.yttContextInvalidated = true;
    } else {
      console.error("YTT: Failed to set storage:", e);
    }
  }
}

function saveHistory() {
  safeSendMessage({ action: "REPORT_WATCH_TIME", delta: 0 });
}

function deleteHistoryVideo(uid) {
  if (uid !== currentUid) {
    deletedUids.add(uid);
  }
  safeSendMessage({ action: "DELETE_VIDEO", uid });
}

function clearAllData() {
  safeSendMessage({ action: "CLEAR_HISTORY" }, () => {
    // Reset in-memory settings (history will be updated via storage listener)
    breakSettings = {
      enabled: true,
      intervalValue: 15,
      intervalUnit: "minutes",
      workUrl: "https://www.google.com",
    };

    saveShortsBlockerSettings();
    saveBreakSettings();

    if (isStatsOpen) renderStats();
    applyShortsBlockerState();
  });
}

function saveShortsBlockerSettings() {
  safeSendMessage({
    action: "SAVE_SETTINGS",
    type: "shorts",
    settings: shortsBlockerSettings,
  });
}

function saveDislikeCountSettings() {
  safeSendMessage({
    action: "SAVE_SETTINGS",
    type: "dislike",
    settings: dislikeCountSettings,
  });
}

function saveBreakSettings() {
  safeSendMessage({
    action: "SAVE_SETTINGS",
    type: "break",
    settings: breakSettings,
  });
}

function saveBackupSettings() {
  safeSendMessage({
    action: "SAVE_SETTINGS",
    type: "backup",
    settings: backupSettings,
  });
}

function saveOpacitySettings() {
  safeSendMessage({
    action: "SAVE_SETTINGS",
    type: "opacity",
    settings: opacitySettings,
  });
  try {
    localStorage.setItem("ytt_opacity_fast_path", JSON.stringify(opacitySettings));
  } catch (e) {}
}

function saveRetentionSettings() {
  safeSendMessage({
    action: "SAVE_SETTINGS",
    type: "retention",
    settings: retentionSettings,
  });
}

// Sync listener: keeps all open tabs in sync when storage changes
storage.onChanged.addListener((changes, area) => {
  try {
    if (area === "local") {
      let needsUIRefresh = false;

      if (changes.ytt_history) {
        allHistory = changes.ytt_history.newValue || {};
        needsUIRefresh = true;
      }
      if (changes.ytt_shorts_settings) {
        const newValue = changes.ytt_shorts_settings.newValue || {
          enabled: true,
        };
        shortsBlockerSettings.enabled = newValue.enabled;
        applyShortsBlockerState(); // Live apply shorts blocker toggle
        needsUIRefresh = true;
      }
      if (changes.ytt_dislike_settings) {
        const newValue = changes.ytt_dislike_settings.newValue;
        if (newValue && typeof newValue === "object") {
          dislikeCountSettings.enabled = newValue.enabled ?? true;
          applyDislikeCountState();
          needsUIRefresh = true;
        }
      }
      if (changes.ytt_break_settings) {
        const newValue = changes.ytt_break_settings.newValue || {
          enabled: true,
          intervalValue: 15,
          intervalUnit: "minutes",
          workUrl: "https://www.google.com",
        };
        breakSettings.enabled = newValue.enabled;
        breakSettings.intervalValue =
          newValue.intervalValue ?? newValue.intervalMinutes ?? 15;
        breakSettings.intervalUnit = newValue.intervalUnit || "minutes";
        breakSettings.workUrl = newValue.workUrl;
        needsUIRefresh = true;
      }
      if (changes.ytt_backup_settings) {
        backupSettings = {
          ...{
            enabled: true,
            intervalHours: 24,
            backupOnClose: true,
            maxBackups: 10,
            reminderEnabled: true,
            reminderInterval: 24,
            reminderUnit: "hours",
            lastReminderTime: 0,
          },
          ...(changes.ytt_backup_settings.newValue || {}),
        };
        needsUIRefresh = true;
      }
      if (changes.ytt_smart_fullscreen_settings) {
        smartFullscreenSettings = {
          ...{ enabled: false },
          ...(changes.ytt_smart_fullscreen_settings.newValue || {}),
        };
        needsUIRefresh = true;
      }
      if (changes.ytt_opacity_settings) {
        opacitySettings = {
          ...{ enabled: false, value: 0.5 },
          ...(changes.ytt_opacity_settings.newValue || {}),
        };
        applyOpacityState();
        needsUIRefresh = true;
      }

      // Only re-render if the stats panel is actually open
      if (needsUIRefresh && isStatsOpen) {
        if (typeof syncSettingsUI === "function") syncSettingsUI();
        renderStats();
      }
    }
  } catch (e) {
    if (e.message.includes("context invalidated")) {
      window.yttContextInvalidated = true;
    }
  }
});

function saveRetentionSettings() {
  safeStorageSet({ ytt_retention_settings: retentionSettings });
}

function saveSmartFullscreenSettings() {
  safeStorageSet({ ytt_smart_fullscreen_settings: smartFullscreenSettings });
}

function applyOpacityState() {
  const OPACITY_STYLE_ID = "ytt-opacity-style-tag";
  let styleEl = document.getElementById(OPACITY_STYLE_ID);

  if (!opacitySettings.enabled) {
    if (styleEl) styleEl.remove();
    // Rely on the removal of the style tag to revert background color
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = OPACITY_STYLE_ID;
    const target = document.head || document.documentElement;
    target.appendChild(styleEl);
  }

  const css = `
    ytd-app, #content, #page-manager {
      opacity: ${opacitySettings.value} !important;
      transition: opacity 0.3s ease !important;
    }
    body, ytd-app {
      background-color: #000 !important;
    }
    #stats-sidebar, #stats-toggle-btn, .stats-tooltip, .confirm-modal-overlay {
      opacity: 1 !important;
    }
  `;

  if (styleEl.textContent !== css) {
    styleEl.textContent = css;
  }
}

// === ZERO-LATENCY FAST PATH: Apply opacity instantly on load ===
try {
  const fastPath = localStorage.getItem("ytt_opacity_fast_path");
  if (fastPath) {
    const cached = JSON.parse(fastPath);
    if (cached && cached.enabled) {
      opacitySettings = cached;
      applyOpacityState();
    }
  }
} catch (e) {}
