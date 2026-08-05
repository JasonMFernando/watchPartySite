(function () {
  const roomCode =
    WatchPartyPeer.getQueryParam("room") ||
    (WatchPartyPeer.loadSession() && WatchPartyPeer.loadSession().roomCode);
  const role = WatchPartyPeer.getQueryParam("role") || "host";

  const roomDisplay = document.getElementById("room-code-display");
  const connDot = document.getElementById("conn-dot");
  const movieGrid = document.getElementById("movie-grid");
  const inviteLink = document.getElementById("invite-link");
  const copyBtn = document.getElementById("copy-link-btn");

  if (!roomCode || role !== "host") {
    window.location.href = "index.html";
    return;
  }

  roomDisplay.textContent = roomCode;

  const joinUrl =
    window.location.origin +
    window.location.pathname.replace(/library\.html$/, "index.html") +
    "?room=" +
    encodeURIComponent(roomCode);
  inviteLink.value = joinUrl;

  copyBtn.addEventListener("click", function () {
    inviteLink.select();
    navigator.clipboard.writeText(inviteLink.value).then(
      function () {
        copyBtn.textContent = "Copied!";
        setTimeout(function () {
          copyBtn.textContent = "Copy link";
        }, 1500);
      },
      function () {
        document.execCommand("copy");
        copyBtn.textContent = "Copied!";
        setTimeout(function () {
          copyBtn.textContent = "Copy link";
        }, 1500);
      }
    );
  });

  function setConnUI(open) {
    connDot.classList.toggle("connected", !!open);
    connDot.classList.toggle("waiting", !open);
  }

  const wp = WatchPartyPeer.create();
  let pendingMovie = null;

  wp.on("connection", function (state) {
    setConnUI(state.open);
    if (state.open && pendingMovie) {
      wp.send({ type: "movie", ...pendingMovie, at: Date.now() });
    }
  });

  wp.on("error", function (err) {
    alert(err.message || "Connection error");
  });

  wp
    .startHost(roomCode)
    .then(function () {
      WatchPartyPeer.saveSession({ role: "host", roomCode: roomCode });
    })
    .catch(function (err) {
      alert(err.message || "Could not create room peer.");
      window.location.href = "index.html";
    });

  function goToTheater(movie) {
    WatchPartyPeer.saveSession({
      role: "host",
      roomCode: roomCode,
      movie: movie,
    });
    // Peer cannot survive navigation — theater will resume host peer
    wp.destroy();
    window.location.href =
      "theater.html?room=" + encodeURIComponent(roomCode) + "&role=host";
  }

  function selectMovie(movie) {
    const payload = {
      id: movie.id,
      title: movie.title,
      url: movie.url,
    };
    pendingMovie = payload;
    WatchPartyPeer.saveSession({
      role: "host",
      roomCode: roomCode,
      movie: payload,
    });

    if (wp.connected) {
      wp.send({ type: "movie", ...payload, at: Date.now() });
      // Brief delay so guest receives before host tears down peer
      setTimeout(function () {
        goToTheater(payload);
      }, 400);
    } else {
      // Guest not connected yet — host can still enter theater; guest gets movie on reconnect via session... 
      // Guest won't have movie until host rebroadcasts on theater. Proceed anyway.
      goToTheater(payload);
    }
  }

  (typeof MOVIES !== "undefined" ? MOVIES : []).forEach(function (movie) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "movie-card";
    btn.setAttribute("aria-label", "Select " + movie.title);

    const poster = document.createElement("div");
    poster.className = "movie-poster";

    if (movie.poster) {
      const img = document.createElement("img");
      img.src = movie.poster;
      img.alt = "";
      img.loading = "lazy";
      poster.appendChild(img);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "movie-poster-fallback";
      fallback.textContent = (movie.title || "?").charAt(0).toUpperCase();
      poster.appendChild(fallback);
    }

    const title = document.createElement("div");
    title.className = "movie-title";
    title.textContent = movie.title;

    btn.appendChild(poster);
    btn.appendChild(title);
    btn.addEventListener("click", function () {
      selectMovie(movie);
    });
    movieGrid.appendChild(btn);
  });

  window.addEventListener("beforeunload", function () {
    // leave peer alive only if staying; destroy on leave
  });
})();
