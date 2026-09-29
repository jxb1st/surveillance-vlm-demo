/* Annotations page: raw, normalized and model-facing views of one real record. */
(function () {
  "use strict";
  var D = window.DEMO, U = window.U, current = null;

  function ids() {
    var t = U.$("a-task").value, q = U.$("a-q").value.trim().toLowerCase();
    return Object.keys(D.samples).sort().filter(function (id) {
      var s = D.samples[id];
      return (!t || s.task === t) && (!q || id.indexOf(q) >= 0 || s.video.indexOf(q) >= 0);
    });
  }
  function renderList() {
    var host = U.clear(U.$("a-list")), list = ids();
    list.forEach(function (id) {
      var s = D.samples[id];
      host.appendChild(U.el("button", { type: "button", role: "option", "aria-current": id === current ? "true" : "false", "aria-selected": id === current ? "true" : "false", onclick: function () { show(id); } },
        [U.el("span", { class: "mono", text: id }), U.el("br"), U.el("span", { class: "note", text: s.task + (s.subtask ? " · " + s.subtask : "") + " · " + U.level(s.level) })]));
    });
    if (!list.length) host.appendChild(U.el("p", { class: "note", style: "padding:10px", text: "No record matches." }));
  }

  function normalized(s, v) {
    var rows = [
      ["Sample ID", [U.el("span", { class: "mono", text: s.id }), " ", U.tag("local normalization", "norm")]],
      ["Task", [s.task + (s.subtask ? " · " + s.subtask : ""), " ", U.tag("publisher annotation", "ref")]],
      ["Semantic level", [U.level(s.level) + " (" + s.level + ") ", U.tag("publisher annotation", "ref")]],
      ["Source record", U.el("span", { class: "mono", text: s.locator + " @ " + s.benchmark_revision.slice(0, 8) })],
      ["Annotation origin", s.origin],
      ["Video", [U.el("a", { href: U.href("videos.html", { video: s.video }) }, s.video), " · " + U.fmt(v.duration, 1) + " s · " + s.source]]
    ];
    var box = U.el("div");
    box.appendChild(U.kv(rows));
    if (s.task === "ADC") {
      box.appendChild(U.el("h3", { text: "Question" })); box.appendChild(U.el("p", { text: s.input.question }));
      box.appendChild(U.el("h3", { text: "Options (publisher order and IDs)" }));
      var ol = U.el("ul", { style: "list-style:none;padding:0;margin:0" });
      s.input.options.forEach(function (o) {
        var isRef = o.id === s.ref.answer_id;
        ol.appendChild(U.el("li", { style: "margin:0 0 5px" }, [U.el("b", { text: o.id + ". " }), o.text, isRef ? " " : null, isRef ? U.tag("reference answer", "ref") : null]));
      });
      box.appendChild(ol);
    } else {
      box.appendChild(U.el("h3", { text: s.task === "TDG" ? "Query description" : "Reference description" }));
      box.appendChild(U.el("p", {}, [s.ref.description, " ", U.tag("publisher annotation", "ref")]));
      box.appendChild(U.el("h3", { text: "Reference interval" }));
      var iv = s.ref.intervals_sec[0];
      box.appendChild(U.el("p", {}, [U.fmt(iv[0], 1) + " s – " + U.fmt(iv[1], 1) + " s of " + U.fmt(v.duration, 1) + " s ", U.tag("publisher annotation", "ref")]));
      var tl = U.el("div", { class: "tl" });
      U.timeline(tl, v.duration, [{ label: "Reference", spans: [{ s: iv[0], e: iv[1], cls: "ref", text: "reference" }] }], function (t) { window.location.href = U.href("videos.html", { video: s.video }); });
      box.appendChild(tl);
      box.appendChild(U.kv([["Time units", s.time.source_units], ["Validation", [U.tag(s.time.validation_status, s.time.validation_status === "verified" ? "ok" : "pend"), " " + (s.time.validation_note || "")]], ["Input clock origin", U.fmt(s.time.input_origin_sec, 1) + " s"]]));
    }
    box.appendChild(U.kv([["Bounding boxes", "not provided"], ["Person / object IDs", "not provided"], ["Confidence", "not provided"], ["Causal relations", "not provided"]]));
    return box;
  }

  function modelFacing(s) {
    var box = U.el("div");
    box.appendChild(U.el("p", {}, [U.tag("exact model input", "pred"), " The text below is sent to every model, together with " + D.core.sampling.target_frames + " video frames and their timestamps."]));
    box.appendChild(U.el("pre", { text: s.prompt }));
    box.appendChild(U.kv([["Prompt SHA-256", s.prompt_sha256, { class: "mono" }], ["Input window", U.fmt(s.input.input_window_sec[0], 1) + " – " + U.fmt(s.input.input_window_sec[1], 1) + " s (whole video)"]]));
    box.appendChild(U.el("h3", { text: "Withheld from inference" }));
    var w = U.el("div", { class: "withheld" }), ul = U.el("ul", { style: "margin:0;padding-left:18px" });
    s.withheld.forEach(function (x) { ul.appendChild(U.el("li", { class: "mono", text: x })); });
    w.appendChild(ul); box.appendChild(w);
    var why = { ADC: "The candidate descriptions and the task instruction are legitimate inputs. Nothing marks which candidate is correct.",
      TDG: "The description is the query. Its reference interval is withheld.",
      ALD: "Only the requested semantic level is supplied. The reference description and times are withheld." }[s.task];
    box.appendChild(U.el("p", { class: "note", text: why }));
    return box;
  }

  function show(id) {
    var body = U.clear(U.$("a-body"));
    current = id;
    if (!id || !D.samples[id]) {
      body.appendChild(U.el("p", { class: "callout warn", text: id ? "Record “" + id + "” is not part of this build." : "Select a record." }));
      renderList(); return;
    }
    var s = D.samples[id], v = D.videos[s.video];
    U.setParams({ sample: id });
    body.appendChild(U.el("div", { class: "filters" }, [
      U.el("b", { class: "mono", text: id }),
      U.el("a", { class: "btn", href: U.href("videos.html", { video: s.video }) }, "Watch video"),
      U.el("a", { class: "btn", href: U.href("results.html", { sample: id, model: U.params().model }) }, "See model outputs")]));
    body.appendChild(U.el("div", { class: "cols3" }, [
      U.el("div", { class: "panel col" }, [U.el("h3", {}, ["1 · Original annotation ", U.tag("publisher annotation", "ref")]), U.el("p", { class: "note", text: "Field names and values exactly as released." }), U.json(s.raw)]),
      U.el("div", { class: "panel col" }, [U.el("h3", {}, ["2 · Normalized view ", U.tag("local normalization", "norm")]), normalized(s, v)]),
      U.el("div", { class: "panel col" }, [U.el("h3", {}, ["3 · Model-facing input ", U.tag("exact model input", "pred")]), modelFacing(s)])]));
    renderList();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var p = U.params();
    U.$("a-task").addEventListener("change", renderList);
    U.$("a-q").addEventListener("input", renderList);
    show(p.sample || D.core.ann_examples.ADC);
    var sel = document.querySelector("#a-list [aria-current=true]");
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
  });
})();
