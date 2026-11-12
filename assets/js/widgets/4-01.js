// Lecture 4.1 — Potential outcomes and identification.
// Widgets: estimands-targeting (ATE vs ATT vs ATU when treatment is targeted) and
// positivity-explorer (propensity-score overlap). Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function expit(x) { return 1 / (1 + Math.exp(-x)); }
  // Seeded generator with the poorly mixed first draws thrown away.
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }
  function presetRow(root, label) {
    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: label }, pre);
    return pre;
  }

  // ---------------------------------------------------------------------------
  // ATE, ATT, ATU with ten baseline-risk groups of equal size.
  V.register("estimands-targeting", function (root) {
    var K = 10, r0 = [];
    for (var k = 0; k < K; k++) r0.push(0.02 + 0.03 * k); // 2% … 29% risk of death without treatment

    var ctr = V.controls(root);
    var sT = V.slider(ctr, { label: "Targeting (+ treats high-risk patients, − treats low-risk)", min: -3, max: 3, step: 0.25, value: 0, fmt: function (v) { return v === 0 ? "none (random)" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(2); }, onInput: draw });
    var sLo = V.slider(ctr, { label: "Risk ratio in the lowest-risk group", min: 0.3, max: 1.2, step: 0.05, value: 0.6, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sHi = V.slider(ctr, { label: "Risk ratio in the highest-risk group", min: 0.3, max: 1.2, step: 0.05, value: 0.6, fmt: function (v) { return v.toFixed(2); }, onInput: draw });

    var pre = presetRow(root, "Try:");
    [["Random treatment", 0, 0.6, 0.6], ["Constant RR, targeted", 2, 0.6, 0.6], ["Benefit only at high risk, targeted", 2, 1, 0.45], ["Treat those who gain least", -2, 0.6, 0.6]].forEach(function (p) {
      V.button(pre, p[0], function () { sT.set(p[1]); sLo.set(p[2]); sHi.set(p[3]); draw(); });
    });

    V.legend(root, [
      { cls: "s1", label: "Deaths prevented per 100 treated, by risk group" },
      { cls: "s3", label: "ATE", dashed: true }, { cls: "s2", label: "ATT", dashed: true }, { cls: "s4", label: "ATU", dashed: true }
    ]);
    var c1 = V.svg(root, 640, 230);
    c1.setAttribute("aria-label", "Bar chart of the absolute benefit of treatment in ten baseline-risk groups, with horizontal lines for the ATE, ATT and ATU");
    var c2 = V.svg(root, 640, 150);
    c2.setAttribute("aria-label", "Bar chart of the share of patients treated in each baseline-risk group");

    var out = V.readouts(root, [
      { key: "ate", label: "ATE: everyone (risk difference · risk ratio)" },
      { key: "att", label: "ATT: those treated", cls: "good" },
      { key: "atu", label: "ATU: those not treated" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Ten equal-sized groups whose risk of death without treatment runs from 2% to 29%. The risk ratio moves smoothly (on the log scale) from the lowest to the highest group. Risk differences are in percentage points; negative means fewer deaths." }, root);

    function draw() {
      var tau = sT.value(), lo = Math.log(sLo.value()), hi = Math.log(sHi.value());
      var p = [], rr = [], r1 = [], ben = [];
      for (var k = 0; k < K; k++) {
        p.push(expit(tau * (k - 4.5) / 2.87));
        rr.push(Math.exp(lo + (hi - lo) * k / (K - 1)));
        r1.push(r0[k] * rr[k]);
        ben.push((r0[k] - r1[k]) * 100);
      }
      function est(wfun) {
        var w = 0, s0 = 0, s1 = 0;
        for (var k = 0; k < K; k++) { var wk = wfun(k); w += wk; s0 += wk * r0[k]; s1 += wk * r1[k]; }
        return { rd: (s1 - s0) / w, rr: s1 / s0 };
      }
      var ate = est(function () { return 1; }), att = est(function (k) { return p[k]; }), atu = est(function (k) { return 1 - p[k]; });

      // panel 1: benefit per group
      clear(c1);
      var lines = [[-ate.rd * 100, "s3"], [-att.rd * 100, "s2"], [-atu.rd * 100, "s4"]];
      var ymin = Math.min(0, Math.min.apply(null, ben)), ymax = Math.max(1, Math.max.apply(null, ben));
      ymin = ymin < 0 ? Math.floor(ymin * 1.15) : 0; ymax = Math.ceil(ymax * 1.15);
      var xt = []; for (var j = 0; j < K; j++) xt.push(j + 0.5);
      var f = V.frame(c1, { x: [0, K], y: [ymin, ymax], xTicks: xt, fmtX: function () { return ""; }, margin: { top: 12, bottom: 22, left: 56, right: 16 }, yLabel: "Deaths prevented / 100" });
      var g = f.inner;
      el("line", { x1: f.x(0), x2: f.x(K), y1: f.y(0), y2: f.y(0), class: "viz-axis" }, g);
      for (var k2 = 0; k2 < K; k2++) {
        var x0 = f.x(k2 + 0.15), w = f.x(k2 + 0.85) - x0, yb = f.y(Math.max(0, ben[k2])), h = Math.abs(f.y(0) - f.y(ben[k2]));
        el("rect", { x: x0, y: yb, width: w, height: Math.max(h, 0.5), class: "fill-soft s1" }, g);
        el("rect", { x: x0, y: yb, width: w, height: Math.max(h, 0.5), fill: "none", class: "stroke s1", "stroke-width": 1.2 }, g);
      }
      lines.forEach(function (L) {
        el("line", { x1: f.x(0), x2: f.x(K), y1: f.y(L[0]), y2: f.y(L[0]), class: "stroke dashed " + L[1], "stroke-width": 2 }, g);
      });

      // panel 2: share treated
      clear(c2);
      var f2 = V.frame(c2, { x: [0, K], y: [0, 1], yTicks: [0, 0.5, 1], xTicks: xt, fmtX: function (t) { return V.fmt.pct(r0[Math.floor(t)]); }, fmtY: V.fmt.pct, margin: { top: 8, bottom: 40, left: 56, right: 16 }, xLabel: "Risk of death without treatment (ten groups)", yLabel: "Treated" });
      for (var k3 = 0; k3 < K; k3++) {
        var xx = f2.x(k3 + 0.15), ww = f2.x(k3 + 0.85) - xx;
        el("rect", { x: xx, y: f2.y(p[k3]), width: ww, height: f2.y(0) - f2.y(p[k3]), class: "fill-soft s5" }, f2.inner);
        el("rect", { x: xx, y: f2.y(p[k3]), width: ww, height: f2.y(0) - f2.y(p[k3]), fill: "none", class: "stroke s5", "stroke-width": 1.2 }, f2.inner);
      }

      function txt(e) { return V.fmt.signed(e.rd * 100, 1) + " pts · RR " + e.rr.toFixed(2); }
      out.ate(txt(ate)); out.att(txt(att)); out.atu(txt(atu));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Positivity explorer: one covariate (bleeding-risk score) drives anticoagulation.
  V.register("positivity-explorer", function (root) {
    var N = 3000, r = stream(41017), X = [], U = [], C = [];
    for (var i = 0; i < N; i++) { X.push(V.normal(r)); U.push(r()); C.push(r()); }

    var ctr = V.controls(root);
    var sG = V.slider(ctr, { label: "How strongly bleeding risk drives the decision (log-odds per SD)", min: 0, max: 5, step: 0.25, value: 1, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var contra = 0;
    var tw = el("div", {}, ctr);
    el("div", { class: "widget-slider-label", style: "font-size:0.88rem;margin-bottom:0.3rem", text: "Contraindicated patients (never anticoagulated)" }, tw);
    V.toggle(tw, { options: [{ value: 0, label: "None" }, { value: 0.1, label: "10% of patients" }], value: 0, onChange: function (v) { contra = v; draw(); } });

    V.legend(root, [
      { cls: "s1", label: "Anticoagulated (bars up)" }, { cls: "s5", label: "Not anticoagulated (bars down)" },
      { cls: "s3", label: "Score below 0.05 or above 0.95" }
    ]);
    var c = V.svg(root, 640, 300);
    c.setAttribute("aria-label", "Mirrored histogram of propensity scores: treated patients above the axis, untreated below, with the regions near 0 and near 1 shaded");

    var out = V.readouts(root, [
      { key: "lo", label: "of the untreated have score < 0.05 (no treated look-alikes)" },
      { key: "hi", label: "of the treated have score > 0.95 (no untreated look-alikes)" },
      { key: "mw", label: "Largest ATE weight" },
      { key: "ess", label: "Effective sample size with ATE weights" }
    ]);
    var st = V.readouts(root, [
      { key: "ate", label: "ATE (everyone): needs both tails" },
      { key: "att", label: "ATT (the treated): needs untreated look-alikes" },
      { key: "atu", label: "ATU (the untreated): needs treated look-alikes" }
    ]);
    var boxes = st.ate ? root.querySelectorAll(".widget-readouts")[1].children : [];
    el("p", { class: "widget-note", text: "Illustrative numbers. 3,000 simulated ICU patients; the probability of anticoagulation falls with a standardised bleeding-risk score. “Supported”: under 1% of the relevant group lack look-alikes. “Thin”: 1–10%, so a few people get very large weights. “Extrapolated”: more than 10%, so the answer depends on the model, not the data. “Not identified”: some patients (the contraindicated) have no treated look-alikes at all." }, root);

    function status(share, structural) {
      if (structural) return ["Not identified", "bad"];
      if (share < 0.01) return ["Supported", "good"];
      if (share < 0.10) return ["Thin", ""];
      return ["Extrapolated", "bad"];
    }

    function draw() {
      var g = sG.value(), nb = 20, up = [], dn = [];
      for (var b = 0; b < nb; b++) { up.push(0); dn.push(0); }
      var nT = 0, nU = 0, loU = 0, hiT = 0, sw = 0, sw2 = 0, mw = 0, nContra = 0;
      for (var i = 0; i < N; i++) {
        var isC = C[i] < contra;
        var e = isC ? 0 : expit(0.4 - g * X[i]);
        var a = U[i] < e;
        var bin = Math.min(nb - 1, Math.floor(e * nb));
        if (a) { up[bin]++; nT++; if (e > 0.95) hiT++; }
        else { dn[bin]++; nU++; if (e < 0.05) loU++; if (isC) nContra++; }
        var w = a ? 1 / e : 1 / (1 - e);
        sw += w; sw2 += w * w; if (w > mw) mw = w;
      }
      var M = Math.max.apply(null, up.concat(dn));
      M = Math.max(50, Math.ceil(M * 1.25 / 50) * 50);

      clear(c);
      var f = V.frame(c, { x: [0, 1], y: [-M, M], fmtX: function (t) { return t.toFixed(1); }, fmtY: function (t) { return V.fmt.int(Math.abs(t)); }, margin: { top: 14, bottom: 42, left: 52, right: 16 }, xLabel: "Propensity score: probability of anticoagulation given bleeding risk", yLabel: "Patients" });
      var gg = f.inner;
      el("rect", { x: f.x(0), y: f.y(M), width: f.x(0.05) - f.x(0), height: f.y(-M) - f.y(M), class: "fill-soft s3" }, gg);
      el("rect", { x: f.x(0.95), y: f.y(M), width: f.x(1) - f.x(0.95), height: f.y(-M) - f.y(M), class: "fill-soft s3" }, gg);
      for (var b2 = 0; b2 < nb; b2++) {
        var x0 = f.x(b2 / nb) + 1, w = f.x(1 / nb) - f.x(0) - 2;
        if (up[b2]) el("rect", { x: x0, y: f.y(up[b2]), width: w, height: f.y(0) - f.y(up[b2]), class: "fill s1" }, gg);
        if (dn[b2]) el("rect", { x: x0, y: f.y(0), width: w, height: f.y(-dn[b2]) - f.y(0), class: "fill s5" }, gg);
      }
      el("line", { x1: f.x(0), x2: f.x(1), y1: f.y(0), y2: f.y(0), class: "viz-axis" }, gg);
      el("text", { x: f.x(0.5), y: f.y(M) + 14, "text-anchor": "middle", class: "viz-small viz-muted", text: "anticoagulated" }, gg);
      el("text", { x: f.x(0.5), y: f.y(-M) - 6, "text-anchor": "middle", class: "viz-small viz-muted", text: "not anticoagulated" }, gg);

      out.lo(V.fmt.pct1(loU / Math.max(1, nU)));
      out.hi(V.fmt.pct1(hiT / Math.max(1, nT)));
      out.mw(mw > 1e6 ? "> 1,000,000" : V.fmt.num(mw, mw < 10 ? 1 : 0));
      out.ess(V.fmt.pct(sw * sw / sw2 / N) + " of N");

      var sAtt = status(hiT / Math.max(1, nT), false);
      var sAtu = status(loU / Math.max(1, nU), nContra > 0);
      var rank = function (s) { return s[1] === "bad" ? 2 : s[1] === "" ? 1 : 0; };
      var sAte = rank(sAtt) >= rank(sAtu) ? sAtt : sAtu;
      if (nContra > 0) sAte = ["Not identified", "bad"];
      [[st.ate, sAte, 0], [st.att, sAtt, 1], [st.atu, sAtu, 2]].forEach(function (z) {
        z[0](z[1][0]);
        var box = boxes[z[2]];
        if (box) { box.classList.toggle("good", z[1][1] === "good"); box.classList.toggle("bad", z[1][1] === "bad"); }
      });
    }
    draw();
  });
})();
