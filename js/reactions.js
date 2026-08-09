/**
 * Emoji reaction bar + floating animations over the video.
 */
(function (global) {
  const EMOJIS = ["❤️", "😂", "😮", "👏", "🍿", "😖", "😭", "⏳", "😡"];
  const STORAGE_KEY = "wp-emoji-bar-collapsed";
  const DND_KEY = "wp-dnd-overlays";

  function createReactions(options) {
    const barEl = options.barEl;
    const layerEl = options.layerEl;
    const sendFn = options.sendFn;
    const toggleBtn = options.toggleBtn;
    const dndBtn = options.dndBtn;
    const shellEl =
      options.shellEl ||
      (barEl && barEl.closest(".player-shell"));

    let dnd = false;

    if (!barEl) {
      return {
        onRemote: function () {},
        spawn: function () {},
        spawnChat: function () {},
        setCollapsed: function () {},
        isCollapsed: function () {
          return false;
        },
        setDnd: function () {},
        isDnd: function () {
          return false;
        },
      };
    }

    function spawn(emoji) {
      if (!layerEl || dnd || !emoji) return;
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

    function spawnChat(text, from) {
      if (!layerEl || dnd || !text) return;
      const clean = String(text).replace(/\s+/g, " ").trim();
      if (!clean) return;
      const shown =
        clean.length > 72 ? clean.slice(0, 70) + "…" : clean;

      const el = document.createElement("div");
      el.className = "floating-chat";
      const who = document.createElement("span");
      who.className = "floating-chat-from";
      who.textContent = from || "Chat";
      el.appendChild(who);
      el.appendChild(document.createTextNode(shown));
      el.style.left = 8 + Math.random() * 45 + "%";
      el.style.bottom = 10 + Math.random() * 28 + "%";
      layerEl.appendChild(el);
      setTimeout(function () {
        el.remove();
      }, 3600);
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

    function setDnd(on) {
      dnd = !!on;
      if (shellEl) {
        shellEl.classList.toggle("dnd-on", dnd);
      }
      if (dnd && layerEl) {
        layerEl.innerHTML = "";
      }
      if (dndBtn) {
        dndBtn.setAttribute("aria-pressed", dnd ? "true" : "false");
        dndBtn.setAttribute(
          "aria-label",
          dnd ? "Turn off Do Not Disturb" : "Do Not Disturb"
        );
        dndBtn.title = dnd
          ? "Do Not Disturb on — tap to show floating messages"
          : "Do Not Disturb — hide floating messages";
        dndBtn.classList.toggle("is-active", dnd);
      }
      try {
        localStorage.setItem(DND_KEY, dnd ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
    }

    function isDnd() {
      return dnd;
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setCollapsed(!isCollapsed());
      });
    }

    if (dndBtn) {
      dndBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        setDnd(!dnd);
      });
    }

    let savedCollapsed = false;
    let savedDnd = false;
    try {
      savedCollapsed = localStorage.getItem(STORAGE_KEY) === "1";
      savedDnd = localStorage.getItem(DND_KEY) === "1";
    } catch (e) {
      /* ignore */
    }
    setCollapsed(savedCollapsed);
    setDnd(savedDnd);

    function onRemote(msg) {
      if (!msg || msg.type !== "reaction" || !msg.emoji) return;
      spawn(msg.emoji);
    }

    return {
      onRemote: onRemote,
      spawn: spawn,
      spawnChat: spawnChat,
      setCollapsed: setCollapsed,
      isCollapsed: isCollapsed,
      setDnd: setDnd,
      isDnd: isDnd,
    };
  }

  global.WatchPartyReactions = { create: createReactions, EMOJIS: EMOJIS };
})(window);
