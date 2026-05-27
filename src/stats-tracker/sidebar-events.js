// === Sidebar Event Bindings: Filters, navigation, settings, open/close ===

/**
 * Global view switcher accessible from all modules
 */
let viewHistory = ["history"]; // Navigation stack
let selectedChannelForVideos = null; // Currently viewed channel's videos
let isFilterCollapsed = true; // Track requested manual state of the date picker/filters slider

/**
 * Synchronizes all UI controls (toggles, inputs, dropdowns) with the current
 * in-memory global state variables. Used for instant updates after backup restores.
 */
function syncSettingsUI() {
  // 0. Syncing based on current selectedDayFilter (no forced reset to 'today' here)

  // 1. Toggles
  const shortsToggle = document.getElementById("shorts-blocker-toggle");
  if (shortsToggle) shortsToggle.checked = shortsBlockerSettings.enabled;

  const dislikeToggle = document.getElementById("dislike-count-toggle");
  if (dislikeToggle) dislikeToggle.checked = dislikeCountSettings.enabled;

  const breakToggle = document.getElementById("break-enabled-toggle");
  if (breakToggle) breakToggle.checked = breakSettings.enabled;

  const backupEnabledToggle = document.getElementById("backup-enabled-toggle");
  if (backupEnabledToggle) backupEnabledToggle.checked = backupSettings.enabled;

  const backupOnCloseToggle = document.getElementById("backup-on-close-toggle");
  if (backupOnCloseToggle)
    backupOnCloseToggle.checked = backupSettings.backupOnClose;

  const backupReminderToggle = document.getElementById("backup-reminder-toggle");
  if (backupReminderToggle)
    backupReminderToggle.checked = backupSettings.reminderEnabled;

  const reminderContainer = document.getElementById("reminder-interval-container");
  if (reminderContainer)
    reminderContainer.style.display = backupSettings.reminderEnabled ? "flex" : "none";

  const smartFullscreenToggle = document.getElementById("smart-fullscreen-toggle");
  if (smartFullscreenToggle)
    smartFullscreenToggle.checked = smartFullscreenSettings.enabled;

  const opacityToggle = document.getElementById("opacity-enabled-toggle");
  if (opacityToggle) opacityToggle.checked = opacitySettings.enabled;

  const opacitySlider = document.getElementById("opacity-value-slider");
  if (opacitySlider) {
    opacitySlider.value = opacitySettings.value;
    updateSliderProgress(opacitySlider);
  }

  const opacityLabel = document.getElementById("opacity-percentage-label");
  if (opacityLabel) opacityLabel.textContent = Math.round(opacitySettings.value * 100) + "%";

  const opacitySliderContainer = document.getElementById("opacity-slider-container");
  if (opacitySliderContainer) opacitySliderContainer.style.display = opacitySettings.enabled ? "flex" : "none";

  // 2. Numeric & Text Inputs
  const intervalValue = document.getElementById("interval-value");
  if (intervalValue && document.activeElement !== intervalValue) {
    intervalValue.value = breakSettings.intervalValue;
  }

  const workUrlInput = document.getElementById("setting-work-url");
  if (workUrlInput && document.activeElement !== workUrlInput) {
    workUrlInput.value = breakSettings.workUrl;
  }

  const maxBackupsValue = document.getElementById("max-backups-value");
  if (maxBackupsValue && document.activeElement !== maxBackupsValue) {
    maxBackupsValue.value = backupSettings.maxBackups || 10;
  }

  const reminderValueInput = document.getElementById("reminder-interval-value");
  if (reminderValueInput && document.activeElement !== reminderValueInput) {
    if (backupSettings.reminderInterval !== undefined) {
      reminderValueInput.value = backupSettings.reminderInterval;
    }
  }

  const backupIntervalValue = document.getElementById("backup-interval-value");
  if (backupIntervalValue && document.activeElement !== backupIntervalValue) {
    backupIntervalValue.value = backupSettings.intervalValue || 24;
  }

  // 3. Custom Dropdowns
  const syncDropdown = (id, value, map) => {
    const dropdown = document.getElementById(id);
    if (!dropdown) return;
    dropdown.dataset.value = value;
    const triggerSpan = dropdown.querySelector(".dropdown-trigger span");
    if (triggerSpan) {
      const defaultLabels = {
        minutes: "min",
        seconds: "sec",
        hours: "hr",
      };
      triggerSpan.textContent = (map && map[value]) || defaultLabels[value] || value;
    }

    const items = dropdown.querySelectorAll(".dropdown-item");
    items.forEach((item) => {
      item.classList.toggle(
        "active",
        String(item.dataset.value) === String(value),
      );
    });
  };

  syncDropdown("backup-interval-unit-dropdown", backupSettings.intervalUnit || "hours", {
    weeks: "wks",
    days: "days",
    hours: "hr",
    minutes: "min",
  });

  syncDropdown("reminder-interval-unit-dropdown", backupSettings.reminderUnit, {
    weeks: "wks",
    days: "days",
    hours: "hr",
    minutes: "min",
    seconds: "sec",
  });

  syncDropdown("retention-duration-dropdown", retentionSettings.duration, {
    7: "7 Days",
    15: "15 Days",
    30: "30 Days",
    90: "3 Months",
    180: "6 Months",
    365: "1 Year",
    "-1": "Unlimited",
  });

  syncDropdown("history-period-dropdown", selectedDayFilter, {});

  syncDropdown("interval-unit-dropdown", breakSettings.intervalUnit, {
    minutes: "min",
    seconds: "sec",
    hours: "hr",
  });

  if (typeof initializeDropdowns === "function") initializeDropdowns();
  if (typeof syncHistoryPresets === "function") syncHistoryPresets();
  if (typeof updateDateLabel === "function") updateDateLabel();
}

// Global message listener for live UI updates
runtime.onMessage.addListener((request) => {
  if (request.action === "BACKUP_CREATED") {
    // Only refresh if we are currently looking at the backup view
    if (activeView === "backup") {
      renderBackups();
    }
  }
});

/**
 * Formats a date or preset label for the UI (e.g., "Apr 7, 2026", "Today", or "Last 30 Days").
 */
const formatDateLabel = (value) => {
  const map = {
    today: "Today",
    yesterday: "Yesterday",
    "7days": "Last 7 Days",
    "15days": "Last 15 Days",
    "30days": "Last 30 Days",
    "90days": "Last 3 Months",
    "180days": "Last 6 Months",
    "365days": "Last Year",
    all: "All Time",
  };

  if (map[value]) return map[value];

  // Check if it's a specific date YYYY-MM-DD
  const parts = String(value).split("-").map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (String(value).endsWith("days")) {
    return `Last ${parseInt(value, 10)} Days`;
  }

  return value;
};

/**
 * Updates the current date label in the history view and synchronizes the period dropdown.
 */
const updateDateLabel = () => {
  const formatted = formatDateLabel(selectedDayFilter);

  // 1. Update side navigation label
  const sideLabel = document.querySelector(".current-date-label");
  if (sideLabel) sideLabel.textContent = formatted;

  // 2. Update period dropdown trigger text
  const histDropdown = document.getElementById("history-period-dropdown");
  if (histDropdown) {
    histDropdown.dataset.value = selectedDayFilter;
    const triggerSpan = histDropdown.querySelector(".dropdown-trigger span");
    if (triggerSpan) {
      // Mapping for dropdown specific labels (e.g. "All History" instead of "All Time")
      const dropdownLabels = { all: "All History" };
      triggerSpan.textContent = dropdownLabels[selectedDayFilter] || formatted;
    }

    // Update active class on items
    const items = histDropdown.querySelectorAll(".dropdown-item");
    items.forEach((item) => {
      item.classList.toggle(
        "active",
        String(item.dataset.value) === String(selectedDayFilter),
      );
    });
  }
};

/**
 * Syncs the history period dropdown items with data retention settings.
 */
const syncHistoryPresets = () => {
  const dropdown = document.getElementById("history-period-dropdown");
  if (!dropdown) return;

  const duration = retentionSettings.duration;
  const items = dropdown.querySelectorAll(".dropdown-item");

  items.forEach((item) => {
    const val = item.dataset.value;
    if (val === "today" || val === "yesterday" || val === "all") {
      item.style.display = "block";
      return;
    }

    const days = parseInt(val, 10);
    if (duration === -1 || days <= duration) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });

  // Update Special chip label
  const specialItem = dropdown.querySelector(".dropdown-item.special");
  if (specialItem) {
    specialItem.textContent =
      duration === -1 ? "Unlimited History" : duration + " Days History";
  }
};

function switchView(viewName) {
  if (viewName !== activeView) {
    viewHistory.push(viewName);
    // Keep stack manageable
    if (viewHistory.length > 20) viewHistory.shift();
  }
  _switchViewInternal(viewName);
}

function _switchViewInternal(viewName) {
  activeView = viewName;
  const hView = document.getElementById("history-view");
  const aView = document.getElementById("analytics-view");
  const sView = document.getElementById("settings-view");
  const hFilters = document.getElementById("stats-header-filters");

  if (hView) hView.style.display = viewName === "history" ? "block" : "none";
  if (aView) aView.style.display = viewName === "analytics" ? "block" : "none";
  if (sView) sView.style.display = viewName === "settings" ? "block" : "none";
  if (hFilters) hFilters.style.display = "block";

  const toggleStrip = document.getElementById("history-filter-toggle");
  if (toggleStrip) toggleStrip.style.display = "flex";

  const bView = document.getElementById("backup-view");
  if (bView) bView.style.display = viewName === "backup" ? "block" : "none";

  const cdView = document.getElementById("channel-distribution-view");
  if (cdView)
    cdView.style.display =
      viewName === "channel-distribution" ? "block" : "none";

  const cvView = document.getElementById("channel-videos-view");
  if (cvView)
    cvView.style.display = viewName === "channel-videos" ? "block" : "none";

  const kbView = document.getElementById("keybinds-view");
  const historyContent = document.getElementById("history-header-content");

  if (kbView) {
    kbView.style.display = viewName === "keybinds" ? "block" : "none";
    if (viewName === "keybinds" || viewName === "history" || viewName === "analytics") {
      if (viewName === "keybinds" && typeof renderKeybinds === "function") renderKeybinds();
      if (historyContent) historyContent.style.display = "flex";
      if (hFilters) {
        hFilters.style.display = "block";
        hFilters.classList.toggle("collapsed", isFilterCollapsed);
        const tBtn = document.getElementById("toggle-filter-btn");
        if (tBtn) {
          tBtn.classList.toggle("expanded", !isFilterCollapsed);
          tBtn.innerHTML = isFilterCollapsed ? icons.chevron_down : icons.chevron_up;
        }
      }
    } else {
      if (hFilters) hFilters.classList.add("collapsed");
    }
  }

  const cPopover = document.getElementById("calendar-popover");
  if (cPopover) cPopover.style.display = "none";

  // Update universal view title bar
  const viewTitleMap = {
    history: "Watch History",
    analytics: "Analytics",
    "channel-distribution": "Channel Distribution",
    "channel-videos": "Channel Activity",
    backup: "Backup & Restore",
    settings: "Settings",
    keybinds: "Keybinds"
  };
  const titleText = document.getElementById("view-title-text");
  const backBtn = document.getElementById("view-back-btn");
  if (titleText) titleText.textContent = viewTitleMap[viewName] || viewName;
  if (backBtn) {
    // Always show back button per user request
    backBtn.style.display = "flex";

    // Update opacity to indicate if there's history to walk back into
    backBtn.style.opacity = viewHistory.length > 1 ? "1" : "0.5";

    backBtn.onclick = (e) => {
      e.stopPropagation();
      // Pop the current view off the stack
      if (viewHistory.length > 1) {
        viewHistory.pop(); // remove current
        const prev = viewHistory[viewHistory.length - 1];
        _switchViewInternal(prev);
      } else {
        // If on root, ensure we stay on history or perform a subtle UI feedback
        // Providing a consistent "Back" experience as requested
        _switchViewInternal("history");
      }
    };
  }

  // Update Button Active States
  ["nav-history", "nav-analytics", "nav-backup", "nav-settings"].forEach(
    (id) => {
      const navBtn = document.getElementById(id);
      if (navBtn) navBtn.classList.toggle("active", id === `nav-${viewName}`);
    },
  );

  if (typeof renderStats === "function") renderStats();
}

function bindSidebarEvents(sidebar, btn, dragStatus) {
  // Date Navigator & Calendar Logic
  let calendarDate = new Date(); // Month/Year currently shown in the calendar popover

  // Handled by top-level updateDateLabel()

  const renderCalendar = () => {
    const container = document.getElementById("calendar-popover");
    if (!container) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const monthName = new Date(year, month).toLocaleString(undefined, {
      month: "long",
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = getDayKey(new Date());
    const selectedStr =
      selectedDayFilter === "today"
        ? todayStr
        : selectedDayFilter === "yesterday"
          ? getDayKey(new Date(Date.now() - 86400000))
          : selectedDayFilter;

    let html = `
      <div class="calendar-header">
        <div class="calendar-month-year">${monthName} ${year}</div>
        <div class="calendar-nav">
          <button id="cal-prev" class="nav-arrow-btn">${icons.prev}</button>
          <button id="cal-next" class="nav-arrow-btn">${icons.next}</button>
        </div>
      </div>
      <div class="calendar-grid">
        <div class="calendar-day-label">Su</div>
        <div class="calendar-day-label">Mo</div>
        <div class="calendar-day-label">Tu</div>
        <div class="calendar-day-label">We</div>
        <div class="calendar-day-label">Th</div>
        <div class="calendar-day-label">Fr</div>
        <div class="calendar-day-label">Sa</div>
    `;

    // Empty slots before first day
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="calendar-day empty"></div>';
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        d,
      ).padStart(2, "0")}`;
      const isToday = dateKey === todayStr;
      const isSelected = dateKey === selectedStr;

      html += `
        <div class="calendar-day ${isToday ? "today" : ""} ${
          isSelected ? "selected" : ""
        }" data-date="${dateKey}">
          ${d}
        </div>
      `;
    }

    html += "</div>";
    container.innerHTML = html;

    // Calendar Handlers
    container.querySelector("#cal-prev").onclick = (e) => {
      e.stopPropagation();
      calendarDate.setMonth(calendarDate.getMonth() - 1);
      renderCalendar();
    };
    container.querySelector("#cal-next").onclick = (e) => {
      e.stopPropagation();
      calendarDate.setMonth(calendarDate.getMonth() + 1);
      renderCalendar();
    };
    container.querySelectorAll(".calendar-day:not(.empty)").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        selectedDayFilter =
          el.dataset.date === todayStr ? "today" : el.dataset.date;
        container.style.display = "none";
        updateDateLabel();
        renderStats();
      };
    });
  };

  const trigger = document.getElementById("calendar-trigger");
  const popover = document.getElementById("calendar-popover");
  if (trigger && popover) {
    trigger.onclick = (e) => {
      e.stopPropagation();
      const isVisible = popover.style.display === "block";
      popover.style.display = isVisible ? "none" : "block";
      if (!isVisible) renderCalendar();
    };
  }

  const prevBtn = document.getElementById("date-prev");
  const nextBtn = document.getElementById("date-next");

  const shiftDate = (offset) => {
    let current;
    if (selectedDayFilter === "today") {
      current = new Date();
    } else if (selectedDayFilter === "yesterday") {
      current = new Date(Date.now() - 86400000);
    } else if (
      selectedDayFilter === "all" ||
      selectedDayFilter.endsWith("days")
    ) {
      current = new Date();
    } else {
      const parts = selectedDayFilter.split("-").map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        current = new Date(parts[0], parts[1] - 1, parts[2]);
      } else {
        current = new Date();
      }
    }
    current.setDate(current.getDate() + offset);

    const newKey = getDayKey(current);
    selectedDayFilter = newKey === getDayKey(new Date()) ? "today" : newKey;
    updateDateLabel();
    renderStats();
  };

  if (prevBtn)
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      shiftDate(-1);
    };
  if (nextBtn)
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      shiftDate(1);
    };

  // History Period Dropdown Logic
  const histDropdown = document.getElementById("history-period-dropdown");
  if (histDropdown) {
    histDropdown.addEventListener("change", (e) => {
      selectedDayFilter = e.detail.value;
      updateDateLabel();
      renderStats();
    });
  }

  // Initial syncs
  syncHistoryPresets();
  updateDateLabel();

  // View Navigation Logic

  const attachNav = (id, view) => {
    const el = document.getElementById(id);
    if (el)
      el.onclick = (e) => {
        e.stopPropagation();
        switchView(view);
      };
  };

  attachNav("nav-history", "history");
  attachNav("nav-analytics", "analytics");
  attachNav("nav-settings", "settings");

  const navKeybinds = document.getElementById("nav-keybinds");
  if (navKeybinds) {
    navKeybinds.onclick = (e) => {
      e.stopPropagation();
      switchView("keybinds");
    };
  }

  const resetKeybindsBtn = document.getElementById("reset-keybinds");
  if (resetKeybindsBtn) {
    resetKeybindsBtn.onclick = (e) => {
      e.stopPropagation();
      showConfirmModal({
        title: "Reset Shortcuts?",
        message: "Are you sure you want to restore all keyboard shortcuts to their default settings?",
        confirmText: "Reset",
        cancelText: "Cancel",
        icon: "⌨️",
        onConfirm: () => {
          keybindSettings = {
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
            manualBackup: "Alt+U"
          };
          if (typeof safeStorageSet === "function") {
            safeStorageSet({ ytt_keybind_settings: keybindSettings });
          }
          if (typeof renderKeybinds === "function") renderKeybinds();
        }
      });
    };
  }

  const navBackup = document.getElementById("nav-backup");
  if (navBackup) {
    navBackup.onclick = (e) => {
      e.stopPropagation();
      switchView("backup");
      renderBackups();
    };
  }

  const backToSettings = document.getElementById("back-to-settings");
  if (backToSettings) {
    backToSettings.onclick = (e) => {
      e.stopPropagation();
      switchView("settings");
    };
  }

  const navToChannels = document.getElementById("nav-to-channels");
  if (navToChannels) {
    navToChannels.onclick = (e) => {
      e.stopPropagation();
      switchView("channel-distribution");
    };
  }

  // Remove the old nav-backup-view button listener (no longer in HTML)

  // Settings Controls
  const shortsToggle = document.getElementById("shorts-blocker-toggle");
  if (shortsToggle) {
    shortsToggle.onchange = (e) => {
      e.stopPropagation();
      shortsBlockerSettings.enabled = shortsToggle.checked;
      saveShortsBlockerSettings();
      applyShortsBlockerState();
    };
  }

  const dislikeToggle = document.getElementById("dislike-count-toggle");
  if (dislikeToggle) {
    dislikeToggle.onchange = (e) => {
      e.stopPropagation();
      console.log("YTT: Dislike toggled:", dislikeToggle.checked);
      dislikeCountSettings.enabled = dislikeToggle.checked;
      saveDislikeCountSettings();
      // Apply state immediately, force-fetching if enabled
      applyDislikeCountState();
    };
  }

  const breakToggle = document.getElementById("break-enabled-toggle");
  if (breakToggle) {
    breakToggle.onchange = (e) => {
      e.stopPropagation();
      breakSettings.enabled = breakToggle.checked;
      saveBreakSettings();
      if (!breakSettings.enabled) {
        continuousWatchStart = null;
        breakModalShown = false;
      }
    };
  }

  const workUrlInput = document.getElementById("setting-work-url");
  if (workUrlInput) {
    const updateWorkUrl = () => {
      let url = workUrlInput.value.trim();
      if (url && !url.startsWith("http")) url = "https://" + url;
      breakSettings.workUrl = url || "https://www.google.com";
      saveBreakSettings();
    };
    workUrlInput.onchange = updateWorkUrl;
    workUrlInput.oninput = updateWorkUrl;
  }

  const intervalMinus = document.getElementById("interval-minus");
  const intervalPlus = document.getElementById("interval-plus");
  const intervalValue = document.getElementById("interval-value");

  if (intervalMinus) {
    intervalMinus.onclick = (e) => {
      e.stopPropagation();
      breakSettings.intervalValue = Math.max(1, breakSettings.intervalValue - 1);
      if (intervalValue) intervalValue.value = breakSettings.intervalValue;
      saveBreakSettings();
    };
  }
  if (intervalPlus) {
    intervalPlus.onclick = (e) => {
      e.stopPropagation();
      breakSettings.intervalValue = Math.min(1440, (breakSettings.intervalValue || 15) + 1);
      if (intervalValue) intervalValue.value = breakSettings.intervalValue;
      saveBreakSettings();
    };
  }
  if (intervalValue) {
    const updateInterval = () => {
      let val = parseInt(intervalValue.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 1440) val = 1440;
      breakSettings.intervalValue = val;
      saveBreakSettings();
    };
    intervalValue.onchange = () => {
      // Force constraints on blur
      let val = parseInt(intervalValue.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 1440) val = 1440;
      intervalValue.value = val;
      updateInterval();
    };
    intervalValue.oninput = updateInterval;
  }

  const unitDropdown = document.getElementById("interval-unit-dropdown");
  if (unitDropdown) {
    unitDropdown.addEventListener("change", (e) => {
      breakSettings.intervalUnit = e.detail.value;
      saveBreakSettings();
    });
  }

  const sfToggle = document.getElementById("smart-fullscreen-toggle");
  if (sfToggle) {
    sfToggle.onchange = (e) => {
      e.stopPropagation();
      smartFullscreenSettings.enabled = sfToggle.checked;
      saveSmartFullscreenSettings();
    };
  }

  const opacityToggle = document.getElementById("opacity-enabled-toggle");
  const opacitySlider = document.getElementById("opacity-value-slider");
  const opacityLabel = document.getElementById("opacity-percentage-label");
  const opacitySliderContainer = document.getElementById("opacity-slider-container");

  if (opacityToggle) {
    opacityToggle.onchange = (e) => {
      e.stopPropagation();
      opacitySettings.enabled = opacityToggle.checked;
      if (opacitySliderContainer) {
        opacitySliderContainer.style.display = opacityToggle.checked ? "flex" : "none";
      }
      saveOpacitySettings();
      applyOpacityState();
    };
  }

  if (opacitySlider) {
    // Initial color sync
    updateSliderProgress(opacitySlider);

    opacitySlider.oninput = (e) => {
      e.stopPropagation();
      const val = parseFloat(opacitySlider.value);
      opacitySettings.value = val;
      if (opacityLabel) {
        opacityLabel.textContent = Math.round(val * 100) + "%";
      }
      updateSliderProgress(opacitySlider);
      saveOpacitySettings();
      applyOpacityState();
    };

    opacitySlider.onkeydown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.stopPropagation();
        e.preventDefault();
        const step = 0.01;
        const current = parseFloat(opacitySlider.value);
        if (e.key === "ArrowRight") {
          opacitySlider.value = Math.min(1, current + step);
        } else {
          opacitySlider.value = Math.max(0, current - step);
        }
        // Trigger input event to update UI and state
        opacitySlider.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
  }

  // Backup Settings
  const backupEnabledToggle = document.getElementById("backup-enabled-toggle");
  if (backupEnabledToggle) {
    backupEnabledToggle.onchange = (e) => {
      e.stopPropagation();
      backupSettings.enabled = backupEnabledToggle.checked;
      saveBackupSettings();
    };
  }

  const backupOnCloseToggle = document.getElementById("backup-on-close-toggle");
  if (backupOnCloseToggle) {
    backupOnCloseToggle.onchange = (e) => {
      e.stopPropagation();
      backupSettings.backupOnClose = backupOnCloseToggle.checked;
      saveBackupSettings();
    };
  }

  const backupReminderToggle = document.getElementById("backup-reminder-toggle");
  const reminderIntervalContainer = document.getElementById("reminder-interval-container");
  if (backupReminderToggle) {
    backupReminderToggle.onchange = (e) => {
      e.stopPropagation();
      backupSettings.reminderEnabled = backupReminderToggle.checked;
      if (reminderIntervalContainer) {
        reminderIntervalContainer.style.display = backupReminderToggle.checked ? "flex" : "none";
      }
      saveBackupSettings();
    };
  }

  const backupMinus = document.getElementById("backup-interval-minus");
  const backupPlus = document.getElementById("backup-interval-plus");
  const backupValue = document.getElementById("backup-interval-value");

  if (backupMinus) {
    backupMinus.onclick = (e) => {
      e.stopPropagation();
      backupSettings.intervalValue = Math.max(1, (backupSettings.intervalValue || 1) - 1);
      if (backupValue) backupValue.value = backupSettings.intervalValue;
      saveBackupSettings();
    };
  }
  if (backupPlus) {
    backupPlus.onclick = (e) => {
      e.stopPropagation();
      backupSettings.intervalValue = (backupSettings.intervalValue || 1) + 1;
      if (backupValue) backupValue.value = backupSettings.intervalValue;
      saveBackupSettings();
    };
  }
  if (backupValue) {
    const updateBackupInterval = () => {
      let val = parseInt(backupValue.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      backupSettings.intervalValue = val;
      saveBackupSettings();
    };
    backupValue.onchange = updateBackupInterval;
    backupValue.oninput = updateBackupInterval;
  }

  const backupUnitDropdown = document.getElementById("backup-interval-unit-dropdown");
  if (backupUnitDropdown) {
    backupUnitDropdown.addEventListener("change", (e) => {
      backupSettings.intervalUnit = e.detail.value;
      saveBackupSettings();
    });
  }

  const reminderMinus = document.getElementById("reminder-interval-minus");
  const reminderPlus = document.getElementById("reminder-interval-plus");
  const reminderValue = document.getElementById("reminder-interval-value");

  if (reminderMinus) {
    reminderMinus.onclick = (e) => {
      e.stopPropagation();
      backupSettings.reminderInterval = Math.max(
        1,
        (backupSettings.reminderInterval || 1) - 1,
      );
      if (reminderValue) reminderValue.value = backupSettings.reminderInterval;
      saveBackupSettings();
    };
  }
  if (reminderPlus) {
    reminderPlus.onclick = (e) => {
      e.stopPropagation();
      backupSettings.reminderInterval = Math.min(10080, (backupSettings.reminderInterval || 1) + 1);
      if (reminderValue) reminderValue.value = backupSettings.reminderInterval;
      saveBackupSettings();
    };
  }
  if (reminderValue) {
    const updateReminderInterval = () => {
      let val = parseInt(reminderValue.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 10080) val = 10080;
      backupSettings.reminderInterval = val;
      saveBackupSettings();
    };
    reminderValue.onchange = () => {
      let val = parseInt(reminderValue.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 10080) val = 10080;
      reminderValue.value = val;
      updateReminderInterval();
    };
    reminderValue.oninput = updateReminderInterval;
  }

  const reminderUnitDropdown = document.getElementById(
    "reminder-interval-unit-dropdown",
  );
  if (reminderUnitDropdown) {
    reminderUnitDropdown.addEventListener("change", (e) => {
      backupSettings.reminderUnit = e.detail.value;
      saveBackupSettings();
    });
  }

  const testBackupBtn = document.getElementById("test-backup-reminder");
  if (testBackupBtn) {
    testBackupBtn.onclick = (e) => {
      e.stopPropagation();
      safeSendMessage({ action: "TEST_BACKUP_REMINDER" });
    };
  }

  const retentionDropdown = document.getElementById(
    "retention-duration-dropdown",
  );
  if (retentionDropdown) {
    retentionDropdown.addEventListener("change", (e) => {
      retentionSettings.duration = parseInt(e.detail.value, 10);
      saveRetentionSettings();

      if (typeof syncHistoryPresets === "function") {
        syncHistoryPresets();
      }
    });
  }

  const maxBackupsMinus = document.getElementById("max-backups-minus");
  const maxBackupsPlus = document.getElementById("max-backups-plus");
  const maxBackupsValue = document.getElementById("max-backups-value");

  if (maxBackupsMinus) {
    maxBackupsMinus.onclick = (e) => {
      e.stopPropagation();
      backupSettings.maxBackups = Math.max(
        1,
        (backupSettings.maxBackups || 10) - 1,
      );
      if (maxBackupsValue) maxBackupsValue.value = backupSettings.maxBackups;
      saveBackupSettings();
    };
  }
  if (maxBackupsPlus) {
    maxBackupsPlus.onclick = (e) => {
      e.stopPropagation();
      backupSettings.maxBackups = Math.min(
        50,
        (backupSettings.maxBackups || 10) + 1,
      );
      if (maxBackupsValue) maxBackupsValue.value = backupSettings.maxBackups;
      saveBackupSettings();
    };
  }
  if (maxBackupsValue) {
    const updateMaxBackups = () => {
      let val = parseInt(maxBackupsValue.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 50) val = 50;
      backupSettings.maxBackups = val;
      saveBackupSettings();
    };
    maxBackupsValue.onchange = () => {
      // Force constraints on blur
      let val = parseInt(maxBackupsValue.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 50) val = 50;
      maxBackupsValue.value = val;
      updateMaxBackups();
    };
    maxBackupsValue.oninput = updateMaxBackups;
  }

  // Dropdown initialization
  if (typeof initializeDropdowns === "function") initializeDropdowns();

  const createBackupBtn = document.getElementById("create-manual-backup");
  const deleteBtn = document.getElementById("delete-all-backups");
  if (deleteBtn) {
    deleteBtn.onclick = () => {
      showConfirmModal({
        title: "Clear All Backups?",
        message:
          "This will permanently delete all stored snapshots in the local database. This action cannot be undone.",
        confirmText: "Clear All",
        cancelText: "Cancel",
        icon: "🗑️",
        onConfirm: () => {
          safeSendMessage({ action: "DELETE_ALL_BACKUPS" }, (response) => {
            if (response && response.success) {
              renderBackups();
            } else {
              alert(
                "Failed to clear backups: " +
                  (response ? response.error : "Unknown error"),
              );
            }
          });
        },
      });
    };
  }

  // Import JSON Click
  const importBtn = document.getElementById("import-backup-json");
  const fileInput = document.getElementById("backup-file-input");

  if (importBtn && fileInput) {
    importBtn.onclick = (e) => {
      e.stopPropagation();
      fileInput.click();
    };

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target.result);

          // Basic validation
          if (!importedData.allHistory && !importedData.shortsBlockerSettings) {
            throw new Error("Invalid backup file format");
          }

          showConfirmModal({
            title: "Import Backup?",
            message:
              "This will overwrite your current history and settings. Are you sure?",
            confirmText: "Import & Restore",
            cancelText: "Cancel",
            icon: "📥",
            onConfirm: () => {
              importBtn.disabled = true;
              importBtn.textContent = "Importing...";

              safeSendMessage(
                { action: "IMPORT_BACKUP", clientData: importedData },
                (response) => {
                  importBtn.disabled = false;
                  importBtn.textContent = "Import JSON";
                  fileInput.value = ""; // Reset input

                  if (response && response.success) {
                    // Refresh everything instantly without reload
                    // Explicitly update local state variables from response to avoid race conditions
                    if (response.settings) {
                      const s = response.settings;
                      if (s.ytt_shorts_settings)
                        shortsBlockerSettings.enabled =
                          s.ytt_shorts_settings.enabled;
                      if (s.ytt_dislike_settings)
                        dislikeCountSettings.enabled =
                          s.ytt_dislike_settings.enabled;
                      if (s.ytt_break_settings) {
                        breakSettings.enabled = s.ytt_break_settings.enabled;
                        breakSettings.intervalValue =
                          s.ytt_break_settings.intervalValue ??
                          s.ytt_break_settings.intervalMinutes ??
                          15;
                        breakSettings.intervalUnit =
                          s.ytt_break_settings.intervalUnit || "minutes";
                        breakSettings.workUrl = s.ytt_break_settings.workUrl;
                      }
                      if (s.ytt_backup_settings)
                        backupSettings = {
                          ...backupSettings,
                          ...s.ytt_backup_settings,
                        };
                      if (s.ytt_retention_settings)
                        retentionSettings = {
                          ...retentionSettings,
                          ...s.ytt_retention_settings,
                        };
                      if (s.ytt_opacity_settings)
                        opacitySettings = {
                          ...opacitySettings,
                          ...s.ytt_opacity_settings,
                        };
                      if (s.ytt_smart_fullscreen_settings)
                        smartFullscreenSettings = {
                          ...smartFullscreenSettings,
                          ...s.ytt_smart_fullscreen_settings,
                        };
                      if (s.ytt_keybind_settings)
                        keybindSettings = {
                          ...keybindSettings,
                          ...s.ytt_keybind_settings,
                        };

                      // Apply live side-effects
                      if (typeof applyShortsBlockerState === "function")
                        applyShortsBlockerState();
                      if (typeof applyDislikeCountState === "function")
                        applyDislikeCountState();
                      if (typeof applyOpacityState === "function")
                        applyOpacityState();
                      if (typeof applyFloatingPlayerState === "function")
                        applyFloatingPlayerState();
                    }

                    // Give storage.onChanged and DOM a moment to settle for total reliability
                    setTimeout(() => {
                      selectedDayFilter = "today"; // Reset filter specifically for imports
                      syncSettingsUI();
                      switchView("history");
                      renderStats();
                      renderBackups();
                    }, 50);

                    // Show success feedback
                    const originalHtml = importBtn.innerHTML;
                    importBtn.textContent = "Imported!";
                    importBtn.style.color = "#2ecc71";
                    setTimeout(() => {
                      importBtn.innerHTML = originalHtml;
                      importBtn.style.color = "";
                    }, 2000);
                  } else {
                    showAlertModal({
                      title: "Import Failed",
                      message: response
                        ? response.error
                        : "Unknown error occurred during import.",
                      icon: "❌",
                    });
                  }
                },
              );
            },
          });
        } catch (err) {
          showAlertModal({
            title: "Invalid File",
            message:
              "The selected file is not a valid YouTube Time Tracker backup. Please check the JSON format.",
            icon: "⚠️",
          });
          fileInput.value = "";
        }
      };
      reader.readAsText(file);
    };
  }

  if (createBackupBtn) {
    createBackupBtn.onclick = (e) => {
      e.stopPropagation();
      window.triggerManualBackup();
    };
  }

  // Clear Data Action
  const clearDataBtn = document.getElementById("clear-all-data");
  if (clearDataBtn) {
    clearDataBtn.onclick = (e) => {
      e.stopPropagation();

      showConfirmModal({
        title: "Clear All Data?",
        message:
          "Are you sure you want to delete all watch history and reset all settings? This action cannot be undone.",
        confirmText: "Clear All",
        cancelText: "Cancel",
        icon: "🗑️",
        onConfirm: () => {
          clearAllData();

          // Update UI elements immediately
          const intervalVal = document.getElementById("interval-value");
          if (intervalVal) intervalVal.value = breakSettings.intervalValue;

          const sToggle = document.getElementById("shorts-blocker-toggle");
          if (sToggle) sToggle.checked = shortsBlockerSettings.enabled;

          const dToggle = document.getElementById("dislike-count-toggle");
          if (dToggle) dToggle.checked = dislikeCountSettings.enabled;

          const bToggle = document.getElementById("break-enabled-toggle");
          if (bToggle) bToggle.checked = breakSettings.enabled;

          const wUrlInput = document.getElementById("setting-work-url");
          if (wUrlInput) wUrlInput.value = breakSettings.workUrl;

          // Show history view to indicate completion
          switchView("history");
          renderStats();

          // Visual feedback on the button
          const originalHtml = clearDataBtn.innerHTML;
          clearDataBtn.textContent = "Data Cleared!";
          clearDataBtn.style.background = "#2ecc71";
          clearDataBtn.style.color = "white";
          clearDataBtn.style.borderColor = "#2ecc71";
          setTimeout(() => {
            clearDataBtn.innerHTML = originalHtml;
            clearDataBtn.style.background = "";
            clearDataBtn.style.color = "";
            clearDataBtn.style.borderColor = "";
          }, 2000);
        },
      });
    };
  }

  // Filter Section Toggle Logic
  const toggleBtn = document.getElementById("toggle-filter-btn");
  const subheader = document.getElementById("stats-header-filters");
  const toggleStrip = document.getElementById("history-filter-toggle");

  if (toggleBtn && subheader) {
    const toggleFilters = (forceState) => {
      const isCollapsed = subheader.classList.contains("collapsed");
      const shouldCollapse =
        forceState !== undefined ? !forceState : !isCollapsed;

      isFilterCollapsed = shouldCollapse; // Set preference to the manually requested state

      subheader.classList.toggle("collapsed", shouldCollapse);
      toggleBtn.classList.toggle("expanded", !shouldCollapse);

      // Update icon based on state
      toggleBtn.innerHTML = shouldCollapse
        ? icons.chevron_down
        : icons.chevron_up;
    };

    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      toggleFilters();
    };

    // "Drag down" feel - simple version: click on strip also toggles
    if (toggleStrip) {
      let startY = 0;
      toggleStrip.onmousedown = (e) => {
        startY = e.clientY;

        const onMouseMove = (moveEvent) => {
          const dy = moveEvent.clientY - startY;
          if (dy > 20) {
            // Dragged down enough
            toggleFilters(true); // Expand
            cleanup();
          } else if (dy < -20) {
            // Dragged up enough
            toggleFilters(false); // Collapse
            cleanup();
          }
        };

        const cleanup = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", cleanup);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", cleanup);
      };

      // Also allow clicking the strip itself to toggle
      toggleStrip.onclick = (e) => {
        if (e.target === toggleStrip) {
          toggleFilters();
        }
      };
    }
  }

  // Toggle sidebar open/close
  btn.onclick = (e) => {
    if (dragStatus.isDragging) return; // Don't toggle if we were dragging
    e.stopPropagation();
    toggleStats();
  };

  const closeBtn = document.getElementById("close-stats");
  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      isStatsOpen = false;
      sidebar.classList.remove("open");
      btn.classList.remove("active");
      document.body.classList.remove("stats-sidebar-active");
      document.body.style.overflow = "";
      if (typeof restoreIsolation === "function") restoreIsolation();
    };
  }

  // Close on escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isStatsOpen) {
      isStatsOpen = false;
      sidebar.classList.remove("open");
      btn.classList.remove("active");
      document.body.classList.remove("stats-sidebar-active");
      document.body.style.overflow = "";
      if (typeof restoreIsolation === "function") restoreIsolation();
    }
  });

  // Scroll Listener for Infinite History
  const statsBody = sidebar.querySelector(".stats-body");
  if (statsBody) {
    statsBody.onscroll = () => {
      if (activeView !== "history" && activeView !== "channel-videos") return;

      // Trigger if we are 200px from the bottom
      const threshold = 200;
      const remaining =
        statsBody.scrollHeight - (statsBody.scrollTop + statsBody.clientHeight);

      if (remaining < threshold) {
        if (activeView === "history") {
          appendHistoryBatch();
        } else if (activeView === "channel-videos") {
          appendChannelVideosBatch();
        }
      }
    };
  }

  // Close on click outside
  document.addEventListener("click", (e) => {
    if (popover && !popover.contains(e.target) && e.target !== trigger) {
      popover.style.display = "none";
    }

    if (isStatsOpen && !sidebar.contains(e.target) && !btn.contains(e.target)) {
      // Robustness: Ignore clicks on spontaneous popups so clearing them
      // during sidebar open doesn't accidentally trigger this "close" logic.
      const ignoreIds = [
        "ytt-backup-reminder",
        "break-reminder-modal",
        "stats-confirm-modal",
        "stats-multitab-toast",
        "stats-multitab-modal",
      ];
      for (const id of ignoreIds) {
        if (document.getElementById(id)?.contains(e.target)) return;
      }

      isStatsOpen = false;
      sidebar.classList.remove("open");
      btn.classList.remove("active");
      document.body.classList.remove("stats-sidebar-active");
      document.body.style.overflow = "";
      if (typeof restoreIsolation === "function") restoreIsolation();
    }
  });

  // Sidebar hover logic (simplified as global lock is now primary)
  sidebar.onmouseenter = () => {
    // Already handled by global lock if open
  };
  sidebar.onmouseleave = () => {
    if (!isStatsOpen) document.body.style.overflow = "";
  };

  // Initial UI sync
  switchView(activeView);
  updateDateLabel();

  // Stop propagation of shortcut keys to YouTube when typing in our sidebar
  sidebar.addEventListener(
    "keydown",
    (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) {
        e.stopPropagation();
      }
    },
    false,
  );
}

/**
 * Fetches and renders the list of backups present in IndexedDB.
 */
function renderBackups() {
  const list = document.getElementById("backup-history-list");
  if (!list) return;

  safeSendMessage({ action: "GET_BACKUPS" }, (backups) => {
    if (!backups || backups.length === 0) {
      list.innerHTML =
        '<li class="loading-placeholder">No backups found yet.</li>';
      return;
    }

    list.innerHTML = "";
    backups.forEach((b) => {
      const item = document.createElement("li");
      item.className = "backup-item";
      item.innerHTML = `
                <div class="backup-lead">
                    ${icons.backup}
                </div>
                <div class="backup-info">
                    <span class="backup-date">${b.dateString}</span>
                    <span class="backup-meta">Snapshot - YouTube History</span>
                </div>
                <div class="backup-actions">
                    <button class="backup-btn restore-btn" title="Restore this Backup" data-id="${b.id}">
                        ${icons.restore}
                    </button>
                    <button class="backup-btn download-btn" title="Download as JSON" data-id="${b.id}">
                        ${icons.download}
                    </button>
                    <button class="backup-btn delete-btn" title="Delete Backup" data-id="${b.id}">
                        ${icons.close}
                    </button>
                </div>
            `;

      // Restore Action
      item.querySelector(".restore-btn").onclick = (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        showConfirmModal({
          title: "Restore this Backup?",
          message:
            "This will completely overwrite your current history and settings with data from this snapshot. Are you sure?",
          confirmText: "Restore Now",
          cancelText: "Cancel",
          icon: "🔄",
          onConfirm: () => {
            safeSendMessage(
              { action: "RESTORE_BACKUP", id: id },
              (response) => {
                if (response && response.success) {
                  // Success feedback: sync UI instantly
                  // Explicitly update local state variables from response to avoid race conditions
                  if (response.settings) {
                    const s = response.settings;
                    if (s.ytt_shorts_settings)
                      shortsBlockerSettings.enabled =
                        s.ytt_shorts_settings.enabled;
                    if (s.ytt_dislike_settings)
                      dislikeCountSettings.enabled =
                        s.ytt_dislike_settings.enabled;
                    if (s.ytt_break_settings) {
                      breakSettings.enabled = s.ytt_break_settings.enabled;
                      breakSettings.intervalValue =
                        s.ytt_break_settings.intervalValue ??
                        s.ytt_break_settings.intervalMinutes ??
                        15;
                      breakSettings.intervalUnit =
                        s.ytt_break_settings.intervalUnit || "minutes";
                      breakSettings.workUrl = s.ytt_break_settings.workUrl;
                    }
                    if (s.ytt_backup_settings)
                      backupSettings = {
                        ...backupSettings,
                        ...s.ytt_backup_settings,
                      };
                    if (s.ytt_retention_settings)
                      retentionSettings = {
                        ...retentionSettings,
                        ...s.ytt_retention_settings,
                      };

                    if (s.ytt_opacity_settings)
                      opacitySettings = {
                        ...opacitySettings,
                        ...s.ytt_opacity_settings,
                      };
                    if (s.ytt_smart_fullscreen_settings)
                      smartFullscreenSettings = {
                        ...smartFullscreenSettings,
                        ...s.ytt_smart_fullscreen_settings,
                      };
                    if (s.ytt_keybind_settings)
                      keybindSettings = {
                        ...keybindSettings,
                        ...s.ytt_keybind_settings,
                      };

                    // Apply live side-effects
                    if (typeof applyShortsBlockerState === "function")
                      applyShortsBlockerState();
                    if (typeof applyDislikeCountState === "function")
                      applyDislikeCountState();
                    if (typeof applyOpacityState === "function")
                      applyOpacityState();
                    if (typeof applyFloatingPlayerState === "function")
                      applyFloatingPlayerState();
                  }

                  // Give storage.onChanged and DOM a moment to settle for total reliability
                  setTimeout(() => {
                    selectedDayFilter = "today"; // Reset filter specifically for restores
                    syncSettingsUI();
                    switchView("history");
                    renderStats();
                    renderBackups();
                  }, 50);
                } else {
                  alert(
                    "Failed to restore: " +
                      (response ? response.error : "Unknown error"),
                  );
                }
              },
            );
          },
        });
      };

      // Download Action
      item.querySelector(".download-btn").onclick = (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        const date = e.currentTarget
          .closest(".backup-item")
          .querySelector(".backup-date").textContent;

        const btn = e.currentTarget;
        const originalIcon = btn.innerHTML;
        btn.innerHTML = icons.loading || "...";
        btn.disabled = true;

        safeSendMessage({ action: "GET_BACKUP_FULL", id: id }, (fullBackup) => {
          btn.innerHTML = originalIcon;
          btn.disabled = false;

          if (fullBackup && fullBackup.data) {
            // Include a version and timestamp for the JSON file
            const exportData = {
              version: "1.0",
              exportedAt: new Date().toISOString(),
              source: id,
              ...fullBackup.data,
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ytt-backup_${date.replace(/[,]/g, "").replace(/[/\s:]/g, "-").replace(/-+/g, "-")}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } else {
            alert("Failed to fetch full backup data for download.");
          }
        });
      };

      // Delete Action
      item.querySelector(".delete-btn").onclick = (e) => {
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        showConfirmModal({
          title: "Delete Backup?",
          message:
            "Are you sure you want to remove this backup? This cannot be undone.",
          confirmText: "Delete",
          cancelText: "Cancel",
          icon: "🗑️",
          onConfirm: () => {
            safeSendMessage({ action: "DELETE_BACKUP", id: id }, () => {
              renderBackups();
            });
          },
        });
      };

      list.appendChild(item);
    });
  });
}

/**
 * Renders the list of keybinds in the keybinds-view
 */
function renderKeybinds() {
  const container = document.getElementById("keybinds-list-container");
  if (!container) return;

  const categories = [
    {
      title: "Navigation",
      actions: [
        { id: "navHistory", label: "Watch History", desc: "Instantly jump to your watch history timeline", icon: icons.history },
        { id: "navAnalytics", label: "Analytics Stats", desc: "View detailed charts and usage statistics", icon: icons.analytics },
        { id: "navChannels", label: "Channels", desc: "View watch time broken down by channel", icon: icons.analytics },
        { id: "navBackup", label: "Backups & Sync", desc: "Manage your data backups and sync settings", icon: icons.backup },
        { id: "navSettings", label: "Settings Menu", desc: "Access all extension preferences", icon: icons.settings },
        { id: "navShortcuts", label: "Hotkeys", desc: "Open this shortcuts settings page", icon: icons.settings }
      ]
    },
    {
      title: "Feature Controls",
      actions: [
        { id: "toggleSidebar", label: "Toggle Sidebar", desc: "Open or close the time tracker sidebar", icon: icons.history },
        { id: "toggleFloating", label: "Floating Mode", desc: "Toggle the resizable PiP video player", icon: icons.pip },
        { id: "toggleDislike", label: "Dislike Counter", desc: "Toggle visibility of the dislike count", icon: icons.dislike },
        { id: "toggleShorts", label: "Shorts Blocker", desc: "Instantly enable/disable the shorts filter", icon: icons.close },
        { id: "toggleOpacity", label: "Toggle Opacity", desc: "Dim/undim the YouTube background", icon: icons.eye },
        { id: "manualBackup", label: "Manual Backup", desc: "Save a snapshot of your current data", icon: icons.backup }
      ]
    }
  ];

  container.innerHTML = categories.map(cat => `
    <div class="keybind-section">
      <div class="section-title">${cat.title}</div>
      <div class="settings-card">
        ${cat.actions.map(action => `
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="label-with-icon">
                <div class="item-icon">${action.icon}</div>
                <span class="settings-item-label">${action.label}</span>
              </div>
              <span class="settings-item-desc">${action.desc}</span>
            </div>
            <div class="keybind-display" id="bind-${action.id}" data-action="${action.id}" title="Click to remap">
              ${keybindSettings[action.id] || "None"}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Add click listeners for recording
  container.querySelectorAll(".keybind-display").forEach(display => {
    display.onclick = () => startRecordingKeybind(display);
  });
}

/**
 * Handles the key recording process (Quick Copy pattern)
 * Uses keydown to build combo, keyup to finalize when all released.
 */
let isRecording = false;
function startRecordingKeybind(display) {
  if (isRecording) return;
  isRecording = true;

  const actionId = display.dataset.action;
  const originalText = display.innerText;

  // Visual feedback — highlight active, dim others
  display.classList.add("recording");
  display.innerText = "Press keys...";

  const allDisplays = document.querySelectorAll(".keybind-display");
  allDisplays.forEach(d => {
    if (d !== display) d.style.opacity = "0.3";
  });

  let activeKeys = [];          // Ordered array for display
  let pressedKeysSet = new Set(); // Tracks physical keys to avoid keydown repeats

  function getReadableKeyName(e) {
    const code = e.code;
    const key = e.key;

    // Modifier keys with L/R distinction
    const modifiers = {
      ShiftLeft: "Shift", ShiftRight: "Shift",
      ControlLeft: "Ctrl", ControlRight: "Ctrl",
      AltLeft: "Alt", AltRight: "Alt",
      MetaLeft: "Meta", MetaRight: "Meta"
    };
    if (modifiers[code]) return modifiers[code];

    // Regular keys
    if (key === " ") return "Space";
    if (key.length === 1) return key.toUpperCase();
    return key;
  }

  const handleKeyDown = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();

    if (e.key === "Escape") {
      cancelRecording();
      return;
    }

    const keyName = getReadableKeyName(e);
    if (!pressedKeysSet.has(e.code)) {
      pressedKeysSet.add(e.code);
      // Avoid duplicate named keys (e.g. ShiftLeft and ShiftRight both become "Shift")
      if (!activeKeys.includes(keyName)) {
        activeKeys.push(keyName);
      }
      display.innerText = activeKeys.join("+");
    }
  };

  const handleKeyUp = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();

    pressedKeysSet.delete(e.code);

    // When all keys are released and we have a combo, finalize
    if (pressedKeysSet.size === 0 && activeKeys.length > 0) {
      finalizeRecording();
    }
  };

  const finalizeRecording = () => {
    const combination = activeKeys.join("+");
    keybindSettings[actionId] = combination;
    display.innerText = combination;

    // Save to storage
    if (typeof safeStorageSet === "function") {
      safeStorageSet({ ytt_keybind_settings: keybindSettings });
    }
    cleanup();
  };

  const cancelRecording = () => {
    display.innerText = originalText;
    cleanup();
  };

  const cleanup = () => {
    isRecording = false;
    display.classList.remove("recording");
    allDisplays.forEach(d => { d.style.opacity = ""; });
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("keyup", handleKeyUp, true);
    window.removeEventListener("blur", cancelRecording);
  };

  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("keyup", handleKeyUp, true);
  window.addEventListener("blur", cancelRecording);
}

/**
 * Closes all active spontaneous popups (Reminders, Multi-tab warnings)
 * to ensure they don't overlap with the sidebar.
 */
function closeAllActivePopups() {
  // 1. Backup Reminder
  const backupReminder = document.getElementById("ytt-backup-reminder");
  if (backupReminder) {
    const xBtn =
      backupReminder.querySelector("#ytt-reminder-x") ||
      backupReminder.querySelector(".close-btn");
    if (xBtn) xBtn.click();
    else backupReminder.remove();
  }

  // 2. Break Reminder
  const breakModal = document.getElementById("break-reminder-modal");
  if (breakModal) {
    const closeBtn = document.getElementById("break-keep-watching");
    if (closeBtn) closeBtn.click();
    else breakModal.remove();
  }

  // 3. Multi-tab Toast
  const multiTabToast = document.getElementById("stats-multitab-toast");
  if (multiTabToast) {
    const dismissBtn = document.getElementById("toast-dismiss");
    if (dismissBtn) dismissBtn.click();
    else multiTabToast.remove();
  }

  // 4. Multi-tab Modal
  const multiTabModal = document.getElementById("stats-multitab-modal");
  if (multiTabModal) {
    const keepBtn = document.getElementById("modal-keep-this");
    if (keepBtn) keepBtn.click();
    else multiTabModal.remove();
  }
}

window.toggleStats = function() {
  const sidebar = document.getElementById("stats-sidebar");
  const btn = document.getElementById("stats-toggle-btn");
  if (!sidebar || !btn) return;

  isStatsOpen = !isStatsOpen;

  sidebar.classList.toggle("open", isStatsOpen);
  btn.classList.toggle("active", isStatsOpen);

  if (isStatsOpen) {
    closeAllActivePopups();
    document.body.classList.add("stats-sidebar-active");
    document.body.style.overflow = "hidden";
    if (typeof renderStats === "function") renderStats();
    if (typeof isolateModal === "function") isolateModal(sidebar);
    // Auto-focus sidebar for keyboard navigation
    setTimeout(() => sidebar.focus(), 300);
  } else {
    document.body.classList.remove("stats-sidebar-active");
    document.body.style.overflow = "";
    if (typeof restoreIsolation === "function") restoreIsolation();
  }
};
window.switchView = function(viewName) {
  if (viewName !== activeView) {
    viewHistory.push(viewName);
    // Keep stack manageable
    if (viewHistory.length > 20) viewHistory.shift();
  }
  _switchViewInternal(viewName);
};

window.triggerManualBackup = function() {
  const createBackupBtn = document.getElementById("create-manual-backup");
  if (createBackupBtn) {
    createBackupBtn.disabled = true;
    const originalHtml = createBackupBtn.innerHTML;
    createBackupBtn.textContent = "Backing up...";

    safeSendMessage({ action: "CREATE_BACKUP_MANUAL" }, () => {
      createBackupBtn.disabled = false;
      createBackupBtn.innerHTML = originalHtml;
      // Delay slightly to ensure IndexedDB has committed the change
      setTimeout(() => {
        renderBackups();
      }, 100);
    });
  } else {
    // If btn doesn't exist (not in DOM), just send message
    safeSendMessage({ action: "CREATE_BACKUP_MANUAL" }, () => {
       setTimeout(() => {
         renderBackups();
       }, 100);
    });
  }
};
function updateSliderProgress(slider) {
  if (!slider) return;
  const val = slider.value;
  const min = slider.min || 0;
  const max = slider.max || 1;
  const percent = ((val - min) / (max - min)) * 100;

  slider.style.background = `linear-gradient(to right, var(--stats-primary) 0%, var(--stats-primary) ${percent}%, var(--stats-input-bg) ${percent}%, var(--stats-input-bg) 100%)`;
}
