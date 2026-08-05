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

    function onLocalPlay() {
      if (suppress) return;
      sendFn({
        type: "play",
        currentTime: video.currentTime,
        at: Date.now(),
      });
    }

    function onLocalPause() {
      if (suppress) return;
      sendFn({
        type: "pause",
        currentTime: video.currentTime,
        at: Date.now(),
      });
    }

    function onLocalSeeked() {
      if (suppress || seekingFromRemote) return;
      sendFn({
        type: "seek",
        currentTime: video.currentTime,
        at: Date.now(),
      });
    }

    video.addEventListener("play", onLocalPlay);
    video.addEventListener("pause", onLocalPause);
    video.addEventListener("seeked", onLocalSeeked);

    function applyRemote(msg) {
      if (!msg || !msg.type) return;

      if (msg.type === "play") {
        withSuppress(function () {
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
          if (Math.abs(video.currentTime - msg.currentTime) > DRIFT_THRESHOLD) {
            seekingFromRemote = true;
            video.currentTime = msg.currentTime;
          }
          video.pause();
        });
        return;
      }

      if (msg.type === "seek") {
        if (Math.abs(video.currentTime - msg.currentTime) <= SEEK_THRESHOLD) {
          return;
        }
        withSuppress(function () {
          seekingFromRemote = true;
          video.currentTime = msg.currentTime;
        });
      }
    }

    return {
      applyRemote: applyRemote,
      destroy: function () {
        video.removeEventListener("play", onLocalPlay);
        video.removeEventListener("pause", onLocalPause);
        video.removeEventListener("seeked", onLocalSeeked);
      },
    };
  }

  global.WatchPartySync = { create: createSync };
})(window);
