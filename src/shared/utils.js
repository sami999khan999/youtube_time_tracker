// === Shared Utility Functions ===

function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null || seconds === undefined) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
        return `${h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
    }
    return `${m}:${s < 10 ? '0' + s : s}`;
}

// === Page Scroll Lock ===
// Named locks so nested owners (sidebar + modal) can't unlock each other.
const activeScrollLocks = new Set();

function applyScrollLockState() {
    const locked = activeScrollLocks.size > 0;
    document.documentElement.classList.toggle('ytt-scroll-locked', locked);
    if (document.body) document.body.classList.toggle('ytt-scroll-locked', locked);
}

/**
 * Locks page scrolling. The class is applied to <html> as well as <body>:
 * "Hide Suggestions" sets `html { overflow-x: hidden }`, and once <html>'s
 * overflow is no longer `visible` the viewport stops inheriting <body>'s
 * overflow — so a body-only lock leaves the page scrollable.
 * @param {string} owner - Identifier of whatever requested the lock.
 */
function lockPageScroll(owner = 'default') {
    activeScrollLocks.add(owner);
    applyScrollLockState();
}

/** Releases this owner's lock; scrolling resumes once no owners remain. */
function unlockPageScroll(owner = 'default') {
    activeScrollLocks.delete(owner);
    applyScrollLockState();
}
