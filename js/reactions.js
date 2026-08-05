/**
 * Emoji reaction bar + floating animations over the video.
 */
(function (global) {
  const EMOJIS = ["❤️", "😂", "😮", "👏", "🍿"];
  const STORAGE_KEY = "wp-emoji-bar-collapsed";

  function createReactions(options) {
    const barEl = options.barEl;
    const layerEl = options.layerEl;
    const sendFn = options.sendFn;
    const dockEl = options.dockEl || (barEl && barEl.closest(".emoji-dock"));
    const collapseBtn =
      options.collapseBtn ||
      (dockEl && dockEl.querySelector(".emoji-collapse"));

    function spawn(emoji) {
      if (!layerEl) return;
      const el = document.createElement("span");
      el.className = "floating-emoji";
      el.textContent = emoji;
      const left = 10 + Math.random() * 80;
      el.style.left = left + "%";
      el.style.bottom = 8 + Math.random() * 20 + "%";
      layerEl.appendChild(el);
      setTimeout(function () {
        el.remove();
      }, 2600);
    }

    EMOJIS.forEach(function (emoji) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-btn";
      btn.textContent = emoji;
      btn.setAttribute("aria-label", "React with " + emoji);
      btn.addEventListener("click", function () {
        spawn(emoji);
        sendFn({
          type: "reaction",
          emoji: emoji,
          at: Date.now(),
        });
      });
      barEl.appendChild(btn);
    });

    function setCollapsed(collapsed) {
      if (!dockEl) return;
      dockEl.classList.toggle("is-collapsed", collapsed);
      if (collapseBtn) {
        collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        collapseBtn.title = collapsed ? "Show reactions" : "Hide reactions";
      }
      try {
        localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
    }

    function isCollapsed() {
      return !!(dockEl && dockEl.classList.contains("is-collapsed"));
    }

    if (collapseBtn && dockEl) {
      collapseBtn.addEventListener("click", function () {
        setCollapsed(!isCollapsed());
      });
      let saved = false;
      try {
        saved = localStorage.getItem(STORAGE_KEY) === "1";
      } catch (e) {
        /* ignore */
      }
      if (saved) setCollapsed(true);
    }

    function onRemote(msg) {
      if (!msg || msg.type !== "reaction" || !msg.emoji) return;
      spawn(msg.emoji);
    }

    return {
      onRemote: onRemote,
      spawn: spawn,
      setCollapsed: setCollapsed,
      isCollapsed: isCollapsed,
    };
  }

  global.WatchPartyReactions = { create: createReactions, EMOJIS: EMOJIS };
})(window);
