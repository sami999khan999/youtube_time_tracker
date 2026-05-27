// === Break Reminder: Quote fetching, modal, and timer ===

async function fetchZenQuote() {
  return new Promise((resolve) => {
    safeSendMessage({ action: "FETCH_QUOTE" }, (response) => {
      if (response && response.text) {
        resolve(response);
      } else {
        // Randomized local fallbacks if message fails
        const fallbacks = [
          {
            text: "The secret of getting ahead is getting started.",
            author: "Mark Twain",
          },
          {
            text: "It does not matter how slowly you go as long as you do not stop.",
            author: "Confucius",
          },
          {
            text: "Everything you've ever wanted is on the other side of fear.",
            author: "George Addair",
          },
        ];
        resolve(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
      }
    });
  });
}

function showBreakModal(quote) {
  if (document.getElementById("break-reminder-modal")) return;

  // Default fallback if quote failed
  const finalQuote = quote || {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
  };

  const overlay = document.createElement("div");
  overlay.id = "break-reminder-modal";
  overlay.className = "break-modal-overlay";
  // Accessibility: Role and Aria
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "break-modal-title");

  overlay.innerHTML = `
        <div class="break-modal">
            <div class="modal-drag-handle"></div>
            <div class="break-modal-icon">☕</div>
            <h2 id="break-modal-title" class="break-modal-title">Time for a Break!</h2>
            <p class="break-modal-subtitle">You've been watching for ${
              breakSettings.intervalValue
            } ${
              breakSettings.intervalUnit === "seconds" ? "seconds" : "minutes"
            } straight.</p>
            <blockquote class="break-modal-quote">
                <p>"${finalQuote.text}"</p>
                <cite>— ${finalQuote.author}</cite>
            </blockquote>
            <div class="break-modal-actions">
                <button id="break-keep-watching" class="break-btn secondary">Keep Watching</button>
                <button id="break-go-work" class="break-btn primary">Go to Work</button>
            </div>
        </div>
    `;
  document.body.appendChild(overlay);

  // Prevent background scroll and selection
  document.body.style.overflow = "hidden";
  document.body.style.userSelect = "none";

  const modal = overlay.querySelector(".break-modal");
  const keepWatchingBtn = document.getElementById("break-keep-watching");
  const goWorkBtn = document.getElementById("break-go-work");

  // Focus the first action button
  setTimeout(() => keepWatchingBtn.focus(), 100);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add("visible");
    if (typeof isolateModal === "function") isolateModal(overlay);
  });

  // Swipe to Dismiss (Mobile)
  let touchStartY = 0;
  let currentY = 0;
  let isSwiping = false;

  modal.addEventListener(
    "touchstart",
    (e) => {
      if (window.innerWidth > 600) return;
      touchStartY = e.touches[0].clientY;
      modal.style.transition = "none";
      isSwiping = true;
    },
    { passive: true },
  );

  modal.addEventListener(
    "touchmove",
    (e) => {
      if (!isSwiping) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - touchStartY;

      if (deltaY > 0) {
        // Only allow swiping down
        modal.style.transform = `translateY(${deltaY}px)`;
      }
    },
    { passive: true },
  );

  modal.addEventListener("touchend", () => {
    if (!isSwiping) return;
    isSwiping = false;
    modal.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)";

    const deltaY = currentY - touchStartY;
    if (deltaY > 120) {
      // Dismiss
      dismissModal();
    } else {
      // Snap back
      modal.style.transform = "translateY(0)";
    }
  });

  const dismissModal = () => {
    overlay.classList.remove("visible");
    document.body.style.overflow = ""; // Restore scroll
    document.body.style.userSelect = ""; // Restore selection

    if (window.innerWidth <= 600) {
      modal.style.transform = "translateY(100%)";
    }
    if (typeof restoreIsolation === "function") restoreIsolation();
    setTimeout(() => overlay.remove(), 400);
    continuousWatchStart = Date.now(); // Reset timer
    breakModalShown = false;
    preFetchedQuote = null; // Clear pre-fetched for next cycle

    // Resume video playback
    const video = document.querySelector("video");
    if (video) video.play();
  };

  // Accessibility: Click outside to close
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      dismissModal();
    }
  };

  // Accessibility: Focus Trap (Tab behavior)
  overlay.onkeydown = (e) => {
    if (e.key === "Tab") {
      const focusables = [keepWatchingBtn, goWorkBtn];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        // Tab
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
    if (e.key === "Escape") {
      dismissModal();
    }
  };

  if (keepWatchingBtn) {
    keepWatchingBtn.onclick = (e) => {
      e.stopPropagation();
      dismissModal();
    };
  }

  if (goWorkBtn) {
    goWorkBtn.onclick = () => {
      window.location.href = breakSettings.workUrl || "https://www.google.com";
    };
  }
}

function updateTimerBadge(remainingMinutes) {
  const badge = document.getElementById("stats-timer-badge");
  if (!badge) return;

  if (!breakSettings.enabled || remainingMinutes <= 0 || breakModalShown) {
    badge.style.display = "none";
    return;
  }

  badge.style.display = "block";
  badge.style.background = "#0f0f0f";

  if (remainingMinutes >= 52560000) { // 100 years
    badge.textContent = `${Math.round(remainingMinutes / 52560000)}cen`;
  } else if (remainingMinutes >= 5256000) { // 10 years
    badge.textContent = `${Math.round(remainingMinutes / 5256000)}dec`;
  } else if (remainingMinutes >= 525600) { // 1 year
    badge.textContent = `${Math.round(remainingMinutes / 525600)}y`;
  } else if (remainingMinutes >= 43200) { // 30 days
    badge.textContent = `${Math.round(remainingMinutes / 43200)}mo`;
  } else if (remainingMinutes >= 10080) { // 7 days
    badge.textContent = `${Math.round(remainingMinutes / 10080)}w`;
  } else if (remainingMinutes >= 1440) { // 1 day
    badge.textContent = `${Math.round(remainingMinutes / 1440)}d`;
  } else if (remainingMinutes >= 60) { // 1 hour
    badge.textContent = `${Math.round(remainingMinutes / 60)}h`;
  } else if (remainingMinutes >= 1) { // 1 minute
    badge.textContent = `${Math.round(remainingMinutes)}m`;
  } else { // Seconds
    badge.textContent = `${Math.round(remainingMinutes * 60)}s`;
    badge.style.background = "#FF0033"; // High urgency
  }
}

function checkBreakReminder() {
  if (!breakSettings.enabled) {
    updateTimerBadge(0);
    return;
  }

  const video = document.querySelector("video");
  if (!video || video.paused) {
    continuousWatchStart = null;
    breakModalShown = false;
    updateTimerBadge(0);
    return;
  }

  if (!continuousWatchStart) {
    continuousWatchStart = Date.now();
    return;
  }

  const elapsed = (Date.now() - continuousWatchStart) / 1000 / 60; // minutes
  let intervalMinutes;
  if (breakSettings.intervalUnit === "hours") {
    intervalMinutes = breakSettings.intervalValue * 60;
  } else if (breakSettings.intervalUnit === "seconds") {
    intervalMinutes = breakSettings.intervalValue / 60;
  } else {
    intervalMinutes = breakSettings.intervalValue;
  }
  
  // Pre-fetch quote 5 seconds before the interval (5/60 minutes)
  const preFetchThreshold = intervalMinutes - 5 / 60;
  if (elapsed >= preFetchThreshold && !preFetchedQuote && !isFetchingQuote) {
    isFetchingQuote = true;
    fetchZenQuote().then((quote) => {
      preFetchedQuote = quote;
      isFetchingQuote = false;
    });
  }

  if (elapsed >= intervalMinutes && !breakModalShown) {
    // Don't show if sidebar is open
    const sidebar = document.getElementById("stats-sidebar");
    if (sidebar && sidebar.classList.contains("open")) return;

    breakModalShown = true;
    video.pause();
    showBreakModal(preFetchedQuote);
    updateTimerBadge(0);
  } else {
    updateTimerBadge(intervalMinutes - elapsed);
  }
}
// }
