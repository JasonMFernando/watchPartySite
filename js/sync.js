/**
 * Synchronized HTML5 video play / pause / seek.
 */
(function (global) {
  const SEEK_THRESHOLD = 2;
  const DRIFT_THRESHOLD = 0.5;

  function createSync(video, sendFn) {
    let suppress = false;
    let seekingFromRemote = false;

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

    function applyRemote(msg) {
      if (!msg || !msg.type) return;

      if (msg.type === "play") {
        withSuppress(function () {
          if (typeof msg.rate === "number") applyRate(msg.rate);
          if (Math.abs(video.currentTime - msg.currentTime) > DRIFT_THRESHOLD) {
            seekingFromRemote = true;
            video.currentTime = msg.currentTime;
          }
          const p = video.play();
          if (p && typeof p.catch === "function") p.catch(function () {});
        });
        return;
      }

      if (msg.type === "pause") {
        withSuppress(function () {
          if (typeof msg.rate === "number") applyRate(msg.rate);
          if (Math.abs(video.currentTime - msg.currentTime) > DRIFT_THRESHOLD) {
            seekingFromRemote = true;
            video.currentTime = msg.currentTime;
          }
          video.pause();
        });
        return;
      }

      if (msg.type === "seek") {
        withSuppress(function () {
          if (typeof msg.rate === "number") applyRate(msg.rate);
          if (Math.abs(video.currentTime - msg.currentTime) > SEEK_THRESHOLD) {
            seekingFromRemote = true;
            video.currentTime = msg.currentTime;
          }
        });
        return;
      }

      if (msg.type === "rate") {
        withSuppress(function () {
          applyRate(msg.rate);
          if (
            typeof msg.currentTime === "number" &&
            Math.abs(video.currentTime - msg.currentTime) > DRIFT_THRESHOLD
          ) {
            seekingFromRemote = true;
            video.currentTime = msg.currentTime;
          }
        });
      }
    }

    return {
      applyRemote: applyRemote,
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
