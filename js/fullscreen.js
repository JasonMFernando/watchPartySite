/**
 * Fullscreen the player shell (video + reactions + emoji bar).
 * Native <video> fullscreen only shows the video element, so reactions
 * would be invisible — we fullscreen the container instead, with a CSS
 * fake-fullscreen fallback for iOS Safari.
 */
(function (global) {
  function createFullscreen(options) {
    const shellEl = options.shellEl;
    const videoEl = options.videoEl;
    const toggleBtn = options.toggleBtn;
    if (!shellEl || !videoEl) {
      return { destroy: function () {} };
    }

    let fake = false;

    function isDocFs() {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        null;
      return fsEl === shellEl;
    }

    function isActive() {
      return fake || isDocFs();
    }

    function updateBtn() {
      if (!toggleBtn) return;
      const on = isActive();
      toggleBtn.setAttribute("aria-pressed", on ? "true" : "false");
      toggleBtn.setAttribute(
        "aria-label",
        on ? "Exit fullscreen" : "Enter fullscreen"
      );
      toggleBtn.title = on ? "Exit fullscreen" : "Fullscreen";
      toggleBtn.classList.toggle("is-active", on);
      toggleBtn.innerHTML = on
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    }

    function enterFake() {
      if (fake) return;
      fake = true;
      shellEl.classList.add("is-fs");
      document.documentElement.classList.add("player-fs-lock");
      document.body.classList.add("player-fs-lock");
      updateBtn();
    }

    function exitFake() {
      if (!fake) return;
      fake = false;
      shellEl.classList.remove("is-fs");
      document.documentElement.classList.remove("player-fs-lock");
      document.body.classList.remove("player-fs-lock");
      updateBtn();
    }

    function requestDocFs() {
      const req =
        shellEl.requestFullscreen ||
        shellEl.webkitRequestFullscreen ||
        shellEl.msRequestFullscreen;
      if (!req) return Promise.reject(new Error("no fullscreen"));
      return Promise.resolve(req.call(shellEl)).catch(function (err) {
        throw err;
      });
    }

    function exitDocFs() {
      const exit =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.msExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        return Promise.resolve(exit.call(document)).catch(function () {});
      }
      return Promise.resolve();
    }

    function enter() {
      if (isActive()) return;
      // Prefer real Fullscreen API when the shell can host overlays.
      // Fall back to CSS fake-fullscreen (needed on many iOS versions).
      const canShellFs = typeof shellEl.requestFullscreen === "function";
      if (canShellFs) {
        requestDocFs().catch(function () {
          enterFake();
        });
      } else {
        enterFake();
      }
      updateBtn();
    }

    function exit() {
      if (fake) {
        exitFake();
        return;
      }
      exitDocFs().then(updateBtn);
    }

    function toggle() {
      if (isActive()) exit();
      else enter();
    }

    function onFsChange() {
      if (!isDocFs() && !fake) {
        updateBtn();
      } else if (isDocFs()) {
        exitFake();
        updateBtn();
      } else {
        updateBtn();
      }
    }

    // iOS native video fullscreen cannot show HTML overlays — redirect.
    function onWebkitBegin() {
      setTimeout(function () {
        if (typeof videoEl.webkitExitFullscreen === "function") {
          try {
            videoEl.webkitExitFullscreen();
          } catch (e) {
            /* ignore */
          }
        }
        enterFake();
      }, 50);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });
    }

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    videoEl.addEventListener("webkitbeginfullscreen", onWebkitBegin);

    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape" && fake) {
        exitFake();
      }
    });

    updateBtn();

    return {
      enter: enter,
      exit: exit,
      toggle: toggle,
      isActive: isActive,
      destroy: function () {
        exitFake();
        document.removeEventListener("fullscreenchange", onFsChange);
        document.removeEventListener("webkitfullscreenchange", onFsChange);
        videoEl.removeEventListener("webkitbeginfullscreen", onWebkitBegin);
      },
    };
  }

  global.WatchPartyFullscreen = { create: createFullscreen };
})(window);
