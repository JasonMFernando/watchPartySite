(function () {
  const statusEl = document.getElementById("status-msg");
  const createBtn = document.getElementById("create-room-btn");
  const joinBtn = document.getElementById("join-room-btn");
  const codeInput = document.getElementById("room-code-input");

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    statusEl.className = "status-msg" + (kind ? " " + kind : "");
  }

  function normalizeCode(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  const prefill = WatchPartyPeer.getQueryParam("room");
  if (prefill) {
    codeInput.value = normalizeCode(prefill);
  }

  createBtn.addEventListener("click", function () {
    const roomCode = WatchPartyPeer.generateRoomCode(6);
    WatchPartyPeer.saveSession({ role: "host", roomCode: roomCode, movie: null });
    window.location.href =
      "library.html?room=" + encodeURIComponent(roomCode) + "&role=host";
  });

  function joinRoom() {
    const roomCode = normalizeCode(codeInput.value);
    if (roomCode.length < 4) {
      setStatus("Enter a valid room code.", "error");
      return;
    }

    WatchPartyPeer.saveSession({ role: "guest", roomCode: roomCode, movie: null });
    setStatus("Joining room…", "ok");
    window.location.href =
      "theater.html?room=" + encodeURIComponent(roomCode) + "&role=guest";
  }

  joinBtn.addEventListener("click", joinRoom);
  codeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      joinRoom();
    }
  });
})();
