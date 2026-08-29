(function () {
  const params = new URLSearchParams(window.location.search);
  const session = WatchPartyPeer.loadSession() || {};
  const roomCode = params.get("room") || session.roomCode;
  const role = params.get("role") || session.role || "guest";

  const roomDisplay = document.getElementById("room-code-display");
  const connDot = document.getElementById("conn-dot");
  const waitingView = document.getElementById("waiting-view");
  const theaterView = document.getElementById("theater-view");
  const waitingStatus = document.getElementById("waiting-status");
  const waitingCopy = document.getElementById("waiting-copy");
  const movieTitleEl = document.getElementById("movie-title");
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

  if (changeMovieBtn && role === "host") {
    changeMovieBtn.hidden = false;
  }

  function setConnUI(open) {
    connDot.classList.toggle("connected", !!open);
    connDot.classList.toggle("waiting", !open);
  }

  function showTheater(movie) {
    currentMovie = movie;
    WatchPartyPeer.saveSession({
      role: role,
      roomCode: roomCode,
      movie: movie,
    });

    waitingView.hidden = true;
    theaterView.hidden = false;
    movieTitleEl.textContent = movie.title || "Untitled";

    if (video.getAttribute("data-movie-url") !== movie.url) {
      video.setAttribute("data-movie-url", movie.url);
      video.src = movie.url;
      video.load();
    }

    if (!sync) {
      sync = WatchPartySync.create(video, function (msg) {
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

  function goToLibraryForNextMovie() {
    try {
      video.pause();
    } catch (_) {}
    wp.send({ type: "movie-clear", at: Date.now() });
    WatchPartyPeer.saveSession({
      role: "host",
      roomCode: roomCode,
      movie: null,
    });
    wp.destroy();
    window.location.href =
      "library.html?room=" + encodeURIComponent(roomCode) + "&role=host";
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

  wp.on("movie", function (msg) {
    if (!msg.url) return;
    showTheater({
      id: msg.id,
      title: msg.title,
      url: msg.url,
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
    wp.destroy();
  });
})();
