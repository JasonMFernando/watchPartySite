/**
 * Sidebar text chat.
 */
(function (global) {
  function createChat(options) {
    const messagesEl = options.messagesEl;
    const emptyEl = options.emptyEl;
    const formEl = options.formEl;
    const inputEl = options.inputEl;
    const role = options.role || "you";
    const sendFn = options.sendFn;

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
    }

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      const text = (inputEl.value || "").trim();
      if (!text) return;
      const from = role === "host" ? "Host" : "Guest";
      appendMessage(text, from, true);
      sendFn({
        type: "chat",
        text: text,
        from: from,
        at: Date.now(),
      });
      inputEl.value = "";
      inputEl.focus();
    });

    function onRemote(msg) {
      if (!msg || msg.type !== "chat" || !msg.text) return;
      appendMessage(msg.text, msg.from || "Guest", false);
    }

    return { onRemote: onRemote, appendMessage: appendMessage };
  }

  global.WatchPartyChat = { create: createChat };
})(window);
