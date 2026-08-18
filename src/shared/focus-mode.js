/**
 * @file focus-mode.js
 * @description Focus Mode — reduces a watch page to the video alone.
 *
 * All the styling lives in settings/focus-mode.css, which ships inside
 * dist/content.css and is therefore loaded by the browser at document_start,
 * before first paint. This module only has to flip one attribute on <html> —
 * an element that already exists when a content script first runs and that
 * YouTube never rebuilds — so the stripped-down layout is in place on the very
 * first frame of a hard reload and survives SPA navigation untouched.
 *
 * Nothing here resizes or repositions the player. Focus Mode hides the page
 * around the video; the video itself keeps the size YouTube gave it. That is
 * why this module dispatches no synthetic resize — doing so would invite the
 * player to remeasure and change the frame the user asked us to leave alone.
 *
 * Mirrors the page-dimmer fast path in shared/state.js.
 */

const FOCUS_MODE_ATTR = "data-ytt-focus";

/**
 * Focus mode only makes sense on a watch page — on the feed it would hide the
 * masthead and leave the user with nothing to navigate with. Checked here in
 * JS rather than in a CSS selector because `location.pathname` is readable
 * synchronously at document_start, while the DOM markers that identify a watch
 * page (ytd-watch-flexy) have not been parsed yet.
 */
function isFocusEligiblePage() {
  return window.location.pathname === "/watch";
}

/**
 * Applies or clears the focus-mode attribute for the current page.
 *
 * Safe to call on every navigation event — it early-returns when the attribute
 * already matches the desired state, so the repeated calls from bootstrap's
 * yt-navigate-finish / yt-page-data-updated handlers cost nothing.
 */
function applyFocusModeState() {
  const root = document.documentElement;
  if (!root) return;

  const shouldApply =
    typeof focusModeSettings !== "undefined" &&
    !!focusModeSettings.enabled &&
    isFocusEligiblePage();
  const isApplied = root.hasAttribute(FOCUS_MODE_ATTR);

  if (shouldApply === isApplied) return;

  if (shouldApply) {
    root.setAttribute(FOCUS_MODE_ATTR, "");
  } else {
    root.removeAttribute(FOCUS_MODE_ATTR);
  }
}

// === ZERO-LATENCY FAST PATH: enter focus mode before first paint ===
// Runs synchronously at document_start (before initState's async storage read
// resolves), so a hard reload of a watch URL never flashes the masthead,
// comments and suggestions in before we strip them.
try {
  const fastPath = localStorage.getItem("ytt_focus_fast_path");
  if (fastPath) {
    const cached = JSON.parse(fastPath);
    if (cached && cached.enabled) {
      focusModeSettings = { ...focusModeSettings, ...cached };
      applyFocusModeState();
    }
  }
} catch (e) {}
