/**
 * Sidebar text chat.
 */
(function (global) {
  const COLLAPSE_KEY = "wp-chat-collapsed";

  function createChat(options) {
    const messagesEl = options.messagesEl;
    const emptyEl = options.emptyEl;
    const formEl = options.formEl;
    const inputEl = options.inputEl;
    const role = options.role || "you";
    const sendFn = options.sendFn;
    const overlayFn = options.overlayFn;
    const panelEl = options.panelEl || document.getElementById("chat-panel");
    const layoutEl =
      options.layoutEl || document.getElementById("theater-view");
    const hideBtn = options.hideBtn || document.getElementById("chat-hide-btn");
    const showBtn = options.showBtn || document.getElementById("chat-show-btn");

    function hideEmpty() {
      if (emptyEl) emptyEl.hidden = true;
    }

    function appendMessage(text, from, isLocal) {
      hideEmpty();
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble " + (isLocal ? "local" : "remote");
      const meta = document.createElement("span");
      meta.className = "chat-meta";
      meta.textContent = from;
      bubble.appendChild(meta);
      bubble.appendChild(document.createTextNode(text));
      messagesEl.appendChild(bubble);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      if (typeof overlayFn === "function") {
        overlayFn(text, from);
      }
    }

    function sendText(raw) {
      const text = String(raw || "").trim();
      if (!text) return false;
      const from = role === "host" ? "Host" : "Guest";
      appendMessage(text, from, true);
      if (typeof sendFn === "function") {
        sendFn({
          type: "chat",
          text: text,
          from: from,
          at: Date.now(),
        });
      }
      return true;
    }

    function isCollapsed() {
      return !!(layoutEl && layoutEl.classList.contains("chat-collapsed"));
    }

    function setCollapsed(collapsed) {
      collapsed = !!collapsed;
      if (layoutEl) {
        layoutEl.classList.toggle("chat-collapsed", collapsed);
      }
      if (panelEl) {
        panelEl.hidden = collapsed;
        panelEl.setAttribute("aria-hidden", collapsed ? "true" : "false");
      }
      if (showBtn) {
        showBtn.hidden = !collapsed;
        showBtn.setAttribute("aria-pressed", collapsed ? "true" : "false");
      }
      if (hideBtn) {
        hideBtn.setAttribute(
          "aria-label",
          collapsed ? "Show chat" : "Hide chat"
        );
        hideBtn.title = collapsed ? "Show chat" : "Hide chat";
      }
      try {
        localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
      } catch (e) {
        /* ignore */
      }
    }

    if (formEl) {
      formEl.addEventListener("submit", function (e) {
        e.preventDefault();
        const text = (inputEl.value || "").trim();
        if (!text) return;
        sendText(text);
        inputEl.value = "";
        inputEl.focus();
      });
    }

    if (hideBtn) {
      hideBtn.addEventListener("click", function (e) {
        e.preventDefault();
        setCollapsed(true);
      });
    }

    if (showBtn) {
      showBtn.addEventListener("click", function (e) {
        e.preventDefault();
        setCollapsed(false);
        if (inputEl) {
          try {
            inputEl.focus();
          } catch (_) {}
        }
      });
    }

    let savedCollapsed = false;
    try {
      savedCollapsed = localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch (e) {
      /* ignore */
    }
    setCollapsed(savedCollapsed);

    function onRemote(msg) {
      if (!msg || msg.type !== "chat" || !msg.text) return;
      appendMessage(msg.text, msg.from || "Guest", false);
    }

    return {
      onRemote: onRemote,
      appendMessage: appendMessage,
      sendText: sendText,
      setCollapsed: setCollapsed,
      isCollapsed: isCollapsed,
    };
  }

  global.WatchPartyChat = { create: createChat };
})(window);
