// === Constants: Colors & SVG Icons ===

const SHORTS_BLOCKER_CSS_ID = "yt-shorts-blocker-dynamic-css";
const SHORTS_BLOCKER_CSS = `
/* Hiding Shorts Sidebar Entries */
ytd-guide-entry-renderer:has(a[href="/shorts"]),
ytd-mini-guide-entry-renderer:has(a[href="/shorts"]),
ytd-guide-entry-renderer:has(a[title="Shorts"]),
ytd-mini-guide-entry-renderer:has(a[title="Shorts"]) {
    display: none !important;
}
/* Hiding Home Feed Shorts Sections */
ytd-rich-shelf-renderer[is-shorts],
ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
#ytt-floating-btn:hover {
    color: #fff !important;
}

/* Custom Player Tooltip */
.ytt-player-tooltip {
    position: fixed;
    background: rgba(28, 28, 28, 0.9);
    color: #fff;
    padding: 5px 10px;
    border-radius: 2px;
    font-size: 12px;
    font-weight: 500;
    pointer-events: none;
    z-index: 2147483647;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
    transform: translateX(-50%);
    opacity: 0;
    transition: opacity 0.1s ease;
}

.ytt-player-tooltip.visible {
    opacity: 1;
}
/* Hiding Shorts in Search Results */
ytd-reel-shelf-renderer,
ytd-shelf-renderer:has(ytd-reel-shelf-renderer),
ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
ytd-item-section-renderer:has(ytd-reel-shelf-renderer),
ytd-item-section-renderer.ytGridShelfViewModelHost:has(a[href*="/shorts/"]),
ytd-shelf-renderer[is-shorts],
ytd-rich-shelf-renderer[is-shorts],
ytd-shelf-renderer:has(yt-icon[type="shorts"]),
ytd-rich-section-renderer:has(yt-icon[type="shorts"]),
ytd-shelf-renderer:has(a[href*="/shorts/"]),
ytd-rich-section-renderer:has(a[href*="/shorts/"]),
ytd-rich-shelf-renderer:has(a[href*="/shorts/"]) {
    display: none !important;
}
/* Hiding individual Shorts videos */
ytd-video-renderer:has(a[href*="/shorts/"]),
ytd-grid-video-renderer:has(a[href*="/shorts/"]),
ytd-rich-item-renderer:has(a[href*="/shorts/"]),
ytd-reel-item-renderer,
ytd-compact-video-renderer:has(a[href*="/shorts/"]) {
    display: none !important;
}
/* Hiding Shorts Section in Navigation Drawer */
ytd-guide-section-renderer:has(a[href*="/shorts"]),
ytd-guide-entry-renderer:has(a[href*="/shorts"]) {
    display: none !important;
}
/* Hiding Shorts Tab on Channel Pages */
yt-tab-shape[tab-title="Shorts"],
.yt-tab-shape-wiz__tab[aria-label="Shorts"],
a[href*="/shorts/"] {
    display: none !important;
}
/* Specific fix for sidebar links that might have escaped */
ytd-guide-entry-renderer a[href*="/shorts"],
ytd-mini-guide-entry-renderer a[href*="/shorts"] {
    display: none !important;
}
`;

const dayColors = [
  "#e11d48", // Today (Muted Red)
  "#ea580c", // -1 (Muted Orange)
  "#ca8a04", // -2 (Muted Yellow)
  "#16a34a", // -3 (Muted Green)
  "#0284c7", // -4 (Muted Blue)
  "#7c3aed", // -5 (Muted Purple)
  "#db2777", // -6 (Muted Pink)
];

const icons = {
  analytics: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
  history: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  delete: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  stats_toggle: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20v-4"></path></svg>`,
  settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  dislike: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2l3 4 3-4h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"></path><line x1="9" y1="8" x2="9" y2="12"></line><line x1="15" y1="8" x2="15" y2="12"></line></svg>`,
  backup: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
  download: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  restore: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>`,
  prev: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
  next: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
  calendar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
  chevron_down: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  chevron_up: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
  expand: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>`,
  pip: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M13 11l7 7"></path><path d="M20 11v7h-7"></path></svg>`,
  eye: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
};
