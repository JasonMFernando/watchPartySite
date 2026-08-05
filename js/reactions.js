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
    const toggleBtn = options.toggleBtn;
    const shellEl =
      options.shellEl ||
      (barEl && barEl.closest(".player-shell"));

    if (!barEl) {
      return {
        onRemote: function () {},
        spawn: function () {},
        setCollapsed: function () {},
        isCollapsed: function () {
          return false;
        },
      };
    }

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

    barEl.innerHTML = "";

    EMOJIS.forEach(function (emoji) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-btn";
      btn.textContent = emoji;
      btn.setAttribute("aria-label", "React with " + emoji);
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        spawn(emoji);
        if (typeof sendFn === "function") {
          sendFn({
            type: "reaction",
            emoji: emoji,
            at: Date.now(),
          });
        }
      });
      barEl.appendChild(btn);
    });

    function isCollapsed() {
      return !!(shellEl && shellEl.classList.contains("reactions-collapsed"));
    }

    function setCollapsed(collapsed) {
      collapsed = !!collapsed;
      if (shellEl) {
        shellEl.classList.toggle("reactions-collapsed", collapsed);
      }
      barEl.hidden = collapsed;
      barEl.setAttribute("aria-hidden", collapsed ? "true" : "false");

      if (toggleBtn) {
        toggleBtn.setAttribute("aria-pressed", collapsed ? "false" : "true");
        toggleBtn.setAttribute(
          "aria-label",
          collapsed ? "Show reactions" : "Hide reactions"
        );
        toggleBtn.title = collapsed ? "Show reactions" : "Hide reactions";
        toggleBtn.classList.toggle("is-collapsed", collapsed);
      }

      try {
        localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setCollapsed(!isCollapsed());
      });
    }

    let saved = false;
    try {
      saved = localStorage.getItem(STORAGE_KEY) === "1";
    } catch (e) {
      /* ignore */
    }
    setCollapsed(saved);

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
