/**
 * PeerJS room helpers + JSON message protocol for Watch Party.
 * Expects PeerJS loaded globally as `Peer`.
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

  /**
   * @typedef {object} WatchPartyPeer
   * @property {import('peerjs').Peer|null} peer
   * @property {import('peerjs').DataConnection|null} conn
   * @property {string|null} roomCode
   * @property {'host'|'guest'|null} role
   * @property {boolean} connected
   * @property {function(object): void} send
   * @property {function(string, function): void} on
   * @property {function(): void} destroy
   */

  function createWatchParty() {
    /** @type {WatchPartyPeer} */
    const api = {
      peer: null,
      conn: null,
      roomCode: null,
      role: null,
      connected: false,
      _handlers: {},
      _peerOpen: false,
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

    api.send = function (msg) {
      if (!api.conn || !api.conn.open) return false;
      try {
        api.conn.send(msg);
        return true;
      } catch (err) {
        console.error("send failed", err);
        return false;
      }
    };

    function wireConnection(conn) {
      api.conn = conn;

      conn.on("open", function () {
        api.connected = true;
        emit("connection", { open: true });
        api.send({
          type: "hello",
          role: api.role,
          at: Date.now(),
        });
      });

      conn.on("data", function (data) {
        if (!data || typeof data !== "object" || !data.type) return;
        emit("message", data);
        emit(data.type, data);
      });

      conn.on("close", function () {
        api.connected = false;
        emit("connection", { open: false });
      });

      conn.on("error", function (err) {
        emit("error", { message: err && err.message ? err.message : String(err) });
      });
    }

    /**
     * Host: register with room code as Peer ID and accept one guest.
     * Retries briefly when the ID is still releasing after a page navigation.
     */
    api.startHost = function (roomCode, retryCount) {
      const retriesLeft = typeof retryCount === "number" ? retryCount : 5;

      return new Promise(function (resolve, reject) {
        api.role = "host";
        api.roomCode = roomCode;
        api._peerOpen = false;

        if (api.peer) {
          try {
            api.peer.destroy();
          } catch (_) {}
          api.peer = null;
        }

        const peer = new Peer(roomCode, {
          debug: 1,
        });
        api.peer = peer;

        peer.on("open", function (id) {
          api._peerOpen = true;
          saveSession({ role: "host", roomCode: id });
          resolve(id);
        });

        peer.on("connection", function (conn) {
          if (api.conn && api.conn.open) {
            conn.close();
            return;
          }
          wireConnection(conn);
        });

        peer.on("error", function (err) {
          const unavailable = err && err.type === "unavailable-id";
          const msg = unavailable
            ? "That room code is already in use. Create a new room."
            : err && err.message
              ? err.message
              : "Peer connection error";

          if (!api._peerOpen && unavailable && retriesLeft > 0) {
            try {
              peer.destroy();
            } catch (_) {}
            setTimeout(function () {
              api
                .startHost(roomCode, retriesLeft - 1)
                .then(resolve)
                .catch(reject);
            }, 800);
            return;
          }

          if (!api._peerOpen) {
            reject(new Error(msg));
          } else {
            emit("error", { message: msg });
          }
        });

        peer.on("disconnected", function () {
          emit("connection", { open: false, peerDisconnected: true });
        });
      });
    };

    /**
     * Guest: anonymous peer, connect to host room code.
     */
    api.joinAsGuest = function (roomCode) {
      return new Promise(function (resolve, reject) {
        api.role = "guest";
        api.roomCode = roomCode;

        const peer = new Peer({
          debug: 1,
        });
        api.peer = peer;

        peer.on("open", function () {
          api._peerOpen = true;
          saveSession({ role: "guest", roomCode: roomCode });

          const conn = peer.connect(roomCode, { reliable: true });
          wireConnection(conn);

          const timeout = setTimeout(function () {
            if (!api.connected) {
              reject(new Error("Could not reach the host. Check the code and that the host is online."));
            }
          }, 15000);

          conn.on("open", function () {
            clearTimeout(timeout);
            resolve(roomCode);
          });

          conn.on("error", function (err) {
            clearTimeout(timeout);
            reject(new Error(err && err.message ? err.message : "Failed to connect"));
          });
        });

        peer.on("error", function (err) {
          const msg = err && err.message ? err.message : "Peer connection error";
          if (!api._peerOpen) {
            reject(new Error(msg));
          } else {
            emit("error", { message: msg });
          }
        });
      });
    };

    /**
     * Resume host peer on library/theater pages (same tab session).
     */
    api.resumeHost = function (roomCode) {
      return api.startHost(roomCode);
    };

    /**
     * Resume guest connection on theater (reconnect to host).
     */
    api.resumeGuest = function (roomCode) {
      return api.joinAsGuest(roomCode);
    };

    api.destroy = function () {
      try {
        if (api.conn) api.conn.close();
      } catch (_) {}
      try {
        if (api.peer) api.peer.destroy();
      } catch (_) {}
      api.conn = null;
      api.peer = null;
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
