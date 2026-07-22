/**
 * Logic for hiding YouTube suggestions and centering the video player.
 */

const SUGGESTIONS_STYLE_ID = "ytt-hide-suggestions-style";

function applyHideSuggestionsState() {
  let styleEl = document.getElementById(SUGGESTIONS_STYLE_ID);

  if (!hideSuggestionsSettings.enabled) {
    if (styleEl) styleEl.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = SUGGESTIONS_STYLE_ID;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  // CSS to hide the sidebar and center the content
  // #secondary is the sidebar on watch page
  // #primary is the main column (video + comments)
  // ytd-watch-flexy is the main container
  const css = `
    /* Hide the secondary column (suggestions) */
    #secondary.ytd-watch-flexy,
    ytd-live-chat-frame#chat,
    #related.ytd-watch-flexy,
    #secondary-inner.ytd-watch-flexy {
      display: none !important;
      width: 0 !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Inform YouTube's layout system that sidebar is gone */
    ytd-watch-flexy {
      --ytd-watch-flexy-sidebar-width: 0px !important;
    }

    /* Center the columns container */
    ytd-watch-flexy #columns.ytd-watch-flexy {
      justify-content: center !important;
      max-width: 100% !important;
    }

    /* Center and constrain the primary column — reset native right padding from sidebar gap */
    #primary.ytd-watch-flexy {
      max-width: 1280px !important;
      min-width: 0 !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    /* Restore padding below the player (description, comments, etc.) */
    ytd-watch-flexy #below {
      padding-left: 16px !important;
      padding-right: 16px !important;
    }

    /* Center the player itself */
    #player-container-outer.ytd-watch-flexy,
    #player-container-inner.ytd-watch-flexy {
      margin-left: auto !important;
      margin-right: auto !important;
    }

    /* Prevent horizontal scrollbars on the page */
    html, body {
      overflow-x: hidden !important;
    }
  `;

  if (styleEl.textContent !== css) {
    styleEl.textContent = css;
  }
}

// === ZERO-LATENCY FAST PATH: hide suggestions before first paint ===
// Runs synchronously at document_start (before initState's async storage read
// resolves), so the "Hide Suggestions" layout is applied with no flicker or
// layout shift on hard reload / navigation via our own links.
try {
  const fastPath = localStorage.getItem("ytt_suggestions_fast_path");
  if (fastPath) {
    const cached = JSON.parse(fastPath);
    if (cached && cached.enabled) {
      hideSuggestionsSettings = { ...hideSuggestionsSettings, ...cached };
      applyHideSuggestionsState();
    }
  }
} catch (e) {}
