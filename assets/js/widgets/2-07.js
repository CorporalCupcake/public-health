// Lecture 2.7 — Berkson's bias / collider stratification.
// Two independent conditions in a population; admission depends on them.
// Among the admitted, the conditions become negatively correlated. Illustrative numbers.
Viz.register("berkson-collider", function (root) {
  var V = Viz, el = V.el, N = 600, D = 3.4;
  var rand = V.rng(4242), X = [], Y = [], U = [];
  for (var i = 0; i < N; i++) { X.push(V.normal(rand)); Y.push(V.normal(rand)); U.push(rand()); }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function corr(ix) {
    var n = ix.length; if (n < 3) return NaN;
    var mx = 0, my = 0; ix.forEach(function (i) { mx += X[i]; my += Y[i]; }); mx /= n; my /= n;
    var sxy = 0, sxx = 0, syy = 0;
    ix.forEach(function (i) { var a = X[i] - mx, b = Y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; });
    return { r: sxy / Math.sqrt(sxx * syy), b: sxy / sxx, mx: mx, my: my };
  }

  var ctr = V.controls(root);
  var rule = V.toggle(ctr, { options: [{ value: "sum", label: "A + B high" }, { value: "either", label: "A or B high" }, { value: "random", label: "At random" }], value: "sum", onChange: draw });
  var st = V.slider(ctr, { label: "Admission cut-off (higher = stricter)", min: -3, max: 3, step: 0.1, value: 1, fmt: function (v) { return V.fmt.signed(v, 1); }, onInput: draw });

  V.legend(root, [
    { cls: "s2", label: "Admitted (in the hospital study)" },
    { cls: "s5", label: "Not admitted (in the community only)" },
    { cls: "s3", label: "Trend among the admitted" }
  ]);
  var c = V.svg(root, 640, 420);
  c.setAttribute("aria-label", "Scatter of two independent condition scores in a population, with admitted people highlighted and the trend line among them");

  var out = V.readouts(root, [
    { key: "all", label: "Correlation of A and B in the whole population" },
    { key: "sel", label: "Correlation among the admitted", cls: "bad" },
    { key: "share", label: "Share of the population admitted" }
  ]);
  el("p", { class: "widget-note", text: "Illustrative numbers. 600 people with two conditions, A and B, scored independently. “A + B high”: admitted if A + B exceeds the cut-off. “A or B high”: admitted if either score exceeds it. “At random”: the same share as the first rule, picked by lottery." }, root);

  function draw() {
    var t = st.value(), mode = rule.value(), sel = [], all = [];
    var share = 0;
    for (var i = 0; i < N; i++) if (X[i] + Y[i] > t * Math.SQRT2) share++;
    share /= N;
    for (i = 0; i < N; i++) {
      all.push(i);
      var s = mode === "sum" ? X[i] + Y[i] > t * Math.SQRT2 : mode === "either" ? (X[i] > t || Y[i] > t) : U[i] < share;
      if (s) sel.push(i);
    }
    clear(c);
    var f = V.frame(c, { x: [-D, D], y: [-D, D], xTicks: [-3, -2, -1, 0, 1, 2, 3], yTicks: [-3, -2, -1, 0, 1, 2, 3], xLabel: "Severity of condition A (standardised score)", yLabel: "Severity of condition B" });
    var g = f.inner, isSel = {};
    sel.forEach(function (k) { isSel[k] = 1; });
    for (i = 0; i < N; i++) if (!isSel[i]) el("circle", { cx: f.x(Math.max(-D, Math.min(D, X[i]))), cy: f.y(Math.max(-D, Math.min(D, Y[i]))), r: 2.6, class: "fill-soft s5" }, g);
    sel.forEach(function (k) { el("circle", { cx: f.x(Math.max(-D, Math.min(D, X[k]))), cy: f.y(Math.max(-D, Math.min(D, Y[k]))), r: 3, class: "dot s2" }, g); });

    // Selection boundary
    if (mode === "sum") {
      var c0 = t * Math.SQRT2, pts = [];
      // x + y = c0, clipped to the box
      var xa = Math.max(-D, c0 - D), xb = Math.min(D, c0 + D);
      if (xa < xb) el("line", { x1: f.x(xa), y1: f.y(c0 - xa), x2: f.x(xb), y2: f.y(c0 - xb), class: "edge strong", "stroke-dasharray": "5 4" }, g);
    } else if (mode === "either" && t < D && t > -D) {
      el("path", { d: "M" + f.x(-D) + "," + f.y(t) + "L" + f.x(t) + "," + f.y(t) + "L" + f.x(t) + "," + f.y(-D), class: "edge strong", "stroke-dasharray": "5 4" }, g);
    }

    var rA = corr(all), rS = corr(sel);
    if (rS && isFinite(rS.r)) {
      var x1 = -D, x2 = D, y1 = rS.my + rS.b * (x1 - rS.mx), y2 = rS.my + rS.b * (x2 - rS.mx);
      // clip vertically
      function clipX(yv) { return rS.mx + (yv - rS.my) / rS.b; }
      if (Math.abs(rS.b) > 1e-9) {
        if (y1 > D) { x1 = clipX(D); y1 = D; } if (y1 < -D) { x1 = clipX(-D); y1 = -D; }
        if (y2 > D) { x2 = clipX(D); y2 = D; } if (y2 < -D) { x2 = clipX(-D); y2 = -D; }
      }
      el("line", { x1: f.x(x1), y1: f.y(y1), x2: f.x(x2), y2: f.y(y2), class: "stroke s3" }, g);
    }
    out.all(V.fmt.signed(rA.r, 2));
    out.sel(rS && isFinite(rS.r) ? V.fmt.signed(rS.r, 2) : "–");
    out.share(V.fmt.pct(sel.length / N));
  }
  draw();
});
