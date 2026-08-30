(function () {
  const MOVIE_LIST_URL =
    "https://watchparty-movie-list.jasonmathewfd.workers.dev/";

  const roomCode =
    WatchPartyPeer.getQueryParam("room") ||
    (WatchPartyPeer.loadSession() && WatchPartyPeer.loadSession().roomCode);
  const role = WatchPartyPeer.getQueryParam("role") || "host";

  const roomDisplay = document.getElementById("room-code-display");
  const roomCountEl = document.getElementById("room-count");
  const connDot = document.getElementById("conn-dot");
  const movieGrid = document.getElementById("movie-grid");
  const libraryStatus = document.getElementById("library-status");
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

  function setRoomCount(count) {
    if (!roomCountEl) return;
    const n = typeof count === "number" ? count : 1;
    roomCountEl.textContent = n === 1 ? "1 online" : n + " online";
  }

  function setLibraryStatus(text, kind) {
    if (!libraryStatus) return;
    libraryStatus.textContent = text || "";
    libraryStatus.hidden = !text;
    libraryStatus.className =
      "library-status" + (kind ? " " + kind : "");
  }

  const wp = WatchPartyPeer.create();

  wp.on("connection", function (state) {
    setConnUI(state.open);
  });

  wp.on("presence", function (state) {
    setRoomCount(state.count);
    setConnUI(!!state.guestOnline);
  });

  wp.on("error", function (err) {
    alert(err.message || "Connection error");
  });

  setRoomCount(1);

  wp
    .startHost(roomCode)
    .then(function () {
      WatchPartyPeer.saveSession({ role: "host", roomCode: roomCode });
      setConnUI(true);
    })
    .catch(function (err) {
      alert(err.message || "Could not create room.");
      window.location.href = "index.html";
    });

  function goToTheater(movie) {
    WatchPartyPeer.saveSession({
      role: "host",
      roomCode: roomCode,
      movie: movie,
    });
    // Firebase room stays in RTDB — just leave this page
    wp.destroy();
    window.location.href =
      "theater.html?room=" + encodeURIComponent(roomCode) + "&role=host";
  }

  function selectMovie(movie) {
    const quality = WatchPartyQualities.pickInitialQuality(movie);
    const url = WatchPartyQualities.resolveUrl(movie, quality) || movie.url;
    const payload = {
      id: movie.id,
      title: movie.title,
      url: url,
      quality: quality || "",
      sources: movie.sources || {},
      qualities: movie.qualities || [],
    };
    if (quality) WatchPartyQualities.savePreferredQuality(quality);
    WatchPartyPeer.saveSession({
      role: "host",
      roomCode: roomCode,
      movie: payload,
    });

    movieGrid.querySelectorAll(".movie-card").forEach(function (btn) {
      btn.disabled = true;
    });

    // Publish movie to Firebase so guests see it even during navigation
    wp.send({ type: "movie", ...payload, at: Date.now() });
    setTimeout(function () {
      goToTheater(payload);
    }, 250);
  }

  function renderMovies(movies) {
    movieGrid.innerHTML = "";
    if (!movies.length) {
      setLibraryStatus("No movies found in the bucket yet.", "error");
      return;
    }
    setLibraryStatus("", "");

    movies.forEach(function (movie) {
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

      if (movie.qualities && movie.qualities.length) {
        const badge = document.createElement("div");
        badge.className = "movie-qualities";
        badge.textContent = movie.qualities
          .map(function (q) {
            return q + "p";
          })
          .join(" · ");
        btn.appendChild(badge);
      }

      btn.addEventListener("click", function () {
        selectMovie(movie);
      });
      movieGrid.appendChild(btn);
    });
  }

  function loadMovies() {
    setLibraryStatus("Loading movies…", "");
    movieGrid.innerHTML = "";

    fetch(MOVIE_LIST_URL)
      .then(function (res) {
        if (!res.ok) {
          throw new Error("Could not load movie list (" + res.status + ")");
        }
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) {
          throw new Error(
            (data && data.error) || "Movie list returned invalid data"
          );
        }
        renderMovies(WatchPartyQualities.groupMovies(data));
      })
      .catch(function (err) {
        setLibraryStatus(
          (err && err.message) ||
            "Could not load movies. Check your connection and try again.",
          "error"
        );
      });
  }

  loadMovies();
})();
