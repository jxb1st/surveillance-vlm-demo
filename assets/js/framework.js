/* Framework page: scripted edge replay over real cached server inference. */
(function () {
  "use strict";
  var D = window.DEMO, U = window.U;
  var STAGE_MSG = [
    "Monitoring: the edge detector watches the stream. The rolling buffer keeps recent video.",
    "Trigger: the scripted edge trigger fires.",
    "Context selection: a window around the trigger is taken from the buffer and uploaded.",
    "Server analysis: the Video VLM reads frames from the uploaded window. The result stays locked until the window has been played to its end.",
    "Result: cached output of the real server inference on this window."
  ];
  var st = { c: null, stage: 0, reachedEnd: false, playing: false, timer: null, tl: null };

  function caseById(id) { return D.replay.cases.filter(function (c) { return c.id === id; })[0]; }
  function v() { return U.$("rv"); }
  function winLen() { var w = st.c.replay.window_source_sec; return w[1] - w[0]; }
  function trigOffset() { return st.c.replay.trigger_source_sec - st.c.replay.window_source_sec[0]; }
  function atEnd() { var d = v().duration || winLen(); return v().ended || v().currentTime >= d - 0.25; }

  function drawTimeline() {
    var c = st.c, r = c.replay, tracks = [
      { label: "Source video (" + U.fmt(c.video_duration, 1) + " s)", spans: [{ s: r.window_source_sec[0], e: r.window_source_sec[1], cls: "win", text: "uploaded window", title: "Window sent to the server" }],
        marks: st.stage >= 1 ? [{ t: r.trigger_source_sec, title: "Scripted trigger at " + U.fmt(r.trigger_source_sec, 1) + " s" }] : [] }
    ];
    var p = c.prediction;
    tracks.push({ label: "Server evidence interval", spans: (st.stage === 4 && p && p.evidence ? p.evidence.map(function (iv) { return { s: iv[0], e: iv[1], cls: "pred", text: "model evidence", title: "Evidence interval stated by the model" }; }) : []),
      empty: st.stage === 4 ? (p ? "model gave no interval" : "no cached result") : "locked until the result stage" });
    st.tl = U.timeline(U.$("rtl"), c.video_duration, tracks, function (t) {
      var w = r.window_source_sec; try { v().currentTime = Math.max(0, Math.min(winLen(), t - w[0])); } catch (e) { /* not ready */ }
    });
    st.tl.setTime(r.window_source_sec[0] + (v().currentTime || 0));
  }

  function drawSide() {
    var c = st.c, r = c.replay, side = U.clear(U.$("rside")), p = c.prediction;
    side.appendChild(U.el("h3", { style: "margin-top:0", text: r.theme_label }));
    var rows = [["Edge detector", [U.tag("scripted", "manual"), " " + r.edge_detector]]];
    if (st.stage >= 1) { rows.push(["Trigger reason", [r.trigger_reason, " ", U.tag("scripted", "manual")]]); rows.push(["Trigger time", U.fmt(r.trigger_source_sec, 1) + " s on the source clock — " + r.trigger_origin]); }
    if (st.stage >= 2) {
      rows.push(["Selected upload window", U.fmt(r.window_source_sec[0], 1) + " – " + U.fmt(r.window_source_sec[1], 1) + " s (" + U.fmt(winLen(), 1) + " s), original-video offset " + U.fmt(r.window_source_sec[0], 1) + " s"]);
      rows.push(["Pre-trigger context", U.fmt(r.pre_trigger_context_sec, 1) + " s"]);
      rows.push(["Post-trigger context", (r.post_trigger_context_included ? "included, " : "not included, ") + U.fmt(r.post_trigger_context_sec, 1) + " s"]);
    }
    if (st.stage >= 3) {
      rows.push(["Server model", D.replay.run ? D.replay.run.display_name + " (" + D.replay.run.checkpoint + " @ " + D.replay.run.model_revision.slice(0, 8) + ", thinking " + D.replay.run.thinking + ")" : "not run"]);
      rows.push(["Model input", (p ? p.n_frames : D.core.sampling.target_frames) + " frames sampled uniformly from the window only, plus the replay prompt"]);
    }
    side.appendChild(U.kv(rows));
    if (st.stage === 3) side.appendChild(U.el("p", { class: "locked", text: atEnd() ? "The window has been played to its end. Go to the next stage to see the result." : "Result locked: the replay has not reached the end of the uploaded window yet." }));
    if (st.stage === 4) {
      if (!p) side.appendChild(U.el("p", { class: "locked", text: "No cached server result in this build (replay run status: " + D.replay.status + "). Nothing is simulated." }));
      else {
        var res = U.el("div", { class: "result" }, [
          U.el("div", {}, [U.tag("real cached server inference", "pred"), " ", U.tag(p.status, p.status === "completed" ? "ok" : "bad")]),
          U.kv([["Decision", p.decision || "—"],
            ["Evidence interval", p.evidence && p.evidence.length ? U.fmt(p.evidence[0][0], 1) + " – " + U.fmt(p.evidence[0][1], 1) + " s (source clock)" : "—"],
            ["Explanation", [p.explanation || "—", " ", U.el("span", { class: "note", text: "(model output, not a verified fact)" })]],
            ["Measured model latency", "end-to-end " + U.fmt(p.timing.end_to_end, 0) + " ms, generation " + U.fmt(p.timing.generation, 0) + " ms (cached frames; model load excluded)"],
            ["Input check", p.frames_match_window ? "all " + p.n_frames + " sampled frames lie inside the uploaded window" : "WARNING: frames outside the window"],
            ["Run", p.run_id, { class: "mono" }]]),
          U.el("details", {}, [U.el("summary", { text: "Raw final response and prompt" }), U.el("pre", { text: p.text == null ? "(no text)" : p.text }), U.el("pre", { text: c.prompt })]),
          U.el("details", {}, [U.el("summary", { text: "Publisher annotation for this video (not shown to the model)" }),
            U.el("p", {}, [U.tag("publisher annotation", "ref"), " " + U.level(c.publisher_reference.level) + ", " + U.fmt(c.publisher_reference.interval_sec[0], 1) + "–" + U.fmt(c.publisher_reference.interval_sec[1], 1) + " s: " + c.publisher_reference.description])])]);
        side.appendChild(res);
      }
    }
  }

  function drawStages() {
    Array.prototype.forEach.call(document.querySelectorAll("#stages li"), function (li) {
      var i = Number(li.getAttribute("data-stage"));
      li.className = i === st.stage ? "on" : i < st.stage ? "done" : "";
      if (i === st.stage) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
    U.$("stage-msg").textContent = STAGE_MSG[st.stage];
    U.$("btn-prev").disabled = st.stage === 0;
    U.$("btn-next").disabled = st.stage === 4;
    U.$("btn-next").textContent = st.stage === 3 && !atEnd() ? "Skip to end of window and show result" : "Next stage";
    U.$("btn-play").textContent = st.playing ? "Pause replay" : "Play replay";
    Array.prototype.forEach.call(document.querySelectorAll("[data-node]"), function (g) {
      var on = { 0: ["camera", "edge", "buffer", "monitor"], 1: ["edge", "gate"], 2: ["buffer", "window"], 3: ["server"], 4: ["output", "operator"] }[st.stage];
      g.setAttribute("opacity", on.indexOf(g.getAttribute("data-node")) >= 0 ? "1" : "0.7");
    });
  }
  function draw() { drawStages(); drawSide(); drawTimeline(); }

  function setStage(n, fromPlay) {
    n = Math.max(0, Math.min(4, n));
    if (n === 4 && !atEnd()) {
      // The result is never revealed before the replay reaches the end of the supplied window.
      try { v().pause(); v().currentTime = Math.max(0, (v().duration || winLen()) - 0.05); } catch (e) { /* not ready */ }
    }
    st.stage = n;
    if (!fromPlay && n < 4) stopPlay();
    draw();
  }
  function stopPlay() { st.playing = false; try { v().pause(); } catch (e) { /* ignore */ } if (st.timer) { clearTimeout(st.timer); st.timer = null; } }
  function play() {
    if (st.playing) { stopPlay(); drawStages(); return; }
    if (st.stage === 4) reset();
    st.playing = true; drawStages();
    var pr = v().play(); if (pr && pr.catch) pr.catch(function () { st.playing = false; drawStages(); });
  }
  function onTime() {
    var t = v().currentTime;
    if (st.tl) st.tl.setTime(st.c.replay.window_source_sec[0] + t);
    if (!st.playing) { if (st.stage === 3) { drawSide(); drawStages(); } return; }
    // Presentation timing only: stages follow playback position, not measured latency.
    var trig = trigOffset();
    if (st.stage === 0 && t >= trig) setStage(1, true);
    else if (st.stage === 1 && t >= trig + 1.5) setStage(2, true);
    else if (st.stage === 2 && t >= trig + 3.0) setStage(3, true);
    if (atEnd() && st.stage < 4) { st.playing = false; setStage(4, true); }
  }
  function reset() { stopPlay(); try { v().currentTime = 0; } catch (e) { /* ignore */ } st.stage = 0; draw(); }

  function selectCase(id) {
    var c = caseById(id) || D.replay.cases[0];
    stopPlay(); st.c = c; st.stage = 0;
    Array.prototype.forEach.call(document.querySelectorAll("#case-seg [data-case]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-case") === c.id ? "true" : "false"); });
    var vid = v();
    vid.removeAttribute("src"); if (c.poster) vid.setAttribute("poster", c.poster);
    if (c.preview) { vid.src = c.preview; vid.load(); }
    U.$("rv-note").textContent = c.preview ? "This player shows exactly the uploaded window (" + U.fmt(c.replay.window_source_sec[0], 1) + "–" + U.fmt(c.replay.window_source_sec[1], 1) + " s of the source video). Player time 0 equals source time " + U.fmt(c.replay.window_source_sec[0], 1) + " s." : "The clip for this window is missing from the build.";
    U.sheet(U.$("rframes"), c.frames_dir, c.frames, function (t) { try { vid.currentTime = Math.max(0, t - c.replay.window_source_sec[0]); } catch (e) { /* ignore */ } });
    U.setParams({ case: c.id });
    draw();
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!D.replay || !D.replay.cases.length || !U.$("rv")) return;
    Array.prototype.forEach.call(document.querySelectorAll("#case-seg [data-case]"), function (b) { b.addEventListener("click", function () { selectCase(b.getAttribute("data-case")); }); });
    U.$("btn-prev").addEventListener("click", function () { setStage(st.stage - 1); });
    U.$("btn-next").addEventListener("click", function () { setStage(st.stage + 1); });
    U.$("btn-play").addEventListener("click", play);
    U.$("btn-reset").addEventListener("click", reset);
    v().addEventListener("timeupdate", onTime);
    v().addEventListener("ended", onTime);
    v().addEventListener("loadedmetadata", draw);
    selectCase(U.params().case);
  });
})();
