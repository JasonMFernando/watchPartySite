/**
 * Group R2 movie files that differ only by 480P / 720P / 1080P in the name.
 */
(function (global) {
  const QUALITY_ORDER = ["1080", "720", "480"];
  const QUALITY_RE = /(?:^|[.\-_ ])(480|720|1080)P(?:[.\-_ ]|$)/i;

  function filenameFromMovie(movie) {
    if (movie && movie.filename) return String(movie.filename);
    const url = (movie && movie.url) || "";
    try {
      const path = decodeURIComponent(new URL(url).pathname);
      return path.split("/").pop() || "";
    } catch (_) {
      return String(movie && movie.id ? movie.id : "");
    }
  }

  function detectQuality(name) {
    const m = String(name || "").match(QUALITY_RE);
    return m ? m[1] : null;
  }

  function groupKey(name) {
    return String(name || "")
      .replace(/\.mp4$/i, "")
      .replace(/\.(480|720|1080)P\./gi, ".")
      .replace(/[.\-_ ](480|720|1080)P(?=[.\-_ ]|$)/gi, "")
      .replace(/(480|720|1080)P/gi, "")
      .replace(/[.\-_ ]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .toLowerCase();
  }

  function preferUrl(sources) {
    if (!sources) return "";
    for (let i = 0; i < QUALITY_ORDER.length; i++) {
      const q = QUALITY_ORDER[i];
      if (sources[q]) return sources[q];
    }
    const keys = Object.keys(sources);
    return keys.length ? sources[keys[0]] : "";
  }

  function titleFromGroupKey(key, fallback) {
    if (fallback && !/480p|720p|1080p/i.test(fallback)) return fallback;
    // Prefer "Show - S01E01" when present
    const ep = key.match(/^(.*?)\.(s\d{1,2}e\d{1,2})\b/i);
    if (ep) {
      const show = ep[1].replace(/\./g, " ").replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
      return show + " - " + ep[2].toUpperCase();
    }
    return key
      .replace(/\./g, " ")
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function groupMovies(list) {
    const map = {};
    (list || []).forEach(function (movie) {
      if (!movie || !movie.url) return;
      const name = filenameFromMovie(movie);
      const q = detectQuality(name);
      const key = groupKey(name) || String(movie.id || movie.url);
      if (!map[key]) {
        map[key] = {
          id: key,
          title: titleFromGroupKey(key, movie.title),
          poster: movie.poster || "",
          sources: {},
          url: movie.url,
        };
      }
      if (q) {
        map[key].sources[q] = movie.url;
      } else {
        // No quality token — keep as default / "auto" slot
        map[key].sources.default = movie.url;
      }
      if (movie.poster && !map[key].poster) map[key].poster = movie.poster;
      // Prefer nicer title from Worker when available
      if (movie.title && !/480p|720p|1080p/i.test(movie.title)) {
        map[key].title = movie.title;
      }
    });

    return Object.keys(map)
      .map(function (key) {
        const item = map[key];
        item.url = preferUrl(item.sources) || item.url;
        item.qualities = Object.keys(item.sources)
          .filter(function (q) {
            return q !== "default";
          })
          .sort(function (a, b) {
            return (
              QUALITY_ORDER.indexOf(b) - QUALITY_ORDER.indexOf(a) ||
              Number(b) - Number(a)
            );
          });
        return item;
      })
      .sort(function (a, b) {
        return String(a.title).localeCompare(String(b.title), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }

  function availableQualities(movie) {
    if (!movie) return [];
    if (movie.qualities && movie.qualities.length) return movie.qualities.slice();
    if (movie.sources) {
      return Object.keys(movie.sources)
        .filter(function (q) {
          return q !== "default" && movie.sources[q];
        })
        .sort(function (a, b) {
          return QUALITY_ORDER.indexOf(b) - QUALITY_ORDER.indexOf(a);
        });
    }
    return [];
  }

  function resolveUrl(movie, quality) {
    if (!movie) return "";
    const sources = movie.sources || {};
    if (quality && sources[quality]) return sources[quality];
    return preferUrl(sources) || movie.url || "";
  }

  function loadPreferredQuality() {
    try {
      return localStorage.getItem("watchparty-quality") || "";
    } catch (_) {
      return "";
    }
  }

  function savePreferredQuality(q) {
    try {
      if (q) localStorage.setItem("watchparty-quality", q);
    } catch (_) {}
  }

  function pickInitialQuality(movie) {
    const quals = availableQualities(movie);
    if (!quals.length) return "";
    const pref = loadPreferredQuality();
    if (pref && quals.indexOf(pref) !== -1) return pref;
    for (let i = 0; i < QUALITY_ORDER.length; i++) {
      if (quals.indexOf(QUALITY_ORDER[i]) !== -1) return QUALITY_ORDER[i];
    }
    return quals[0];
  }

  global.WatchPartyQualities = {
    groupMovies: groupMovies,
    availableQualities: availableQualities,
    resolveUrl: resolveUrl,
    pickInitialQuality: pickInitialQuality,
    savePreferredQuality: savePreferredQuality,
    QUALITY_ORDER: QUALITY_ORDER,
  };
})(window);
