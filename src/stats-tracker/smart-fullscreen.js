// === Floating Player: Native Picture-in-Picture Implementation ===

function setupSmartFullscreen() {
  // We keep the function name for compatibility with bootstrap.js

  // Initial check
  applyFloatingPlayerState();
}

function applyFloatingPlayerState() {
  if (!smartFullscreenSettings.enabled) {
    removeFloatingButton();
    return;
  }

  const controls =
    document.querySelector(".ytp-right-controls") ||
    document.querySelector(".ytp-chrome-controls");

  if (!controls || document.getElementById("ytt-floating-btn")) return;

  const btn = document.createElement("button");
  btn.id = "ytt-floating-btn";
  btn.className = "ytp-button";
  btn.innerHTML = icons.pip;
  btn.style.verticalAlign = "top";

  // Custom Tooltip Logic
  btn.onmouseenter = () => showPlayerTooltip(btn, "Floating Mode (YTT)");
  btn.onmouseleave = () => hidePlayerTooltip();

  btn.onclick = (e) => {
    e.preventDefault();
    toggleNativePiP();
  };

  // Insert at the beginning of right controls
  controls.insertBefore(btn, controls.firstChild);
}

function showPlayerTooltip(target, text) {
  let tooltip = document.getElementById("ytt-player-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "ytt-player-tooltip";
    tooltip.className = "ytt-player-tooltip";
    document.body.appendChild(tooltip);
  }

  tooltip.innerText = text;

  // Position: centered above the button, moved significantly higher
  const rect = target.getBoundingClientRect();
  tooltip.style.left = rect.left + rect.width / 2 + "px";
  tooltip.style.top = rect.top - 48 + "px";
  tooltip.classList.add("visible");
}

function hidePlayerTooltip() {
  const tooltip = document.getElementById("ytt-player-tooltip");
  if (tooltip) tooltip.classList.remove("visible");
}

function removeFloatingButton() {
  const btn = document.getElementById("ytt-floating-btn");
  if (btn) btn.remove();

  // If in PiP, exit it
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture().catch(() => {});
  }
}

let isTogglingPiP = false;

async function toggleNativePiP() {
  if (isTogglingPiP) return;
  isTogglingPiP = true;

  try {
    const video = document.querySelector("video");
    if (!video) {
      console.warn("YTT: No video element found for PiP toggle.");
      return;
    }

    // Exiting PiP
    if (document.pictureInPictureElement) {
      console.log("YTT: Exiting Picture-in-Picture mode...");
      try {
        await document.exitPictureInPicture();
        // Ensure the video is brought back into view ("bring it back up")
        video.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (err) {
        console.error("YTT: Failed to exit Picture-in-Picture:", err);
      }
    }
    // Entering PiP
    else if (document.pictureInPictureEnabled) {
      console.log("YTT: Entering Picture-in-Picture mode...");
      try {
        await video.requestPictureInPicture();
        // Ensure we handle when the user closes the PiP window manually
        video.addEventListener(
          "leavepictureinpicture",
          () => {
            console.log("YTT: Left Picture-in-Picture");
          },
          { once: true },
        );
      } catch (err) {
        // Common error cases:
        // - NotAllowedError: requires user interaction (e.g., video not playing, or permission denied)
        // - NotSupportedError: video element in a cross-origin context
        // - InvalidStateError: video element in fullscreen or has an invalid state
        const errorName = err.name || "Unknown";
        if (errorName === "NotAllowedError") {
          console.warn(
            "YTT: PiP denied. Video may need to be playing, or permission was denied.",
          );
        } else if (errorName === "InvalidStateError") {
          console.warn(
            "YTT: PiP failed. Video element is in an invalid state (e.g., fullscreen, hidden, or cross-origin).",
          );
        } else {
          console.error(`YTT: Failed to enter Picture-in-Picture (${errorName}):`, err);
        }
      }
    } else {
      console.warn(
        "YTT: Picture-in-Picture is not supported in this browser or context.",
      );
    }
  } catch (err) {
    console.error("YTT: Unexpected error during PiP toggle:", err);
  } finally {
    // Release the lock after a short delay to prevent double-triggering from multiple sources (keydown + command)
    setTimeout(() => {
      isTogglingPiP = false;
    }, 500);
  }
}

// Attach to window for shortcut access
window.toggleNativePiP = toggleNativePiP;

function isWindowSystemFullscreen() {
  return false;
} // Stub for compatibility
