(function () {
  const params = new URLSearchParams(window.location.search);
  const session = WatchPartyPeer.loadSession() || {};
  const roomCode = params.get("room") || session.roomCode;
  const role = params.get("role") || session.role || "guest";

  const roomDisplay = document.getElementById("room-code-display");
  const roomCountEl = document.getElementById("room-count");
  const connDot = document.getElementById("conn-dot");
  const waitingView = document.getElementById("waiting-view");
  const theaterView = document.getElementById("theater-view");
  const waitingStatus = document.getElementById("waiting-status");
  const waitingCopy = document.getElementById("waiting-copy");
  const movieTitleEl = document.getElementById("movie-title");
  const partyStatus = document.getElementById("party-status");
  const qualityPicker = document.getElementById("quality-picker");
  const qualitySelect = document.getElementById("quality-select");
  const video = document.getElementById("player");
  const changeMovieBtn = document.getElementById("change-movie-btn");

  if (!roomCode) {
    window.location.href = "index.html";
    return;
  }

  roomDisplay.textContent = roomCode;
  document.title = (role === "host" ? "Host" : "Guest") + " — Watch Party";

  let currentMovie = session.movie || null;
  let sync = null;
  let chat = null;
  let reactions = null;
  let fullscreen = null;
  let destroyed = false;
  let hostPicking = false;
  let hostLeftHandled = false;
  let leaveTimer = null;
  let guestWasOnline = false;
  let switchingQuality = false;
  let currentQuality = "";

  if (changeMovieBtn && role === "host") {
    changeMovieBtn.hidden = false;
  }

  function setConnUI(open) {
    connDot.classList.toggle("connected", !!open);
    connDot.classList.toggle("waiting", !open);
  }

  function setRoomCount(count) {
    if (!roomCountEl) return;
    const n = typeof count === "number" ? count : 1;
    roomCountEl.textContent = n === 1 ? "1 online" : n + " online";
  }

  function setPartyStatus(text, kind) {
    if (!partyStatus) return;
    if (!text) {
      partyStatus.hidden = true;
      partyStatus.textContent = "";
      partyStatus.className = "party-status";
      return;
    }
    partyStatus.hidden = false;
    partyStatus.textContent = text;
    partyStatus.className = "party-status" + (kind ? " " + kind : "");
  }

  function updateQualityPicker(movie) {
    if (!qualityPicker || !qualitySelect) return;
    const quals = WatchPartyQualities.availableQualities(movie);
    qualitySelect.innerHTML = "";
    if (quals.length < 2) {
      qualityPicker.hidden = true;
      return;
    }
    quals.forEach(function (q) {
      const opt = document.createElement("option");
      opt.value = q;
      opt.textContent = q + "p";
      qualitySelect.appendChild(opt);
    });
    const selected =
      (currentQuality && quals.indexOf(currentQuality) !== -1
        ? currentQuality
        : WatchPartyQualities.pickInitialQuality(movie)) || quals[0];
    qualitySelect.value = selected;
    currentQuality = selected;
    qualityPicker.hidden = false;
  }

  function applyVideoUrl(url, opts) {
    opts = opts || {};
    if (!url) return;
    const keepTime = typeof opts.currentTime === "number" ? opts.currentTime : 0;
    const shouldPlay = !!opts.shouldPlay;

    video.setAttribute("data-movie-url", url);
    switchingQuality = true;
    video.src = url;
    video.load();

    function onReady() {
      video.removeEventListener("loadedmetadata", onReady);
      try {
        if (keepTime > 0 && isFinite(keepTime)) {
          video.currentTime = keepTime;
        }
      } catch (_) {}
      switchingQuality = false;
      if (shouldPlay) {
        const p = video.play();
        if (p && p.catch) p.catch(function () {});
      }
    }
    video.addEventListener("loadedmetadata", onReady);
  }

  function switchQuality(quality) {
    if (!currentMovie || !quality) return;
    const nextUrl = WatchPartyQualities.resolveUrl(currentMovie, quality);
    if (!nextUrl || nextUrl === video.getAttribute("data-movie-url")) {
      currentQuality = quality;
      return;
    }
    const t = video.currentTime || 0;
    const playing = !video.paused;
    currentQuality = quality;
    WatchPartyQualities.savePreferredQuality(quality);
    currentMovie = Object.assign({}, currentMovie, {
      url: nextUrl,
      quality: quality,
    });
    WatchPartyPeer.saveSession({
      role: role,
      roomCode: roomCode,
      movie: currentMovie,
    });
    applyVideoUrl(nextUrl, { currentTime: t, shouldPlay: playing });
  }

  if (qualitySelect) {
    qualitySelect.addEventListener("change", function () {
      switchQuality(qualitySelect.value);
    });
  }

  function showTheater(movie) {
    const quality =
      WatchPartyQualities.pickInitialQuality(movie) || movie.quality || "";
    const url =
      WatchPartyQualities.resolveUrl(movie, quality) || movie.url || "";
    currentQuality = quality;
    currentMovie = Object.assign({}, movie, {
      url: url,
      quality: quality,
      sources: movie.sources || {},
      qualities: WatchPartyQualities.availableQualities(movie),
    });

    WatchPartyPeer.saveSession({
      role: role,
      roomCode: roomCode,
      movie: currentMovie,
    });

    waitingView.hidden = true;
    theaterView.hidden = false;
    movieTitleEl.textContent = currentMovie.title || "Untitled";
    updateQualityPicker(currentMovie);

    if (video.getAttribute("data-movie-url") !== url) {
      applyVideoUrl(url, {
        currentTime: 0,
        shouldPlay: false,
      });
    }

    if (!sync) {
      sync = WatchPartySync.create(video, function (msg) {
        if (switchingQuality) return;
        if (wp) wp.send(msg);
      });
    }
    if (!reactions) {
      reactions = WatchPartyReactions.create({
        barEl: document.getElementById("emoji-bar"),
        layerEl: document.getElementById("reactions-layer"),
        toggleBtn: document.getElementById("emoji-toggle"),
        dndBtn: document.getElementById("dnd-toggle"),
        shellEl: document.getElementById("player-shell"),
        sendFn: function (msg) {
          if (wp) wp.send(msg);
        },
      });
    }
    if (!chat) {
      chat = WatchPartyChat.create({
        messagesEl: document.getElementById("chat-messages"),
        emptyEl: document.getElementById("chat-empty"),
        formEl: document.getElementById("chat-form"),
        inputEl: document.getElementById("chat-input"),
        role: role,
        sendFn: function (msg) {
          if (wp) wp.send(msg);
        },
        overlayFn: function (text, from) {
          if (reactions) reactions.spawnChat(text, from);
        },
      });
    }
    if (!fullscreen) {
      fullscreen = WatchPartyFullscreen.create({
        shellEl: document.getElementById("player-shell"),
        videoEl: video,
        toggleBtn: document.getElementById("fs-toggle"),
      });
    }
  }

  function showWaiting(nextMovie) {
    currentMovie = null;
    waitingView.hidden = false;
    theaterView.hidden = true;
    setPartyStatus("");
    if (qualityPicker) qualityPicker.hidden = true;
    currentQuality = "";
    try {
      video.pause();
    } catch (_) {}
    video.removeAttribute("data-movie-url");
    video.removeAttribute("src");
    video.load();

    if (waitingCopy) {
      waitingCopy.textContent = nextMovie
        ? "Host is picking the next movie. Hang tight — same room."
        : "You're in the room. The theater opens when the host picks a movie.";
    }
    waitingStatus.textContent = nextMovie
      ? "Waiting for the next movie…"
      : "In the room — waiting for the host to pick a movie…";
    waitingStatus.className = "status-msg ok";
  }

  function handleHostLeft() {
    if (hostLeftHandled || destroyed || role !== "guest") return;
    if (hostPicking) return;
    hostLeftHandled = true;
    try {
      video.pause();
    } catch (_) {}
    setConnUI(false);
    setPartyStatus("Host left the room", "error");
    if (!waitingView.hidden) {
      if (waitingCopy) {
        waitingCopy.textContent = "The host left this watch party.";
      }
      waitingStatus.textContent = "Host left — taking you home…";
      waitingStatus.className = "status-msg error";
    } else {
      waitingView.hidden = false;
      theaterView.hidden = true;
      if (waitingCopy) {
        waitingCopy.textContent = "The host left this watch party.";
      }
      waitingStatus.textContent = "Host left — taking you home…";
      waitingStatus.className = "status-msg error";
    }
    WatchPartyPeer.clearSession();
    setTimeout(function () {
      if (destroyed) return;
      wp.destroy();
      window.location.href = "index.html";
    }, 2500);
  }

  function goToLibraryForNextMovie() {
    try {
      video.pause();
    } catch (_) {}
    wp.send({ type: "picking", active: true, at: Date.now() });
    wp.send({ type: "movie-clear", at: Date.now() });
    WatchPartyPeer.saveSession({
      role: "host",
      roomCode: roomCode,
      movie: null,
    });
    // Short delay so picking + clear land before presence drops
    setTimeout(function () {
      wp.destroy();
      window.location.href =
        "library.html?room=" + encodeURIComponent(roomCode) + "&role=host";
    }, 200);
  }

  if (changeMovieBtn) {
    changeMovieBtn.addEventListener("click", function () {
      if (role !== "host") return;
      goToLibraryForNextMovie();
    });
  }

  const wp = WatchPartyPeer.create();

  function broadcastMovieIfHost() {
    if (role === "host" && currentMovie && wp.connected) {
      wp.send({
        type: "movie",
        id: currentMovie.id,
        title: currentMovie.title,
        url: currentMovie.url,
        quality: currentMovie.quality || "",
        sources: currentMovie.sources || {},
        qualities: currentMovie.qualities || [],
        at: Date.now(),
      });
      wp.send({
        type: video.paused ? "pause" : "play",
        currentTime: video.currentTime || 0,
        at: Date.now(),
      });
    }
  }

  wp.on("connection", function (state) {
    setConnUI(state.open);
    if (state.open) {
      if (role === "guest" && !currentMovie) {
        waitingStatus.textContent =
          "In the room — waiting for the host to pick a movie…";
        waitingStatus.className = "status-msg ok";
      }
      broadcastMovieIfHost();
    }
  });

  wp.on("picking", function (msg) {
    hostPicking = !!msg.active;
  });

  wp.on("presence", function (state) {
    if (destroyed || hostLeftHandled) return;

    setRoomCount(state.count);

    if (role === "host") {
      setConnUI(!!state.guestOnline);
      if (state.guestOnline) {
        guestWasOnline = true;
        setPartyStatus("");
      } else if (guestWasOnline) {
        setPartyStatus("Guest left the room", "warn");
      } else {
        setPartyStatus("Waiting for guest…", "");
      }
      return;
    }

    // Guest
    setConnUI(!!state.hostOnline);

    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }

    if (state.hostOnline) {
      if (!waitingView.hidden && !currentMovie && !hostPicking) {
        waitingStatus.textContent =
          "In the room — waiting for the host to pick a movie…";
        waitingStatus.className = "status-msg ok";
      }
      return;
    }

    // Host offline — debounce so Change movie navigation doesn't false-fire
    leaveTimer = setTimeout(function () {
      leaveTimer = null;
      if (destroyed || hostLeftHandled || hostPicking) return;
      handleHostLeft();
    }, 3500);
  });

  wp.on("movie", function (msg) {
    if (!msg.url && !(msg.sources && Object.keys(msg.sources).length)) return;
    hostPicking = false;
    setPartyStatus("");
    showTheater({
      id: msg.id,
      title: msg.title,
      url: msg.url,
      quality: msg.quality || "",
      sources: msg.sources || {},
      qualities: msg.qualities || [],
    });
  });

  wp.on("movie-clear", function () {
    if (role === "guest") {
      WatchPartyPeer.saveSession({
        role: "guest",
        roomCode: roomCode,
        movie: null,
      });
      showWaiting(true);
    }
  });

  wp.on("play", function (msg) {
    if (sync) sync.applyRemote(msg);
  });
  wp.on("pause", function (msg) {
    if (sync) sync.applyRemote(msg);
  });
  wp.on("seek", function (msg) {
    if (sync) sync.applyRemote(msg);
  });
  wp.on("chat", function (msg) {
    if (chat) chat.onRemote(msg);
  });
  wp.on("reaction", function (msg) {
    if (reactions) reactions.onRemote(msg);
  });

  wp.on("error", function (err) {
    if (!waitingView.hidden) {
      waitingStatus.textContent = err.message || "Connection error";
      waitingStatus.className = "status-msg error";
    }
    console.error(err);
  });

  // Initial UI
  if (currentMovie && currentMovie.url) {
    showTheater(currentMovie);
  } else if (role === "host") {
    window.location.href =
      "library.html?room=" + encodeURIComponent(roomCode) + "&role=host";
    return;
  } else {
    showWaiting(false);
  }

  setRoomCount(1);

  const start =
    role === "host" ? wp.resumeHost(roomCode) : wp.resumeGuest(roomCode);

  start
    .then(function () {
      setConnUI(wp.connected);
      broadcastMovieIfHost();
      if (role === "guest" && !currentMovie) {
        waitingStatus.textContent =
          "In the room — waiting for the host to pick a movie…";
        waitingStatus.className = "status-msg ok";
      }
    })
    .catch(function (err) {
      setConnUI(false);
      if (role === "host") {
        alert(err.message || "Could not open the room.");
        window.location.href = "index.html";
      } else {
        waitingStatus.textContent =
          (err.message || "Could not join room.") +
          " Check the code and that the host created the room.";
        waitingStatus.className = "status-msg error";
      }
    });

  window.addEventListener("beforeunload", function () {
    destroyed = true;
    if (leaveTimer) clearTimeout(leaveTimer);
    wp.destroy();
  });
})();
