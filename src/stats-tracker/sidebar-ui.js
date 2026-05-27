// === Stats Sidebar UI: Toggle button, sidebar creation, drag & resize ===
const SCROLLBAR_PADDING = 30;

function injectStatsUI() {
  if (!document.body) return;
  if (document.getElementById("stats-toggle-btn")) return;

  // Tooltip (Global sibling of sidebar)
  if (!document.getElementById("stats-tooltip")) {
    const tooltip = document.createElement("div");
    tooltip.id = "stats-tooltip";
    tooltip.className = "stats-tooltip";
    document.body.appendChild(tooltip);
  }

  // Load position first to avoid "jump" during navigation
  safeStorageGet("ytt_toggle_pos", (data) => {
    if (document.getElementById("stats-toggle-btn")) return;

    // Toggle Button
    const btn = document.createElement("div");
    btn.id = "stats-toggle-btn";
    btn.innerHTML = `
            ${icons.stats_toggle}
            <span id="stats-timer-badge" class="stats-timer-badge" style="display: none;"></span>
        `;
    btn.title = "YouTube Stats Tracker (Drag to Move)";

    const savedPos = data.ytt_toggle_pos || null;

    // Apply saved position BEFORE appending to DOM to prevent flash
    applyPosition(btn, savedPos);
    document.body.appendChild(btn);

    // Events and initialization
    setupSidebarLogic(btn);
  });
}

/**
 * Applies position to the button. Always uses `left` for horizontal
 * placement so the CSS spring transition works correctly.
 */
function applyPosition(btn, savedPos) {
  const padding = 10;
  const btnSize = 54; // matches CSS width/height

  let { top, snapped } = savedPos || {};

  // Default values
  let topNum = parseInt(top, 10);
  if (isNaN(topNum)) topNum = 80;

  // Vertical boundary
  const maxTop = window.innerHeight - btnSize - padding;
  topNum = Math.max(padding, Math.min(maxTop, topNum));

  // Horizontal: always use `left` so CSS transition animates the spring
  let leftNum;
  if (snapped === "right") {
    leftNum = window.innerWidth - btnSize - SCROLLBAR_PADDING;
  } else {
    leftNum = padding;
    snapped = "left";
  }

  btn.style.top = topNum + "px";
  btn.style.left = leftNum + "px";
  btn.style.bottom = "auto";
  btn.style.right = "auto";

  return { top: topNum, snapped };
}

function setupSidebarLogic(btn) {
  const dragStatus = { isDragging: false };
  let currentSnapped = "right"; // default

  // Read initial snapped state from storage
  safeStorageGet("ytt_toggle_pos", (data) => {
    if (data.ytt_toggle_pos && data.ytt_toggle_pos.snapped) {
      currentSnapped = data.ytt_toggle_pos.snapped;
    }
  });

  // On resize/fullscreen: re-read saved position from storage then re-apply
  const handleViewportChange = () => {
    safeStorageGet("ytt_toggle_pos", (data) => {
      const result = applyPosition(btn, data.ytt_toggle_pos || null);
      currentSnapped = result.snapped;
    });
  };

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleViewportChange, 150);
  });

  document.addEventListener("fullscreenchange", handleViewportChange);
  document.addEventListener("webkitfullscreenchange", handleViewportChange);

  let startX, startY, btnStartX, btnStartY;

  btn.onmousedown = (e) => {
    dragStatus.isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = btn.getBoundingClientRect();
    btnStartX = rect.left;
    btnStartY = rect.top;

    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragStatus.isDragging = true;
        btn.classList.add("dragging");

        let newLeft = btnStartX + dx;
        let newTop = btnStartY + dy;

        // Boundary Constraints
        const padding = 10;
        newLeft = Math.max(
          padding,
          Math.min(window.innerWidth - btn.offsetWidth - padding, newLeft),
        );
        newTop = Math.max(
          padding,
          Math.min(window.innerHeight - btn.offsetHeight - padding, newTop),
        );

        btn.style.left = newLeft + "px";
        btn.style.top = newTop + "px";
        btn.style.bottom = "auto";
        btn.style.right = "auto";
      }
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      if (dragStatus.isDragging) {
        btn.classList.remove("dragging");

        // Springy Edge Snapping — uses `left` so the CSS transition animates
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const padding = 10;
        let snapped;

        if (centerX < window.innerWidth / 2) {
          btn.style.left = padding + "px";
          snapped = "left";
        } else {
          btn.style.left =
            window.innerWidth - rect.width - SCROLLBAR_PADDING + "px";
          snapped = "right";
        }

        currentSnapped = snapped;

        // Save state
        setTimeout(() => {
          safeStorageSet({
            ytt_toggle_pos: {
              top: btn.style.top,
              snapped: snapped,
            },
          });
          // Reset dragging status AFTER the click event has a chance to fire
          dragStatus.isDragging = false;
        }, 200);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Sidebar
  const sidebar = document.createElement("div");
  sidebar.id = "stats-sidebar";
  sidebar.setAttribute("tabindex", "-1"); // Allow focus for keyboard control
  sidebar.style.outline = "none"; // Hide focus ring

  // Load and Apply Persisted Width from storage
  safeStorageGet("ytt_sidebar_width", (data) => {
    if (data.ytt_sidebar_width) {
      sidebar.style.width = data.ytt_sidebar_width + "px";
    }
  });

  // Add Resizer Handle
  const resizer = document.createElement("div");
  resizer.className = "sidebar-resizer";
  sidebar.appendChild(resizer);

  // Resizing Logic
  let isResizing = false;
  resizer.onmousedown = (e) => {
    e.preventDefault(); // Prevent text selection start
    isResizing = true;
    document.body.classList.add("yt-shorts-resizing-active");
    sidebar.classList.add("resizing");
    resizer.classList.add("active");

    const startX = e.clientX;
    const startWidth = parseInt(getComputedStyle(sidebar).width, 10);

    const onMouseMove = (moveEvent) => {
      if (!isResizing) return;
      const currentX = moveEvent.clientX;
      const delta = startX - currentX; // Moving left increases width
      let newWidth = startWidth + delta;

      // Constraints
      newWidth = Math.max(300, Math.min(800, newWidth));
      sidebar.style.width = newWidth + "px";
    };

    const onMouseUp = () => {
      isResizing = false;
      document.body.classList.remove("yt-shorts-resizing-active");
      sidebar.classList.remove("resizing");
      resizer.classList.add("active");
      safeStorageSet({
        ytt_sidebar_width: parseInt(sidebar.style.width, 10),
      });
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // Insert sidebar HTML template
  sidebar.insertAdjacentHTML("beforeend", getSidebarHTML());
  document.body.appendChild(sidebar);

  // Bind all events (filters, navigation, settings, open/close)
  bindSidebarEvents(sidebar, btn, dragStatus);
}
