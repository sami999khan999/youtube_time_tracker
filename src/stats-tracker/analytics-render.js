// === Analytics Rendering: Bar chart, pie chart, heatmaps, insights ===

let selectedHeatmapYear = "Last 365 Days";

function renderAnalyticsView() {
  const data = getFilteredAnalyticsData();

  // Update Overview Stats
  updateAnalyticsOverview(data);

  // Render Components
  renderMainTrendsChart(data);
  renderWatchDistribution(data);
  renderActivityHeatmap();
  renderDetailedInsights(data);
}

/**
 * Aggregates watch data based on the current global selectedDayFilter
 */
function getPeriodKeys(filter, offset = 0) {
  const now = new Date();
  let keys = [];

  if (filter === "today") {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    keys = [getDayKey(d)];
  } else if (filter === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1 - offset);
    keys = [getDayKey(d)];
  } else if (filter.endsWith("days")) {
    const daysCount = parseInt(filter);
    const startOffset = (offset + 1) * daysCount - 1;
    const endOffset = offset * daysCount;
    for (let i = startOffset; i >= endOffset; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      keys.push(getDayKey(d));
    }
  } else if (filter === "all") {
    if (offset === 0) {
      keys = Object.keys(allHistory).sort();
    } else {
      keys = [];
    }
  } else {
    // Specific date YYYY-MM-DD
    const dateParts = filter.split("-").map(Number);
    const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    d.setDate(d.getDate() - offset);
    keys = [getDayKey(d)];
  }
  return keys;
}

function isFutureDate(filter) {
  if (
    !filter ||
    filter === "today" ||
    filter === "yesterday" ||
    filter.endsWith("days") ||
    filter === "all"
  )
    return false;
  const dateParts = filter.split("-").map(Number);
  if (dateParts.length !== 3) return false;
  const selectedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selectedDate > today;
}

/**
 * Aggregates summary statistics for a given set of date keys.
 */
function getPeriodSummary(keys) {
  const stats = {
    totalTime: 0,
    activeDays: 0,
    videoCount: 0,
    topChannel: { name: "None", time: 0 },
  };
  const channelMap = {};

  keys.forEach((key) => {
    const d = allHistory[key];
    if (d && d.watchTime > 0) {
      stats.activeDays++;
      stats.totalTime += d.watchTime;
      stats.videoCount += d.videos ? d.videos.length : 0;
      (d.videos || []).forEach((v) => {
        const c = v.channelName || "Unknown";
        channelMap[c] = (channelMap[c] || 0) + (v.watchedDuration || 0);
        if (channelMap[c] > stats.topChannel.time) {
          stats.topChannel = { name: c, time: channelMap[c] };
        }
      });
    }
  });

  return stats;
}

/**
 * Aggregates watch data based on the current global selectedDayFilter
 */
function getFilteredAnalyticsData() {
  const result = {
    days: [], // { key, label, value, color }
    channels: [], // { label, value }
    totalWatchTime: 0,
    videoCounts: 0,
    averageWatchTime: 0,
    maxDay: { key: "", value: 0 },
  };

  const channelsMap = {};
  const keysToInclude = getPeriodKeys(selectedDayFilter, 0);

  keysToInclude.forEach((key, index) => {
    const dayData = allHistory[key] || {
      watchTime: 0,
      activeTime: 0,
      videos: [],
    };
    const val = dayData.watchTime;

    // Always show labels, but format shorter for larger ranges
    const [y, m, d] = key.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    let label = "";

    if (keysToInclude.length <= 14) {
      label = `${d} ${months[parseInt(m) - 1]}`;
    } else {
      label = `${d}/${m}`;
    }

    result.days.push({
      key,
      label,
      value: val,
      color: dayColors[index % dayColors.length],
      activeTime: dayData.activeTime || 0,
      videoCount: dayData.videos ? dayData.videos.length : 0,
      topVideos: [...(dayData.videos || [])]
        .sort((a, b) => (b.watchedDuration || 0) - (a.watchedDuration || 0))
        .slice(0, 3)
        .map((v) => v.title),
    });

    // Aggregate Channels
    (dayData.videos || []).forEach((v) => {
      const chan = v.channelName || "Unknown Channel";
      const duration = v.watchedDuration || 0;

      if (!channelsMap[chan]) {
        channelsMap[chan] = {
          value: 0,
          thumbnail: v.thumbnail,
          videos: new Map(), // Use Map to track duration per unique video
          topVideo: { title: v.title, duration: duration },
        };
      }

      channelsMap[chan].value += duration;

      // Track duration for this specific video ID to find top video
      const vidId = v.id || v.uid;
      const existingVidData = channelsMap[chan].videos.get(vidId) || {
        duration: 0,
        title: v.title,
      };
      existingVidData.duration += duration;
      channelsMap[chan].videos.set(vidId, existingVidData);

      // Update Top Video if this overall duration is higher
      if (existingVidData.duration > channelsMap[chan].topVideo.duration) {
        channelsMap[chan].topVideo = {
          title: existingVidData.title,
          duration: existingVidData.duration,
        };
      }

      // Prioritize Captured Channel Logo > Captured Video Thumbnail > Generated Fallback
      const thumbFallback = `https://i.ytimg.com/vi/${vidId}/default.jpg`;
      const logo = v.channelThumb || v.thumbnail || thumbFallback;

      // Only update if we don't have a logo yet, or if we have a real channelThumb now
      const isRealLogo = v.channelThumb && !v.channelThumb.startsWith("data:");
      if (!channelsMap[chan].thumbnail || isRealLogo) {
        channelsMap[chan].thumbnail = logo;
      }
    });

    result.totalWatchTime += val;
    result.videoCounts += dayData.videos ? dayData.videos.length : 0;

    if (val > result.maxDay.value) {
      result.maxDay = { key, value: val };
    }
  });

  result.averageWatchTime =
    keysToInclude.length > 0 ? result.totalWatchTime / keysToInclude.length : 0;

  // Sort and finalize channels
  result.channels = Object.entries(channelsMap)
    .map(([label, info]) => ({
      label,
      value: info.value,
      videoCount: info.videos.size,
      thumbnail: info.thumbnail,
      topVideo: info.topVideo.title,
      avgTime: info.value / info.videos.size,
    }))
    .sort((a, b) => b.value - a.value);

  return result;
}

function updateAnalyticsOverview(data) {
  const totalEl = document.getElementById("analytics-total-time");
  const avgEl = document.getElementById("analytics-avg-time");
  const periodEl = document.getElementById("trends-period-label");

  if (totalEl) totalEl.textContent = formatTimeShort(data.totalWatchTime);
  if (avgEl) avgEl.textContent = formatTimeShort(data.averageWatchTime);

  if (periodEl) {
    if (selectedDayFilter === "today") periodEl.textContent = "Today";
    else if (selectedDayFilter === "yesterday")
      periodEl.textContent = "Yesterday";
    else if (selectedDayFilter.endsWith("days"))
      periodEl.textContent = `Last ${parseInt(selectedDayFilter)} Days`;
    else if (selectedDayFilter === "all") periodEl.textContent = "All Time";
    else periodEl.textContent = selectedDayFilter;
  }
}

function formatTimeShort(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function renderMainTrendsChart(data) {
  const chartContainer = document.getElementById("stats-chart");
  if (!chartContainer) return;

  if (data.days.length === 0) {
    const isFuture = isFutureDate(selectedDayFilter);
    chartContainer.innerHTML = `<div class="no-data-msg">${isFuture ? "Future Date - No activity yet" : "No data for this period"}</div>`;
    return;
  }

  const maxValue = Math.max(...data.days.map((d) => d.value), 3600); // at least 1hr scale

  chartContainer.innerHTML = data.days
    .map((d) => {
      const height = Math.max(4, (d.value / maxValue) * 100);
      const isActive = d.key === getDayKey(new Date());

      // Construct Rich Tooltip HTML
      const [y, m, day] = d.key.split("-");
      const dateObj = new Date(y, m - 1, day);
      const dateStr = dateObj.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });

      let tooltipContent = `
            <div class="tooltip-date">${dateStr}</div>
            <div class="tooltip-stat-row">
                <span class="tooltip-stat-label">Watch Time</span>
                <span class="tooltip-stat-value">${formatTime(Math.round(d.value))}</span>
            </div>
        `;

      if (d.activeTime > 0) {
        tooltipContent += `
                <div class="tooltip-stat-row">
                    <span class="tooltip-stat-label">Active Time</span>
                    <span class="tooltip-stat-value">${formatTime(Math.round(d.activeTime))}</span>
                </div>
            `;
      }

      tooltipContent += `
            <div class="tooltip-stat-row">
                <span class="tooltip-stat-label">Videos</span>
                <span class="tooltip-stat-value">${d.videoCount}</span>
            </div>
        `;

      if (d.topVideos && d.topVideos.length > 0) {
        tooltipContent += `
                <div class="tooltip-videos-header">Top Videos</div>
                ${d.topVideos.map((title) => `<div class="tooltip-video-item">${title}</div>`).join("")}
            `;
      }

      return `
            <div class="chart-bar-wrapper ${isActive ? "active" : ""}" data-tooltip='${tooltipContent.replace(/'/g, "&apos;")}'>
                <div class="chart-bar-outer">
                    <div class="chart-bar-fill" style="height: ${height}%; background: ${d.color}"></div>
                </div>
                ${d.label ? `<span class="chart-label">${d.label}</span>` : ""}
            </div>
        `;
    })
    .join("");

  // Re-bind tooltips
  bindAnalyticsTooltips(chartContainer);

  // Setup scroll arrows
  initCustomScroll(
    "chart-scroll-track",
    "chart-scroll-left",
    "chart-scroll-right",
  );
}

function initCustomScroll(trackId, leftId, rightId) {
  const track = document.getElementById(trackId);
  const leftArrow = document.getElementById(leftId);
  const rightArrow = document.getElementById(rightId);
  if (!track || !leftArrow || !rightArrow) return;

  // Auto-scroll to end on render
  track.scrollLeft = track.scrollWidth;

  let scrollInterval = null;
  let currentSpeed = 3;
  const baseSpeed = 3;
  const turboSpeed = 12;

  const startScroll = (direction) => {
    stopScroll();
    scrollInterval = setInterval(() => {
      track.scrollLeft += direction * currentSpeed;
    }, 16); // ~60fps
  };

  const stopScroll = () => {
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
    currentSpeed = baseSpeed;
  };

  const enhanceSpeed = () => {
    currentSpeed = turboSpeed;
  };

  leftArrow.onmouseenter = () => startScroll(-1);
  leftArrow.onmouseleave = stopScroll;
  leftArrow.onmousedown = (e) => {
    if (e.button === 0) enhanceSpeed();
  };
  leftArrow.onmouseup = () => (currentSpeed = baseSpeed);

  rightArrow.onmouseenter = () => startScroll(1);
  rightArrow.onmouseleave = stopScroll;
  rightArrow.onmousedown = (e) => {
    if (e.button === 0) enhanceSpeed();
  };
  rightArrow.onmouseup = () => (currentSpeed = baseSpeed);

  // Update arrow visibility based on scroll position
  const updateArrowVisibility = () => {
    const atStart = track.scrollLeft <= 2;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    leftArrow.style.opacity = atStart ? "0.15" : "";
    rightArrow.style.opacity = atEnd ? "0.15" : "";
    leftArrow.style.pointerEvents = atStart ? "none" : "";
    rightArrow.style.pointerEvents = atEnd ? "none" : "";
  };

  track.onscroll = updateArrowVisibility;
  // Initial check after render settles
  setTimeout(updateArrowVisibility, 50);
}

function renderWatchDistribution(data) {
  const pieChart = document.getElementById("pie-chart");
  const pieLegend = document.getElementById("pie-legend");
  const centerVal = document.getElementById("pie-total-value");
  if (!pieChart || !pieLegend) return;

  if (centerVal) centerVal.textContent = formatTimeShort(data.totalWatchTime);

  if (data.totalWatchTime === 0 || data.channels.length === 0) {
    const isFuture = isFutureDate(selectedDayFilter);
    pieChart.style.background = "var(--stats-chart-bar-bg)";
    pieLegend.innerHTML = `<div class="legend-empty">${isFuture ? "Future date" : "No activity recorded"}</div>`;
    return;
  }

  // Calculate slices for ALL channels (per user request)
  const sorted = [...data.channels];
  let cumulativePercent = 0;
  const slices = sorted.map((c, i) => {
    const start = cumulativePercent;
    const end = start + (c.value / data.totalWatchTime) * 100;
    cumulativePercent = end;
    return {
      ...c,
      start,
      end,
      color: dayColors[i % dayColors.length],
    };
  });

  const updatePieHighlight = (hoverIdx) => {
    const gradient = slices
      .map((s, i) => {
        let color = s.color;
        if (hoverIdx !== -1 && i !== hoverIdx) {
          // Dim other slices using a simple rgba opacity if they were hex
          // Since they are strings, we'll convert them or just use a dimmed overlay logic.
          // For simplicity, we'll use a helper to dim the hex colors.
          color = hexToRgba(color, 0.2);
        }
        return `${color} ${s.start}% ${s.end}%`;
      })
      .join(", ");
    pieChart.style.background = `conic-gradient(${gradient})`;
  };

  // Helper to dim hex colors
  function hexToRgba(hex, alpha) {
    let r, g, b;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  pieChart.style.background = `conic-gradient(${slices.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(", ")})`;

  // Render Top 5 as pills + View All button
  pieLegend.innerHTML =
    slices
      .slice(0, 5)
      .map(
        (d) => `
        <div class="legend-item" data-channel="${d.label || d.key}">
            <span class="legend-color" style="background: ${d.color}"></span>
            <span class="legend-label">${d.label || d.key}</span>
            <span class="legend-value">${Math.round((d.value / data.totalWatchTime) * 100)}%</span>
        </div>
    `,
      )
      .join("") +
    `
        <button id="view-all-channels" class="view-more-btn">
            View All Channels
        </button>
    `;

  // Setup "View All Channels" view switching
  const viewAllBtn = document.getElementById("view-all-channels");
  if (viewAllBtn) {
    viewAllBtn.onclick = (e) => {
      if (e) e.stopPropagation();
      activeView = "channel-distribution";
      localStorage.setItem("ytt_active_view", activeView);
      switchView(activeView);
      renderChannelDistribution(data);
    };
  }

  // Interaction for legend items
  pieLegend.querySelectorAll(".legend-item").forEach((item, idx) => {
    item.onmouseenter = () => updatePieHighlight(idx);
    item.onmouseleave = () => updatePieHighlight(-1);
  });

  // Interaction
  const tooltip = document.getElementById("stats-tooltip");
  pieChart.onmousemove = (e) => {
    const rect = pieChart.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let angle =
      Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI) +
      90;
    if (angle < 0) angle += 360;
    const percent = (angle / 360) * 100;

    const activeSlice = slices.find(
      (s) => percent >= s.start && percent < s.end,
    );
    if (activeSlice) {
      const pct = Math.round((activeSlice.value / data.totalWatchTime) * 100);
      const avgStr = formatTimeShort(
        activeSlice.avgTime || activeSlice.value / activeSlice.videoCount,
      );
      tooltip.innerHTML = `
                <div class="tooltip-date">${activeSlice.label || activeSlice.key}</div>
                <div class="tooltip-stat-row">
                    <span class="tooltip-stat-label">Watch Time</span>
                    <span class="tooltip-stat-value">${formatTime(Math.round(activeSlice.value))}</span>
                </div>
                <div class="tooltip-stat-row">
                    <span class="tooltip-stat-label">Share</span>
                    <span class="tooltip-stat-value">${pct}%</span>
                </div>
                <div class="tooltip-stat-row">
                    <span class="tooltip-stat-label">Videos</span>
                    <span class="tooltip-stat-value">${activeSlice.videoCount}</span>
                </div>
                <div class="tooltip-stat-row">
                    <span class="tooltip-stat-label">Avg / Video</span>
                    <span class="tooltip-stat-value">${avgStr}</span>
                </div>
                ${
                  activeSlice.topVideo
                    ? `
                    <div class="tooltip-videos-header">Most Watched</div>
                    <div class="tooltip-video-item">${activeSlice.topVideo}</div>
                `
                    : ""
                }
            `;
      tooltip.classList.add("visible");
      positionTooltip(e, tooltip);
      // Highlight the hovered slice
      const sliceIdx = slices.indexOf(activeSlice);
      updatePieHighlight(sliceIdx);
    } else {
      tooltip.classList.remove("visible");
      updatePieHighlight(-1);
    }
  };
  pieChart.onmouseleave = () => {
    tooltip.classList.remove("visible");
    updatePieHighlight(-1);
  };
}

function renderChannelDistribution(data) {
  const listEl = document.getElementById("full-channel-list");
  if (!listEl) return;

  if (!data || !data.channels || data.channels.length === 0) {
    listEl.innerHTML =
      '<div class="loading-placeholder">No channel data available</div>';
    return;
  }

  // Sort all channels by value descending
  const sorted = [...data.channels].sort((a, b) => b.value - a.value);

  listEl.innerHTML = sorted
    .map((c, index) => {
      const percent = Math.round((c.value / data.totalWatchTime) * 100);
      const rank = index + 1;
      const avgStr = formatTimeShort(c.avgTime || c.value / c.videoCount);

      // Generate an elegant letter-avatar if no thumbnail exists
      const channelName = c.label || c.key;
      const firstLetter = channelName.charAt(0).toUpperCase();
      const avatarContent = c.thumbnail
        ? `<img src="${c.thumbnail}" class="channel-avatar-detailed" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
        : "";

      return `
            <div class="channel-card-detailed" data-channel="${channelName}">
                <div class="channel-rank-badge ${rank <= 3 ? "top-rank-badge" : ""}">${rank}</div>
                
                <div class="channel-view-avatar">
                    ${avatarContent}
                    <div class="channel-avatar-fallback" style="${c.thumbnail ? "display:none;" : ""}">
                        ${firstLetter}
                    </div>
                </div>

                <div class="channel-info-detailed">
                    <div class="channel-main-row">
                        <span class="channel-name" title="${channelName}">${channelName}</span>
                        <div class="channel-percent-badge">${percent}%</div>
                    </div>

                    <div class="channel-meta-row">
                        <div class="channel-stats-row">
                            <span>${formatTime(Math.round(c.value))}</span>
                            <span class="stats-dot"></span>
                            <span>${c.videoCount} videos</span>
                            <span class="stats-dot"></span>
                            <span>Avg ${avgStr}</span>
                        </div>

                        ${c.topVideo ? `
                            <div class="channel-top-video-row">
                                <span class="top-video-icon">🏆</span>
                                <span class="top-video-title" title="${c.topVideo}">${c.topVideo}</span>
                            </div>
                        ` : ""}
                    </div>
                </div>
            </div>
        `;
    })
    .join("");

  // Add click listeners
  listEl.querySelectorAll(".channel-card-detailed").forEach((card) => {
    card.onclick = (e) => {
      e.stopPropagation();
      selectedChannelForVideos = card.dataset.channel;
      switchView("channel-videos");
      renderChannelVideosView(selectedChannelForVideos);
    };
  });
}

function renderChannelVideosView(channelName) {
  const titleEl = document.getElementById("channel-videos-title");
  const listEl = document.getElementById("channel-videos-list");
  if (titleEl) titleEl.textContent = `Videos from ${channelName}`;
  if (!listEl) return;

  // Use the current active period keys for filtering
  const keysToInclude = getPeriodKeys(selectedDayFilter || "today", 0);
  let channelVideos = [];

  keysToInclude.forEach((key) => {
    const day = allHistory[key];
    if (day && day.videos) {
      day.videos.forEach((v) => {
        if (v.channelName === channelName) {
          channelVideos.push(v);
        }
      });
    }
  });

  if (channelVideos.length === 0) {
    listEl.innerHTML =
      '<div style="text-align:center; padding: 40px; color:#666;">No videos found for this channel in the selected period.</div>';
    return;
  }

  // Sort by last watched time descending
  fullSortedVideos = channelVideos.sort((a, b) => {
    const aTime = a.lastStarted || a.lastUpdated || 0;
    const bTime = b.lastStarted || b.lastUpdated || 0;
    return bTime - aTime;
  });

  listEl.innerHTML = "";
  loadedVideoCount = 0;
  appendChannelVideosBatch();
}

function appendChannelVideosBatch() {
  const listEl = document.getElementById("channel-videos-list");
  const loadingEl = document.getElementById("channel-videos-loading");
  if (
    !listEl ||
    isInfiniteScrolling ||
    loadedVideoCount >= fullSortedVideos.length
  ) {
    if (loadingEl) loadingEl.style.display = "none";
    return;
  }

  if (loadingEl) loadingEl.style.display = "flex";
  isInfiniteScrolling = true;

  setTimeout(() => {
    const batch = fullSortedVideos.slice(
      loadedVideoCount,
      loadedVideoCount + historyPageSize,
    );
    const fragment = document.createDocumentFragment();

    batch.forEach((v) => {
      if (typeof createVideoItemElement === "function") {
        fragment.appendChild(createVideoItemElement(v));
      }
    });

    listEl.appendChild(fragment);
    loadedVideoCount += batch.length;
    isInfiniteScrolling = false;

    if (loadedVideoCount >= fullSortedVideos.length && loadingEl) {
      loadingEl.style.display = "none";
    }
  }, 100);
}

function renderActivityHeatmap() {
  const container = document.getElementById("activity-heatmap");
  const selectorContainer = document.getElementById("heatmap-year-selector");
  if (!container) return;

  // 1. Year Discovery & Selector Rendering
  const years = Array.from(
    new Set(Object.keys(allHistory).map((k) => k.split("-")[0])),
  ).sort((a, b) => b - a);
  const options = ["Last 365 Days", ...years];

  if (selectorContainer) {
    selectorContainer.innerHTML = `
            <div class="custom-dropdown heatmap-year-dropdown" id="heatmap-year-dropdown" data-value="${selectedHeatmapYear}">
                <div class="dropdown-trigger">
                    <span>${selectedHeatmapYear}</span>
                    <svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div class="dropdown-menu">
                    ${options
                      .map(
                        (y) => `
                        <div class="dropdown-item ${selectedHeatmapYear == y ? "active" : ""}" data-value="${y}">
                            ${y}
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `;

    const dropdown = document.getElementById("heatmap-year-dropdown");
    if (dropdown) {
      if (typeof initializeDropdowns === "function") initializeDropdowns();
      dropdown.addEventListener("change", (e) => {
        selectedHeatmapYear = e.detail.value;
        renderActivityHeatmap();
      });
    }
  }

  // 2. Date Range Calculation
  let startDate, endDate, weeks;
  const now = new Date();
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const days = ["", "Mon", "", "Wed", "", "Fri", ""];

  if (selectedHeatmapYear === "Last 365 Days") {
    endDate = new Date(now);
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 364);
    // Align start to Sunday
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1);
    }
    // Calculate weeks needed to cover from aligned startDate to today
    const diffTime = Math.abs(endDate - startDate);
    weeks = Math.ceil(
      (diffTime + 1000 * 60 * 60 * 24) / (1000 * 60 * 60 * 24 * 7),
    );
    // Ensure at least 53 weeks for consistent "Year" look
    if (weeks < 53) weeks = 53;
  } else {
    const year = parseInt(selectedHeatmapYear);
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31);
    // Align start to the first Sunday on or before Jan 1
    while (startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1);
    }
    // Calculate weeks needed to cover the whole year (or until today if current year)
    const targetEnd = year === now.getFullYear() ? new Date(now) : endDate;
    const diffTime = Math.abs(targetEnd - startDate);
    weeks = Math.ceil(
      (diffTime + 1000 * 60 * 60 * 24) / (1000 * 60 * 60 * 24 * 7),
    );

    // However, the grid usually looks better if fully rendered for the selected year
    if (year !== now.getFullYear()) {
      const yearDiff = Math.abs(endDate - startDate);
      weeks = Math.ceil(
        (yearDiff + 1000 * 60 * 60 * 24) / (1000 * 60 * 60 * 24 * 7),
      );
    }
  }

  let heatmapData = [];
  let months = [];
  let lastMonth = -1;

  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = getDayKey(d);
    const dayData = allHistory[key] || {
      watchTime: 0,
      activeTime: 0,
      videos: [],
    };
    const val = dayData.watchTime;

    // Month label logic
    if (i % 7 === 0) {
      const m = d.getMonth();
      if (m !== lastMonth) {
        months.push({ name: monthNames[m], index: i / 7 });
        lastMonth = m;
      }
    }

    let level = 0;
    if (val > 0) level = 1;
    if (val > 3600) level = 2;
    if (val > 7200) level = 3;
    if (val > 14400) level = 4;

    const dateStr = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const videos = [...(dayData.videos || [])]
      .sort((a, b) => (b.watchedDuration || 0) - (a.watchedDuration || 0))
      .slice(0, 3);

    let tooltipHtml = `
            <div class="tooltip-date">${dateStr}</div>
            <div class="tooltip-stat-row">
                <span class="tooltip-stat-label">Watch Time</span>
                <span class="tooltip-stat-value">${formatTime(Math.round(val))}</span>
            </div>
            <div class="tooltip-stat-row">
                <span class="tooltip-stat-label">Videos</span>
                <span class="tooltip-stat-value">${dayData.videos ? dayData.videos.length : 0}</span>
            </div>
        `;

    if (videos.length > 0) {
      tooltipHtml += `<div class="tooltip-videos-header">Top Videos:</div>`;
      videos.forEach((v) => {
        tooltipHtml += `<div class="tooltip-video-item">${v.title}</div>`;
      });
    }

    heatmapData.push({ key, val, level, tooltipHtml });
  }

  let html = `
        <div class="heatmap-modern-wrapper">
            <div class="heatmap-months-row" style="grid-template-columns: repeat(${weeks}, 11px)">
                ${months
                  .map(
                    (m, i) => `
                    <span class="month-label" style="grid-column: ${m.index + 1}">${m.name}</span>
                `,
                  )
                  .join("")}
            </div>
            <div class="heatmap-main-row">
                <div class="heatmap-days-col">
                    ${days.map((d) => `<span class="day-label">${d}</span>`).join("")}
                </div>
                <div class="heatmap-grid modern" style="grid-template-columns: repeat(${weeks}, 11px)">
                    ${heatmapData
                      .map(
                        (d) => `
                        <div class="heatmap-cell level-${d.level}" data-tooltip="${d.tooltipHtml.replace(/"/g, "&quot;")}"></div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        </div>
    `;

  container.innerHTML = html;
  bindAnalyticsTooltips(container);

  initCustomScroll(
    "activity-heatmap",
    "heatmap-scroll-left",
    "heatmap-scroll-right",
  );
}

function renderDetailedInsights(currentData) {
  const insightEl = document.getElementById("key-insights");
  if (!insightEl) return;

  const insights = [];
  const filter = selectedDayFilter;
  const isSingleDay =
    filter === "today" ||
    filter === "yesterday" ||
    (filter && filter.includes("-"));

  // 1. Fetch Comparison Data
  const currentKeys = getPeriodKeys(filter, 0);
  const prevKeys = getPeriodKeys(filter, 1);

  const currentStats = getPeriodSummary(currentKeys);
  const prevStats = getPeriodSummary(prevKeys);

  // Handle Empty / Future States
  if (currentStats.totalTime === 0) {
    const isFuture = isFutureDate(filter);
    insightEl.innerHTML = `
            <div class="insight-card-modern empty-state-card">
                <div class="insight-header-row">
                    <span class="insight-icon-vibrant">${isFuture ? "📅" : "🏝️"}</span>
                    <h4>${isFuture ? "Future Date" : "Activity Empty"}</h4>
                </div>
                <p>${isFuture ? "This date is in the future. No data available yet." : "No activity recorded for this day. Go watch some videos!"}</p>
            </div>
        `;
    return;
  }

  // Insight: Trend Analysis
  if (prevStats.totalTime > 0) {
    const diff = currentStats.totalTime - prevStats.totalTime;
    const percent = Math.round((Math.abs(diff) / prevStats.totalTime) * 100);
    const direction = diff >= 0 ? "more" : "less";
    const trendIcon = diff >= 0 ? "📈" : "📉";
    const periodLabel = isSingleDay
      ? filter === "today"
        ? "yesterday"
        : "the day before"
      : "previous period";

    insights.push({
      icon: trendIcon,
      title: "Trend Analysis",
      text: `You watched <strong>${percent}% ${direction}</strong> content compared to ${periodLabel}.`,
    });
  }

  // Insight: Top Activity / Highlights
  if (isSingleDay) {
    if (currentStats.topChannel.time > 0) {
      insights.push({
        icon: "📺",
        title: "Top Channel",
        text: `You spent most of your time on <strong>${currentStats.topChannel.name}</strong>.`,
      });
    }
  } else {
    if (currentData.maxDay.value > 0) {
      insights.push({
        icon: "🔥",
        title: "Peak Activity",
        text: `Your highest watch time was on <strong>${currentData.maxDay.key}</strong> with <strong>${formatTime(Math.round(currentData.maxDay.value))}</strong>.`,
      });
    }

    const avg = currentStats.totalTime / currentData.days.length;
    insights.push({
      icon: "📊",
      title: "Daily Average",
      text: `You are averaging <strong>${formatTimeShort(avg)}</strong> of watch time per day.`,
    });

    const consistency = Math.round(
      (currentStats.activeDays / currentData.days.length) * 100,
    );
    insights.push({
      icon: "🎯",
      title: "Consistency",
      text: `You watched YouTube on <strong>${currentStats.activeDays}</strong> out of the last <strong>${currentData.days.length}</strong> days (${consistency}%).`,
    });
  }

  // Insight: Binge Warning
  const bingeThreshold = 3 * 3600; // 3 hours
  const bingeDays = currentData.days.filter(
    (d) => d.value > bingeThreshold,
  ).length;
  if (bingeDays > 0) {
    insights.push({
      icon: "⚠️",
      title: "Binge Warning",
      text: isSingleDay
        ? `High activity detected! You spent over <strong>3 hours</strong> on YouTube today.`
        : `You had <strong>${bingeDays}</strong> sessions exceeding 3 hours. Consider taking more breaks!`,
    });
  }

  insightEl.innerHTML = insights
    .map(
      (i) => `
        <div class="insight-card-modern">
            <div class="insight-header-row">
                <span class="insight-icon-vibrant">${i.icon}</span>
                <h4>${i.title}</h4>
            </div>
            <p>${i.text}</p>
        </div>
    `,
    )
    .join("");
}

function bindAnalyticsTooltips(container) {
  const tooltip = document.getElementById("stats-tooltip");
  container.querySelectorAll("[data-tooltip]").forEach((el) => {
    el.onmouseenter = (e) => {
      tooltip.innerHTML = el.dataset.tooltip;
      tooltip.classList.add("visible");
      positionTooltip(e, tooltip);
    };
    el.onmousemove = (e) => positionTooltip(e, tooltip);
    el.onmouseleave = () => tooltip.classList.remove("visible");
  });
}

function positionTooltip(e, tooltip) {
  const margin = 15;
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  let left = e.clientX + margin;
  let top = e.clientY - margin;
  if (left + tooltipWidth > window.innerWidth)
    left = e.clientX - tooltipWidth - margin;
  if (top < margin) top = margin;
  if (top + tooltipHeight > window.innerHeight - margin)
    top = window.innerHeight - tooltipHeight - margin;
  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}
