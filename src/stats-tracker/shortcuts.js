// === Shortcuts: Global Keyboard Listener & Executors ===

/**
 * Parses a keybind string like "Alt+S" into an object
 */
function parseKeybind(bindString) {
    const parts = bindString.split('+');
    return {
        key: parts[parts.length - 1].toLowerCase(),
        alt: parts.includes('Alt'),
        shift: parts.includes('Shift'),
        ctrl: parts.includes('Ctrl') || parts.includes('Control'),
        meta: parts.includes('Meta') || parts.includes('Command')
    };
}

/**
 * Checks if a KeyboardEvent matches a keybind string
 */
function matchesKeybind(e, bindString) {
    if (!bindString) return false;
    const bind = parseKeybind(bindString);
    
    // Normalize key name (handle corner cases like 'Escape' vs 'Esc' if needed)
    const pressedKey = e.key.toLowerCase();
    
    // Basic match
    if (pressedKey !== bind.key) return false;
    
    // Modifier match
    if (e.altKey !== bind.alt) return false;
    if (e.shiftKey !== bind.shift) return false;
    if (e.ctrlKey !== bind.ctrl) return false;
    if (e.metaKey !== bind.meta) return false;
    
    return true;
}

window.initShortcuts = function() {
    console.log("YTT: [Shortcuts] Initializing...");
    
    if (typeof keybindSettings === 'undefined') {
        console.error("YTT: [Shortcuts] FATAL - keybindSettings is undefined!");
        return;
    }
    
    console.log("YTT: [Shortcuts] Active Binds:", JSON.stringify(keybindSettings));
    
    window.addEventListener('keydown', (e) => {
        // Skip if currently recording a keybind remap
        if (typeof isRecording !== 'undefined' && isRecording) return;

        // Log all keypresses for debugging if it starts with a modifier
        if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) {
            console.log(`YTT: [Keydown] Key: ${e.key}, Alt: ${e.altKey}, Shift: ${e.shiftKey}, Ctrl: ${e.ctrlKey}, Meta: ${e.metaKey}`);
        }

        // 1. Ignore if typing in an input/textarea
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
            return;
        }

        // 2. Check each registered shortcut
        // Side navigation
        if (matchesKeybind(e, keybindSettings.toggleSidebar)) {
            console.log("YTT: [Match] toggleSidebar triggered");
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof window.toggleStats === 'function') {
                window.toggleStats();
            } else {
                console.error("YTT: [Shortcuts] window.toggleStats is not a function!");
            }
        } 
        else if (matchesKeybind(e, keybindSettings.toggleFloating)) {
            console.log("YTT: [Match] toggleFloating triggered");
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof toggleNativePiP === 'function') toggleNativePiP();
        }
        else if (matchesKeybind(e, keybindSettings.toggleDislike)) {
            console.log("YTT: [Match] toggleDislike triggered");
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof dislikeCountSettings !== 'undefined') {
                dislikeCountSettings.enabled = !dislikeCountSettings.enabled;
                if (typeof applyDislikeCountState === 'function') applyDislikeCountState();
                saveSettingsInStorage();
            }
        }
        else if (matchesKeybind(e, keybindSettings.toggleShorts)) {
            console.log("YTT: [Match] toggleShorts triggered");
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof shortsBlockerSettings !== 'undefined') {
                shortsBlockerSettings.enabled = !shortsBlockerSettings.enabled;
                if (typeof applyShortsBlockerState === 'function') applyShortsBlockerState();
                saveSettingsInStorage();
            }
        }
        else if (matchesKeybind(e, keybindSettings.toggleSuggestions)) {
            console.log("YTT: [Match] toggleSuggestions triggered");
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof hideSuggestionsSettings !== 'undefined') {
                hideSuggestionsSettings.enabled = !hideSuggestionsSettings.enabled;
                if (typeof applyHideSuggestionsState === 'function') applyHideSuggestionsState();
                if (typeof syncSettingsUI === 'function') syncSettingsUI();
                saveSuggestionsSettings();
            }
        }
        else if (matchesKeybind(e, keybindSettings.toggleOpacity)) {
            console.log("YTT: [Match] toggleOpacity triggered");
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof opacitySettings !== 'undefined') {
                opacitySettings.enabled = !opacitySettings.enabled;
                if (typeof applyOpacityState === 'function') applyOpacityState();
                if (typeof syncSettingsUI === 'function') syncSettingsUI();
                saveSettingsInStorage();
            }
        }
        else if (matchesKeybind(e, keybindSettings.opacityUp)) {
            console.log("YTT: [Match] opacityUp triggered");
            e.preventDefault();
            e.stopImmediatePropagation();
            adjustOpacityLevel(0.05);
        }
        else if (matchesKeybind(e, keybindSettings.opacityDown)) {
            console.log("YTT: [Match] opacityDown triggered");
            e.preventDefault();
            e.stopImmediatePropagation();
            adjustOpacityLevel(-0.05);
        }
        // New Navigation and System Shortcuts
        else if (matchesKeybind(e, keybindSettings.navHistory)) {
            handleNavShortcut("history");
        }
        else if (matchesKeybind(e, keybindSettings.navAnalytics)) {
            handleNavShortcut("analytics");
        }
        else if (matchesKeybind(e, keybindSettings.navBackup)) {
            handleNavShortcut("backup");
        }
        else if (matchesKeybind(e, keybindSettings.navSettings)) {
            handleNavShortcut("settings");
        }
        else if (matchesKeybind(e, keybindSettings.navChannels)) {
            handleNavShortcut("channel-distribution");
        }
        else if (matchesKeybind(e, keybindSettings.navShortcuts)) {
            handleNavShortcut("keybinds");
        }
        else if (matchesKeybind(e, keybindSettings.manualBackup)) {
            console.log("YTT: [Match] manualBackup triggered");
            e.preventDefault();
            e.stopImmediatePropagation();
            if (typeof window.triggerManualBackup === "function") {
                window.triggerManualBackup();
            }
        }

        function handleNavShortcut(viewName) {
            console.log(`YTT: [Match] navShortcut -> ${viewName}`);
            e.preventDefault();
            e.stopImmediatePropagation();
            
            // Open sidebar if closed
            if (!isStatsOpen && typeof window.toggleStats === 'function') {
                window.toggleStats();
            }
            
            // Switch view
            if (typeof window.switchView === 'function') {
                window.switchView(viewName);
            }
        }
    }, true); 
    
    console.log("YTT: [Shortcuts] Global listener attached.");

    // Listen for background commands (e.g. for when the tab is minimized)
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === "TOGGLE_PIP") {
            console.log("YTT: [Command] TOGGLE_PIP received from background");
            if (typeof toggleNativePiP === 'function') toggleNativePiP();
        }
    });
}

// Contrast/half-moon glyph for the opacity toast, matching the app's icon style
const OPACITY_TOAST_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"></path></svg>`;

/**
 * Nudges the "Dim YouTube Base" opacity level up or down via keyboard.
 * Auto-enables the feature so the change is immediately visible, clamps to a
 * safe 0.05–1.0 range, syncs the settings UI, and surfaces a brief toast.
 */
function adjustOpacityLevel(delta) {
    if (typeof opacitySettings === 'undefined') return;

    // Enable dimming so the adjustment has a visible effect
    opacitySettings.enabled = true;

    const current = typeof opacitySettings.value === 'number' ? opacitySettings.value : 0.5;
    let next = current + delta;
    // Clamp to 0.05–1.0 so the page never fully disappears
    next = Math.min(1, Math.max(0.05, Math.round(next * 100) / 100));
    opacitySettings.value = next;

    if (typeof applyOpacityState === 'function') applyOpacityState();
    if (typeof syncSettingsUI === 'function') syncSettingsUI();
    saveSettingsInStorage();

    if (typeof window.showActionToast === 'function') {
        window.showActionToast({
            eyebrow: 'Opacity',
            message: `YouTube visibility set to ${Math.round(next * 100)}%`,
            icon: OPACITY_TOAST_ICON,
            duration: 1400,
        });
    }
}

function saveSettingsInStorage() {
    // Helper to persist quick toggles triggered via shortcuts
    if (typeof safeStorageSet === 'function') {
        safeStorageSet({
            ytt_shorts_settings: shortsBlockerSettings,
            ytt_dislike_settings: dislikeCountSettings,
            ytt_smart_fullscreen_settings: smartFullscreenSettings,
            ytt_keybind_settings: keybindSettings,
            ytt_opacity_settings: opacitySettings
        });
        try {
            localStorage.setItem("ytt_opacity_fast_path", JSON.stringify(opacitySettings));
        } catch (e) {}
    }
}
