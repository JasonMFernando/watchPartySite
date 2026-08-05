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
  const movieTitleEl = document.getElementById("movie-title");
  const video = document.getElementById("player");

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
      });
    }
    if (!reactions) {
      reactions = WatchPartyReactions.create({
        barEl: document.getElementById("emoji-bar"),
        layerEl: document.getElementById("reactions-layer"),
        toggleBtn: document.getElementById("emoji-toggle"),
        shellEl: document.getElementById("player-shell"),
        sendFn: function (msg) {
          if (wp) wp.send(msg);
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

  function showWaiting() {
    waitingView.hidden = false;
    theaterView.hidden = true;
    waitingStatus.textContent = "Connecting to host…";
    waitingStatus.className = "status-msg";
  }

  let wp = WatchPartyPeer.create();
  let reconnectTimer = null;
  let destroyed = false;

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

  function bindPeerHandlers(instance) {
    instance.on("connection", function (state) {
      setConnUI(state.open);
      if (state.open) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        if (role === "guest" && !currentMovie) {
          waitingStatus.textContent =
            "Connected — waiting for the host to pick a movie…";
          waitingStatus.className = "status-msg ok";
        }
        broadcastMovieIfHost();
      } else if (!destroyed && role === "guest") {
        if (!currentMovie) {
          waitingStatus.textContent =
            "Disconnected from host. Reconnecting…";
          waitingStatus.className = "status-msg error";
        }
        scheduleGuestReconnect();
      }
    });

    instance.on("movie", function (msg) {
      if (!msg.url) return;
      showTheater({
        id: msg.id,
        title: msg.title,
        url: msg.url,
      });
    });

    instance.on("play", function (msg) {
      if (sync) sync.applyRemote(msg);
    });
    instance.on("pause", function (msg) {
      if (sync) sync.applyRemote(msg);
    });
    instance.on("seek", function (msg) {
      if (sync) sync.applyRemote(msg);
    });
    instance.on("chat", function (msg) {
      if (chat) chat.onRemote(msg);
    });
    instance.on("reaction", function (msg) {
      if (reactions) reactions.onRemote(msg);
    });

    instance.on("error", function (err) {
      if (!waitingView.hidden) {
        waitingStatus.textContent = err.message || "Connection error";
        waitingStatus.className = "status-msg error";
      }
      console.error(err);
    });
  }

  function scheduleGuestReconnect() {
    if (destroyed || role !== "guest" || reconnectTimer) return;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      if (destroyed || wp.connected) return;
      wp.destroy();
      wp = WatchPartyPeer.create();
      bindPeerHandlers(wp);
      wp
        .resumeGuest(roomCode)
        .then(function () {
          setConnUI(wp.connected);
        })
        .catch(function () {
          scheduleGuestReconnect();
        });
    }, 2000);
  }

  bindPeerHandlers(wp);

  // Initial UI
  if (currentMovie && currentMovie.url) {
    showTheater(currentMovie);
  } else if (role === "host") {
    window.location.href =
      "library.html?room=" + encodeURIComponent(roomCode) + "&role=host";
    return;
  } else {
    showWaiting();
  }

  const start =
    role === "host"
      ? wp.resumeHost(roomCode)
      : wp.resumeGuest(roomCode);

  start
    .then(function () {
      setConnUI(wp.connected);
      broadcastMovieIfHost();
    })
    .catch(function (err) {
      setConnUI(false);
      if (role === "host") {
        alert(err.message || "Could not reopen the room. Create a new room.");
        window.location.href = "index.html";
      } else {
        waitingStatus.textContent =
          (err.message || "Could not connect.") + " Retrying…";
        waitingStatus.className = "status-msg error";
        scheduleGuestReconnect();
      }
    });

  window.addEventListener("beforeunload", function () {
    destroyed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    wp.destroy();
  });
})();