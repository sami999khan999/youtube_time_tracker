// === Background Service Worker: Single Source of Truth for State ===

// Cross-browser compatibility (Chrome / Firefox / Edge)
const storage = chrome?.storage || browser.storage;
const runtime = chrome?.runtime || browser.runtime;
const tabs = chrome?.tabs || browser.tabs;

let allHistory = {};
let shortsBlockerSettings = { enabled: true };
let breakSettings = {
  enabled: true,
  intervalMinutes: 15,
  workUrl: "https://www.google.com",
};
const activePlayingTabs = {}; // Tracks { tabId: timestamp }
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
};
let retentionSettings = {
  duration: 7,
};
let dislikeCountSettings = { enabled: true };
let opacitySettings = { enabled: false, value: 0.5 };
let smartFullscreenSettings = { enabled: true };
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
  toggleOpacity: "Alt+U",
};
const youtubeTabs = new Set(); // Tracks active YouTube tabs for the "on close" backup

// Global throttles for multi-tab time tracking
let lastGlobalWatchUpdateTime = 0;
let lastGlobalActiveUpdateTime = Date.now();
let lastStorageWriteTime = 0;
let pendingSaveTimeout = null;

// Load initial state from storage
const loadPromise = new Promise((resolve) => {
  storage.local.get(
    [
      "ytt_history",
      "ytt_shorts_settings",
      "ytt_break_settings",
      "ytt_backup_settings",
      "ytt_retention_settings",
      "ytt_dislike_settings",
      "ytt_opacity_settings",
      "ytt_smart_fullscreen_settings",
      "ytt_keybind_settings",
    ],
    (data) => {
      if (data.ytt_smart_fullscreen_settings)
        smartFullscreenSettings = {
          ...smartFullscreenSettings,
          ...data.ytt_smart_fullscreen_settings,
        };
      if (data.ytt_keybind_settings)
        keybindSettings = { ...keybindSettings, ...data.ytt_keybind_settings };

      if (data.ytt_retention_settings)
        retentionSettings = {
          ...retentionSettings,
          ...data.ytt_retention_settings,
        };

      // Watch for storage changes to keep background memory in sync with UI
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;

        if (changes.ytt_shorts_settings)
          shortsBlockerSettings = changes.ytt_shorts_settings.newValue;
        if (changes.ytt_break_settings)
          breakSettings = changes.ytt_break_settings.newValue;
        if (changes.ytt_backup_settings) {
          backupSettings = changes.ytt_backup_settings.newValue;
          scheduleAlarms();
        }
        if (changes.ytt_retention_settings)
          retentionSettings = changes.ytt_retention_settings.newValue;
        if (changes.ytt_dislike_settings)
          dislikeCountSettings = changes.ytt_dislike_settings.newValue;
        if (changes.ytt_opacity_settings)
          opacitySettings = changes.ytt_opacity_settings.newValue;
        if (changes.ytt_smart_fullscreen_settings)
          smartFullscreenSettings = changes.ytt_smart_fullscreen_settings.newValue;
        if (changes.ytt_keybind_settings)
          keybindSettings = changes.ytt_keybind_settings.newValue;
      });

      // Enforce retention policy on load
      if (data.ytt_history) {
        allHistory = cleanupOldHistory(
          data.ytt_history,
          retentionSettings.duration,
        );
        // Save cleaned history back if it changed
        if (
          Object.keys(allHistory).length !==
          Object.keys(data.ytt_history).length
        ) {
          storage.local.set({ ytt_history: allHistory });
        }
      }

      if (data.ytt_shorts_settings)
        shortsBlockerSettings = data.ytt_shorts_settings;
      if (data.ytt_break_settings) breakSettings = data.ytt_break_settings;
      if (data.ytt_backup_settings)
        backupSettings = { ...backupSettings, ...data.ytt_backup_settings };
      if (data.ytt_dislike_settings)
        dislikeCountSettings = {
          ...dislikeCountSettings,
          ...data.ytt_dislike_settings,
        };
      if (data.ytt_opacity_settings)
        opacitySettings = {
          ...opacitySettings,
          ...data.ytt_opacity_settings,
        };

      scheduleAlarms();
      console.log("Background: State loaded and cleaned.");
      resolve();
    },
  );
});

function cleanupOldHistory(history, days) {
  if (days === -1) return history; // Unlimited

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);
  const threshold = getDayKey(thresholdDate);

  const cleaned = {};
  Object.keys(history).forEach((key) => {
    if (key >= threshold) cleaned[key] = history[key];
  });
  return cleaned;
}

runtime.onMessage.addListener((request, sender, sendResponse) => {
  let isResponded = false;
  const safeResponse = (data) => {
    if (!isResponded) {
      isResponded = true;
      try {
        sendResponse(data);
      } catch (e) {
        console.warn(
          "BG: sendResponse failed (channel probably closed):",
          e.message,
        );
      }
    }
  };

  loadPromise
    .then(async () => {
      try {
        if (request.action === "REPORT_WATCH_TIME") {
          const tabId = sender.tab ? sender.tab.id : null;

          if (tabId) {
            if (request.isPlaying && request.videoId) {
              activePlayingTabs[tabId] = {
                time: Date.now(),
                videoId: request.videoId,
                windowId: sender.tab.windowId,
              };
            } else {
              delete activePlayingTabs[tabId];
            }
          }

          const now = Date.now();
          for (const tid in activePlayingTabs) {
            if (now - activePlayingTabs[tid].time > 3000) {
              delete activePlayingTabs[tid];
            }
          }

          let otherPlayingTabId = null;
          if (request.isPlaying && tabId && request.videoId) {
            for (const tid in activePlayingTabs) {
              if (
                tid !== String(tabId) &&
                activePlayingTabs[tid].videoId === request.videoId
              ) {
                otherPlayingTabId = parseInt(tid, 10);
                break;
              }
            }
          }

          handleWatchTimeReport(request);
          safeResponse({ success: true, otherPlayingTabId });
        } else if (request.action === "SAVE_SETTINGS") {
          handleSettingsUpdate(request);
          safeResponse({ success: true });
        } else if (request.action === "CLOSE_TAB" && sender.tab) {
          tabs.remove(sender.tab.id);
          safeResponse({ success: true });
        } else if (request.action === "CLOSE_TAB_BY_ID") {
          if (request.tabId) {
            tabs.remove(request.tabId);
          }
          safeResponse({ success: true });
        } else if (request.action === "DELETE_VIDEO") {
          handleDeleteVideo(request.uid);
          safeResponse({ success: true });
        } else if (request.action === "CLEAR_HISTORY") {
          handleClearHistory();
          safeResponse({ success: true });
        } else if (request.action === "FETCH_QUOTE") {
          const quote = await fetchZenQuote();
          safeResponse(quote);
        } else if (request.action === "GET_BACKUPS") {
          const backups = await self.yttDB.getAllBackups();
          safeResponse(backups);
        } else if (request.action === "CREATE_BACKUP_MANUAL" || request.action === "CREATE_BACKUP_AND_DOWNLOAD") {
          const backupData = await createBackup();
          safeResponse({ success: true, data: backupData });
        } else if (request.action === "DELETE_BACKUP") {
          await self.yttDB.deleteBackup(request.id);
          safeResponse({ success: true });
        } else if (request.action === "GET_BACKUP_FULL") {
          const backup = await self.yttDB.getBackupById(request.id);
          safeResponse(backup);
        } else if (request.action === "IMPORT_BACKUP" || request.action === "RESTORE_FROM_FAILSAFE") {
          const importData = request.action === "RESTORE_FROM_FAILSAFE" ? request.data : request.clientData;
          handleImportBackup(importData)
            .then((result) => {
              safeResponse({
                success: result.success,
                settings: result.settings,
              });
            })
            .catch((err) => {
              safeResponse({ success: false, error: err.message });
            });
        } else if (request.action === "RESTORE_BACKUP") {
          self.yttDB
            .getBackupById(request.id)
            .then((backup) => {
              if (backup) {
                return handleImportBackup(backup.data);
              }
              throw new Error("Backup not found");
            })
            .then((result) => {
              safeResponse({
                success: result.success,
                settings: result.settings,
              });
            })
            .catch((err) => {
              safeResponse({ success: false, error: err.message });
            });
        } else if (request.action === "DELETE_ALL_BACKUPS") {
          self.yttDB
            .clearAllBackups()
            .then(() => {
              safeResponse({ success: true });
            })
            .catch((err) => {
              safeResponse({ success: false, error: err.message });
            });
        } else if (request.action === "GET_DISLIKE_COUNT") {
          fetchDislikeFromAPI(request.videoId)
            .then((data) => safeResponse(data))
            .catch((err) => {
              console.error("BG: Dislike fetch error:", err);
              safeResponse(null);
            });
        } else if (request.action === "TEST_BACKUP_REMINDER") {
          broadcastBackupReminder();
          safeResponse({ success: true });
        } else {
          // Fallback for unknown actions
          safeResponse({ error: "Unknown action: " + request.action });
        }
      } catch (err) {
        console.error("BG: Async message handling error:", err);
        safeResponse({ error: err.message });
      }
    })
    .catch((err) => {
      console.error("BG: loadPromise rejection:", err);
      safeResponse({ error: "State load failed" });
    });

  return true; // Keep message channel open for asynchronous response
});

function getDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function handleDeleteVideo(uid) {
  Object.keys(allHistory).forEach((key) => {
    const videoIndex = allHistory[key].videos.findIndex((v) => v.uid === uid);
    if (videoIndex !== -1) {
      const video = allHistory[key].videos[videoIndex];
      if (video && video.watchedDuration > 0) {
        allHistory[key].watchTime = Math.max(
          0,
          (allHistory[key].watchTime || 0) - video.watchedDuration,
        );
      }
      allHistory[key].videos.splice(videoIndex, 1);
    }
  });
  storage.local.set({ ytt_history: allHistory });
}

function handleClearHistory() {
  const currentDay = getDayKey();
  allHistory = {
    [currentDay]: {
      watchTime: 0,
      activeTime: 0,
      videos: [],
      sessionStart: Date.now(),
    },
  };
  storage.local.set({ ytt_history: allHistory });
}

function handleWatchTimeReport(data) {
  const {
    delta,
    videoId,
    videoTitle,
    channelName,
    currentPosition,
    totalDuration,
  } = data;
  const currentDay = getDayKey();

  if (!allHistory[currentDay]) {
    allHistory[currentDay] = {
      watchTime: 0,
      activeTime: 0,
      videos: [],
      sessionStart: Date.now(),
    };
  }

  const todayData = allHistory[currentDay];
  const uid = `${currentDay}_${videoId}`;
  let videoEntry = todayData.videos.find((v) => v.uid === uid);

  if (!videoEntry && videoId) {
    videoEntry = {
      uid: uid,
      id: videoId,
      title: videoTitle || "Loading Video...",
      channelName: channelName || "Loading Channel...",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      startTime: new Date().toLocaleTimeString(),
      watchedDuration: 0,
      currentPosition: currentPosition || 0,
      totalDuration: totalDuration || 0,
      lastUpdated: Date.now(),
    };
    todayData.videos.push(videoEntry);
  }

  if (videoEntry) {
    videoEntry.lastUpdated = Date.now();
    if (delta > 0) {
      // 1. Individual video accuracy: always increment
      videoEntry.watchedDuration += delta;

      // 2. Aggregate Watch Time: always increment (5 tabs = 5s per second)
      todayData.watchTime += delta;
    }

    // Track if this specific video instance is currently playing
    const wasPlaying = !!videoEntry.isPlaying;
    videoEntry.isPlaying = !!data.isPlaying;

    // Update lastStarted only when transitions to playing or is new and playing
    // This prevents the "shuffling" jitter in the history list across tabs.
    if (videoEntry.isPlaying && (!wasPlaying || !videoEntry.lastStarted)) {
      videoEntry.lastStarted = Date.now();
    }

    if (currentPosition !== undefined && isFinite(currentPosition))
      videoEntry.currentPosition = currentPosition;
    if (
      totalDuration !== undefined &&
      isFinite(totalDuration) &&
      totalDuration > 0
    )
      videoEntry.totalDuration = totalDuration;
    if (videoTitle && videoEntry.title === "Loading Video...")
      videoEntry.title = videoTitle;
    if (channelName && videoEntry.channelName === "Loading Channel...")
      videoEntry.channelName = channelName;
  }

  // --- Multi-Tab Stale Cleanup ---
  // Ensure videos that haven't reported in 3s are marked as NOT playing.
  // This handles closed tabs or videos that were paused without a final report.
  const now = Date.now();
  if (todayData && todayData.videos) {
    todayData.videos.forEach((v) => {
      if (v.isPlaying && now - (v.lastUpdated || 0) > 3000) {
        v.isPlaying = false;
      }
    });
  }

  // Track active usage time (heartbeat)
  const timeSinceLastActiveUpdate = now - lastGlobalActiveUpdateTime;

  // STRICT LINEAR TIME: Only add time if 1s+ has passed globally.
  // We add 'timeSinceLastActiveUpdate' but cap it to 2s to avoid massive jumps
  // (e.g. if the computer sleeps or browser suspends background scripts).
  if (timeSinceLastActiveUpdate >= 950) {
    const linearDelta = Math.min(timeSinceLastActiveUpdate, 2000) / 1000;
    todayData.activeTime = (todayData.activeTime || 0) + linearDelta;
    lastGlobalActiveUpdateTime = now;
  }

  // Live broadcast to all tabs for instant UI updates
  broadcastHistoryToTabs();

  // Throttled storage write to prevent performance bottlenecks
  throttledSaveHistory();
}

/**
 * Sends the current history to all open YouTube tabs for instant UI syncing.
 */
function broadcastHistoryToTabs() {
  tabs.query({ url: "*://*.youtube.com/*" }, (allTabs) => {
    allTabs.forEach((tab) => {
      // Don't send if we don't have permission for this tab
      if (!tab.url || !tab.url.includes("youtube.com")) return;

      try {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "HISTORY_UPDATE",
            allHistory: allHistory,
          },
          () => {
            // Ignore errors (tab might be closed or not loaded yet)
            if (chrome.runtime.lastError) {
            }
          },
        );
      } catch (e) {}
    });
  });
}

/**
 * Batches storage writes to reduce disk I/O when many tabs are open.
 */
function throttledSaveHistory() {
  const now = Date.now();

  // If we haven't written in 5 seconds, do it now
  if (now - lastStorageWriteTime > 5000) {
    if (pendingSaveTimeout) {
      clearTimeout(pendingSaveTimeout);
      pendingSaveTimeout = null;
    }
    saveHistoryNow();
  } else if (!pendingSaveTimeout) {
    // Schedule a save if one isn't already pending
    pendingSaveTimeout = setTimeout(
      () => {
        pendingSaveTimeout = null;
        saveHistoryNow();
      },
      5000 - (now - lastStorageWriteTime),
    );
  }
}

function saveHistoryNow() {
  lastStorageWriteTime = Date.now();
  storage.local.set({ ytt_history: allHistory });
  
  // Periodic failsafe sync (e.g., every 5 mins of activity)
  // We construct a backup-like object but specifically for "live" recovery
  const liveBackup = {
      allHistory,
      shortsBlockerSettings,
      breakSettings,
      backupSettings,
      retentionSettings,
      dislikeCountSettings,
      opacitySettings,
      smartFullscreenSettings,
      keybindSettings
  };
  broadcastFailsafeSync(liveBackup);
}

function handleSettingsUpdate(data) {
  if (data.type === "shorts") {
    shortsBlockerSettings = data.settings;
    storage.local.set({ ytt_shorts_settings: shortsBlockerSettings });
  } else if (data.type === "break") {
    breakSettings = data.settings;
    storage.local.set({ ytt_break_settings: breakSettings });
  } else if (data.type === "dislike") {
    dislikeCountSettings = data.settings;
    storage.local.set({ ytt_dislike_settings: dislikeCountSettings });
  } else if (data.type === "backup") {
    backupSettings = data.settings;
    storage.local.set({ ytt_backup_settings: backupSettings });
    scheduleAlarms();
  } else if (data.type === "retention") {
    retentionSettings = data.settings;
    storage.local.set({ ytt_retention_settings: retentionSettings });
    // Trigger immediate cleanup when setting changes
    allHistory = cleanupOldHistory(allHistory, retentionSettings.duration);
    storage.local.set({ ytt_history: allHistory });
  } else if (data.type === "opacity") {
    opacitySettings = data.settings;
    storage.local.set({ ytt_opacity_settings: opacitySettings });
  }
}

async function fetchZenQuote() {
  try {
    const resp = await fetch(
      `https://zenquotes.io/api/random?t=${Date.now()}`,
      {
        cache: "no-cache",
      },
    );
    const data = await resp.json();
    if (data && data[0]) {
      return { text: data[0].q, author: data[0].a };
    }
  } catch (e) {
    console.error("Background fetch failed:", e);
  }
  const fallbacks = [
    {
      text: "The secret of getting ahead is getting started.",
      author: "Mark Twain",
    },
    {
      text: "It does not matter how slowly you go as long as you do not stop.",
      author: "Confucius",
    },
    {
      text: "Everything you've ever wanted is on the other side of fear.",
      author: "George Addair",
    },
    {
      text: "Hardships often prepare ordinary people for an extraordinary destiny.",
      author: "C.S. Lewis",
    },
    {
      text: "Believe you can and you're halfway there.",
      author: "Theodore Roosevelt",
    },
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

async function fetchDislikeFromAPI(videoId) {
  console.log(`BG: Fetching dislike count for ${videoId}`);
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`,
      );
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      // Retry on server errors (5xx), give up on client errors (4xx)
      if (response.status >= 500 && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
        console.warn(
          `BG: API returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      console.warn(`BG: API error: ${response.status} for ${videoId}`);
      return null;
    } catch (e) {
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 500;
        console.warn(
          `BG: Fetch failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`,
          e.message,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      console.warn("BG: Dislike fetch failed after retries:", e.message);
      return null;
    }
  }
  return null;
}

// === Backup Logic ===

async function createBackup() {
  // Just-In-Time fetch from storage to avoid race conditions with recent UI changes
  const storageData = await new Promise((resolve) => {
    storage.local.get(
      [
        "ytt_shorts_settings",
        "ytt_break_settings",
        "ytt_backup_settings",
        "ytt_retention_settings",
        "ytt_dislike_settings",
        "ytt_opacity_settings",
        "ytt_smart_fullscreen_settings",
        "ytt_keybind_settings",
      ],
      (res) => resolve(res),
    );
  });

  const data = {
    allHistory, // Background is the source of truth for current session history
    shortsBlockerSettings:
      storageData.ytt_shorts_settings || shortsBlockerSettings,
    breakSettings: storageData.ytt_break_settings || breakSettings,
    backupSettings: storageData.ytt_backup_settings || backupSettings,
    retentionSettings: storageData.ytt_retention_settings || retentionSettings,
    dislikeCountSettings:
      storageData.ytt_dislike_settings || dislikeCountSettings,
    opacitySettings: storageData.ytt_opacity_settings || opacitySettings,
    smartFullscreenSettings:
      storageData.ytt_smart_fullscreen_settings || smartFullscreenSettings,
    keybindSettings: storageData.ytt_keybind_settings || keybindSettings,
  };
  try {
    await self.yttDB.addBackup(data);
    console.log("Background: Backup created successfully.");

    // Trigger failsafe sync to YouTube tabs (survives extension removal)
    broadcastFailsafeSync(data);

    // Purge old backups based on settings
    if (backupSettings.maxBackups) {
      await self.yttDB.purgeOldBackups(backupSettings.maxBackups);
    }

    // Broadcast to all tabs that a new backup was created (so they can refresh list instantly)
    broadcastBackupCreated();

    return data;
  } catch (e) {
    console.error("Background: Backup failed:", e);
    return null;
  }
}

function broadcastBackupCreated() {
  tabs.query({ url: "*://*.youtube.com/*" }, (allTabs) => {
    allTabs.forEach((tab) => {
      if (!tab.url || !tab.url.includes("youtube.com")) return;
      try {
        chrome.tabs.sendMessage(tab.id, { action: "BACKUP_CREATED" }, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
        });
      } catch (e) {}
    });
  });
}

async function handleImportBackup(data) {
  if (!data) throw new Error("No data provided for import");

  try {
    // Update memory state - Ensure every setting is updated or reset to default
    allHistory = data.allHistory || data.ytt_history || {};
    shortsBlockerSettings = data.shortsBlockerSettings ||
      data.ytt_shorts_settings || { enabled: true };
    breakSettings = data.breakSettings ||
      data.ytt_break_settings || {
        enabled: true,
        intervalMinutes: 15,
        workUrl: "https://www.google.com",
      };
    backupSettings = data.backupSettings ||
      data.ytt_backup_settings || {
        enabled: true,
        intervalHours: 24,
        backupOnClose: true,
        maxBackups: 10,
        reminderEnabled: true,
        reminderInterval: 24,
        reminderUnit: "hours",
      };
    retentionSettings = data.retentionSettings ||
      data.ytt_retention_settings || { duration: 7 };
    dislikeCountSettings = data.dislikeCountSettings ||
      data.ytt_dislike_settings || { enabled: true };
    opacitySettings = data.opacitySettings ||
      data.ytt_opacity_settings || { enabled: false, value: 0.5 };
    smartFullscreenSettings = data.smartFullscreenSettings ||
      data.ytt_smart_fullscreen_settings || { enabled: true };
    keybindSettings = data.keybindSettings ||
      data.ytt_keybind_settings || keybindSettings;

    // Save to storage
    const saveObj = {
      ytt_history: allHistory,
      ytt_shorts_settings: shortsBlockerSettings,
      ytt_break_settings: breakSettings,
      ytt_backup_settings: backupSettings,
      ytt_retention_settings: retentionSettings,
      ytt_dislike_settings: dislikeCountSettings,
      ytt_opacity_settings: opacitySettings,
      ytt_smart_fullscreen_settings: smartFullscreenSettings,
      ytt_keybind_settings: keybindSettings,
    };

    await new Promise((resolve, reject) => {
      storage.local.set(saveObj, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });

    // Refresh alarms
    scheduleAlarms();

    // Create an automatic backup of the newly imported state for safety
    await createBackup();

    return {
      success: true,
      settings: {
        ytt_shorts_settings: shortsBlockerSettings,
        ytt_break_settings: breakSettings,
        ytt_backup_settings: backupSettings,
        ytt_retention_settings: retentionSettings,
        ytt_dislike_settings: dislikeCountSettings,
        ytt_opacity_settings: opacitySettings,
        ytt_smart_fullscreen_settings: smartFullscreenSettings,
        ytt_keybind_settings: keybindSettings,
      },
    };
  } catch (err) {
    console.error("YTT: Import backup failed:", err);
    throw err;
  }
}

function scheduleAlarms() {
  // 1. Periodic Storage Backup
  chrome.alarms.clear("ytt_periodic_backup", () => {
    if (backupSettings.enabled) {
      let intervalMinutes = 24 * 60; // Default
      const val = backupSettings.intervalValue || 1;
      const unit = backupSettings.intervalUnit || "hours";
      
      if (unit === "weeks") intervalMinutes = val * 7 * 24 * 60;
      else if (unit === "days") intervalMinutes = val * 24 * 60;
      else if (unit === "hours") intervalMinutes = val * 60;
      else if (unit === "minutes") intervalMinutes = val;

      console.log(`YTT: Attempting to schedule backup. Val: ${val}, Unit: ${unit}, Result: ${intervalMinutes} min`);

      if (intervalMinutes > 0) {
        chrome.alarms.create("ytt_periodic_backup", {
          periodInMinutes: Math.max(1, intervalMinutes),
        });
        console.log(`YTT: Backup alarm created for every ${intervalMinutes} minutes.`);
      }
    } else {
      console.log("YTT: Automatic backups are disabled.");
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ytt_periodic_backup") {
    createBackup();
  }
});

function broadcastBackupReminder() {
  console.log("YTT: Broadcasting backup reminder to YouTube tabs...");
  tabs.query({ url: "*://*.youtube.com/*" }, (allTabs) => {
    console.log(`YTT: Found ${allTabs.length} YouTube tabs.`);
    allTabs.forEach((tab) => {
      if (!tab.url || !tab.url.includes("youtube.com")) return;
      try {
        chrome.tabs.sendMessage(tab.id, { action: "SHOW_BACKUP_REMINDER" }, (resp) => {
             if (chrome.runtime.lastError) {
                console.warn(`YTT: Failed to send reminder to tab ${tab.id}:`, chrome.runtime.lastError.message);
             } else {
                console.log(`YTT: Sent reminder to tab ${tab.id}.`);
             }
        });
      } catch (e) {
          console.error(`YTT: Error sending reminder to tab ${tab.id}:`, e);
      }
    });
  });
}

/**
 * Broadcasts the latest backup to all YouTube tabs to be stored in localStorage.
 * This is our "Failsafe" strategy to persist data even if the extension is uninstalled.
 */
function broadcastFailsafeSync(data) {
  tabs.query({ url: "*://*.youtube.com/*" }, (allTabs) => {
    allTabs.forEach((tab) => {
      if (!tab.url || !tab.url.includes("youtube.com")) return;
      try {
        chrome.tabs.sendMessage(
          tab.id,
          {
            action: "SYNC_FAILSAFE",
            data: data,
          },
          () => {
            if (chrome.runtime.lastError) {
              // Ignore - tab might be in a state where it can't receive messages
            }
          },
        );
      } catch (e) {}
    });
  });
}

// Track YouTube tabs for "on close" backup
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes("youtube.com")) {
    youtubeTabs.add(tabId);
  } else {
    youtubeTabs.delete(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (youtubeTabs.has(tabId)) {
    youtubeTabs.delete(tabId);
    // If no more YouTube tabs are open, trigger backup
    if (youtubeTabs.size === 0 && backupSettings.backupOnClose) {
      createBackup();
    }
  }
});
// === Command Shortcuts Handler ===
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-pip") {
    // Find the relevant YouTube tab to toggle
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, (allTabs) => {
      if (allTabs.length === 0) return;

      // PRIORITY 1: Tab that is currently audible (browser-level check)
      const audibleTab = allTabs.find((t) => t.audible);
      if (audibleTab) {
        chrome.tabs.sendMessage(audibleTab.id, { action: "TOGGLE_PIP" });
        return;
      }

      // PRIORITY 2: Tab that most recently reported watching activity
      const playingTabIds = Object.keys(activePlayingTabs).map(Number);
      if (playingTabIds.length > 0) {
        const targetTabId = playingTabIds.sort(
          (a, b) => activePlayingTabs[b].time - activePlayingTabs[a].time,
        )[0];
        if (targetTabId) {
          chrome.tabs.sendMessage(targetTabId, { action: "TOGGLE_PIP" });
          return;
        }
      }

      // PRIORITY 3: Active YouTube tab
      const activeTab = allTabs.find((t) => t.active);
      if (activeTab) {
        chrome.tabs.sendMessage(activeTab.id, { action: "TOGGLE_PIP" });
        return;
      }

      // PRIORITY 4: First YouTube tab found
      chrome.tabs.sendMessage(allTabs[0].id, { action: "TOGGLE_PIP" });
    });
  }
});
