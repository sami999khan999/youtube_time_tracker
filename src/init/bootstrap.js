// === Bootstrap: Initial calls, intervals, observers, event listeners ===

(async () => {
    // Wait for full state to load from storage
    await initState();

    // Initial Run
    applyShortsBlockerState();
    applyDislikeCountState();
    applyOpacityState();
    injectStatsUI();
    setupFullscreenAutoHide();
    if (typeof setupSmartFullscreen === 'function') setupSmartFullscreen();
    if (typeof window.initShortcuts === 'function') window.initShortcuts();

    // Intervals
    const trackingInterval = setInterval(() => {
        try {
            if (window.yttContextInvalidated) {
                clearInterval(trackingInterval);
                return;
            }
            updateStats();
            checkBreakReminder();
            if (typeof checkBackupReminder === 'function') checkBackupReminder();
        } catch (e) {
            if (e.message.includes('context invalidated')) {
                window.yttContextInvalidated = true;
                clearInterval(trackingInterval);
            }
        }
    }, 1000);

    // Throttle MutationObserver calls to applyDislikeCountState
    let dislikeMutationTimer = null;
    const observer = new MutationObserver(() => {
        if (shortsBlockerSettings.enabled) blockShorts();

        // Throttle dislike checks: at most once every 100ms from mutations
        if (!dislikeMutationTimer) {
            dislikeMutationTimer = setTimeout(() => {
                dislikeMutationTimer = null;
                applyDislikeCountState();
            }, 100);
        }

        // Ensure UI is re-injected if YouTube's SPA wipes it
        injectStatsUI();
        if (typeof applyFloatingPlayerState === 'function') applyFloatingPlayerState();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Handle YouTube's custom navigation events
    window.addEventListener('yt-navigate-start', () => {
        // Final sync: use cached values, YouTube may have already reset the video element
        updateStats(lastVideoId, true);
        // Clear dislike state for the upcoming video
        if (typeof resetDislikeState === 'function') resetDislikeState();
    });

    window.addEventListener('yt-page-data-updated', () => {
        applyShortsBlockerState();
        applyDislikeCountState();
        applyOpacityState();
        injectStatsUI();
        if (typeof applyFloatingPlayerState === 'function') applyFloatingPlayerState();
    });
    window.addEventListener('yt-navigate-finish', () => {
        applyShortsBlockerState();
        applyDislikeCountState();
        applyOpacityState();
        injectStatsUI();
        if (typeof applyFloatingPlayerState === 'function') applyFloatingPlayerState();
    });
    window.addEventListener('popstate', () => {
        if (shortsBlockerSettings.enabled) blockShorts();
    });

    // Handle tab closure and backgrounding
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            updateStats(undefined, true);
        }
    });

    window.addEventListener('beforeunload', () => {
        updateStats(undefined, true);
    });
})();
