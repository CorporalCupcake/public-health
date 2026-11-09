// Lecture 2.14 — Kappa and the prevalence paradox; correlation vs agreement (Bland-Altman). Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function f2(x) { return x.toFixed(2); }

  // ---------------------------------------------------------------------------
  // Two raters, each independently right with the same probability (sensitivity = specificity).
  // Raw agreement then does not depend on prevalence; kappa does.
  V.register("kappa-prevalence", function (root) {
    var ctr = V.controls(root);
    var sPrev = V.slider(ctr, { label: "Prevalence of the finding", min: 1, max: 50, step: 1, value: 30, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sAcc = V.slider(ctr, { label: "Each reader’s accuracy (sensitivity = specificity)", min: 70, max: 99, step: 1, value: 90, fmt: function (v) { return v + "%"; }, onInput: draw });

    function calc(pi, a) {
      var pp = pi * a * a + (1 - pi) * (1 - a) * (1 - a);
      var nn = pi * (1 - a) * (1 - a) + (1 - pi) * a * a;
      var pn = a * (1 - a);                     // each discordant cell
      var q = pi * a + (1 - pi) * (1 - a);       // each reader's share of positives
      var po = pp + nn, pe = q * q + (1 - q) * (1 - q);
      return { pp: pp, nn: nn, pn: pn, po: po, pe: pe, k: (po - pe) / (1 - pe),
        pos: 2 * pp / (2 * pp + 2 * pn), neg: 2 * nn / (2 * nn + 2 * pn) };
    }

    var tw = el("div", { class: "table-wrap", style: "margin:0.4rem 0 0.8rem" }, root);
    var tbl = el("table", null, tw);
    el("caption", { text: "Expected readings for 1,000 ECGs" }, tbl);
    var th = el("thead", null, tbl), hr = el("tr", null, th);
    ["", "Reader B: positive", "Reader B: negative"].forEach(function (t) { el("th", { text: t }, hr); });
    var tb = el("tbody", null, tbl), cells = {};
    [["p", "Reader A: positive"], ["n", "Reader A: negative"]].forEach(function (r) {
      var tr = el("tr", null, tb);
      el("th", { text: r[1] }, tr);
      cells[r[0] + "p"] = el("td", null, tr);
      cells[r[0] + "n"] = el("td", null, tr);
    });

    V.legend(root, [
      { cls: "s5", label: "Raw agreement" },
      { cls: "s3", label: "Cohen’s kappa" },
      { cls: "s2", label: "Positive agreement", dashed: true }
    ]);
    var c = V.svg(root, 640, 280);
    c.setAttribute("aria-label", "Raw agreement, kappa and positive agreement plotted against prevalence");
    var f = V.frame(c, { x: [0, 50], y: [0, 1], fmtX: function (v) { return v + "%"; }, fmtY: V.fmt.pct, xLabel: "Prevalence of the finding", yLabel: "Agreement" });
    var lPo = el("path", { class: "stroke s5" }, f.inner);
    var lK = el("path", { class: "stroke s3" }, f.inner);
    var lPos = el("path", { class: "stroke s2 dashed" }, f.inner);
    var mark = el("line", { y1: f.y(0), y2: f.y(1), class: "edge strong", "stroke-dasharray": "4 4" }, f.inner);
    var dPo = el("circle", { r: 5, class: "dot s5" }, f.inner);
    var dK = el("circle", { r: 5, class: "dot s3" }, f.inner);

    var out = V.readouts(root, [
      { key: "po", label: "Raw agreement (both say the same)" },
      { key: "pe", label: "Agreement expected by chance alone" },
      { key: "k", label: "Cohen’s kappa", cls: "bad" },
      { key: "band", label: "Landis–Koch label for this kappa" },
      { key: "pos", label: "Positive agreement (on the positives only)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. The readers err independently, so their raw agreement depends only on accuracy. Kappa falls as the finding gets rarer because chance agreement on “negative” rises." }, root);

    function band(k) {
      return k < 0 ? "poor" : k <= 0.2 ? "slight" : k <= 0.4 ? "fair" : k <= 0.6 ? "moderate" : k <= 0.8 ? "substantial" : "almost perfect";
    }

    function draw() {
      var pi = sPrev.value() / 100, a = sAcc.value() / 100, r = calc(pi, a);
      var po = [], k = [], pos = [];
      for (var p = 1; p <= 50; p += 0.5) {
        var s = calc(p / 100, a);
        po.push([f.x(p), f.y(s.po)]); k.push([f.x(p), f.y(Math.max(0, s.k))]); pos.push([f.x(p), f.y(s.pos)]);
      }
      lPo.setAttribute("d", V.line(po)); lK.setAttribute("d", V.line(k)); lPos.setAttribute("d", V.line(pos));
      var x = f.x(pi * 100);
      mark.setAttribute("x1", x); mark.setAttribute("x2", x);
      dPo.setAttribute("cx", x); dPo.setAttribute("cy", f.y(r.po));
      dK.setAttribute("cx", x); dK.setAttribute("cy", f.y(Math.max(0, r.k)));

      cells.pp.textContent = V.fmt.int(r.pp * 1000);
      cells.pn.textContent = V.fmt.int(r.pn * 1000);
      cells.np.textContent = V.fmt.int(r.pn * 1000);
      cells.nn.textContent = V.fmt.int(r.nn * 1000);
      out.po(V.fmt.pct(r.po));
      out.pe(V.fmt.pct(r.pe));
      out.k(f2(r.k));
      out.band(band(r.k));
      out.pos(V.fmt.pct(r.pos));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Two methods for 24-hour sodium (mmol/day): a reference and a new method.
  // Scatter (where correlation lives) and Bland-Altman plot (where agreement lives).
  V.register("bland-altman", function (root) {
    var N = 120, MU = 150, rand = V.rng(214), Z = [];
    for (var i = 0; i < N; i++) Z.push([V.normal(rand), V.normal(rand), V.normal(rand)]);

    var ctr = V.controls(root);
    var sBias = V.slider(ctr, { label: "Constant bias of the new method", min: -40, max: 40, step: 1, value: 25, fmt: function (v) { return V.fmt.signed(v, 0) + " mmol"; }, onInput: draw });
    var sSlope = V.slider(ctr, { label: "Proportional bias (new method’s slope)", min: 0.5, max: 1.5, step: 0.05, value: 1, fmt: f2, onInput: draw });
    var sNoise = V.slider(ctr, { label: "Random disagreement (SD)", min: 0, max: 50, step: 1, value: 20, fmt: function (v) { return v + " mmol"; }, onInput: draw });
    var sSpread = V.slider(ctr, { label: "Spread of true intake between people (SD)", min: 15, max: 70, step: 1, value: 55, fmt: function (v) { return v + " mmol"; }, onInput: draw });
    var sOK = V.slider(ctr, { label: "Difference you would accept", min: 10, max: 60, step: 5, value: 20, fmt: function (v) { return "± " + v + " mmol"; }, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["High r, poor agreement", 25, 1, 20, 55], ["Spot-urine-like (squashed)", 0, 0.6, 25, 55], ["Good agreement", 2, 1, 6, 55], ["Same methods, narrow range", 25, 1, 20, 15]].forEach(function (p) {
      V.button(pre, p[0], function () { sBias.set(p[1]); sSlope.set(p[2]); sNoise.set(p[3]); sSpread.set(p[4]); draw(); });
    });

    el("div", { class: "widget-note", style: "margin:0.2rem 0 0.2rem;font-weight:600", text: "1 · Scatter: what correlation sees" }, root);
    V.legend(root, [{ cls: "s4", label: "One person" }, { cls: "s5", label: "Line of perfect agreement (y = x)", dashed: true }]);
    var c1 = V.svg(root, 640, 300);
    c1.setAttribute("aria-label", "Scatter of new method against reference method with the line of equality");
    var f1 = V.frame(c1, { x: [0, 350], y: [0, 350], xLabel: "Reference: 24-hour urine sodium (mmol/day)", yLabel: "New method (mmol/day)", margin: { right: 90 } });
    el("line", { x1: f1.x(0), y1: f1.y(0), x2: f1.x(350), y2: f1.y(350), class: "stroke s5 dashed" }, f1.inner);
    var g1 = el("g", null, f1.inner);
    var rTxt = el("text", { x: f1.x(350) + 10, y: f1.y(330), class: "viz-bold colour s4" }, f1.inner);
    el("text", { x: f1.x(350) + 10, y: f1.y(330) + 18, class: "viz-small viz-muted", text: "correlation" }, f1.inner);

    el("div", { class: "widget-note", style: "margin:0.8rem 0 0.2rem;font-weight:600", text: "2 · Bland-Altman plot: what agreement looks like" }, root);
    V.legend(root, [{ cls: "s1", label: "Mean difference (bias)" }, { cls: "s3", label: "95% limits of agreement", dashed: true }, { cls: "s5", label: "Difference you would accept" }]);
    var c2 = V.svg(root, 640, 300);
    c2.setAttribute("aria-label", "Bland-Altman plot: difference between methods against their mean, with the mean difference and 95% limits of agreement");
    var f2r = V.frame(c2, { x: [0, 350], y: [-120, 120], yTicks: [-120, -80, -40, 0, 40, 80, 120], fmtY: function (v) { return V.fmt.signed(v, 0); }, xLabel: "Mean of the two methods (mmol/day)", yLabel: "New − reference (mmol/day)", margin: { right: 90 } });
    var okBand = el("rect", { x: f2r.x(0), width: f2r.x(350) - f2r.x(0), class: "fill-soft s5" }, f2r.inner);
    el("line", { x1: f2r.x(0), x2: f2r.x(350), y1: f2r.y(0), y2: f2r.y(0), class: "viz-axis" }, f2r.inner);
    var g2 = el("g", null, f2r.inner);
    var lMean = el("line", { x1: f2r.x(0), x2: f2r.x(350), class: "stroke s1" }, f2r.inner);
    var lUp = el("line", { x1: f2r.x(0), x2: f2r.x(350), class: "stroke s3 dashed" }, f2r.inner);
    var lLo = el("line", { x1: f2r.x(0), x2: f2r.x(350), class: "stroke s3 dashed" }, f2r.inner);
    var tMean = el("text", { x: f2r.x(350) + 8, class: "viz-small viz-bold colour s1", "dominant-baseline": "middle" }, f2r.inner);
    var tUp = el("text", { x: f2r.x(350) + 8, class: "viz-small colour s3", "dominant-baseline": "middle" }, f2r.inner);
    var tLo = el("text", { x: f2r.x(350) + 8, class: "viz-small colour s3", "dominant-baseline": "middle" }, f2r.inner);

    var out = V.readouts(root, [
      { key: "r", label: "Correlation (r)" },
      { key: "bias", label: "Mean difference (bias)", cls: "bad" },
      { key: "loa", label: "95% limits of agreement" },
      { key: "ok", label: "People whose two results differ by less than the accepted amount", cls: "good" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers: 120 simulated adults, mean intake 150 mmol/day. The reference has a little error of its own. Points outside the plot area are clipped." }, root);

    function clip(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function draw() {
      var bias = sBias.value(), sl = sSlope.value(), sd = sNoise.value(), sp = sSpread.value(), ok = sOK.value();
      var A = [], B = [];
      Z.forEach(function (z) {
        var t = Math.max(20, MU + sp * z[0]);
        A.push(t + 6 * z[1]);
        B.push(MU + bias + sl * (t - MU) + sd * z[2]);
      });
      var ma = 0, mb = 0;
      for (var i = 0; i < N; i++) { ma += A[i]; mb += B[i]; }
      ma /= N; mb /= N;
      var sab = 0, saa = 0, sbb = 0, d = [], md = 0;
      for (i = 0; i < N; i++) { sab += (A[i] - ma) * (B[i] - mb); saa += (A[i] - ma) * (A[i] - ma); sbb += (B[i] - mb) * (B[i] - mb); d.push(B[i] - A[i]); md += B[i] - A[i]; }
      var r = sab / Math.sqrt(saa * sbb); md /= N;
      var sdd = Math.sqrt(d.reduce(function (s, x) { return s + (x - md) * (x - md); }, 0) / (N - 1));
      var lo = md - 1.96 * sdd, hi = md + 1.96 * sdd;
      var within = d.filter(function (x) { return Math.abs(x) < ok; }).length / N;

      clear(g1); clear(g2);
      for (i = 0; i < N; i++) {
        el("circle", { cx: f1.x(clip(A[i], 0, 350)), cy: f1.y(clip(B[i], 0, 350)), r: 3.2, class: "dot s4", "fill-opacity": 0.75 }, g1);
        el("circle", { cx: f2r.x(clip((A[i] + B[i]) / 2, 0, 350)), cy: f2r.y(clip(d[i], -120, 120)), r: 3.2, class: "dot s4", "fill-opacity": 0.75 }, g2);
      }
      rTxt.textContent = "r = " + f2(r);
      okBand.setAttribute("y", f2r.y(ok)); okBand.setAttribute("height", f2r.y(-ok) - f2r.y(ok));
      [[lMean, tMean, md, "bias "], [lUp, tUp, hi, "upper "], [lLo, tLo, lo, "lower "]].forEach(function (L) {
        var y = f2r.y(clip(L[2], -120, 120));
        L[0].setAttribute("y1", y); L[0].setAttribute("y2", y);
        L[1].textContent = L[3] + V.fmt.signed(L[2], 0);
      });
      // keep the three right-hand labels apart
      var ys = [f2r.y(clip(hi, -120, 120)), f2r.y(clip(md, -120, 120)), f2r.y(clip(lo, -120, 120))];
      if (ys[1] - ys[0] < 15) ys[0] = ys[1] - 15;
      if (ys[2] - ys[1] < 15) ys[2] = ys[1] + 15;
      tUp.setAttribute("y", ys[0]); tMean.setAttribute("y", ys[1]); tLo.setAttribute("y", ys[2]);

      out.r(f2(r));
      out.bias(V.fmt.signed(md, 0) + " mmol");
      out.loa(V.fmt.signed(lo, 0) + " to " + V.fmt.signed(hi, 0));
      out.ok(V.fmt.pct(within));
    }
    draw();
  });
})();
