// === Stats Tracking: Video watch time recording ===

/**
 * @param {string|undefined} explicitVideoId - Force a specific video ID (used during navigation).
 * @param {boolean} isFinalSync - If true, don't read from the video element (it may already
 *   be reset by YouTube's SPA navigation). Use cached values from the last normal tick instead.
 */
function updateStats(explicitVideoId, isFinalSync) {
  if (window.yttContextInvalidated) return;

  const now = Date.now();
  const delta = (now - lastWatchTimeUpdate) / 1000;
  lastWatchTimeUpdate = now;

  const watchFlexy = document.querySelector("ytd-watch-flexy");
  let videoId =
    explicitVideoId ||
    (watchFlexy
      ? watchFlexy.getAttribute("video-id")
      : new URLSearchParams(window.location.search).get("v"));

  const video =
    document.querySelector("video.video-stream.html5-main-video") ||
    document.querySelector("video");

  // Skip tracking during YouTube ads
  const isAd = !!document.querySelector(
    ".ad-showing, .ad-interrupting, .ytp-ad-player-overlay",
  );
  if (isAd) return;

  // Ensure we have a bucket for today
  const currentDay = getDayKey();
  if (!allHistory[currentDay]) {
    allHistory[currentDay] = { watchTime: 0, videos: [], sessionStart: now };
  }
  const todayData = allHistory[currentDay];
  const isNewVideo = videoId !== lastVideoId;

  if (videoId) {
    currentUid = `${currentDay}_${videoId}`;

    // Skip tracking for videos the user explicitly deleted
    if (deletedUids.has(currentUid)) {
      // Still send a heartbeat even if this specific video is blacklisted
      safeSendMessage({ action: 'REPORT_WATCH_TIME', delta });
      return;
    }

    if (isNewVideo || !todayData.videos.find((v) => v.uid === currentUid)) {
      if (isNewVideo) {
        lastVideoId = videoId;
        // New video loaded — old deletions no longer relevant
        deletedUids.clear();
      }

      const videoTitleEl =
        document.querySelector("h1.ytd-watch-metadata") ||
        document.querySelector(".ytd-video-primary-info-renderer h1.title");
      const title = videoTitleEl
        ? videoTitleEl.textContent.trim()
        : "Loading Video...";

      const channelNameEl =
        document.querySelector("#upload-info #channel-name a") ||
        document.querySelector("ytd-video-owner-renderer #channel-name a");
      const channelName = channelNameEl
        ? channelNameEl.textContent.trim()
        : "Loading Channel...";

      const channelAvatarEl = 
        document.querySelector("ytd-video-owner-renderer #avatar yt-img-shadow img") ||
        document.querySelector("ytd-watch-metadata #owner #avatar img") ||
        document.querySelector("#owner #avatar img") ||
        document.querySelector("ytd-video-owner-renderer img") ||
        document.querySelector("#upload-info img#img");
      const channelThumb = channelAvatarEl ? (channelAvatarEl.currentSrc || channelAvatarEl.src) : null;

      if (!todayData.videos.find((v) => v.uid === currentUid)) {
        todayData.videos.push({
          uid: currentUid,
          id: videoId,
          title: title,
          channelName: channelName,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          channelThumb: channelThumb,
          startTime: new Date().toLocaleTimeString(),
          watchedDuration: 0,
          currentPosition: 0,
          // Don't read duration from video element here — it might still
          // hold the previous video's duration (YouTube reuses the element).
          // Subsequent normal ticks will populate this correctly.
          totalDuration: 0,
        });
      }
    }

    const activeVideo = todayData.videos.find((v) => v.uid === currentUid);

    // --- FINAL SYNC PATH ---
    // During navigation/unload, YouTube may have already reset the <video> element.
    // Don't read from it — just send whatever we last cached on activeVideo.
    if (isFinalSync && activeVideo) {
      safeSendMessage({
        action: "REPORT_WATCH_TIME",
        delta: 0,
        videoId: videoId,
        videoTitle: activeVideo.title,
        channelName: activeVideo.channelName,
        currentPosition: activeVideo.currentPosition || 0,
        totalDuration: activeVideo.totalDuration || 0,
      });
      return;
    }

    // --- NORMAL TRACKING PATH ---
    if (activeVideo && video) {
      // Lazy-load title and channel
      if (activeVideo.title === "Loading Video...") {
        const videoTitleEl =
          document.querySelector("h1.ytd-watch-metadata") ||
          document.querySelector(".ytd-video-primary-info-renderer h1.title");
        if (videoTitleEl) activeVideo.title = videoTitleEl.textContent.trim();
      }
      if (activeVideo.channelName === "Loading Channel...") {
        const channelNameEl =
          document.querySelector("#upload-info #channel-name a") ||
          document.querySelector("ytd-video-owner-renderer #channel-name a");
        if (channelNameEl)
          activeVideo.channelName = channelNameEl.textContent.trim();
      }
      if (!activeVideo.channelThumb || activeVideo.channelThumb.startsWith('data:')) {
        const channelAvatarEl = 
          document.querySelector("ytd-video-owner-renderer #avatar yt-img-shadow img") ||
          document.querySelector("ytd-watch-metadata #owner #avatar img") ||
          document.querySelector("#owner #avatar img") ||
          document.querySelector("ytd-video-owner-renderer img") ||
          document.querySelector("#upload-info img#img");
        if (channelAvatarEl) {
          const src = channelAvatarEl.currentSrc || channelAvatarEl.src;
          if (src && !src.startsWith('data:')) {
            activeVideo.channelThumb = src;
          }
        }
      }

      // GUARD: When isNewVideo is true, skip reading from the <video> element.
      // YouTube reuses the same element, so it may still hold the OLD video's
      // currentTime and duration. Wait for the next tick when the element is stable.
      if (!isNewVideo) {
        const liveDuration =
          isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        const liveTime = isFinite(video.currentTime) ? video.currentTime : 0;

        // --- TRANSITION GUARD ---
        // If duration changes significantly (>2s) for the same video ID,
        // or if time jumps back to near-zero while it was previously near the end,
        // it means YouTube has auto-played the next video but hasn't updated the ID yet.
        // In these cases, we SKIP updating the old video's metadata.

        const isNearEnd =
          activeVideo.totalDuration > 0 &&
          activeVideo.totalDuration - activeVideo.currentPosition < 5;
        const suddenJumpToStart = isNearEnd && liveTime < 2 && !video.paused;
        const durationMismatch =
          activeVideo.totalDuration > 0 &&
          liveDuration > 0 &&
          Math.abs(activeVideo.totalDuration - liveDuration) > 1;

        if (suddenJumpToStart || durationMismatch) {
          // Transition detected: don't pollute OLD video entry with NEW video data
          return;
        }

        // Update totalDuration when a valid value is available
        if (liveDuration > 0) {
          activeVideo.totalDuration = liveDuration;
        }

        // Update current position from the live video element
        if (liveTime > 0 || activeVideo.currentPosition === 0) {
          activeVideo.currentPosition = liveTime;
        }
      }

      // Report time and video state to background for atomic update
      const isPlaying =
        !isNewVideo && !video.paused && !video.ended && video.readyState >= 2;
      safeSendMessage(
        {
          action: "REPORT_WATCH_TIME",
          delta: isPlaying ? delta : 0,
          isPlaying: isPlaying,
          videoId: videoId,
          videoTitle: activeVideo.title,
          channelName: activeVideo.channelName,
          currentPosition: activeVideo.currentPosition || 0,
          totalDuration: activeVideo.totalDuration || 0,
        },
        (response) => {
          if (response && response.otherPlayingTabId && isPlaying) {
            // Only show if we aren't currently showing it, and sidebar is closed
            if (!window.multiTabToastShown && !isStatsOpen) {
              window.multiTabToastShown = true;
              showMultiTabToast(response.otherPlayingTabId, () => {
                // Reset flag after a while so it doesn't stay blocked forever
                setTimeout(() => {
                  window.multiTabToastShown = false;
                }, 5000);
              });
            }
          }
        },
      );
    }
  } else {
    // Heartbeat for non-video pages (Home, Subscriptions, etc.) to track active session time
    safeSendMessage({ action: "REPORT_WATCH_TIME", delta });
  }

  if (isStatsOpen) {
    renderStats();
  }
}
