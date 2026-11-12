// Lecture 5.3 — immortal time in an ICU cohort (misclassified, excluded, time-varying, landmark)
// and protopathic bias with a lag window. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // Immortal time. Everyone has the same daily death hazard; the drug does nothing.
  // A share of patients would be started after an exponential wait, if still alive.
  V.register("immortal-icu", function (root) {
    var N = 4000, F = 28, H = 0.012, SHOW = 8;
    var rand = V.rng(2718281829);
    for (var w0 = 0; w0 < 300; w0++) rand();
    var U = [];
    for (var i = 0; i < N; i++) U.push([rand(), rand(), rand()]);

    var ctr = V.controls(root);
    var sShare = V.slider(ctr, { label: "Share who would be started on anticoagulation", min: 20, max: 80, step: 5, value: 50, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sWait = V.slider(ctr, { label: "Average wait from AF onset to the first dose", min: 0.5, max: 7, step: 0.5, value: 2.5, fmt: function (v) { return V.fmt.num(v, 1) + " days"; }, onInput: draw });
    var sL = V.slider(ctr, { label: "Landmark day (for the landmark analysis)", min: 1, max: 7, step: 1, value: 3, fmt: function (v) { return "day " + v; }, onInput: draw });
    var view = V.toggle(root, { options: [
      { value: "mis", label: "Misclassified" },
      { value: "exc", label: "Excluded" },
      { value: "tv", label: "Time-varying" },
      { value: "lm", label: "Landmark" }
    ], value: "mis", onChange: draw });

    var desc = el("p", { class: "widget-note", style: "margin:0.6rem 0 0.2rem" }, root);
    var legHost = el("div", null, root);
    var c = V.svg(root, 640, 380);
    c.setAttribute("aria-label", "Timelines for 16 sample ICU patients over 28 days, showing how the time before the first anticoagulant dose is counted under the chosen analysis, and deaths");
    var host = el("g", null, c);

    var out = V.readouts(root, [
      { key: "mis", label: "Rate ratio: misclassified immortal time", cls: "bad" },
      { key: "exc", label: "Rate ratio: excluded immortal time", cls: "bad" },
      { key: "tv", label: "Rate ratio: time-varying exposure", cls: "good" },
      { key: "lm", label: "Rate ratio: landmark", cls: "good" }
    ]);
    var foot = el("p", { class: "widget-note" }, root);

    var DESC = {
      mis: "Misclassified: anyone ever anticoagulated is “treated” from AF onset, so the wait before the first dose (amber) is counted as treated time in which nobody in the group can die.",
      exc: "Excluded: the wait is deleted from the treated group (dashed), but never-treated patients keep all their time, including the early deaths of people who would have been treated had they lived.",
      tv: "Time-varying: each patient counts as untreated until the first dose and treated afterwards, so every day is allocated to the exposure the patient actually had on that day.",
      lm: "Landmark: only patients still alive and followed at the landmark are analysed, grouped by whether treatment started by then, with the clock restarted at the landmark."
    };

    function simulate() {
      var share = sShare.value() / 100, mean = sWait.value(), P = [];
      for (var i = 0; i < N; i++) {
        var u = U[i], e = -Math.log(u[0]) / H, sched = u[1] < share, w = -mean * Math.log(u[2]);
        var tr = sched && w < Math.min(e, F);
        P.push({ tr: tr, w: tr ? w : null, end: Math.min(e, F), died: e <= F });
      }
      return P;
    }
    function rr(a, b) { return (a.d / a.t) / (b.d / b.t); }

    function draw() {
      var P = simulate(), L = sL.value(), v = view.value();
      var A = { mis: [{ d: 0, t: 0 }, { d: 0, t: 0 }], exc: [{ d: 0, t: 0 }, { d: 0, t: 0 }], tv: [{ d: 0, t: 0 }, { d: 0, t: 0 }], lm: [{ d: 0, t: 0 }, { d: 0, t: 0 }] };
      var dropped = 0;
      P.forEach(function (p) {
        var dd = p.died ? 1 : 0;
        if (p.tr) {
          A.mis[0].d += dd; A.mis[0].t += p.end;
          A.exc[0].d += dd; A.exc[0].t += p.end - p.w;
          A.tv[0].d += dd; A.tv[0].t += p.end - p.w; A.tv[1].t += p.w;
        } else {
          A.mis[1].d += dd; A.mis[1].t += p.end;
          A.exc[1].d += dd; A.exc[1].t += p.end;
          A.tv[1].d += dd; A.tv[1].t += p.end;
        }
        if (p.end > L) {
          var k = p.tr && p.w <= L ? 0 : 1;
          A.lm[k].d += dd; A.lm[k].t += p.end - L;
        } else dropped++;
      });
      ["mis", "exc", "tv", "lm"].forEach(function (k) { out[k](rr(A[k][0], A[k][1]).toFixed(2)); });
      desc.textContent = DESC[v];
      foot.textContent = "Illustrative simulation of 4,000 patients. Death risk about 1.2% a day for everyone, whether treated or not, so the true rate ratio is 1. The landmark analysis dropped " + V.fmt.int(dropped) + " patients (" + V.fmt.pct(dropped / N) + ") who died before day " + L + ".";

      clear(legHost);
      var leg = [{ cls: "s1", label: "Counted as treated" }, { cls: "s5", label: "Counted as untreated" }];
      if (v === "mis") leg.splice(1, 0, { cls: "s2", label: "Immortal time counted as treated" });
      if (v === "exc" || v === "lm") leg.push({ cls: "s5", label: "Not analysed", dashed: true });
      leg.push({ cls: "s3", label: "Death" });
      V.legend(legHost, leg);

      // pick sample patients: first SHOW treated and first SHOW never treated
      var tr = [], un = [];
      for (var i = 0; i < N && (tr.length < SHOW || un.length < SHOW); i++) {
        if (P[i].tr && tr.length < SHOW) tr.push(P[i]);
        else if (!P[i].tr && un.length < SHOW) un.push(P[i]);
      }
      clear(host);
      var x0 = 120, x1 = 620, x = V.scale(0, F, x0, x1), rowH = 19, top = 14;
      var rows = tr.concat(un);
      el("text", { x: 4, y: top + rowH * SHOW / 2 - 2, class: "viz-small viz-bold", text: "Eventually" }, host);
      el("text", { x: 4, y: top + rowH * SHOW / 2 + 13, class: "viz-small viz-bold", text: "treated" }, host);
      el("text", { x: 4, y: top + rowH * (SHOW * 1.5) + 14 - 2, class: "viz-small viz-bold", text: "Never" }, host);
      el("text", { x: 4, y: top + rowH * (SHOW * 1.5) + 14 + 13, class: "viz-small viz-bold", text: "treated" }, host);
      function seg(a, b, y, cls, dashed) {
        if (b <= a) return;
        if (dashed) el("line", { x1: x(a), x2: x(b), y1: y, y2: y, class: "edge", "stroke-dasharray": "3 4", "stroke-width": 1.4 }, host);
        else el("rect", { x: x(a), y: y - 6, width: x(b) - x(a), height: 12, class: "fill " + cls }, host);
      }
      rows.forEach(function (p, j) {
        var y = top + rowH * j + rowH / 2 + (j >= SHOW ? 14 : 0);
        if (v === "lm") {
          if (p.end <= L) { seg(0, p.end, y, null, true); }
          else { seg(0, L, y, null, true); seg(L, p.end, y, p.tr && p.w <= L ? "s1" : "s5"); }
        } else if (p.tr) {
          if (v === "mis") { seg(0, p.w, y, "s2"); seg(p.w, p.end, y, "s1"); }
          else if (v === "exc") { seg(0, p.w, y, null, true); seg(p.w, p.end, y, "s1"); }
          else { seg(0, p.w, y, "s5"); seg(p.w, p.end, y, "s1"); }
        } else seg(0, p.end, y, "s5");
        if (p.died) el("circle", { cx: x(p.end), cy: y, r: 5, class: "dot s3" + (v === "lm" && p.end <= L ? "" : ""), style: v === "lm" && p.end <= L ? "fill-opacity:0.35" : null }, host);
      });
      var yb = top + rowH * SHOW * 2 + 14 + 8;
      if (v === "lm") {
        el("line", { x1: x(L), x2: x(L), y1: top - 6, y2: yb, class: "edge accent", "stroke-dasharray": "5 4" }, host);
        el("text", { x: x(L) + 5, y: yb + 30, class: "viz-small colour s1", text: "landmark: day " + L }, host);
      }
      el("line", { x1: x0, x2: x1, y1: yb, y2: yb, class: "viz-axis" }, host);
      [0, 7, 14, 21, 28].forEach(function (t) { el("text", { x: x(t), y: yb + 16, "text-anchor": "middle", class: "viz-tick", text: t }, host); });
      el("text", { x: (x0 + x1) / 2, y: yb + 30, "text-anchor": "middle", class: "viz-label", text: "Days since new AF on the ECG" }, host);
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Protopathic bias. Exposure = any start of the drug in the 36 months before the
  // index date, ignoring the last `lag` months. Background starts at rate r per month
  // in everyone; some cases also start it for prodromal symptoms, at a time before
  // diagnosis that is exponential with mean P months. True effect: none.
  V.register("protopathic-lag", function (root) {
    var W = 36, R = 0.01;
    var ctr = V.controls(root);
    var sLag = V.slider(ctr, { label: "Lag window: ignore exposure in the last", min: 0, max: 24, step: 1, value: 0, fmt: function (v) { return v + " months"; }, onInput: draw });
    var sQ = V.slider(ctr, { label: "Share of cases prescribed it for early symptoms", min: 0, max: 60, step: 5, value: 30, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sP = V.slider(ctr, { label: "Typical prodrome (symptoms to diagnosis)", min: 1, max: 12, step: 1, value: 4, fmt: function (v) { return v + " months"; }, onInput: draw });

    var c = V.svg(root, 640, 400);
    c.setAttribute("aria-label", "Top: the odds ratio for the drug plotted against the length of the lag window, falling towards 1 as the lag grows. Bottom: when symptom-driven prescriptions happen before diagnosis, with the part ignored by the lag window shaded");
    var host = el("g", null, c);
    var out = V.readouts(root, [
      { key: "or", label: "Odds ratio with this lag", cls: "bad" },
      { key: "or0", label: "Odds ratio with no lag" },
      { key: "kept", label: "Symptom-driven prescriptions still counted" },
      { key: "lost", label: "Genuine exposure window discarded" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Exposure is any start of the drug in the 3 years before diagnosis (cases) or the matched date (controls), minus the lag. About 30% of people start it in 3 years for unrelated reasons. The drug has no effect on the disease, so the true odds ratio is 1." }, root);

    function odds(p) { return p / (1 - p); }
    function orAt(lag, q, P) {
      var pc = 1 - Math.exp(-R * (W - lag));
      var pp = q * (Math.exp(-lag / P) - Math.exp(-W / P));
      var pcase = 1 - (1 - pc) * (1 - pp);
      return odds(pcase) / odds(pc);
    }

    function draw() {
      var lag = sLag.value(), q = sQ.value() / 100, P = sP.value();
      var or0 = orAt(0, q, P), orL = orAt(lag, q, P);
      var ymax = Math.max(2, Math.ceil(or0 * 2) / 2);
      clear(host);

      // top panel
      var top = el("g", null, host); top.W = 640; top.H = 240;
      var f = V.frame(top, { x: [0, 24], y: [0.5, ymax], xTicks: [0, 3, 6, 9, 12, 15, 18, 21, 24], margin: { bottom: 40 }, fmtY: function (v) { return v.toFixed(1); }, xLabel: "Lag window (months)", yLabel: "Odds ratio" });
      var g = f.inner;
      el("line", { x1: f.x(0), x2: f.x(24), y1: f.y(1), y2: f.y(1), class: "stroke s5 dashed", style: "stroke-width:1.5" }, g);
      el("text", { x: f.x(24) - 4, y: f.y(1) - 6, "text-anchor": "end", class: "viz-small viz-muted", text: "truth: no effect" }, g);
      var pts = [];
      for (var i = 0; i <= 96; i++) { var t = 24 * i / 96; pts.push([f.x(t), f.y(orAt(t, q, P))]); }
      el("path", { d: V.line(pts), class: "stroke s3", style: "stroke-width:3" }, g);
      el("line", { x1: f.x(lag), x2: f.x(lag), y1: f.y(0.5), y2: f.y(orL), class: "stroke s3 dashed", style: "stroke-width:1.5" }, g);
      el("circle", { cx: f.x(lag), cy: f.y(orL), r: 6.5, class: "dot s3" }, g);
      var right = lag < 16;
      el("text", { x: f.x(lag) + (right ? 10 : -10), y: f.y(orL) - (right ? 10 : 28), "text-anchor": right ? "start" : "end", class: "viz-small viz-bold colour s3", text: "OR " + orL.toFixed(2) }, g);

      // bottom panel: timing of symptom-driven prescriptions (months before diagnosis)
      var y0 = 380, y1 = 290, x = f.x;
      el("text", { x: 52, y: 270, class: "viz-small viz-bold", text: "When symptom-driven prescriptions happen (months before diagnosis)" }, host);
      var dens = function (s) { return Math.exp(-s / P) / P; }, dmax = dens(0);
      var yS = V.scale(0, dmax, y0, y1);
      var all = [], shade = [];
      for (var j = 0; j <= 96; j++) {
        var s = 24 * j / 96; all.push([x(s), yS(dens(s))]);
        if (s <= lag) shade.push([x(s), yS(dens(s))]);
      }
      el("path", { d: V.area(all, all.map(function (p) { return [p[0], y0]; })), class: "fill-soft s2" }, host);
      if (lag > 0) {
        shade.push([x(lag), yS(dens(lag))]);
        el("path", { d: V.area(shade, shade.map(function (p) { return [p[0], y0]; })), class: "fill s2" }, host);
        el("text", { x: x(lag) + (lag > 14 ? -6 : 6), y: y1 + 4, "text-anchor": lag > 14 ? "end" : "start", class: "viz-small colour s2", text: "ignored by the lag" }, host);
      }
      el("line", { x1: x(0), x2: x(24), y1: y0, y2: y0, class: "viz-axis" }, host);
      [0, 6, 12, 18, 24].forEach(function (t) { el("text", { x: x(t), y: y0 + 15, "text-anchor": "middle", class: "viz-tick", text: t }, host); });

      var kept = (Math.exp(-lag / P) - Math.exp(-W / P)) / (1 - Math.exp(-W / P));
      out.or(orL.toFixed(2));
      out.or0(or0.toFixed(2));
      out.kept(V.fmt.pct(kept));
      out.lost(V.fmt.pct(lag / W));
    }
    draw();
  });
})();
