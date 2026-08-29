/**
 * Watch Party room layer backed by Firebase Realtime Database.
 * Keeps the WatchPartyPeer API so library/theater need minimal changes.
 */
(function (global) {
  const STORAGE_KEY = "watchparty";

  function generateRoomCode(length) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    const len = length || 6;
    for (let i = 0; i < len; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function saveSession(data) {
    const prev = loadSession() || {};
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...data }));
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function makeClientId() {
    return (
      "c_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function ensureFirebase() {
    if (typeof firebase === "undefined") {
      throw new Error("Firebase SDK failed to load.");
    }
    if (!global.WATCHPARTY_FIREBASE_CONFIG) {
      throw new Error("Firebase config missing.");
    }
    if (!firebase.apps.length) {
      firebase.initializeApp(global.WATCHPARTY_FIREBASE_CONFIG);
    }
    return firebase.database();
  }

  function createWatchParty() {
    const api = {
      peer: null,
      conn: null,
      roomCode: null,
      role: null,
      connected: false,
      clientId: makeClientId(),
      _handlers: {},
      _db: null,
      _roomRef: null,
      _unsubs: [],
      _presenceRef: null,
    };

    function emit(event, payload) {
      const list = api._handlers[event] || [];
      list.forEach(function (fn) {
        try {
          fn(payload);
        } catch (err) {
          console.error(err);
        }
      });
    }

    api.on = function (event, fn) {
      if (!api._handlers[event]) api._handlers[event] = [];
      api._handlers[event].push(fn);
    };

    function setConnected(open) {
      api.connected = !!open;
      emit("connection", { open: api.connected });
    }

    function bindRoomListeners() {
      const roomRef = api._roomRef;

      const movieRef = roomRef.child("movie");
      const movieHandler = movieRef.on("value", function (snap) {
        const movie = snap.val();
        if (!movie || !movie.url) return;
        emit("movie", {
          type: "movie",
          id: movie.id,
          title: movie.title,
          url: movie.url,
          at: movie.at || Date.now(),
        });
      });
      api._unsubs.push(function () {
        movieRef.off("value", movieHandler);
      });

      const playbackRef = roomRef.child("playback");
      const playbackHandler = playbackRef.on("value", function (snap) {
        const msg = snap.val();
        if (!msg || !msg.type) return;
        if (msg.by && msg.by === api.clientId) return;
        emit(msg.type, msg);
      });
      api._unsubs.push(function () {
        playbackRef.off("value", playbackHandler);
      });

      const chatRef = roomRef.child("chat");
      const chatHandler = chatRef.on("child_added", function (snap) {
        const msg = snap.val();
        if (!msg || !msg.text) return;
        if (msg.by && msg.by === api.clientId) return;
        emit("chat", {
          type: "chat",
          text: msg.text,
          from: msg.from || "Guest",
          at: msg.at || Date.now(),
        });
      });
      api._unsubs.push(function () {
        chatRef.off("child_added", chatHandler);
      });

      const reactionRef = roomRef.child("reactions");
      const reactionHandler = reactionRef.on("child_added", function (snap) {
        const msg = snap.val();
        if (!msg || !msg.emoji) return;
        if (msg.by && msg.by === api.clientId) return;
        emit("reaction", {
          type: "reaction",
          emoji: msg.emoji,
          at: msg.at || Date.now(),
        });
      });
      api._unsubs.push(function () {
        reactionRef.off("child_added", reactionHandler);
      });

      // Other party presence → green/yellow dot feels right
      const presenceRef = roomRef.child("presence");
      const presenceHandler = presenceRef.on("value", function (snap) {
        const all = snap.val() || {};
        const otherRole = api.role === "host" ? "guest" : "host";
        let otherOnline = false;
        Object.keys(all).forEach(function (key) {
          const p = all[key];
          if (p && p.role === otherRole) otherOnline = true;
        });
        // Stay "connected" to the room as long as Firebase join succeeded;
        // prefer showing linked when the other person is also here.
        if (api.role === "host") {
          setConnected(true);
        } else {
          setConnected(true);
        }
        emit("presence", { otherOnline: otherOnline, all: all });
      });
      api._unsubs.push(function () {
        presenceRef.off("value", presenceHandler);
      });
    }

    function attachPresence() {
      const presenceRef = api._roomRef.child("presence").child(api.clientId);
      api._presenceRef = presenceRef;
      const payload = {
        role: api.role,
        at: Date.now(),
      };
      return presenceRef
        .set(payload)
        .then(function () {
          return presenceRef.onDisconnect().remove();
        })
        .catch(function (err) {
          console.warn("presence failed", err);
        });
    }

    function joinRoom(roomCode, role, createIfMissing) {
      return new Promise(function (resolve, reject) {
        let db;
        try {
          db = ensureFirebase();
        } catch (err) {
          reject(err);
          return;
        }

        api._db = db;
        api.role = role;
        api.roomCode = roomCode;
        api._roomRef = db.ref("rooms/" + roomCode);

        api._roomRef
          .once("value")
          .then(function (snap) {
            const exists = snap.exists();
            if (!exists && !createIfMissing) {
              throw new Error(
                "Room not found. Check the code — the host must create the room first."
              );
            }

            const tasks = [];
            if (!exists && createIfMissing) {
              tasks.push(
                api._roomRef.update({
                  createdAt: Date.now(),
                  createdBy: api.clientId,
                })
              );
            }

            return Promise.all(tasks).then(function () {
              bindRoomListeners();
              return attachPresence();
            });
          })
          .then(function () {
            saveSession({ role: role, roomCode: roomCode });
            setConnected(true);
            resolve(roomCode);
          })
          .catch(function (err) {
            emit("error", {
              message: err && err.message ? err.message : String(err),
            });
            reject(err);
          });
      });
    }

    api.send = function (msg) {
      if (!api._roomRef || !msg || !msg.type) return false;
      const at = msg.at || Date.now();

      try {
        if (msg.type === "movie") {
          api._roomRef.child("movie").set({
            id: msg.id || "",
            title: msg.title || "",
            url: msg.url || "",
            at: at,
            by: api.clientId,
          });
          return true;
        }

        if (
          msg.type === "play" ||
          msg.type === "pause" ||
          msg.type === "seek"
        ) {
          api._roomRef.child("playback").set({
            type: msg.type,
            currentTime: typeof msg.currentTime === "number" ? msg.currentTime : 0,
            at: at,
            by: api.clientId,
            role: api.role,
          });
          return true;
        }

        if (msg.type === "chat") {
          api._roomRef.child("chat").push({
            type: "chat",
            text: String(msg.text || "").slice(0, 500),
            from: msg.from || (api.role === "host" ? "Host" : "Guest"),
            at: at,
            by: api.clientId,
          });
          return true;
        }

        if (msg.type === "reaction") {
          const ref = api._roomRef.child("reactions").push({
            type: "reaction",
            emoji: msg.emoji,
            at: at,
            by: api.clientId,
          });
          // Keep reaction feed small
          setTimeout(function () {
            try {
              ref.remove();
            } catch (_) {}
          }, 5000);
          return true;
        }

        if (msg.type === "hello") {
          return true;
        }
      } catch (err) {
        console.error("firebase send failed", err);
        emit("error", {
          message: err && err.message ? err.message : String(err),
        });
        return false;
      }
      return false;
    };

    api.startHost = function (roomCode) {
      return joinRoom(roomCode, "host", true);
    };

    api.resumeHost = function (roomCode) {
      return joinRoom(roomCode, "host", true);
    };

    api.joinAsGuest = function (roomCode) {
      return joinRoom(roomCode, "guest", false);
    };

    api.resumeGuest = function (roomCode) {
      return joinRoom(roomCode, "guest", false);
    };

    api.destroy = function () {
      api._unsubs.forEach(function (fn) {
        try {
          fn();
        } catch (_) {}
      });
      api._unsubs = [];

      if (api._presenceRef) {
        try {
          api._presenceRef.onDisconnect().cancel();
        } catch (_) {}
        try {
          api._presenceRef.remove();
        } catch (_) {}
        api._presenceRef = null;
      }

      api._roomRef = null;
      api.connected = false;
    };

    return api;
  }

  global.WatchPartyPeer = {
    generateRoomCode: generateRoomCode,
    getQueryParam: getQueryParam,
    saveSession: saveSession,
    loadSession: loadSession,
    clearSession: clearSession,
    create: createWatchParty,
  };
})(window);
