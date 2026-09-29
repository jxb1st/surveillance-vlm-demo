/* Shared helpers. Classic script; no modules, no network access. */
(function () {
  "use strict";
  var D = window.DEMO = window.DEMO || {};
  var U = window.U = {};

  // Build DOM safely: strings always become text nodes, never HTML.
  U.el = function (tag, attrs, kids) {
    var e = document.createElement(tag), k;
    attrs = attrs || {};
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] == null || attrs[k] === false) continue;
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
    });
    return e;
  };
  U.clear = function (n) { while (n.firstChild) n.removeChild(n.firstChild); return n; };
  U.$ = function (id) { return document.getElementById(id); };
  U.fmt = function (x, d) { return x == null || isNaN(x) ? "—" : Number(x).toFixed(d == null ? 1 : d); };
  U.sec = function (x) { return x == null ? "—" : U.fmt(x, 1) + " s"; };
  U.pct = function (x) { return x == null ? "—" : (100 * x).toFixed(1) + "%"; };
  U.dur = function (s) { s = Math.round(s); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); };
  U.level = function (l) { return (D.core.level_labels || {})[l] || l; };
  U.modelName = function (id) { var m = (D.core.models || []).filter(function (x) { return x.id === id; })[0]; return m ? m.name : id; };
  U.modelStatus = function (id) { var m = (D.core.models || []).filter(function (x) { return x.id === id; })[0]; return m ? m.status : "not_run"; };
  U.tag = function (text, cls) { return U.el("span", { class: "tag " + (cls || ""), text: text }); };
  U.kv = function (pairs) {
    var dl = U.el("dl", { class: "kv" });
    pairs.forEach(function (p) { if (!p) return; dl.appendChild(U.el("dt", { text: p[0] })); dl.appendChild(U.el("dd", p[2] || {}, p[1])); });
    return dl;
  };
  U.json = function (o) { return U.el("pre", { text: JSON.stringify(o, null, 2) }); };

  // Query parameters keep the selected record across pages.
  U.params = function () {
    var o = {}, q = window.location.search.replace(/^\?/, "");
    if (!q) return o;
    q.split("&").forEach(function (kv) {
      var i = kv.indexOf("="), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? "" : kv.slice(i + 1);
      try { o[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " ")); } catch (e) { /* ignore malformed */ }
    });
    return o;
  };
  U.setParams = function (obj) {
    var p = U.params(), k, parts = [];
    for (k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) { if (obj[k] == null || obj[k] === "") delete p[k]; else p[k] = obj[k]; }
    for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(p[k]));
    var url = window.location.pathname + (parts.length ? "?" + parts.join("&") : "");
    try { window.history.replaceState(null, "", url); } catch (e) { /* file:// in some browsers */ }
    U.syncNav();
  };
  U.href = function (page, obj) {
    var parts = [], k;
    for (k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null && obj[k] !== "") parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]));
    return page + (parts.length ? "?" + parts.join("&") : "");
  };
  // Navigation links carry the current sample/model so context survives a page change.
  U.syncNav = function () {
    var p = U.params(), keep = {};
    ["sample", "model", "video"].forEach(function (k) { if (p[k]) keep[k] = p[k]; });
    if (keep.sample && D.samples && D.samples[keep.sample]) keep.video = D.samples[keep.sample].video;
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (a) {
      var page = a.getAttribute("data-nav"), o = {};
      if (page === "videos.html") o = { video: keep.video, sample: keep.sample, model: keep.model };
      else if (page === "annotations.html") o = { sample: keep.sample };
      else if (page === "results.html") o = { sample: keep.sample, model: keep.model };
      a.setAttribute("href", U.href(page, o));
    });
  };

  /* Timeline: rows of labelled, clickable spans over [0, duration] on the source clock.
     tracks: [{label, spans: [{s, e, cls, text, title}]}]; onSeek(sourceSeconds). */
  U.timeline = function (host, duration, tracks, onSeek, opts) {
    opts = opts || {};
    U.clear(host);
    var heads = [];
    tracks.forEach(function (t) {
      var track = U.el("div", { class: "tl-track" });
      t.spans.forEach(function (sp) {
        var s = Math.max(0, Math.min(duration, sp.s)), e = Math.max(0, Math.min(duration, sp.e));
        var left = 100 * s / duration, w = Math.max(0.6, 100 * (e - s) / duration);
        track.appendChild(U.el("button", {
          type: "button", class: "tl-span " + (sp.cls || ""), style: "left:" + left + "%;width:" + w + "%",
          title: (sp.title || sp.text || "") + " · " + U.fmt(sp.s) + "–" + U.fmt(sp.e) + " s (click to seek)",
          "aria-label": (t.label + ": " + (sp.title || sp.text || "") + ", " + U.fmt(sp.s) + " to " + U.fmt(sp.e) + " seconds. Seek to start."),
          onclick: function () { onSeek(sp.s); }
        }, sp.text || ""));
      });
      (t.marks || []).forEach(function (m) { track.appendChild(U.el("div", { class: "tl-mark", style: "left:" + (100 * m.t / duration) + "%", title: m.title })); });
      if (!t.spans.length && t.empty) track.appendChild(U.el("span", { class: "note", style: "position:absolute;left:6px;top:2px", text: t.empty }));
      var head = U.el("div", { class: "tl-head", style: "left:0%" });
      track.appendChild(head); heads.push(head);
      host.appendChild(U.el("div", { class: "tl-row" }, [U.el("div", { class: "tl-label" }, t.labelNode || t.label), track]));
    });
    host.appendChild(U.el("div", { class: "tl-axis" }, [U.el("span", { text: "0 s" }), U.el("span", { text: U.fmt(duration / 2) + " s" }), U.el("span", { text: U.fmt(duration) + " s" })]));
    return { setTime: function (t) { var p = Math.max(0, Math.min(100, 100 * t / duration)); heads.forEach(function (h) { h.style.left = p + "%"; }); } };
  };

  /* Contact sheet of the exact frames supplied to the models. */
  U.sheet = function (host, dir, frames, onSeek) {
    U.clear(host);
    if (!frames || !frames.length) { host.appendChild(U.el("p", { class: "note", text: "Frames are not available in this build." })); return; }
    frames.forEach(function (f) {
      var name = ("00" + f.slot).slice(-3) + ".jpg";
      host.appendChild(U.el("button", { type: "button", title: "Frame " + (f.slot + 1) + " · source time " + U.fmt(f.t, 2) + " s · decoded frame index " + f.idx + " · sha256 " + f.sha.slice(0, 12), "aria-label": "Frame " + (f.slot + 1) + " at " + U.fmt(f.t, 1) + " seconds. Seek video.", onclick: function () { onSeek(f.t); } },
        [U.el("img", { src: dir + "/" + name, alt: "", loading: "lazy", decoding: "async" }), U.el("span", { text: U.fmt(f.t, 1) + "s" })]));
    });
  };

  /* Video player with playback-speed selection. No autoplay; metadata-only preload. */
  U.player = function (video, offset) {
    offset = offset || 0;
    var wrap = U.el("div");
    var v = U.el("video", { controls: true, preload: "metadata", playsinline: true, muted: true });
    if (video.poster) v.setAttribute("poster", video.poster);
    var missing = U.el("p", { class: "callout warn hidden", text: "This video file is missing from the build or cannot be played by this browser." });
    if (video.preview) { v.src = video.preview; } else { missing.classList.remove("hidden"); v.classList.add("hidden"); }
    v.addEventListener("error", function () { missing.classList.remove("hidden"); });
    var speed = U.el("select", { "aria-label": "Playback speed", onchange: function () { v.playbackRate = Number(this.value); } },
      ["0.25", "0.5", "1", "1.5", "2"].map(function (s) { return U.el("option", { value: s, selected: s === "1" }, s + "×"); }));
    var clock = U.el("span", { class: "note mono", text: "" });
    wrap.appendChild(v); wrap.appendChild(missing);
    wrap.appendChild(U.el("div", { class: "filters", style: "margin:8px 0 0" }, [U.el("label", { class: "f" }, ["Playback speed", speed]), clock]));
    var api = {
      node: wrap, video: v,
      seek: function (sourceSec) { try { v.currentTime = Math.max(0, sourceSec - offset); } catch (e) { /* not ready */ } v.focus({ preventScroll: true }); },
      onTime: function (fn) { v.addEventListener("timeupdate", function () { fn(v.currentTime + offset); }); v.addEventListener("seeked", function () { fn(v.currentTime + offset); }); }
    };
    api.onTime(function (t) { clock.textContent = "source time " + U.fmt(t, 1) + " s"; });
    return api;
  };

  U.stateTag = function (p) {
    if (!p) return U.tag("not_run", "pend");
    if (p.state === "scored") return U.tag("completed · valid output", "ok");
    if (p.state === "unparsed") return U.tag("invalid output: " + (p.failure || p.parse_status), "bad");
    return U.tag("failed: " + (p.failure || p.status), "bad");
  };

  document.addEventListener("DOMContentLoaded", U.syncNav);
})();
