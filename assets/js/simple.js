/* Simple site: Examples page and Benchmarks page. Classic script, no network access. */
(function () {
  "use strict";
  var D = window.DEMO, U = window.U, X = D.ex;
  var COLORS = ["#2a78d6", "#eb6834", "#1baf7a"];
  var TASK_NAME = { ADC: "Choose a description", TDG: "Find the time", ALD: "Describe the anomaly" };
  function color(mid) { var i = X.models.map(function (m) { return m.id; }).indexOf(mid); return COLORS[i] || "#888"; }
  function span(iv) { return iv ? U.fmt(iv[0], 1) + " – " + U.fmt(iv[1], 1) + " s" : "—"; }
  function good(s, o) { return o && o.state === "scored" && (s.task === "ADC" ? o.score >= 1 : s.task === "TDG" ? o.score >= 0.5 : true); }
  function player(v) { return U.player({ preview: v.src, poster: v.poster }, 0); }

  function mark(ok) { return U.el("span", { class: ok ? "mark-ok" : "mark-no", title: ok ? "matches the ground truth" : "does not match the ground truth", text: ok ? "✓" : "✗" }); }

  /* ---------------- Examples page ---------------- */
  function examples() {
    var st = { task: "ADC", id: null };
    function list() { return Object.keys(X.samples).filter(function (k) { return X.samples[k].task === st.task; }).sort(); }

    function renderVideo(s, v) {
      var host = U.clear(U.$("video")), pl = player(v);
      host.appendChild(pl.node);
      host.appendChild(U.el("div", { class: "chipset", style: "margin:8px 0" }, [U.tag(U.fmt(v.duration, 1) + " s"), U.tag(v.source), U.tag(X.frames + " frames given to each model", "norm")]));
      if (s.task !== "ADC") {
        var tracks = [{ label: "Ground truth", spans: s.interval ? [{ s: s.interval[0], e: s.interval[1], cls: "ref", text: "ground truth" }] : [] }];
        X.models.forEach(function (m) {
          var o = s.out[m.id], sp = [];
          if (o && s.task === "TDG" && o.interval) sp.push({ s: o.interval[0], e: o.interval[1], color: color(m.id), text: m.name });
          if (o && s.task === "ALD" && o.intervals) o.intervals.forEach(function (iv) { sp.push({ s: iv[0], e: iv[1], color: color(m.id), text: m.name }); });
          tracks.push({ label: m.name, spans: sp, empty: o ? "no interval" : "not run" });
        });
        var tl = U.el("div", { class: "tl" }), api = U.timeline(tl, v.duration, tracks, pl.seek);
        pl.onTime(api.setTime); host.appendChild(tl);
      }
    }

    function renderGT(s) {
      var host = U.clear(U.$("gt"));
      if (s.task === "ADC") {
        host.appendChild(U.el("p", { class: "q", text: s.question }));
        var ul = U.el("ul", { class: "opts" });
        s.options.forEach(function (o) {
          var picks = U.el("span", { class: "picks" });
          X.models.forEach(function (m) { var x = s.out[m.id]; if (x && x.answer === o.id) picks.appendChild(U.el("i", { class: "pick", style: "background:" + color(m.id), title: m.name + " chose this" })); });
          ul.appendChild(U.el("li", { class: o.id === s.answer ? "right" : "" }, [U.el("b", { text: o.id }), U.el("span", {}, [o.text, o.id === s.answer ? " " : null, o.id === s.answer ? U.tag("correct answer", "ref") : null, picks])]));
        });
        host.appendChild(ul);
        host.appendChild(U.el("p", { class: "note", style: "margin-top:8px", text: "Dots show which model chose which option." }));
      } else if (s.task === "TDG") {
        host.appendChild(U.el("p", { class: "q", text: "The model is given this description and must find when it happens:" }));
        host.appendChild(U.el("p", { class: "desc", text: "“" + s.description + "”" }));
        host.appendChild(U.el("p", { class: "q", text: "Correct time interval" }));
        host.appendChild(U.el("p", { class: "big", text: span(s.interval) }));
      } else {
        host.appendChild(U.el("p", { class: "q", text: "The model is asked to find and describe: " + U.level(s.level).toLowerCase() }));
        host.appendChild(U.el("p", { class: "q", text: "Reference description" }));
        host.appendChild(U.el("p", { class: "desc", text: s.description }));
        host.appendChild(U.el("p", { class: "q", text: "Reference time interval" }));
        host.appendChild(U.el("p", { class: "big", text: span(s.interval) }));
      }
      host.appendChild(U.el("div", { class: "chipset" }, [U.tag(s.subtask ? s.task + " · " + s.subtask : s.task, "norm"), U.tag(U.level(s.level)), U.el("span", { class: "tag mono", text: s.id })]));
    }

    function renderOut(s) {
      var host = U.clear(U.$("out"));
      X.models.forEach(function (m) {
        var o = s.out[m.id], card = U.el("div", { class: "mcard", style: "--c:" + color(m.id) });
        var top = U.el("div", { class: "top" }, [U.el("span", { class: "name", text: m.name })]);
        card.appendChild(top);
        if (!o) { card.appendChild(U.el("p", { class: "why", text: "No output: run status is " + m.status + "." })); host.appendChild(card); return; }
        if (o.state !== "scored") {
          top.appendChild(U.tag("unusable output: " + o.failure, "bad"));
        } else if (s.task === "ALD") top.appendChild(U.tag("not scored", "norm"));
        else top.appendChild(mark(good(s, o)));
        if (s.task === "ADC") {
          card.appendChild(U.el("div", { class: "ans", text: o.answer ? "Chose " + o.answer : "—" }));
          if (o.reason) card.appendChild(U.el("p", { class: "why", text: o.reason }));
        } else if (s.task === "TDG") {
          card.appendChild(U.el("div", { class: "ans", text: span(o.interval) }));
          card.appendChild(U.el("p", { class: "why", text: o.state === "scored" ? "Overlap with ground truth (tIoU): " + Math.round(100 * o.score) + "%" : "Counted as 0% overlap." }));
        } else {
          card.appendChild(U.el("p", { class: "why", style: "font-size:14.5px", text: o.description === "" ? "(the model reported no event)" : (o.description || "—") }));
          if (o.intervals && o.intervals.length) card.appendChild(U.el("div", { class: "ans", style: "font-size:17px;margin-top:4px", text: o.intervals.map(span).join(", ") }));
        }
        card.appendChild(U.el("details", { class: "more", style: "margin:8px 0 0" }, [U.el("summary", { text: "Raw response · " + U.fmt(o.ms, 0) + " ms" }), U.el("pre", { text: o.text == null ? "(no text)" : o.text })]));
        host.appendChild(card);
      });
    }

    function renderThumbs() {
      var host = U.clear(U.$("thumbs"));
      list().forEach(function (id) {
        var s = X.samples[id], v = X.videos[s.video], dots = U.el("span", { class: "dots" });
        if (s.task !== "ALD") X.models.forEach(function (m) { var o = s.out[m.id]; dots.appendChild(U.el("i", { style: "background:" + (!o || o.state !== "scored" ? "#9aa3af" : good(s, o) ? "#2a78d6" : "#eb6834"), title: m.name })); });
        host.appendChild(U.el("button", { type: "button", "aria-current": id === st.id ? "true" : "false", "aria-label": "Open example " + id, title: id, onclick: function () { show(id, true); } },
          [v.poster ? U.el("img", { src: v.poster, alt: "", loading: "lazy", decoding: "async" }) : null, s.task !== "ALD" ? dots : null]));
      });
    }

    function show(id, scroll) {
      var s = X.samples[id];
      if (!s) { id = list()[0]; s = X.samples[id]; }
      st.id = id; st.task = s.task;
      Array.prototype.forEach.call(document.querySelectorAll("#task-seg [data-task]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-task") === st.task ? "true" : "false"); });
      var l = list();
      U.$("pos").textContent = (l.indexOf(id) + 1) + " of " + l.length;
      renderVideo(s, X.videos[s.video]); renderGT(s); renderOut(s); renderThumbs();
      var raw = U.clear(U.$("raw"));
      raw.appendChild(U.el("div", {}, [U.el("h3", { text: "Prompt sent to every model" }), U.el("pre", { text: s.prompt })]));
      raw.appendChild(U.el("div", {}, [U.el("h3", { text: "Raw publisher annotation" }), U.json(s.raw)]));
      U.setParams({ sample: id });
      if (scroll) window.scrollTo({ top: 0 });
    }
    function step(d) { var l = list(), i = l.indexOf(st.id); show(l[(i + d + l.length) % l.length]); }

    Array.prototype.forEach.call(document.querySelectorAll("#task-seg [data-task]"), function (b) { b.addEventListener("click", function () { st.task = b.getAttribute("data-task"); show(list()[0]); }); });
    U.$("prev").addEventListener("click", function () { step(-1); });
    U.$("next").addEventListener("click", function () { step(1); });
    document.addEventListener("keydown", function (e) {
      if (/^(INPUT|SELECT|TEXTAREA|VIDEO)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1);
    });
    var p = U.params();
    show(p.sample && X.samples[p.sample] ? p.sample : list()[0]);
  }

  /* ---------------- Benchmarks page ---------------- */
  function qa(k, a) { return U.el("div", { class: "qa" }, [U.el("span", { class: "k", text: k }), U.el("span", { class: "a", text: a })]); }
  function source(smp) { return U.el("p", { class: "note" }, ["Record ", U.el("span", { class: "mono", text: smp.key }), " of " + smp.records_in_file.toLocaleString() + " in ", U.el("span", { class: "mono", text: smp.file }), smp.revision ? " @ " + smp.revision.slice(0, 8) : ""]); }
  function rawBox(o) { return U.el("details", { class: "more" }, [U.el("summary", { text: "Raw record" }), U.json(o)]); }

  function withVideo(smp, build) {
    var right = U.el("div"), box;
    if (smp.video && smp.video.src) {
      var pl = player(smp.video), left = U.el("div", {}, [pl.node]);
      if (smp.spans && smp.spans.length && smp.time_units) {
        var tl = U.el("div", { class: "tl" });
        var api = U.timeline(tl, smp.video.duration, [{ label: "Annotated spans", spans: smp.spans.map(function (x, i) { return { s: x.s, e: x.e, cls: "ref", text: String(i + 1), title: x.text }; }) }], pl.seek);
        pl.onTime(api.setTime); left.appendChild(tl);
      }
      left.appendChild(U.el("p", { class: "note", text: "Video: the VALU publisher-masked copy of the same source video." + (smp.clip_note ? " " + smp.clip_note : "") }));
      box = U.el("div", { class: "rec" }, [left, right]);
      build(right, pl.seek);
    } else {
      box = U.el("div", { class: "rec novideo" }, [right]);
      right.appendChild(U.el("p", { class: "locked", text: "No video shown: this benchmark's videos are not part of this demo." }));
      build(right, function () {});
    }
    right.appendChild(source(smp)); right.appendChild(rawBox(smp.record));
    return box;
  }

  var RENDER = {
    UCA: function (smp) { return withVideo(smp, function (h, seek) {
      smp.spans.forEach(function (x, i) { h.appendChild(U.el("div", { class: "qa" }, [U.el("button", { class: "btn", type: "button", style: "padding:2px 8px;font-size:12.5px", onclick: function () { seek(x.s); } }, (i + 1) + " · " + span([x.s, x.e])), U.el("span", { class: "a", text: x.text })])); });
    }); },
    HIVAU: function (smp) { return withVideo(smp, function (h) {
      var r = smp.record;
      h.appendChild(U.el("div", { class: "chipset", style: "margin-bottom:8px" }, r.label.map(function (l) { return U.tag("label: " + l, "ref"); }).concat(r.events.map(function (e) { return U.tag("event " + span(e)); }))));
      h.appendChild(qa("Clip caption", (r.clips_caption[0] || [""])[0]));
      h.appendChild(qa("Video summary", r.video_summary));
      (smp.instructions || []).forEach(function (x) { h.appendChild(qa("Instruction (" + x.task + "): " + x.prompt, x.anwser)); });
    }); },
    FINEVAU: function (smp) { return withVideo(smp, function (h) {
      var r = smp.record, sc = r.scene || {};
      h.appendChild(U.el("div", { class: "chipset", style: "margin-bottom:8px" }, Object.keys(sc).map(function (k) { return U.tag(k.replace(/_/g, " ") + ": " + sc[k]); })));
      h.appendChild(qa("Entities", (r.entities || []).map(function (e) { return e.id + " (" + e.category + ")"; }).join(" · ")));
      ((r.events || {}).refined_events || []).slice(0, 4).forEach(function (e) { h.appendChild(qa(e.event_type + " · timestamp " + JSON.stringify(e.timestamp) + " (unit not verified)", e.event_description)); });
    }); },
    SVQA: function (smp) { return withVideo(smp, function (h) {
      Object.keys(smp.record).forEach(function (g) { (smp.record[g] || []).slice(0, 1).forEach(function (p) { h.appendChild(qa(g.replace(/_qa_pairs$/, "").replace(/_/g, " ") + " · " + p.Q, p.A)); }); });
    }); },
    CUVA: function (smp) { return withVideo(smp, function (h) {
      smp.record.forEach(function (r) { var q = r.instruction.trim().split("\n")[0]; h.appendChild(qa(r.task + " · " + (q.length > 150 ? q.slice(0, 150) + "…" : q), r.output)); });
    }); }
  };

  function valu(host) {
    var tabs = U.el("div", { class: "tabs" }), body = U.el("div");
    function show(t) {
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-t") === t ? "true" : "false"); });
      var s = X.samples[D.cat.valu[t]], v = X.videos[s.video], right = U.el("div"), pl = player(v), left = U.el("div", {}, [pl.node]);
      if (s.interval) { var tl = U.el("div", { class: "tl" }); var api = U.timeline(tl, v.duration, [{ label: "Ground truth", spans: [{ s: s.interval[0], e: s.interval[1], cls: "ref", text: "ground truth" }] }], pl.seek); pl.onTime(api.setTime); left.appendChild(tl); }
      if (t === "ADC") { right.appendChild(qa("Question", s.question)); s.options.forEach(function (o) { right.appendChild(U.el("div", { class: "qa", style: o.id === s.answer ? "border-color:var(--ref);background:var(--ref-soft)" : "" }, [U.el("span", { class: "k", text: o.id + (o.id === s.answer ? " · correct answer" : "") }), U.el("span", { class: "a", text: o.text })])); }); }
      else { right.appendChild(qa(t === "TDG" ? "Description given to the model" : "Reference description (hidden from the model)", s.description)); right.appendChild(qa("Time interval", span(s.interval))); right.appendChild(qa("Semantic level", U.level(s.level))); }
      right.appendChild(U.el("p", {}, U.el("a", { class: "btn primary", href: U.href("index.html", { sample: s.id }) }, "See what the models answered")));
      right.appendChild(rawBox(s.raw));
      U.clear(body).appendChild(U.el("div", { class: "rec" }, [left, right]));
    }
    ["ADC", "TDG", "ALD"].forEach(function (t) { tabs.appendChild(U.el("button", { class: "btn", type: "button", "data-t": t, "aria-pressed": "false", onclick: function () { show(t); } }, t + " · " + TASK_NAME[t])); });
    host.appendChild(tabs); host.appendChild(body); show("ADC");
  }

  function benchmarks() {
    Array.prototype.forEach.call(document.querySelectorAll(".bmsample"), function (host) {
      var id = host.getAttribute("data-bm");
      if (id === "VALU") return valu(host);
      var smp = D.cat.samples[id];
      if (!smp || !RENDER[id]) { host.appendChild(U.el("p", { class: "locked", text: "No sample record was extracted for this benchmark in this build." })); return; }
      host.appendChild(RENDER[id](smp));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    if (page === "index.html") examples(); else if (page === "benchmarks.html") benchmarks();
  });
})();
