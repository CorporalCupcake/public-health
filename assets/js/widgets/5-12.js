// Lecture 5.12 — Shrinking observed-to-expected ratios. Illustrative numbers.
// Ten made-up drug–event pairs with observed (O) and expected (E) report counts.
// Shrunk estimate (O + k) / (E + k); k = 0.5 matches the simplified information component
// IC = log2((O + 0.5) / (E + 0.5)). Interval: 2.5% and 97.5% quantiles of Gamma(O + k, rate E + k).
// Raw rule: O/E >= 2. Shrunk rule: lower 2.5% bound > 1 (the IC025 > 0 idea).
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function lgamma(x) {
    var c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    var a = c[0], t = x + 7.5;
    for (var i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  // Regularized lower incomplete gamma P(a, x): series for x < a + 1, continued fraction otherwise.
  function gammaP(a, x) {
    if (x <= 0) return 0;
    var gln = lgamma(a), n, sum, del, ap;
    if (x < a + 1) {
      ap = a; sum = del = 1 / a;
      for (n = 0; n < 500; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; }
      return sum * Math.exp(-x + a * Math.log(x) - gln);
    }
    var b = x + 1 - a, c = 1e300, d = 1 / b, h = d, an;
    for (n = 1; n < 500; n++) {
      an = -n * (n - a); b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-12) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
  }
  // Quantile of Gamma(shape a, rate r) by bisection.
  function gammaQ(p, a, r) {
    var lo = 0, hi = Math.max(10, a * 10 + 50);
    for (var i = 0; i < 100; i++) { var mid = (lo + hi) / 2; if (gammaP(a, mid) < p) lo = mid; else hi = mid; }
    return (lo + hi) / 2 / r;
  }

  var PAIRS = [
    { name: "Drug A · liver injury", O: 1, E: 0.05, real: false },
    { name: "Drug B · rash", O: 2, E: 0.05, real: false },
    { name: "Drug C · pancreatitis", O: 3, E: 0.4, real: true },
    { name: "Drug D · QT prolongation", O: 25, E: 8, real: true },
    { name: "Drug E · headache", O: 60, E: 50, real: false },
    { name: "Drug F · hair loss", O: 4, E: 1.5, real: false },
    { name: "Drug G · ketoacidosis", O: 12, E: 3, real: true },
    { name: "Drug H · falls", O: 1, E: 0.2, real: false },
    { name: "Drug I · angioedema", O: 6, E: 1.2, real: true },
    { name: "Drug J · nausea", O: 40, E: 18, real: false }
  ];
  var LX = [-4, 6.5];
  function log2(v) { return Math.log(v) / Math.LN2; }
  function clip(v) { return Math.max(LX[0], Math.min(LX[1], v)); }

  V.register("shrinkage", function (root) {
    var ctr = V.controls(root);
    var sK = V.slider(ctr, { label: "Shrinkage: pseudo-reports added to O and E (k)", min: 0, max: 5, step: 0.5, value: 0.5,
      fmt: function (v) { return v === 0 ? "0 (no shrinkage)" : v === 0.5 ? "0.5 (as in the IC)" : v.toFixed(1); }, onInput: draw });

    V.legend(root, [
      { cls: "s2", label: "Raw O/E (filled = flagged by O/E ≥ 2)" },
      { cls: "s1", label: "Shrunk estimate and 95% interval (filled = lower bound above 1)" }
    ]);
    var ROW = 34, TOP = 34, BOT = 44, W = 640, H = TOP + ROW * PAIRS.length + BOT;
    var c = V.svg(root, W, H);
    c.setAttribute("aria-label", "Dot plot of ten drug–event pairs on a log scale, showing the raw observed-to-expected ratio and the shrunk estimate with its interval, with lines at a ratio of 1 and 2, and whether each pair was later judged a real adverse reaction");
    var h = el("g", null, c); h.W = W; h.H = H;

    var out = V.readouts(root, [
      { key: "nRaw", label: "Flagged by raw O/E ≥ 2" },
      { key: "nShr", label: "Flagged by shrunk lower bound > 1" },
      { key: "fa", label: "False alarms: raw / shrunk" },
      { key: "miss", label: "Real reactions missed: raw / shrunk" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. O = reports for the pair; E = reports expected if drug and event were unrelated. “Real” is what a later full assessment concluded (made up). Drug J shows what shrinkage cannot fix: a large count inflated by stimulated reporting, not by chance." }, root);

    function draw() {
      var k = sK.value();
      clear(h);
      var f = V.frame(h, { x: LX, y: [0, PAIRS.length], yTicks: [], xTicks: [-4, -2, 0, 1, 2, 3, 4, 5, 6],
        fmtX: function (v) { return v >= 0 ? String(Math.pow(2, v)) : "1/" + Math.pow(2, -v); },
        xLabel: "Observed ÷ expected (log scale)", margin: { left: 214, right: 50, top: TOP, bottom: BOT } });
      var g = f.inner;
      el("text", { x: 4, y: 16, class: "viz-small viz-bold", text: "Pair (O = observed, E = expected)" }, g);
      el("text", { x: W - 4, y: 16, "text-anchor": "end", class: "viz-small viz-bold", text: "Truth" }, g);
      el("line", { x1: f.x(0), x2: f.x(0), y1: TOP, y2: H - BOT, class: "stroke s5", style: "stroke-width:1.5" }, g);
      el("line", { x1: f.x(1), x2: f.x(1), y1: TOP, y2: H - BOT, class: "stroke s2 dashed", style: "stroke-width:1.5" }, g);
      el("text", { x: f.x(1) + 4, y: TOP - 6, class: "viz-small colour s2", text: "raw threshold 2" }, g);
      el("text", { x: f.x(0) - 4, y: TOP - 6, "text-anchor": "end", class: "viz-small viz-muted", text: "no excess" }, g);

      var nRaw = 0, nShr = 0, faR = 0, faS = 0, mR = 0, mS = 0;
      PAIRS.forEach(function (p, i) {
        var yc = TOP + ROW * i + ROW / 2;
        var raw = p.O / p.E, shr = (p.O + k) / (p.E + k);
        var lo = gammaQ(0.025, p.O + k, p.E + k), hi = gammaQ(0.975, p.O + k, p.E + k);
        var fR = raw >= 2, fS = lo > 1;
        if (fR) nRaw++; if (fS) nShr++;
        if (fR && !p.real) faR++; if (fS && !p.real) faS++;
        if (!fR && p.real) mR++; if (!fS && p.real) mS++;
        if (i % 2 === 0) el("rect", { x: f.m.left, y: yc - ROW / 2, width: W - f.m.left - f.m.right, height: ROW, class: "fill-soft s5", style: "opacity:0.35" }, g);
        el("text", { x: 4, y: yc - 3, class: "viz-small", text: p.name }, g);
        el("text", { x: 4, y: yc + 12, class: "viz-small viz-muted", text: "O " + p.O + " · E " + p.E }, g);
        el("text", { x: W - 4, y: yc + 4, "text-anchor": "end", class: "viz-small " + (p.real ? "colour s1 viz-bold" : "viz-muted"), text: p.real ? "real" : "not" }, g);
        el("line", { x1: f.x(clip(log2(lo))), x2: f.x(clip(log2(hi))), y1: yc + 5, y2: yc + 5, class: "stroke s1", style: "stroke-width:2.5" }, g);
        el("circle", { cx: f.x(clip(log2(shr))), cy: yc + 5, r: 5.5, class: "s1 " + (fS ? "dot" : "stroke"), style: fS ? "" : "fill:none;stroke-width:2" }, g);
        el("circle", { cx: f.x(clip(log2(raw))), cy: yc - 5, r: 5, class: "s2 " + (fR ? "dot" : "stroke"), style: fR ? "" : "fill:none;stroke-width:2" }, g);
      });
      out.nRaw(nRaw + " of 10");
      out.nShr(nShr + " of 10");
      out.fa(faR + " / " + faS);
      out.miss(mR + " / " + mS);
    }
    draw();
  });
})();
