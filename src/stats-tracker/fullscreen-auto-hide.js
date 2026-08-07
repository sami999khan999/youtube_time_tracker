// === Fullscreen Auto-hide: Hide toggle button during fullscreen inactivity ===

let autoHideTimeout = null;
let wasFullscreen = false;
const AUTO_HIDE_DELAY = 3000; // 3 seconds
const AUTO_HIDE_CLASS = 'ytt-auto-hidden';

function setupFullscreenAutoHide() {
    // Listen for native browser fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // F11 browser fullscreen fires no fullscreenchange event, so watch resize too
    window.addEventListener('resize', handleFullscreenChange);

    // Watch for YouTube's own fullscreen markers (it flips attributes on the
    // watch page / player rather than only going through the Fullscreen API)
    const observer = new MutationObserver(handleFullscreenChange);
    observer.observe(document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'fullscreen'],
    });

    // Listen for mouse movement to reset timer
    document.addEventListener('mousemove', resetAutoHideTimer);
}

/**
 * True when the video is being watched fullscreen — either via the Fullscreen
 * API, via YouTube's own fullscreen markers, or with the browser itself in F11
 * fullscreen while a video plays.
 */
function isAnyFullscreenActive() {
    if (document.fullscreenElement || document.webkitFullscreenElement) return true;

    if (document.querySelector('ytd-watch-flexy[fullscreen]')) return true;

    const player = document.querySelector('.html5-video-player');
    if (player && player.classList.contains('ytp-fullscreen')) return true;

    // F11: the viewport covers the whole screen. Only treat that as fullscreen
    // viewing when a video is actually playing, so the button stays put while
    // simply browsing in a maximized/F11 window.
    if (window.screen &&
        Math.abs(window.innerHeight - window.screen.height) <= 2 &&
        Math.abs(window.innerWidth - window.screen.width) <= 2) {
        const video = document.querySelector('video');
        if (video && !video.paused && !video.ended) return true;
    }

    return false;
}

function handleFullscreenChange() {
    const isFullscreen = isAnyFullscreenActive();
    const changed = isFullscreen !== wasFullscreen;
    wasFullscreen = isFullscreen;

    const btn = document.getElementById('stats-toggle-btn');
    if (!btn) return;

    if (!isFullscreen) {
        if (changed) {
            stopAutoHideTimer();
            showToggleButton(btn);
        }
        return;
    }

    // Start the countdown on entering fullscreen — and also when the button is
    // showing with no timer pending, which happens when YouTube's SPA wipes and
    // re-injects it mid-fullscreen. Never restart it on unrelated mutations:
    // this handler fires constantly on YouTube, and each restart would push the
    // hide 3s further out so the button would never disappear.
    if (changed || (!autoHideTimeout && !btn.classList.contains(AUTO_HIDE_CLASS))) {
        startAutoHideTimer();
    }
}

function resetAutoHideTimer() {
    if (!isAnyFullscreenActive()) return;

    const btn = document.getElementById('stats-toggle-btn');
    if (btn) showToggleButton(btn);

    startAutoHideTimer();
}

function showToggleButton(btn) {
    btn.classList.remove(AUTO_HIDE_CLASS);
}

function startAutoHideTimer() {
    stopAutoHideTimer();
    autoHideTimeout = setTimeout(() => {
        autoHideTimeout = null;
        const btn = document.getElementById('stats-toggle-btn');
        if (btn && !btn.classList.contains('active')) { // Only hide if sidebar is NOT open
            // A class (not inline styles) so the !important rule in the CSS
            // bundle outranks the page-dim rule that pins the button opaque.
            btn.classList.add(AUTO_HIDE_CLASS);
        }
    }, AUTO_HIDE_DELAY);
}

function stopAutoHideTimer() {
    if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
        autoHideTimeout = null;
    }
}
