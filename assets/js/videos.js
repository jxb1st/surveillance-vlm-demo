/* Videos page: filterable gallery and detail view. */
(function () {
  "use strict";
  var D = window.DEMO, U = window.U;
  var state = { video: null, model: null, revealRef: false, revealPred: false };

  function samplesOf(v) { return v.samples.map(function (id) { return D.samples[id]; }); }
  function pred(model, sid) { return (D.preds[model] || {})[sid] || null; }

  function matches(v, f) {
    if (f.q && v.id.toLowerCase().indexOf(f.q) < 0) return false;
    if (f.source && v.source !== f.source) return false;
    if (f.task && v.tasks.indexOf(f.task) < 0) return false;
    if (f.level && v.levels.indexOf(f.level) < 0) return false;
    if (f.normal === "normal" && v.normal !== true) return false;
    if (f.normal === "abnormal" && v.normal !== false) return false;
    if (f.status && (v.pred_status[f.model] || "not_run") !== f.status) return false;
    return true;
  }
  function filters() {
    return { q: U.$("f-q").value.trim().toLowerCase(), source: U.$("f-source").value, task: U.$("f-task").value,
      level: U.$("f-level").value, normal: U.$("f-normal").value, status: U.$("f-status").value, model: U.$("f-model").value };
  }

  function card(v) {
    var first = v.samples[0], model = U.$("f-model").value;
    var thumb = U.el("button", { type: "button", class: "thumb", "aria-label": "Open video " + v.id, onclick: function () { select(v.id, true); } }, [
      v.poster ? U.el("img", { src: v.poster, alt: "", loading: "lazy", decoding: "async" }) : U.el("span", { class: "note", text: "no preview" }),
      U.el("span", { class: "dur", text: U.dur(v.duration) })]);
    // Titles are neutral IDs on purpose: no event label before the viewer reveals it.
    return U.el("div", { class: "card" + (state.video === v.id ? " sel" : ""), "data-video": v.id }, [thumb,
      U.el("div", { class: "meta" }, [
        U.el("div", { class: "id", text: v.id }),
        U.el("div", { class: "chips" }, [U.tag(v.source)].concat(v.tasks.map(function (t) { return U.tag(t, "norm"); }))),
        U.el("div", { class: "links" }, [
          U.el("a", { href: U.href("annotations.html", { sample: first }) }, "Annotation"),
          U.el("a", { href: U.href("results.html", { sample: first, model: model }) }, "Results")])])]);
  }

  function renderGallery() {
    var f = filters(), host = U.clear(U.$("gallery")), n = 0;
    Object.keys(D.videos).sort().forEach(function (id) { var v = D.videos[id]; if (matches(v, f)) { host.appendChild(card(v)); n++; } });
    U.$("f-count").textContent = n + " of " + Object.keys(D.videos).length + " videos";
    if (!n) host.appendChild(U.el("p", { class: "callout warn", text: "No video matches these filters." }));
  }

  function renderDetail() {
    var host = U.$("detail");
    if (!state.video || !D.videos[state.video]) {
      host.classList.add("hidden"); U.clear(host);
      if (state.video) { host.classList.remove("hidden"); host.appendChild(U.el("p", { class: "callout warn", text: "Video “" + state.video + "” is not part of this build." })); }
      return;
    }
    var v = D.videos[state.video], ss = samplesOf(v), model = state.model;
    U.clear(host).classList.remove("hidden");
    var pl = U.player(v, v.preview_offset);
    var tlHost = U.el("div", { class: "tl" }), sheetHost = U.el("div", { class: "sheet" });

    function drawTimeline() {
      var tracks = [];
      ss.forEach(function (s) {
        var label = s.task + (s.subtask ? " " + s.subtask : "") + " · " + U.level(s.level);
        var refSpans = [], predSpans = [], p = pred(model, s.id);
        if (state.revealRef) (s.ref.intervals_sec || []).forEach(function (iv) { refSpans.push({ s: iv[0], e: iv[1], cls: "ref", text: "reference", title: "Reference interval (publisher annotation)" }); });
        if (state.revealPred && p) {
          if (s.task === "TDG" && p.parsed.interval_sec) predSpans.push({ s: p.parsed.interval_sec[0], e: p.parsed.interval_sec[1], cls: p.state === "scored" ? "pred" : "bad", text: "prediction", title: "Predicted interval (" + U.modelName(model) + ")" });
          if (s.task === "ALD" && p.parsed.evidence_intervals_sec) p.parsed.evidence_intervals_sec.forEach(function (iv) { predSpans.push({ s: iv[0], e: iv[1], cls: "pred", text: "prediction", title: "Predicted evidence interval (" + U.modelName(model) + ")" }); });
        }
        if (s.task === "ADC") return; // ADC has no temporal reference or prediction
        tracks.push({ label: "Reference · " + label, spans: refSpans, empty: state.revealRef ? "no reference interval" : "hidden — reveal reference to show" });
        tracks.push({ label: "Prediction · " + label, spans: predSpans, empty: !state.revealPred ? "hidden — reveal prediction to show" : (p ? (p.state === "scored" || predSpans.length ? "no interval in output" : "no valid interval: " + (p.failure || p.status)) : "not run for this model") });
      });
      if (!tracks.length) tracks.push({ label: "Timeline", spans: [], empty: "This video has ADC questions only; they have no time intervals." });
      var tl = U.timeline(tlHost, v.duration, tracks, pl.seek);
      pl.onTime(tl.setTime);
    }
    drawTimeline();
    U.sheet(sheetHost, "media/frames/" + v.id, v.frames, pl.seek);

    var prov = U.el("div");
    function drawProv() {
      U.clear(prov).appendChild(U.kv([
        ["Video ID", v.id, { class: "mono" }],
        ["Source dataset", v.source],
        ["Publisher file", state.revealRef ? v.source_video_id : "hidden until the reference is revealed (the filename can contain the event label)", { class: "mono" }],
        ["Media shown here", v.display_variant + (v.preview_transformation ? " (" + v.preview_transformation + ")" : "")],
        ["Media used for inference", v.inference_variant],
        ["Preview offset", U.fmt(v.preview_offset, 1) + " s (preview time + offset = source time)"],
        ["Source file SHA-256", v.sha256, { class: "mono" }],
        ["Source", U.el("a", { href: v.source_url, target: "_blank", rel: "noopener" }, v.source_url + " @ " + String(v.source_revision).slice(0, 8))],
        ["Duration / size", U.fmt(v.duration, 1) + " s · " + v.width + "×" + v.height + (v.fps ? " · " + U.fmt(v.fps, 2) + " fps" : "") + " · " + v.codec],
        ["Frames given to models", (v.frames ? v.frames.length : 0) + " frames, uniform over the whole video" + (v.frames_meta && v.frames_meta.duplicated ? " (" + v.frames_meta.duplicated + " repeated because the video has few frames)" : "")]
      ]));
    }
    drawProv();

    var qlist = U.el("div");
    function drawQuestions() {
      U.clear(qlist);
      ss.forEach(function (s) {
        var p = pred(model, s.id);
        qlist.appendChild(U.el("div", { style: "margin:0 0 8px" }, [
          U.tag(s.task + (s.subtask ? " · " + s.subtask : ""), "norm"), " ", U.tag(U.level(s.level)), " ",
          U.el("span", { class: "mono", text: s.id }), " ",
          state.revealPred ? U.stateTag(p) : U.tag("prediction hidden", "norm"), " ",
          U.el("a", { href: U.href("annotations.html", { sample: s.id }) }, "annotation"), " · ",
          U.el("a", { href: U.href("results.html", { sample: s.id, model: model }) }, "result")]));
      });
    }
    drawQuestions();

    var modelSel = U.el("select", { "aria-label": "Model", onchange: function () { state.model = this.value; U.$("f-model").value = this.value; U.setParams({ model: state.model }); drawTimeline(); drawQuestions(); renderGallery(); } },
      D.core.models.map(function (m) { return U.el("option", { value: m.id, selected: m.id === model }, m.name + (m.status !== "completed" ? " (" + m.status + ")" : "")); }));
    var cbRef = U.el("input", { type: "checkbox", id: "cb-ref", checked: state.revealRef, onchange: function () { state.revealRef = this.checked; drawTimeline(); drawProv(); } });
    var cbPred = U.el("input", { type: "checkbox", id: "cb-pred", checked: state.revealPred, onchange: function () { state.revealPred = this.checked; drawTimeline(); drawQuestions(); } });

    host.appendChild(U.el("h2", { text: "Video " + v.id, tabindex: "-1", id: "detail-h" }));
    host.appendChild(U.el("div", { class: "detail" }, [
      U.el("div", { class: "panel" }, [pl.node,
        U.el("div", { class: "filters", style: "margin-top:10px" }, [
          U.el("label", { class: "f" }, ["Model", modelSel]),
          U.el("label", { class: "check" }, [cbRef, U.el("span", {}, [" Reveal ", U.tag("reference intervals", "ref")])]),
          U.el("label", { class: "check" }, [cbPred, U.el("span", {}, [" Reveal ", U.tag("model predictions", "pred")])])]),
        tlHost,
        U.el("p", { class: "note", text: "Look at the footage first, then reveal the reference and the prediction. Click a span or a frame to seek." })]),
      U.el("div", { class: "panel" }, [U.el("h3", { style: "margin-top:0", text: "Questions on this video" }), qlist,
        U.el("h3", { text: "Provenance" }), prov])]));
    host.appendChild(U.el("h3", { text: "Exact frames supplied to the models (with source timestamps)" }));
    host.appendChild(sheetHost);
    host.appendChild(U.el("p", { class: "note", text: "Display copies are downscaled. Hover a frame for its decoded frame index and the SHA-256 of the full-size model input frame. Each model's processor resizes the frames further; see the Models page." }));
    host.appendChild(U.el("p", {}, U.el("button", { class: "btn", type: "button", onclick: function () { select(null); } }, "Close video")));
  }

  function select(id, focus) {
    state.video = id; state.revealRef = false; state.revealPred = false;
    // Keep the selected sample only while it belongs to the selected video.
    var cur = U.params().sample, keep = cur && D.samples[cur] && D.samples[cur].video === id ? cur : null;
    U.setParams({ video: id, sample: keep });
    renderDetail(); renderGallery();
    if (id && focus) { var h = U.$("detail-h"); if (h) { h.scrollIntoView({ block: "start" }); h.focus({ preventScroll: true }); } }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var p = U.params();
    if (p.model && D.core.models.some(function (m) { return m.id === p.model; })) U.$("f-model").value = p.model;
    state.model = U.$("f-model").value;
    state.video = p.video || (p.sample && D.samples[p.sample] ? D.samples[p.sample].video : null);
    ["f-q", "f-source", "f-task", "f-level", "f-normal", "f-status"].forEach(function (id) {
      U.$(id).addEventListener("input", renderGallery); U.$(id).addEventListener("change", renderGallery);
    });
    U.$("f-model").addEventListener("change", function () { state.model = this.value; U.setParams({ model: state.model }); renderDetail(); renderGallery(); });
    renderDetail(); renderGallery();
  });
})();
