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
    const dockEl =
      options.dockEl || (barEl && barEl.closest(".emoji-dock"));
    const collapseBtn =
      options.collapseBtn ||
      (dockEl && dockEl.querySelector(".emoji-collapse"));

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

    function setCollapsed(collapsed) {
      if (!dockEl) return;
      collapsed = !!collapsed;
      dockEl.classList.toggle("is-collapsed", collapsed);
      barEl.hidden = collapsed;
      barEl.setAttribute("aria-hidden", collapsed ? "true" : "false");
      if (collapseBtn) {
        collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        collapseBtn.title = collapsed ? "Show reactions" : "Hide reactions";
        const label = collapseBtn.querySelector(".emoji-collapse-label");
        if (label) {
          // Compact label when collapsed so the floating chip stays small
          label.textContent = collapsed ? "Reactions" : "Hide";
        }
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
      collapseBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setCollapsed(!isCollapsed());
      });

      let saved = false;
      try {
        saved = localStorage.getItem(STORAGE_KEY) === "1";
      } catch (e) {
        /* ignore */
      }
      setCollapsed(saved);
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
