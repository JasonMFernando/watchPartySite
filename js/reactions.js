/**
 * Emoji reaction bar + floating animations over the video.
 */
(function (global) {
  const EMOJIS = ["❤️", "😂", "😮", "👏", "🍿"];

  function createReactions(options) {
    const barEl = options.barEl;
    const layerEl = options.layerEl;
    const sendFn = options.sendFn;

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

    function onRemote(msg) {
      if (!msg || msg.type !== "reaction" || !msg.emoji) return;
      spawn(msg.emoji);
    }

    return { onRemote: onRemote, spawn: spawn };
  }

  global.WatchPartyReactions = { create: createReactions, EMOJIS: EMOJIS };
})(window);
