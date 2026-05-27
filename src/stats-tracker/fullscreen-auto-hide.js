// === Fullscreen Auto-hide: Hide toggle button during fullscreen inactivity ===

let autoHideTimeout = null;
const AUTO_HIDE_DELAY = 3000; // 3 seconds

function setupFullscreenAutoHide() {
    // Listen for native browser fullscreen changes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Watch for pseudo-fullscreen class toggles on the root element
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                handleFullscreenChange();
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });

    // Listen for mouse movement to reset timer
    document.addEventListener('mousemove', resetAutoHideTimer);
}

/**
 * Checks if the page is in native fullscreen OR our custom pseudo-fullscreen mode
 */
function isAnyFullscreenActive() {
    const isNative = !!(document.fullscreenElement || document.webkitFullscreenElement);
    const isPseudo = document.documentElement.classList.contains('ytt-pseudo-active');
    return isNative || isPseudo;
}

function handleFullscreenChange() {
    const isFullscreen = isAnyFullscreenActive();
    const btn = document.getElementById('stats-toggle-btn');
    
    if (!btn) return;

    if (isFullscreen) {
        startAutoHideTimer();
    } else {
        stopAutoHideTimer();
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    }
}

function resetAutoHideTimer() {
    if (!isAnyFullscreenActive()) return;

    const btn = document.getElementById('stats-toggle-btn');
    if (btn) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    }

    startAutoHideTimer();
}

function startAutoHideTimer() {
    stopAutoHideTimer();
    autoHideTimeout = setTimeout(() => {
        const btn = document.getElementById('stats-toggle-btn');
        if (btn && !btn.classList.contains('active')) { // Only hide if sidebar is NOT open
            btn.style.opacity = '0';
            btn.style.pointerEvents = 'none'; // Prevent accidental clicks or hover while hidden
        }
    }, AUTO_HIDE_DELAY);
}

function stopAutoHideTimer() {
    if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
        autoHideTimeout = null;
    }
}
