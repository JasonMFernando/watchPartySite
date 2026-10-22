/**
 * Synchronized HTML5 video play / pause / seek.
 */
(function (global) {
  const SEEK_THRESHOLD = 2;
  const DRIFT_THRESHOLD = 0.5;

  function createSync(video, sendFn) {
    let suppress = false;
    let seekingFromRemote = false;
    let realtime = true;

    function withSuppress(fn) {
      suppress = true;
      try {
        fn();
      } finally {
        // Clear after microtask so media events from programmatic changes are ignored
        setTimeout(function () {
          suppress = false;
          seekingFromRemote = false;
        }, 80);
      }
    }

    function currentRate() {
      const n = Number(video.playbackRate);
      return isFinite(n) && n > 0 ? n : 1;
    }

    function applyRate(rate) {
      const n = Number(rate);
      if (!isFinite(n) || n < 0.25 || n > 4) return;
      if (Math.abs(video.playbackRate - n) < 0.001) return;
      video.playbackRate = n;
    }

    function onLocalPlay() {
      if (suppress) return;
      sendFn({
        type: "play",
        currentTime: video.currentTime,
        rate: currentRate(),
        at: Date.now(),
      });
    }

    function onLocalPause() {
      if (suppress) return;
      sendFn({
        type: "pause",
        currentTime: video.currentTime,
        rate: currentRate(),
        at: Date.now(),
      });
    }

    function onLocalSeeked() {
      if (suppress || seekingFromRemote) return;
      sendFn({
        type: "seek",
        currentTime: video.currentTime,
        rate: currentRate(),
        at: Date.now(),
      });
    }

    function onLocalRate() {
      if (suppress) return;
      sendFn({
        type: "rate",
        currentTime: video.currentTime,
        rate: currentRate(),
        at: Date.now(),
      });
    }

    video.addEventListener("play", onLocalPlay);
    video.addEventListener("pause", onLocalPause);
    video.addEventListener("seeked", onLocalSeeked);
    video.addEventListener("ratechange", onLocalRate);

    function snapTo(time, threshold) {
      if (typeof time !== "number" || !isFinite(time)) return;
      if (Math.abs(video.currentTime - time) <= threshold) return;
      seekingFromRemote = true;
      video.currentTime = time;
    }

    function applyRemote(msg) {
      if (!msg || !msg.type) return;

      if (msg.type === "play") {
        withSuppress(function () {
          if (typeof msg.rate === "number") applyRate(msg.rate);
          if (realtime) snapTo(msg.currentTime, DRIFT_THRESHOLD);
          const p = video.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
        });
        return;
      }

      if (msg.type === "pause") {
        withSuppress(function () {
          if (typeof msg.rate === "number") applyRate(msg.rate);
          if (realtime) snapTo(msg.currentTime, DRIFT_THRESHOLD);
          video.pause();
        });
        return;
      }

      if (msg.type === "seek") {
        withSuppress(function () {
          if (typeof msg.rate === "number") applyRate(msg.rate);
          snapTo(msg.currentTime, SEEK_THRESHOLD);
        });
        return;
      }

      if (msg.type === "rate") {
        withSuppress(function () {
          applyRate(msg.rate);
          if (realtime) snapTo(msg.currentTime, DRIFT_THRESHOLD);
        });
      }
    }

    return {
      applyRemote: applyRemote,
      setRealtime: function (on) {
        realtime = on !== false;
      },
      isRealtime: function () {
        return realtime;
      },
      setRate: function (rate) {
        applyRate(rate);
      },
      getRate: currentRate,
      destroy: function () {
        video.removeEventListener("play", onLocalPlay);
        video.removeEventListener("pause", onLocalPause);
        video.removeEventListener("seeked", onLocalSeeked);
        video.removeEventListener("ratechange", onLocalRate);
      },
    };
  }

  global.WatchPartySync = { create: createSync };
})(window);
