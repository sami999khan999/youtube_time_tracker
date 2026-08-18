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
let hideSuggestionsSettings = {
  enabled: false,
};
let focusModeSettings = {
  enabled: false,
};
let keybindSettings = {
  toggleSidebar: "Alt+S",
  toggleFloating: "Alt+F",
  toggleDislike: "Alt+D",
  toggleShorts: "Alt+B",
  toggleSuggestions: "Alt+H",
  toggleFocusMode: "Alt+Z",
  navHistory: "Alt+Q",
  navAnalytics: "Alt+W",
  navChannels: "Alt+E",
  navBackup: "Alt+R",
  navSettings: "Alt+T",
  navShortcuts: "Alt+Y",
  manualBackup: "Alt+I",
  toggleOpacity: "Alt+U",
  opacityUp: "Alt+=",
  opacityDown: "Alt+-"
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
// uids already dropped from the rendered lists without a rebuild. Tracked so the
// list bookkeeping is adjusted exactly once per video: the tab that performs the
// delete also receives the background's VIDEO_DELETED broadcast for it.
let inPlaceRemovedUids = new Set();
const historyPageSize = 50;
let isInfiniteScrolling = false;

// Per-view search queries (lowercased). Empty string = no filter.
let historySearchQuery = "";
let channelSearchQuery = "";
let channelVideosSearchQuery = "";

/**
 * Initializes state from storage.local
 * Handles migration from localStorage if necessary.
 */
async function initState() {
  loadDeletedUids();
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
        "ytt_suggestions_settings",
        "ytt_focus_settings",
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
        if (data.ytt_suggestions_settings) {
          hideSuggestionsSettings = {
            ...hideSuggestionsSettings,
            ...data.ytt_suggestions_settings,
          };
        }
        if (data.ytt_focus_settings) {
          focusModeSettings = {
            ...focusModeSettings,
            ...data.ytt_focus_settings,
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

        // Refresh the synchronous fast-path caches so the next load / hard
        // reload can apply these visual states before first paint.
        writeVisualFastPath();

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
  } else if (request.action === "VIDEO_DELETED") {
    // Another tab deleted this video — stop reporting it from this tab too,
    // otherwise whichever tab is playing it immediately re-creates the entry.
    blacklistDeletedUid(request.uid);
    if (isStatsOpen) {
      // Drop the row in place — rebuilding the list would reload it from page 1
      // and throw away the scroll position. No-op if this tab already removed it.
      if (typeof removeVideoItemByUid === "function") {
        removeVideoItemByUid(request.uid);
      }
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

// Blacklisted uids live in sessionStorage so a hard reload of the same tab
// doesn't resurrect a video the user just deleted while still sitting on its
// watch page. Navigating to a different video clears the list (see tracking.js).
const DELETED_UIDS_KEY = "ytt_deleted_uids";

function loadDeletedUids() {
  try {
    const raw = sessionStorage.getItem(DELETED_UIDS_KEY);
    if (raw) deletedUids = new Set(JSON.parse(raw));
  } catch (e) {}
}

function persistDeletedUids() {
  try {
    sessionStorage.setItem(
      DELETED_UIDS_KEY,
      JSON.stringify(Array.from(deletedUids)),
    );
  } catch (e) {}
}

function clearDeletedUids() {
  if (deletedUids.size === 0) return;
  deletedUids.clear();
  persistDeletedUids();
}

/**
 * Blacklists a uid and drops it from the in-memory history mirror.
 * Applies to the currently playing video too — otherwise the next tracking
 * tick re-creates the entry with zeroed stats right after the deletion.
 */
function blacklistDeletedUid(uid) {
  if (!uid) return;
  deletedUids.add(uid);
  persistDeletedUids();

  // Remove locally so the sidebar updates immediately, before the background's
  // broadcast lands (and before the next tick can re-add it).
  Object.keys(allHistory).forEach((day) => {
    const bucket = allHistory[day];
    if (!bucket || !bucket.videos) return;
    const idx = bucket.videos.findIndex((v) => v.uid === uid);
    if (idx === -1) return;
    const removed = bucket.videos[idx];
    if (removed.watchedDuration > 0) {
      bucket.watchTime = Math.max(
        0,
        (bucket.watchTime || 0) - removed.watchedDuration,
      );
    }
    bucket.videos.splice(idx, 1);
  });
}

function deleteHistoryVideo(uid) {
  blacklistDeletedUid(uid);
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
  writeVisualFastPath();
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

function saveSuggestionsSettings() {
  safeSendMessage({
    action: "SAVE_SETTINGS",
    type: "suggestions",
    settings: hideSuggestionsSettings,
  });
  writeVisualFastPath();
}

function saveFocusModeSettings() {
  safeSendMessage({
    action: "SAVE_SETTINGS",
    type: "focus",
    settings: focusModeSettings,
  });
  writeVisualFastPath();
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
  writeVisualFastPath();
}

/**
 * Caches the visual feature states to localStorage so they can be applied
 * SYNCHRONOUSLY at document_start on the next load — before first paint —
 * eliminating flicker and layout shift. Mirrors the original opacity
 * fast-path. Readers live at the end of state.js (opacity),
 * suggestions.js (hide suggestions), and blocker.js (shorts).
 */
function writeVisualFastPath() {
  try {
    localStorage.setItem(
      "ytt_opacity_fast_path",
      JSON.stringify(opacitySettings),
    );
    localStorage.setItem(
      "ytt_suggestions_fast_path",
      JSON.stringify(hideSuggestionsSettings),
    );
    localStorage.setItem(
      "ytt_shorts_fast_path",
      JSON.stringify(shortsBlockerSettings),
    );
    localStorage.setItem(
      "ytt_focus_fast_path",
      JSON.stringify(focusModeSettings),
    );
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
      let visualChanged = false;

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
        visualChanged = true;
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
      if (changes.ytt_suggestions_settings) {
        hideSuggestionsSettings = {
          ...{ enabled: false },
          ...(changes.ytt_suggestions_settings.newValue || {}),
        };
        if (typeof applyHideSuggestionsState === "function") applyHideSuggestionsState();
        needsUIRefresh = true;
        visualChanged = true;
      }
      if (changes.ytt_focus_settings) {
        focusModeSettings = {
          ...{ enabled: false },
          ...(changes.ytt_focus_settings.newValue || {}),
        };
        if (typeof applyFocusModeState === "function") applyFocusModeState();
        needsUIRefresh = true;
        visualChanged = true;
      }
      if (changes.ytt_opacity_settings) {
        opacitySettings = {
          ...{ enabled: false, value: 0.5 },
          ...(changes.ytt_opacity_settings.newValue || {}),
        };
        applyOpacityState();
        needsUIRefresh = true;
        visualChanged = true;
      }

      // Keep the synchronous fast-path caches in sync across tabs.
      if (visualChanged) writeVisualFastPath();

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

/**
 * Turns the page dimmer on/off.
 *
 * All the styling lives in settings/opacity.css, which ships inside
 * dist/content.css and is therefore loaded by the browser at document_start,
 * before first paint. This function only has to flip two properties on <html>
 * — an element that already exists when a content script first runs and that
 * YouTube never rebuilds — so the dim is in place on the very first frame of a
 * hard reload and survives SPA navigation untouched.
 *
 * @param {{animate?: boolean}} [options] Fade the change in. Off by default:
 *   on load/navigation a transition would *animate* the change, stretching an
 *   invisible switch into a visible fade. Only deliberate user toggles animate.
 */
function applyOpacityState(options) {
  const animate = !!(options && options.animate);
  const root = document.documentElement;
  if (!root) return;

  // Legacy: pre-overlay versions injected a <style> tag. Drop it if present so
  // its nested-opacity rules cannot stack on top of the overlay.
  const legacy = document.getElementById("ytt-opacity-style-tag");
  if (legacy) legacy.remove();

  if (animate) {
    root.style.setProperty("--ytt-dim-transition", "opacity 0.3s ease");
  } else {
    root.style.removeProperty("--ytt-dim-transition");
  }

  if (!opacitySettings.enabled) {
    root.removeAttribute("data-ytt-dim");
    root.style.removeProperty("--ytt-dim-alpha");
    root.style.removeProperty("--ytt-dim-brightness");
    return;
  }

  // Clamp: a stored value outside 0–1 would blank the page out entirely.
  const value = Math.min(Math.max(Number(opacitySettings.value) || 0, 0.05), 1);

  // The overlay is black at (1 - value) alpha, which renders identically to
  // the content itself at `value` opacity over black.
  root.style.setProperty("--ytt-dim-alpha", String(1 - value));
  root.style.setProperty("--ytt-dim-brightness", String(value));
  if (!root.hasAttribute("data-ytt-dim")) root.setAttribute("data-ytt-dim", "");
}

// === ZERO-LATENCY FAST PATH: Apply opacity instantly on load ===
try {
  const fastPath = localStorage.getItem("ytt_opacity_fast_path");
  if (fastPath) {
    const cached = JSON.parse(fastPath);
    if (cached && cached.enabled) {
      opacitySettings = cached;
      // Two property writes on <html>, which already exists — nothing to wait
      // for, nothing to re-assert. The rules themselves came in with
      // dist/content.css, so the dim is live from the first painted frame.
      applyOpacityState();
    }
  }
} catch (e) {}
