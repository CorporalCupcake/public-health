// Lecture 2.11 — Predictive values on an icon array, and threshold → ROC curve.
// Illustrative numbers.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Standard normal CDF (Abramowitz–Stegun 7.1.26 erf approximation)
  function Phi(z) {
    var t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
    return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
  }
  function dnorm(x, m) { return Math.exp(-0.5 * (x - m) * (x - m)) / Math.sqrt(2 * Math.PI); }

  // ---------------------------------------------------------------------------
  // PPV on 1,000 people
  V.register("ppv-icons", function (root) {
    var ctr = V.controls(root);
    var sp = V.slider(ctr, { label: "Prevalence (share with the disease)", min: 0.1, max: 50, step: 0.1, value: 1, fmt: function (v) { return v.toFixed(1) + "%"; }, onInput: draw });
    var se = V.slider(ctr, { label: "Sensitivity", min: 50, max: 100, step: 1, value: 90, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sc = V.slider(ctr, { label: "Specificity", min: 50, max: 100, step: 0.5, value: 95, fmt: function (v) { return v.toFixed(1) + "%"; }, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Presets:" }, pre);
    [["Population screening", 1, 90, 95], ["Symptomatic clinic", 30, 90, 95], ["Screening, very specific test", 1, 90, 99.5]].forEach(function (p) {
      V.button(pre, p[0], function () { sp.set(p[1]); se.set(p[2]); sc.set(p[3]); draw(); });
    });

    V.legend(root, [
      { cls: "s3", label: "Sick, test positive" },
      { cls: "s4", label: "Sick, test negative (missed)" },
      { cls: "s2", label: "Healthy, test positive (false alarm)" },
      { cls: "s5", label: "Healthy, test negative" }
    ]);
    var c = V.svg(root, 640, 262);
    c.setAttribute("aria-label", "Icon array of 1,000 people coloured by disease status and test result");
    var COLS = 50, CELL = 12, X0 = 20, Y0 = 8;
    var cells = [];
    for (var i = 0; i < 1000; i++) {
      var col = i % COLS, row = Math.floor(i / COLS);
      cells.push(el("rect", { x: X0 + col * CELL + 1.5, y: Y0 + row * CELL + 1.5, width: CELL - 3, height: CELL - 3, rx: 2 }, c));
    }
    var sentence = el("p", { class: "widget-note", style: "font-weight:700;color:var(--text);font-size:0.95rem" }, root);
    var out = V.readouts(root, [
      { key: "ppv", label: "PPV: positives who are truly sick", cls: "bad" },
      { key: "npv", label: "NPV: negatives who are truly healthy", cls: "good" },
      { key: "pos", label: "Positive results per 1,000 screened" },
      { key: "fn", label: "Sick people missed per 1,000" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Squares are rounded to whole people; the PPV and NPV readouts are exact." }, root);

    function draw() {
      var p = sp.value() / 100, s = se.value() / 100, f = sc.value() / 100;
      var D = Math.round(1000 * p), TP = Math.round(D * s), FN = D - TP, FP = Math.round((1000 - D) * (1 - f)), TN = 1000 - D - FP;
      var k = 0;
      [[TP, "fill s3"], [FN, "fill s4"], [FP, "fill s2"], [TN, "fill-soft s5"]].forEach(function (grp) {
        for (var j = 0; j < grp[0]; j++) cells[k++].setAttribute("class", grp[1]);
      });
      var ppv = s * p / (s * p + (1 - f) * (1 - p)), npv = f * (1 - p) / (f * (1 - p) + (1 - s) * p);
      sentence.textContent = "Of the " + (TP + FP) + " people who test positive, " + TP + (TP === 1 ? " has" : " have") + " the disease. Of the " + (FN + TN) + " who test negative, " + FN + (FN === 1 ? " has" : " have") + " it.";
      out.ppv(V.fmt.pct1(ppv));
      out.npv(npv > 0.999 && npv < 1 ? ">99.9%" : V.fmt.pct1(npv));
      out.pos(String(TP + FP));
      out.fn(String(FN));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Threshold on two overlapping distributions → point on the ROC curve
  V.register("roc-threshold", function (root) {
    var ctr = V.controls(root);
    var st = V.slider(ctr, { label: "Threshold (test positive at or above)", min: -2.5, max: 5, step: 0.1, value: 1.2, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sd = V.slider(ctr, { label: "Separation between sick and healthy", min: 0, max: 3.5, step: 0.1, value: 1.8, fmt: function (v) { return v.toFixed(1) + " SD"; }, onInput: draw });
    var spv = V.slider(ctr, { label: "Prevalence (for PPV)", min: 1, max: 50, step: 1, value: 5, fmt: function (v) { return v + "%"; }, onInput: draw });

    V.legend(root, [
      { cls: "s5", label: "Healthy people" },
      { cls: "s3", label: "Sick people" },
      { cls: "s2", label: "False positives (healthy above threshold)" }
    ]);
    var c1 = V.svg(root, 640, 220);
    c1.setAttribute("aria-label", "Two overlapping bell curves of test values for healthy and sick people, with a threshold line");
    var c2 = V.svg(root, 640, 300);
    c2.setAttribute("aria-label", "ROC curve with the current threshold marked, and a table of results per 1,000 people");

    var out = V.readouts(root, [
      { key: "sens", label: "Sensitivity" },
      { key: "spec", label: "Specificity" },
      { key: "auc", label: "AUC (whole curve)", cls: "good" },
      { key: "ppv", label: "PPV at this prevalence", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Test values are normal with equal spread in both groups; the healthy mean is 0." }, root);

    var XS = []; for (var x = -4; x <= 7.0001; x += 0.05) XS.push(x);

    function draw() {
      var t = st.value(), d = sd.value(), prev = spv.value() / 100;
      var sens = 1 - Phi(t - d), spec = Phi(t), auc = Phi(d / Math.SQRT2);

      // Densities
      clear(c1);
      var f = V.frame(c1, { x: [-4, 7], y: [0, 0.45], yTicks: [], xLabel: "Test value", margin: { left: 20, right: 16, bottom: 38 } });
      var g = f.inner, base = function (xs) { return xs.map(function (x) { return [f.x(x), f.y(0)]; }); };
      var right = XS.filter(function (x) { return x >= t; });
      if (right.length > 1) {
        el("path", { d: V.area(right.map(function (x) { return [f.x(x), f.y(dnorm(x, 0))]; }), base(right)), class: "fill s2" }, g);
        el("path", { d: V.area(right.map(function (x) { return [f.x(x), f.y(dnorm(x, d))]; }), base(right)), class: "fill-soft s3" }, g);
      }
      el("path", { d: V.line(XS.map(function (x) { return [f.x(x), f.y(dnorm(x, 0))]; })), class: "stroke s5" }, g);
      el("path", { d: V.line(XS.map(function (x) { return [f.x(x), f.y(dnorm(x, d))]; })), class: "stroke s3" }, g);
      el("line", { x1: f.x(t), x2: f.x(t), y1: f.y(0), y2: f.y(0.43), class: "edge strong" }, g);
      var lft = t > 3.6;
      el("text", { x: f.x(t) + (lft ? -6 : 6), y: f.y(0.43) + 10, "text-anchor": lft ? "end" : "start", class: "viz-small viz-bold", text: lft ? "positive ← threshold" : "threshold → positive" }, g);
      el("text", { x: f.x(-1.25), y: f.y(0.27), "text-anchor": "end", class: "viz-small colour s5 viz-bold", text: "healthy" }, g);
      el("text", { x: f.x(d + 1.25), y: f.y(0.27), "text-anchor": "start", class: "viz-small colour s3 viz-bold", text: "sick" }, g);

      // ROC
      clear(c2);
      var r = V.frame(c2, { x: [0, 1], y: [0, 1], fmtX: V.fmt.pct, fmtY: V.fmt.pct, xTicks: [0, 0.25, 0.5, 0.75, 1], yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: "1 − specificity (false-positive rate)", yLabel: "Sensitivity", margin: { left: 62, right: 318, bottom: 42, top: 12 } });
      var rg = r.inner, pts = [];
      for (var tt = 7; tt >= -4; tt -= 0.05) pts.push([r.x(1 - Phi(tt)), r.y(1 - Phi(tt - d))]);
      el("path", { d: V.line([[r.x(0), r.y(0)], [r.x(1), r.y(1)]]), class: "stroke dashed s5" }, rg);
      el("path", { d: V.area(pts, pts.map(function (p) { return [p[0], r.y(0)]; })), class: "fill-soft s1" }, rg);
      el("path", { d: V.line(pts), class: "stroke s1" }, rg);
      el("circle", { cx: r.x(1 - spec), cy: r.y(sens), r: 7, class: "dot s3" }, rg);
      el("text", { x: r.x(0.55), y: r.y(0.12), "text-anchor": "middle", class: "viz-small viz-muted", text: "AUC " + auc.toFixed(2) }, rg);

      // Natural-frequency 2×2 on the right
      var N = 1000, D = Math.round(N * prev), TP = Math.round(D * sens), FN = D - TP, FP = Math.round((N - D) * (1 - spec)), TN = N - D - FP;
      var X = 350, cw = 92;
      el("text", { x: X, y: 34, class: "viz-bold", text: "Per 1,000 people at " + Math.round(prev * 100) + "% prevalence" }, c2);
      el("text", { x: X + 80 + cw / 2, y: 66, "text-anchor": "middle", class: "viz-small viz-muted", text: "Sick" }, c2);
      el("text", { x: X + 80 + cw * 1.5, y: 66, "text-anchor": "middle", class: "viz-small viz-muted", text: "Healthy" }, c2);
      [["Test +", TP, FP, "s3", "s2"], ["Test −", FN, TN, "s4", "s5"]].forEach(function (row, i) {
        var y = 76 + i * 46;
        el("text", { x: X, y: y + 28, class: "viz-small viz-bold", text: row[0] }, c2);
        [1, 2].forEach(function (j) {
          var gx = el("g", { class: row[j + 2] }, c2);
          el("rect", { x: X + 80 + (j - 1) * cw, y: y, width: cw - 6, height: 40, rx: 6, class: "node-fill" }, gx);
          el("text", { x: X + 80 + (j - 1) * cw + (cw - 6) / 2, y: y + 26, "text-anchor": "middle", class: "viz-bold", text: V.fmt.int(row[j]) }, c2);
        });
      });
      el("text", { x: X, y: 202, class: "viz-small", text: "Positives: " + (TP + FP) + ", of whom " + TP + " are sick." }, c2);
      el("text", { x: X, y: 220, class: "viz-small", text: "Missed: " + FN + " of " + D + " sick people." }, c2);
      el("text", { x: X, y: 246, class: "viz-small viz-muted", text: "Lower threshold: more caught, more alarms." }, c2);
      el("text", { x: X, y: 264, class: "viz-small viz-muted", text: "Higher threshold: fewer alarms, more missed." }, c2);

      var ppv = sens * prev / (sens * prev + (1 - spec) * (1 - prev));
      out.sens(V.fmt.pct1(sens));
      out.spec(V.fmt.pct1(spec));
      out.auc(auc.toFixed(2));
      out.ppv(isFinite(ppv) ? V.fmt.pct1(ppv) : "–");
    }
    draw();
  });
})();
