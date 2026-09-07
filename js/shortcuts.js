/**
 * Fullscreen-only keyboard shortcuts:
 *  ← / →  pick reaction, Enter send
 *  T      open quick chat (empty box auto-dismisses)
 */
(function (global) {
  const EMPTY_IDLE_MS = 2800;

  function isEditableTarget(el) {
    if (!el || el === document.body) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function isEscapeKey(e) {
    return e.key === "Escape" || e.key === "Esc" || e.code === "Escape";
  }

  function createShortcuts(options) {
    const fullscreen = options.fullscreen;
    const reactions = options.reactions;
    const chat = options.chat;
    const quickForm = options.quickForm;
    const quickInput = options.quickInput;

    if (!fullscreen || !reactions) {
      return { destroy: function () {} };
    }

    let quickOpen = false;
    let emptyTimer = null;

    function isFs() {
      return !!(fullscreen.isActive && fullscreen.isActive());
    }

    function isQuickOpen() {
      return quickOpen;
    }

    function clearEmptyTimer() {
      if (emptyTimer) {
        clearTimeout(emptyTimer);
        emptyTimer = null;
      }
    }

    function inputIsEmpty() {
      return !quickInput || !(quickInput.value || "").trim();
    }

    function scheduleEmptyDismiss() {
      clearEmptyTimer();
      if (!quickOpen || !inputIsEmpty()) return;
      emptyTimer = setTimeout(function () {
        emptyTimer = null;
        if (quickOpen && inputIsEmpty()) closeQuickChat(true);
      }, EMPTY_IDLE_MS);
    }

    function closeQuickChat(clear) {
      clearEmptyTimer();
      if (!quickForm) return;
      quickOpen = false;
      quickForm.hidden = true;
      quickForm.setAttribute("aria-hidden", "true");
      if (clear && quickInput) quickInput.value = "";
      if (quickInput && document.activeElement === quickInput) {
        try {
          quickInput.blur();
        } catch (_) {}
      }
    }

    function openQuickChat() {
      if (!quickForm || !quickInput) return;
      if (reactions.clearKeyboardFocus) reactions.clearKeyboardFocus();
      clearEmptyTimer();
      quickOpen = true;
      quickForm.hidden = false;
      quickForm.setAttribute("aria-hidden", "false");
      quickInput.value = "";
      setTimeout(function () {
        try {
          quickInput.focus();
        } catch (_) {}
        scheduleEmptyDismiss();
      }, 0);
    }

    function submitQuickChat() {
      if (!quickInput || !chat || typeof chat.sendText !== "function") return;
      const text = (quickInput.value || "").trim();
      if (!text) {
        closeQuickChat(true);
        return;
      }
      chat.sendText(text);
      closeQuickChat(true);
    }

    function consumeEscKeepFullscreen(e) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
      if (typeof fullscreen.holdExit === "function") {
        fullscreen.holdExit(800);
      }
      setTimeout(function () {
        if (typeof fullscreen.reclaim === "function") fullscreen.reclaim();
      }, 0);
    }

    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const fsOn = isFs();
      const escaping = isEscapeKey(e);

      // Empty quick chat: don't fight Esc — just let the box go away.
      // (Browser may also exit fullscreen; that's OK for the empty case.)
      if (quickOpen && escaping && inputIsEmpty()) {
        closeQuickChat(true);
        return;
      }

      // Has text: Esc cancels the draft and keeps watching.
      if (quickOpen && escaping && !inputIsEmpty()) {
        consumeEscKeepFullscreen(e);
        closeQuickChat(true);
        return;
      }

      if (!fsOn) {
        if (quickOpen) closeQuickChat(true);
        if (reactions.clearKeyboardFocus) reactions.clearKeyboardFocus();
        return;
      }

      if (quickOpen) return;

      if (isEditableTarget(document.activeElement)) return;

      if (escaping) {
        if (reactions.hasKeyboardFocus && reactions.hasKeyboardFocus()) {
          consumeEscKeepFullscreen(e);
          reactions.clearKeyboardFocus();
          return;
        }
        if (typeof fullscreen.clearHoldExit === "function") {
          fullscreen.clearHoldExit();
        }
        if (typeof fullscreen.exit === "function") fullscreen.exit();
        return;
      }

      const key = e.key;

      if (key === "t" || key === "T") {
        e.preventDefault();
        openQuickChat();
        return;
      }

      if (key === "ArrowLeft") {
        e.preventDefault();
        reactions.moveKeyboardFocus(-1);
        return;
      }

      if (key === "ArrowRight") {
        e.preventDefault();
        reactions.moveKeyboardFocus(1);
        return;
      }

      if (key === "Enter") {
        if (reactions.hasKeyboardFocus && reactions.hasKeyboardFocus()) {
          e.preventDefault();
          reactions.confirmKeyboardFocus();
        }
      }
    }

    function onFsChange() {
      if (isFs()) return;
      if (fullscreen.isHoldingExit && fullscreen.isHoldingExit()) return;
      closeQuickChat(true);
      if (reactions.clearKeyboardFocus) reactions.clearKeyboardFocus();
    }

    function onQuickInput() {
      if (!quickOpen) return;
      if (inputIsEmpty()) scheduleEmptyDismiss();
      else clearEmptyTimer();
    }

    function onQuickBlur() {
      // Click away with nothing typed → box disappears (no Esc needed).
      setTimeout(function () {
        if (!quickOpen) return;
        if (document.activeElement === quickInput) return;
        if (inputIsEmpty()) closeQuickChat(true);
      }, 0);
    }

    if (quickForm) {
      quickForm.addEventListener("submit", function (e) {
        e.preventDefault();
        submitQuickChat();
      });
    }

    if (quickInput) {
      quickInput.addEventListener("input", onQuickInput);
      quickInput.addEventListener("blur", onQuickBlur);
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);

    return {
      isQuickOpen: isQuickOpen,
      openQuickChat: openQuickChat,
      closeQuickChat: closeQuickChat,
      destroy: function () {
        clearEmptyTimer();
        document.removeEventListener("keydown", onKeyDown, true);
        document.removeEventListener("fullscreenchange", onFsChange);
        document.removeEventListener("webkitfullscreenchange", onFsChange);
        if (quickInput) {
          quickInput.removeEventListener("input", onQuickInput);
          quickInput.removeEventListener("blur", onQuickBlur);
        }
        closeQuickChat(true);
        if (reactions.clearKeyboardFocus) reactions.clearKeyboardFocus();
      },
    };
  }

  global.WatchPartyShortcuts = { create: createShortcuts };
})(window);
