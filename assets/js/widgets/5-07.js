// Lecture 5.7 — a phenotype rule builder for new-onset AF in the ICU (simulated stays),
// and an outcome-misclassification widget showing what PPV can and cannot correct. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Seeded generator with the poorly mixed first draws thrown away.
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }

  // Multi-select chips styled like the kit's segmented toggle.
  function chips(parent, items, onChange) {
    var state = {};
    items.forEach(function (it) {
      state[it.key] = !!it.on;
      var pill = el("span", { class: "widget-toggle" }, parent);
      var b = el("button", { type: "button", text: it.label }, pill);
      it.btn = b;
      b.addEventListener("click", function () { state[it.key] = !state[it.key]; paint(); onChange(); });
    });
    function paint() { items.forEach(function (it) { it.btn.classList.toggle("on", state[it.key]); it.btn.setAttribute("aria-pressed", state[it.key]); }); }
    paint();
    return { state: state, set: function (k, v) { state[k] = v; paint(); } };
  }

  function row(parent, label) {
    var r = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.7rem" }, parent);
    el("span", { class: "widget-note", style: "margin:0;min-width:7.5rem", text: label }, r);
    return r;
  }

  // ---------------------------------------------------------------------------
  // Phenotype builder. Three true classes: new-onset AF in the ICU, AF before admission, no AF.
  V.register("phenotype-builder", function (root) {
    var N = 2000;
    // probability each source is positive, by class [new, prior, none]; mean lag (h) after true onset; timed?
    var SRC = [
      { key: "ecg", label: "12-lead ECG read as AF", p: [0.72, 0.80, 0.04], lag: 9, timed: true },
      { key: "rhythm", label: "Nurse-charted AF rhythm (2+ entries)", p: [0.85, 0.85, 0.03], lag: 1.5, timed: true },
      { key: "drug", label: "IV rate or rhythm drug started", p: [0.60, 0.45, 0.06], lag: 4, timed: true },
      { key: "icd", label: "ICD-10 AF code at discharge", p: [0.78, 0.90, 0.02], lag: null, timed: false }
    ];
    var HIST = [0.01, 0.60, 0.01]; // chance an earlier admission shows AF, by class

    var r = stream(5070001), P = [];
    for (var i = 0; i < N; i++) {
      var u = r(), cls = u < 0.10 ? 0 : u < 0.18 ? 1 : 2, pt = { cls: cls, src: {}, lag: {} };
      SRC.forEach(function (s) {
        pt.src[s.key] = r() < s.p[cls];
        pt.lag[s.key] = s.timed ? -Math.log(r()) * s.lag : Infinity;
      });
      pt.hist = r() < HIST[cls];
      P.push(pt);
    }

    var r1 = row(root, "Data sources:");
    var ch = chips(r1, SRC.map(function (s) { return { key: s.key, label: s.label, on: s.key === "icd" }; }), draw);
    var r2 = row(root, "Combine them:");
    var mode = "or";
    var tgM = V.toggle(r2, { options: [{ value: "or", label: "Any (OR)" }, { value: "two", label: "At least 2" }, { value: "and", label: "All (AND)" }], value: "or", onChange: function (v) { mode = v; draw(); } });
    var r3 = row(root, "History:");
    var hist = false;
    var tgH = V.toggle(r3, { options: [{ value: false, label: "Ignore earlier admissions" }, { value: true, label: "Exclude AF in earlier admissions" }], value: false, onChange: function (v) { hist = v; draw(); } });

    var pre = row(root, "Try:");
    var presets = [
      ["Codes only", ["icd"], "or", false],
      ["ECG only", ["ecg"], "or", false],
      ["ECG AND code", ["ecg", "icd"], "and", false],
      ["2 of ECG, rhythm, drug + history", ["ecg", "rhythm", "drug"], "two", true]
    ];
    presets.forEach(function (p) {
      V.button(pre, p[0], function () {
        SRC.forEach(function (s) { ch.set(s.key, p[1].indexOf(s.key) >= 0); });
        mode = p[2]; hist = p[3];
        // reflect in the segmented toggles by clicking the matching buttons
        clickOpt(tgMwrap, ["or", "two", "and"].indexOf(mode));
        clickOpt(tgHwrap, hist ? 1 : 0);
        draw();
      });
    });
    var tgMwrap = r2.querySelector(".widget-toggle"), tgHwrap = r3.querySelector(".widget-toggle");
    function clickOpt(wrap, idx) { var b = wrap.querySelectorAll("button")[idx]; if (b && !b.classList.contains("on")) b.click(); }

    V.legend(root, [
      { cls: "s1", label: "True new-onset AF, flagged" },
      { cls: "s5", label: "True new-onset AF, missed" },
      { cls: "s2", label: "Flagged, but AF was there before admission" },
      { cls: "s3", label: "Flagged, no AF" }
    ]);
    var c = V.svg(root, 640, 170);
    c.setAttribute("aria-label", "Two stacked bars. The first splits all patients with true new-onset AF into flagged and missed. The second splits all flagged patients into true new-onset AF, AF from before admission, and no AF.");

    var out = V.readouts(root, [
      { key: "sens", label: "Sensitivity for new-onset AF" },
      { key: "ppv", label: "PPV (flagged who truly have new-onset AF)" },
      { key: "n", label: "Patients flagged (of 2,000)" },
      { key: "lag", label: "Onset time: median lag after true onset" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. 10% develop AF in the ICU, 8% had AF before admission. Sources are independent given the true state; real ones are correlated, which makes AND gain less than it does here. The discharge code has no time, so it cannot date onset." }, root);

    function flagged(pt, on) {
      var keys = SRC.filter(function (s) { return on[s.key]; });
      if (!keys.length) return { f: false };
      var pos = keys.filter(function (s) { return pt.src[s.key]; });
      var f = mode === "or" ? pos.length >= 1 : mode === "and" ? pos.length === keys.length : pos.length >= Math.min(2, keys.length);
      if (hist && pt.hist) f = false;
      if (!f) return { f: false };
      // onset estimate: earliest positive (OR), latest required (AND), second earliest (at least 2)
      var lags = pos.map(function (s) { return pt.lag[s.key]; }).sort(function (a, b) { return a - b; });
      var t = mode === "or" ? lags[0] : mode === "and" ? lags[lags.length - 1] : lags[Math.min(1, lags.length - 1)];
      return { f: true, t: t };
    }

    function draw() {
      var on = ch.state, tp = 0, fpPrior = 0, fpNone = 0, nNew = 0, lags = [];
      P.forEach(function (pt) {
        if (pt.cls === 0) nNew++;
        var res = flagged(pt, on);
        if (!res.f) return;
        if (pt.cls === 0) { tp++; if (isFinite(res.t)) lags.push(res.t); }
        else if (pt.cls === 1) fpPrior++; else fpNone++;
      });
      var nFlag = tp + fpPrior + fpNone;

      clear(c);
      var x0 = 170, x1 = 620, scaleMax = Math.max(nNew, nFlag, 1);
      function bx(v) { return (x1 - x0) * v / scaleMax; }
      function seg(x, y, w, cls) { if (w > 0) el("rect", { x: x, y: y, width: w, height: 34, class: "fill " + cls }, c); return x + w; }
      el("text", { x: x0 - 10, y: 32, "text-anchor": "end", class: "viz-small viz-bold", text: "True new-onset AF" }, c);
      el("text", { x: x0 - 10, y: 48, "text-anchor": "end", class: "viz-small viz-muted", text: "n = " + nNew }, c);
      var xx = seg(x0, 22, bx(tp), "s1"); seg(xx, 22, bx(nNew - tp), "s5");
      el("text", { x: x0 - 10, y: 100, "text-anchor": "end", class: "viz-small viz-bold", text: "Flagged by the rule" }, c);
      el("text", { x: x0 - 10, y: 116, "text-anchor": "end", class: "viz-small viz-muted", text: "n = " + nFlag }, c);
      xx = seg(x0, 90, bx(tp), "s1"); xx = seg(xx, 90, bx(fpPrior), "s2"); seg(xx, 90, bx(fpNone), "s3");
      if (!nFlag) el("text", { x: x0 + 6, y: 112, class: "viz-small viz-muted", text: "no one flagged" }, c);
      el("text", { x: x0, y: 160, class: "viz-small viz-muted", text: "Bars share one scale. The teal part is the same patients in both bars." }, c);

      var anyOn = SRC.some(function (s) { return on[s.key]; });
      out.sens(anyOn ? V.fmt.pct(tp / nNew) : "–");
      out.ppv(nFlag ? V.fmt.pct(tp / nFlag) : "–");
      out.n(V.fmt.int(nFlag));
      if (!tp) out.lag("–");
      else if (!lags.length) out.lag("no time");
      else {
        lags.sort(function (a, b) { return a - b; });
        var med = lags[Math.floor(lags.length / 2)];
        var share = lags.length / tp;
        out.lag(med.toFixed(1) + " h" + (share < 0.995 ? " (" + V.fmt.pct(share) + " dated)" : ""));
      }
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Outcome misclassification: observed vs true risks and RR, and the PPV-only correction.
  V.register("validation-bias", function (root) {
    var diff = false;
    var ctr = V.controls(root);
    var sP = V.slider(ctr, { label: "True outcome risk, untreated", min: 1, max: 30, step: 1, value: 5, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sRR = V.slider(ctr, { label: "True risk ratio (treated vs untreated)", min: 0.5, max: 3, step: 0.05, value: 1.5, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sSe = V.slider(ctr, { label: "Sensitivity of the outcome phenotype", min: 0.5, max: 1, step: 0.01, value: 0.8, fmt: V.fmt.pct, onInput: draw });
    var sSp = V.slider(ctr, { label: "Specificity of the outcome phenotype", min: 0.9, max: 1, step: 0.002, value: 0.99, fmt: V.fmt.pct1, onInput: draw });
    var sG = V.slider(ctr, { label: "Differential only: treated sensitivity minus untreated", min: -0.3, max: 0.3, step: 0.01, value: 0.15, fmt: function (v) { return V.fmt.signed(v * 100, 0) + " points"; }, onInput: draw });
    V.toggle(root, { options: [{ value: false, label: "Non-differential (same in both groups)" }, { value: true, label: "Differential ascertainment" }], value: false, onChange: function (v) { diff = v; draw(); } });

    V.legend(root, [{ cls: "s5", label: "True risk" }, { cls: "s2", label: "Observed (phenotype) risk" }]);
    var c = V.svg(root, 640, 230);
    c.setAttribute("aria-label", "Grouped bars comparing true and observed outcome risk in untreated and treated groups");

    var out = V.readouts(root, [
      { key: "rr", label: "True risk ratio" },
      { key: "obs", label: "Observed risk ratio", cls: "bad" },
      { key: "ppvrr", label: "RR after correcting each group by its PPV" },
      { key: "ppv", label: "PPV: untreated / treated" },
      { key: "npv", label: "NPV: untreated / treated" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers; expected values, no sampling error. Specificity is the same in both groups. Differential mode gives the treated group a different sensitivity, as when treated patients are monitored more closely." }, root);
    var obsBox = root.querySelectorAll(".widget-readout")[1], ppvBox = root.querySelectorAll(".widget-readout")[2];

    function draw() {
      var p0 = sP.value() / 100, rr = sRR.value(), p1 = Math.min(0.99, rr * p0);
      var se0 = sSe.value(), se1 = diff ? Math.max(0.05, Math.min(1, se0 + sG.value())) : se0, sp = sSp.value();
      function obs(p, se) { return se * p + (1 - sp) * (1 - p); }
      var o0 = obs(p0, se0), o1 = obs(p1, se1);
      var ppv0 = se0 * p0 / o0, ppv1 = se1 * p1 / o1;
      var npv0 = sp * (1 - p0) / (sp * (1 - p0) + (1 - se0) * p0), npv1 = sp * (1 - p1) / (sp * (1 - p1) + (1 - se1) * p1);
      var trueRR = p1 / p0, obsRR = o1 / o0, ppvRR = (o1 * ppv1) / (o0 * ppv0);

      clear(c);
      var top = Math.max(p1, o1, p0, o0) * 1.25;
      var f = V.frame(c, { x: [0, 1], y: [0, top], xTicks: [], fmtY: function (v) { return Math.round(v * 1000) / 10 + "%"; }, yLabel: "Risk", margin: { top: 14, bottom: 34, left: 60 } });
      var groups = [["Untreated", p0, o0, 0.27], ["Treated", p1, o1, 0.73]];
      groups.forEach(function (g) {
        var cx = f.x(g[3]), w = 70;
        [[g[1], "s5", -w - 4], [g[2], "s2", 4]].forEach(function (b) {
          var y = f.y(b[0]);
          el("rect", { x: cx + b[2], y: y, width: w, height: f.y(0) - y, rx: 3, class: "fill " + b[1] }, f.inner);
          el("text", { x: cx + b[2] + w / 2, y: y - 6, "text-anchor": "middle", class: "viz-small viz-bold", text: (b[0] * 100).toFixed(1) + "%" }, f.inner);
        });
        el("text", { x: cx, y: c.H - 12, "text-anchor": "middle", class: "viz-label", text: g[0] }, f.inner);
      });

      out.rr(trueRR.toFixed(2));
      out.obs(obsRR.toFixed(2));
      out.ppvrr(ppvRR.toFixed(2));
      out.ppv(V.fmt.pct(ppv0) + " / " + V.fmt.pct(ppv1));
      out.npv(V.fmt.pct1(npv0) + " / " + V.fmt.pct1(npv1));
      var okObs = Math.abs(Math.log(obsRR / trueRR)) < 0.02, okPpv = Math.abs(Math.log(ppvRR / trueRR)) < 0.02;
      obsBox.classList.toggle("bad", !okObs); obsBox.classList.toggle("good", okObs);
      ppvBox.classList.toggle("bad", !okPpv); ppvBox.classList.toggle("good", okPpv);
    }
    draw();
  });
})();
