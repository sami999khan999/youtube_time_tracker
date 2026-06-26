// === Dislike Counter: Attribute Observation Version (Take 12) ===

const dislikeDataCache = {};
let pendingDislikeFetch = null;
let globalObserver = null;
let isDislikeInitialized = false;

// Registry to prevent duplicate observers on buttons
const buttonObservers = new WeakMap();

function getVideoId() {
  const watchFlexy = document.querySelector("ytd-watch-flexy");
  if (watchFlexy && watchFlexy.getAttribute("video-id")) {
    return watchFlexy.getAttribute("video-id");
  }
  const urlParams = new URLSearchParams(window.location.search);
  const v = urlParams.get("v");
  if (v) return v;
  const pathParts = window.location.pathname.split("/");
  if (pathParts[1] === "shorts") return pathParts[2];
  return null;
}

function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

/**
 * Recursive helper to find ALL elements inside Shadow DOM.
 */
function findAllDeep(selector, root = document, results = []) {
    const nodes = root.querySelectorAll(selector);
    nodes.forEach(n => results.push(n));

    const walkers = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walkers.nextNode();
    while (node) {
        if (node.shadowRoot) {
            findAllDeep(selector, node.shadowRoot, results);
        }
        node = walkers.nextNode();
    }
    return results;
}

function isButtonInComment(btn) {
    let curr = btn;
    while (curr && curr !== document.body) {
        const name = curr.nodeName || "";
        if (name.includes("COMMENT")) return true;
        
        if (curr.parentNode instanceof ShadowRoot) {
            curr = curr.parentNode.host;
        } else {
            curr = curr.parentElement;
        }
    }
    return false;
}

function findDislikeButton() {
    const selectors = [
        "yt-animated-action-button-view-model:nth-child(2) button",
        "dislike-button-view-model button",
        "#segmented-dislike-button button",
        "ytd-dislike-button-renderer button"
    ];

    for (const sel of selectors) {
        const matches = findAllDeep(sel);
        const visibleBtn = matches.find(btn => {
            if (!isElementVisible(btn)) return false;
            if (isButtonInComment(btn)) return false;

            const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
            const title = (btn.getAttribute("title") || "").toLowerCase();
            return ariaLabel.includes("dislike") || title.includes("dislike");
        });
        if (visibleBtn) return visibleBtn;
    }
    return null;
}

function findLikeButton() {
    const selectors = [
        "yt-animated-action-button-view-model:nth-child(1) button",
        "like-button-view-model button",
        "#segmented-like-button button",
        "ytd-like-button-renderer button"
    ];

    for (const sel of selectors) {
        const matches = findAllDeep(sel);
        const visibleBtn = matches.find(btn => {
            if (!isElementVisible(btn)) return false;
            if (isButtonInComment(btn)) return false;

            const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
            const title = (btn.getAttribute("title") || "").toLowerCase();
            return (ariaLabel.includes("like") || title.includes("like")) && !ariaLabel.includes("dislike");
        });
        if (visibleBtn) return visibleBtn;
    }
    return null;
}

function findTextSlot(button) {
    if (!button) return null;
    const root = button.shadowRoot || button;
    return root.querySelector(".yt-core-attributed-string, .yt-spec-button-shape-next__button-text-content");
}

function formatDislikeCount(count) {
  if (count >= 1000000) {
    const val = count / 1000000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "M";
  }
  if (count >= 1000) {
    const val = count / 1000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "K";
  }
  return count.toString();
}

async function fetchDislikeCount(videoId) {
  return new Promise((resolve) => {
    safeSendMessage({ action: "GET_DISLIKE_COUNT", videoId }, (data) => {
      resolve(data);
    });
  });
}

/**
 * Initialize global listeners once.
 */
function initDislikeCounter() {
    if (isDislikeInitialized) return;
    isDislikeInitialized = true;

    // YouTube SPA navigation hook
    window.addEventListener("yt-navigate-finish", () => {
        console.log("YTT: [Dislike] SPA Navigation detected.");
        setTimeout(tryRenderDislike, 500); 
    });

    console.log("YTT: [Dislike] System initialized.");
}

function isDislikedState(btn) {
    if (!btn) return false;
    const ariaPressed = btn.getAttribute("aria-pressed") === "true";
    const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
    
    // Check for various ways YouTube signals an active state
    const isLabelActive = ariaLabel.includes("remove") || ariaLabel.includes("disliked");
    const hasActiveClass = btn.classList.contains("yt-spec-button-shape-next--active");
    return ariaPressed || hasActiveClass || isLabelActive;
}

function observeButtonStates(videoId, dislikeBtn, likeBtn) {
    if (!dislikeBtn || !likeBtn) return;
    
    // Cleanup old observers/listeners
    const cleanup = (btn) => {
        const obs = buttonObservers.get(btn);
        if (obs) {
            if (obs.disconnect) obs.disconnect();
            if (obs.clickHandler && btn.removeEventListener) {
                btn.removeEventListener("click", obs.clickHandler);
            }
            buttonObservers.delete(btn);
        }
    };

    cleanup(dislikeBtn);
    cleanup(likeBtn);

    const updateCount = () => {
        const data = dislikeDataCache[videoId];
        if (!data) return;

        const currentState = isDislikedState(dislikeBtn);
        const lastKnownState = dislikeBtn.dataset.yttWasDisliked === "true";

        if (currentState !== lastKnownState) {
            if (currentState) {
                data.dislikes++;
                console.log("YTT: [Dislike] State change: Disliked (+1)");
            } else {
                data.dislikes--;
                console.log("YTT: [Dislike] State change: Un-disliked (-1)");
            }
            dislikeBtn.dataset.yttWasDisliked = currentState;
            doRender(data, videoId, dislikeBtn);
        }
    };

    // 1. Mutation Observer for attribute changes
    const observer = new MutationObserver(updateCount);
    const config = { attributes: true, attributeFilter: ["aria-pressed", "aria-label", "class"] };
    observer.observe(dislikeBtn, config);
    observer.observe(likeBtn, config);

    // 2. Click listeners for immediate response (sometimes attributes lag)
    const handleClick = () => {
        // Small delay to let YouTube's internal state update
        setTimeout(updateCount, 50);
        setTimeout(updateCount, 250); // Second check for slow UI updates
    };

    dislikeBtn.addEventListener("click", handleClick);
    likeBtn.addEventListener("click", handleClick);

    // Store for future cleanup
    const record = { disconnect: () => observer.disconnect(), clickHandler: handleClick };
    buttonObservers.set(dislikeBtn, record);
    buttonObservers.set(likeBtn, record);
}

function tryRenderDislike() {
  if (!dislikeCountSettings || !dislikeCountSettings.enabled) return;
  
  initDislikeCounter();

  const videoId = getVideoId();
  if (!videoId) return;

  const dislikeBtn = findDislikeButton();
  const likeBtn = findLikeButton();
  if (!dislikeBtn) return;

  // Check if already rendered for this video (check both native slot and custom label)
  if (dislikeBtn.dataset.yttDislikeVideo === videoId) {
      const root = dislikeBtn.shadowRoot || dislikeBtn;
      const hasNativeSlot = root.querySelector("[data-ytt-dislike]");
      const hasCustomLabel = root.querySelector(".ytt-hijacked-label");
      if (hasNativeSlot || hasCustomLabel) return;
  }

  if (dislikeDataCache[videoId]) {
     const data = dislikeDataCache[videoId];
     dislikeBtn.dataset.yttWasDisliked = isDislikedState(dislikeBtn);
     doRender(data, videoId, dislikeBtn);
     observeButtonStates(videoId, dislikeBtn, likeBtn);
  } else if (pendingDislikeFetch !== videoId) {
     pendingDislikeFetch = videoId;
     fetchDislikeCount(videoId).then(data => {
         pendingDislikeFetch = null;
         if (data) {
             dislikeDataCache[videoId] = data;
             const currentDislikeBtn = findDislikeButton();
             const currentLikeBtn = findLikeButton();
             if (currentDislikeBtn) {
                 currentDislikeBtn.dataset.yttWasDisliked = isDislikedState(currentDislikeBtn);
                 doRender(data, videoId, currentDislikeBtn);
                 observeButtonStates(videoId, currentDislikeBtn, currentLikeBtn);
             }
         }
     });
  }
}

function doRender(data, videoId, btn) {
    if (!btn || isButtonInComment(btn)) return;

    const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
    const title = (btn.getAttribute("title") || "").toLowerCase();
    if (!ariaLabel.includes("dislike") && !title.includes("dislike")) return;

    const countText = formatDislikeCount(data.dislikes);
    const root = btn.shadowRoot || btn;
    const isShorts = window.location.pathname.includes("/shorts");

    // Clean up any previously injected custom spans
    root.querySelectorAll(".ytt-hijacked-label").forEach(l => l.remove());
    btn.querySelectorAll(".ytt-hijacked-label").forEach(l => l.remove());

    // === Strategy: Use YouTube's native text slot (like Return YouTube Dislike) ===
    // YouTube's button has a built-in text area that is hidden for the dislike button.
    // By setting its content and switching the button from "icon-only" to "icon+text"
    // mode, YouTube's own CSS handles all sizing, spacing, and positioning natively.
    const textContainer = root.querySelector(
        ".yt-spec-button-shape-next__button-text-content"
    );

    if (textContainer && !isShorts) {
        // Set the count text directly into YouTube's native text slot
        textContainer.textContent = countText;
        textContainer.style.setProperty("display", "block", "important");
        textContainer.setAttribute("data-ytt-dislike", "true");

        // Switch button from icon-only to icon+text mode
        // This makes YouTube's CSS properly size and space the button
        if (btn.classList.contains("yt-spec-button-shape-next--icon-button")) {
            btn.classList.remove("yt-spec-button-shape-next--icon-button");
            btn.classList.add("yt-spec-button-shape-next--icon-leading");
            btn.setAttribute("data-ytt-class-swapped", "true");
        }

        btn.dataset.yttDislikeVideo = videoId;
        setupObserver();
        return;
    }

    // === Fallback for Shorts or non-standard layouts ===
    const icon = root.querySelector("yt-icon, svg, .yt-spec-button-shape-next__icon");
    if (!icon) {
        setTimeout(() => {
            if (dislikeCountSettings && dislikeCountSettings.enabled) {
                const retryBtn = findDislikeButton();
                if (retryBtn) doRender(data, videoId, retryBtn);
            }
        }, 300);
        return;
    }

    const label = document.createElement("span");
    label.className = "ytt-hijacked-label";
    label.textContent = countText;
    icon.insertAdjacentElement("afterend", label);

    const parent = icon.parentElement;
    if (parent && parent.nodeType === 1) {
        parent.style.setProperty("display", "flex", "important");
        parent.style.setProperty("flex-direction", isShorts ? "column" : "row", "important");
        parent.style.setProperty("align-items", "center", "important");
        parent.style.setProperty("overflow", "visible", "important");
    }

    icon.style.setProperty("flex-shrink", "0", "important");

    label.style.cssText = isShorts
        ? `
            display: block !important;
            margin-top: 4px !important;
            font-family: inherit !important;
            font-size: 12px !important;
            font-weight: 500 !important;
            line-height: 1 !important;
            color: inherit !important;
            white-space: nowrap !important;
            pointer-events: none !important;
          `
        : `
            display: inline-block !important;
            margin-left: 6px !important;
            font-family: inherit !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            line-height: normal !important;
            color: inherit !important;
            white-space: nowrap !important;
            pointer-events: none !important;
          `;

    btn.dataset.yttDislikeVideo = videoId;
    setupObserver();
}

function setupObserver() {
    if (globalObserver) return;
    
    globalObserver = new MutationObserver((mutations) => {
        const isSelfMutation = mutations.every(m => {
            const target = m.target;
            return target.nodeType === 1 && (
                target.classList.contains("ytt-hijacked-label") || 
                target.closest?.(".ytt-hijacked-label") ||
                target.hasAttribute?.("data-ytt-dislike")
            );
        });

        if (!isSelfMutation) {
            tryRenderDislike();
        }
    });

    globalObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function applyDislikeCountState() {
    if (dislikeCountSettings.enabled) {
        tryRenderDislike();
    } else {
        removeDislikeCount();
    }
}

function removeDislikeCount() {
    // Remove custom labels
    document.querySelectorAll(".ytt-hijacked-label").forEach(l => l.remove());

    // Restore YouTube's native text containers we modified
    document.querySelectorAll("[data-ytt-dislike]").forEach(el => {
        el.textContent = "";
        el.style.removeProperty("display");
        el.removeAttribute("data-ytt-dislike");
    });

    // Restore button classes on dislike buttons with our class swap
    document.querySelectorAll("[data-ytt-class-swapped]").forEach(btn => {
        btn.classList.remove("yt-spec-button-shape-next--icon-leading");
        btn.classList.add("yt-spec-button-shape-next--icon-button");
        btn.removeAttribute("data-ytt-class-swapped");
        delete btn.dataset.yttDislikeVideo;
    });

    if (globalObserver) {
        globalObserver.disconnect();
        globalObserver = null;
    }
}
