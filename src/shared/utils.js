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
