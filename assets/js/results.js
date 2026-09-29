/* Results page: view switch and per-example comparison. */
(function () {
  "use strict";
  var D = window.DEMO, U = window.U;

  function pred(model, sid) { return (D.preds[model] || {})[sid] || null; }
  function setView(v) {
    var pub = v === "published";
    U.$("sec-measured").classList.toggle("hidden", pub);
    U.$("sec-published").classList.toggle("hidden", !pub);
    U.$("view-measured").setAttribute("aria-pressed", pub ? "false" : "true");
    U.$("view-published").setAttribute("aria-pressed", pub ? "true" : "false");
    U.setParams({ view: pub ? "published" : null });
  }

  function groupsFor(task) {
    var set = {};
    Object.keys(D.samples).forEach(function (id) { var s = D.samples[id]; if (s.task === task) set[task === "ADC" ? s.subtask : s.level] = 1; });
    return Object.keys(set).sort();
  }
  function outcome(p, task) {
    if (!p || p.state === "not_run") return "none";
    if (p.state !== "scored") return "fail";
    if (task === "ALD") return "good";
    return (task === "ADC" ? p.score >= 1 : p.score >= 0.5) ? "good" : "bad";
  }
  function fillGroups() {
    var t = U.$("r-task").value, g = U.clear(U.$("r-group"));
    g.appendChild(U.el("option", { value: "" }, "All"));
    groupsFor(t).forEach(function (x) { g.appendChild(U.el("option", { value: x }, t === "ADC" ? x : U.level(x))); });
  }
  function fillSamples(keep) {
    var t = U.$("r-task").value, g = U.$("r-group").value, o = U.$("r-outcome").value, m = U.$("r-model").value, sel = U.clear(U.$("r-sample"));
    var list = Object.keys(D.samples).sort().filter(function (id) {
      var s = D.samples[id];
      if (s.task !== t) return false;
      if (g && (t === "ADC" ? s.subtask : s.level) !== g) return false;
      if (o && outcome(pred(m, id), t) !== o) return false;
      return true;
    });
    list.forEach(function (id) { var s = D.samples[id]; sel.appendChild(U.el("option", { value: id, selected: id === keep }, id + " · " + (s.subtask || U.level(s.level)))); });
    if (!list.length) sel.appendChild(U.el("option", { value: "" }, "no sample matches"));
    return sel.value;
  }

  function predBlock(s, model, reveal, v) {
    var p = pred(model, s.id), box = U.el("div", { class: "panel" });
    box.appendChild(U.el("h3", { style: "margin-top:0" }, [U.modelName(model) + " ", U.tag("model prediction", "pred"), " ", U.stateTag(p)]));
    if (!p) {
      box.appendChild(U.el("p", { class: "locked", text: "No prediction for this sample: the run status for this model is “" + U.modelStatus(model) + "”. Nothing is shown as zero." }));
      return box;
    }
    box.appendChild(U.el("h3", { text: "Raw final response (exact text)" }));
    box.appendChild(p.text != null ? U.el("pre", { text: p.text }) : U.el("p", { class: "locked", text: "No response text: " + (p.error_type || p.status) + (p.error ? " — " + p.error : "") }));
    var rows = [];
    if (s.task === "ADC") {
      rows.push(["Parsed answer", p.parsed.answer_id || "—"]);
      if (p.parsed.reason) rows.push(["Model's stated reason", [p.parsed.reason, " ", U.el("span", { class: "note", text: "(model output, not a verified fact)" })]]);
      if (reveal) rows.push(["Reference answer", [U.tag(s.ref.answer_id, "ref"), " ", p.state === "scored" ? (p.score >= 1 ? U.tag("match", "ok") : U.tag("mismatch: predicted " + p.parsed.answer_id + ", reference " + s.ref.answer_id, "bad")) : U.tag("counted as wrong: " + (p.failure || p.status), "bad")]]);
    } else if (s.task === "TDG") {
      rows.push(["Parsed interval (source clock)", p.parsed.interval_sec ? U.fmt(p.parsed.interval_sec[0], 1) + " – " + U.fmt(p.parsed.interval_sec[1], 1) + " s" : "—"]);
      if (p.state !== "scored" && p.parsed.interval_sec) rows.push(["Interval validity", [U.tag("invalid", "bad"), " must satisfy 0 ≤ start < end ≤ " + U.fmt(v.duration, 1) + " s; scored 0, not clamped"]]);
      if (reveal) { var iv = s.ref.intervals_sec[0]; rows.push(["Reference interval", [U.tag(U.fmt(iv[0], 1) + " – " + U.fmt(iv[1], 1) + " s", "ref")]]); rows.push(["Temporal IoU", U.fmt(p.score, 3)]); }
    } else {
      rows.push(["Parsed description", p.parsed.description != null ? (p.parsed.description || "(model reported no event)") : "—"]);
      rows.push(["Parsed intervals (source clock)", (p.parsed.evidence_intervals_sec || []).map(function (x) { return U.fmt(x[0], 1) + "–" + U.fmt(x[1], 1) + " s"; }).join(", ") || "—"]);
      rows.push(["Score", [U.tag("qualitative only", "norm"), " no description score is computed"]]);
      if (reveal) rows.push(["Reference description", [s.ref.description, " ", U.tag("publisher annotation", "ref")]]);
    }
    rows.push(["Parse", p.parse_status + (p.parse_rule ? " · rule " + p.parse_rule : "")]);
    rows.push(["Latency", "end-to-end " + U.fmt(p.timing.end_to_end, 0) + " ms · generation " + U.fmt(p.timing.generation, 0) + " ms · preprocess " + U.fmt(p.timing.preprocess, 0) + " ms · frame load " + U.fmt(p.timing.decode, 0) + " ms"]);
    rows.push(["Tokens / memory", "visual " + (p.visual_tokens == null ? "—" : p.visual_tokens) + " · input " + (p.in_tokens == null ? "—" : p.in_tokens) + " · output " + (p.out_tokens == null ? "—" : p.out_tokens) + " · peak allocated " + U.fmt(p.peak_gib, 1) + " GiB"]);
    rows.push(["Run / request", [U.el("span", { class: "mono", text: p.run_id + " · request " + p.request_sha256.slice(0, 12) + " · prompt " + p.prompt_sha256.slice(0, 12) })]]);
    box.appendChild(U.kv(rows));
    return box;
  }

  function render() {
    var body = U.clear(U.$("r-body")), id = U.$("r-sample").value, model = U.$("r-model").value, reveal = U.$("r-reveal").checked;
    if (!id || !D.samples[id]) { body.appendChild(U.el("p", { class: "callout warn", text: "No sample matches these filters." })); return; }
    var s = D.samples[id], v = D.videos[s.video];
    U.setParams({ sample: id, model: model });
    var pl = U.player(v, v.preview_offset), tlHost = U.el("div", { class: "tl" }), sheet = U.el("div", { class: "sheet" });
    var tracks = [], p = pred(model, id);
    if (s.task !== "ADC") {
      tracks.push({ label: "Reference", spans: reveal ? s.ref.intervals_sec.map(function (iv) { return { s: iv[0], e: iv[1], cls: "ref", text: "reference" }; }) : [], empty: reveal ? "" : "hidden — tick “Reveal reference”" });
      D.core.models.forEach(function (m) {
        var q = pred(m.id, id), spans = [];
        if (q && s.task === "TDG" && q.parsed.interval_sec) spans.push({ s: q.parsed.interval_sec[0], e: q.parsed.interval_sec[1], cls: q.state === "scored" ? "pred" : "bad", text: q.state === "scored" ? "prediction" : "invalid" });
        if (q && s.task === "ALD" && q.parsed.evidence_intervals_sec) q.parsed.evidence_intervals_sec.forEach(function (iv) { spans.push({ s: iv[0], e: iv[1], cls: "pred", text: "prediction" }); });
        tracks.push({ label: "Prediction · " + m.name, spans: spans, empty: q ? (spans.length ? "" : "no interval: " + (q.failure || "none in output")) : "not run (" + m.status + ")" });
      });
    } else tracks.push({ label: "Timeline", spans: [], empty: "ADC has no time intervals" });
    var tl = U.timeline(tlHost, v.duration, tracks, pl.seek); pl.onTime(tl.setTime);
    U.sheet(sheet, "media/frames/" + v.id, v.frames, pl.seek);

    var q = U.el("div", { class: "panel" }, [
      U.el("h3", { style: "margin-top:0" }, [s.task + (s.subtask ? " · " + s.subtask : "") + " · " + U.level(s.level) + " ", U.el("span", { class: "mono note", text: id })]),
      U.el("details", {}, [U.el("summary", { text: "Exact prompt sent to the model" }), U.el("pre", { text: s.prompt })]),
      U.el("p", {}, [U.el("a", { href: U.href("annotations.html", { sample: id }) }, "Annotation record"), " · ", U.el("a", { href: U.href("videos.html", { video: v.id, model: model }) }, "Video page")])]);
    body.appendChild(U.el("div", { class: "detail" }, [U.el("div", { class: "panel" }, [pl.node, tlHost]), U.el("div", {}, [q, U.el("div", { style: "height:12px" }), predBlock(s, model, reveal, v)])]));
    body.appendChild(U.el("h3", { text: "All models on this sample" }));
    var t = U.el("table"), tb = U.el("tbody");
    t.appendChild(U.el("thead", {}, U.el("tr", {}, ["Model", "Status", "Parsed prediction", reveal ? "Score" : "Score (hidden)", "End-to-end (ms)"].map(function (h) { return U.el("th", { text: h }); }))));
    D.core.models.forEach(function (m) {
      var x = pred(m.id, id), parsed = "—";
      if (x) parsed = s.task === "ADC" ? (x.parsed.answer_id || "—") : s.task === "TDG" ? (x.parsed.interval_sec ? U.fmt(x.parsed.interval_sec[0], 1) + "–" + U.fmt(x.parsed.interval_sec[1], 1) + " s" : "—") : (x.parsed.description || "—");
      tb.appendChild(U.el("tr", {}, [U.el("td", { text: m.name }), U.el("td", {}, U.stateTag(x)), U.el("td", { text: parsed }),
        U.el("td", { class: "n", text: !reveal ? "hidden" : !x ? "— not run" : s.task === "ALD" ? "qualitative only" : s.task === "ADC" ? (x.score >= 1 ? "correct" : "wrong") : "tIoU " + U.fmt(x.score, 3) }),
        U.el("td", { class: "n", text: x ? U.fmt(x.timing.end_to_end, 0) : "—" })]));
    });
    t.appendChild(tb); body.appendChild(U.el("div", { class: "tablewrap" }, t));
    body.appendChild(U.el("h3", { text: "Exact frames supplied to the models" })); body.appendChild(sheet);
  }

  function renderExamples() {
    var host = U.clear(U.$("r-examples"));
    if (!D.core.examples.length) { host.appendChild(U.el("p", { class: "locked", text: "No completed predictions yet, so no examples are selected." })); return; }
    D.core.examples.forEach(function (ex) {
      var s = D.samples[ex.sample_id], p = pred(ex.model, ex.sample_id), what;
      if (s.task === "ADC") what = ex.kind === "success" ? "Chose " + p.parsed.answer_id + "; reference " + s.ref.answer_id + "." : (p.state === "scored" ? "Chose " + p.parsed.answer_id + "; reference is " + s.ref.answer_id + "." : "Output not usable: " + ex.failure + ".");
      else { var iv = s.ref.intervals_sec[0]; what = (p.parsed.interval_sec ? "Predicted " + U.fmt(p.parsed.interval_sec[0], 1) + "–" + U.fmt(p.parsed.interval_sec[1], 1) + " s" : "No interval") + "; reference " + U.fmt(iv[0], 1) + "–" + U.fmt(iv[1], 1) + " s; tIoU " + U.fmt(ex.score, 2) + (p.state !== "scored" ? " (" + ex.failure + ")" : "") + "."; }
      host.appendChild(U.el("div", { class: "panel" }, [
        U.el("div", {}, [U.tag(ex.kind, ex.kind === "success" ? "ok" : "bad"), " ", U.tag("qualitative example", "manual"), " ", U.el("b", { text: U.modelName(ex.model) + " · " + s.task + (s.subtask ? " " + s.subtask : "") })]),
        U.el("p", { style: "margin:8px 0", text: what }),
        U.el("a", { href: U.href("results.html", { sample: ex.sample_id, model: ex.model }), onclick: function (e) { e.preventDefault(); open(ex.sample_id, ex.model, true); } }, "Open " + ex.sample_id)]));
    });
  }

  function open(sample, model, scroll) {
    var s = D.samples[sample];
    if (model && D.core.models.some(function (m) { return m.id === model; })) U.$("r-model").value = model;
    if (s) { U.$("r-task").value = s.task; fillGroups(); U.$("r-outcome").value = ""; }
    fillSamples(s ? sample : null);
    render();
    if (scroll) U.$("r-body").scrollIntoView({ block: "start" });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var p = U.params();
    U.$("view-measured").addEventListener("click", function () { setView("measured"); });
    U.$("view-published").addEventListener("click", function () { setView("published"); });
    if (p.view === "published") setView("published");
    U.$("r-task").addEventListener("change", function () { fillGroups(); fillSamples(); render(); });
    ["r-group", "r-outcome"].forEach(function (id) { U.$(id).addEventListener("change", function () { fillSamples(); render(); }); });
    U.$("r-model").addEventListener("change", function () { fillSamples(U.$("r-sample").value); render(); });
    U.$("r-sample").addEventListener("change", render);
    U.$("r-reveal").addEventListener("change", render);
    renderExamples();
    if (p.sample && !D.samples[p.sample]) {
      fillGroups(); fillSamples();
      U.clear(U.$("r-body")).appendChild(U.el("p", { class: "callout warn", text: "Sample “" + p.sample + "” is not part of this build. Choose a sample above." }));
      return;
    }
    open(p.sample || null, p.model || null, false);
  });
})();
