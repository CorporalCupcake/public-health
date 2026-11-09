// Lecture 2.1 — rate vs risk over time; a live 2×2 table (RR, OR, RD, NNT) and OR drift. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // Rate → risk: with a constant rate λ, risk by time t is 1 − e^(−λt), not λt.
  V.register("rate-risk", function (root) {
    var ctr = V.controls(root);
    var sr = V.slider(ctr, { label: "Rate (per 100 person-years)", min: 0.5, max: 40, step: 0.5, value: 5, fmt: function (v) { return V.fmt.num(v, 1); }, onInput: draw });
    var st = V.slider(ctr, { label: "Follow-up", min: 1, max: 30, step: 1, value: 10, fmt: function (v) { return v + (v === 1 ? " year" : " years"); }, onInput: draw });

    V.legend(root, [
      { cls: "s1", label: "True risk, 1 − e^(−rate × time)" },
      { cls: "s3", label: "Shortcut: rate × time", dashed: true },
      { cls: "s2", label: "Odds of the event" }
    ]);
    var c = V.svg(root, 640, 280);
    c.setAttribute("aria-label", "Risk, the rate-times-time shortcut and the odds, plotted against years of follow-up");
    var f = V.frame(c, { x: [0, 30], y: [0, 1], fmtY: V.fmt.pct, xLabel: "Years of follow-up", yLabel: "Risk (odds on the same scale)" });
    var pRisk = el("path", { class: "stroke s1" }, f.inner);
    var pNaive = el("path", { class: "stroke s3 dashed" }, f.inner);
    var pOdds = el("path", { class: "stroke s2" }, f.inner);
    var mark = el("line", { y1: f.y(0), y2: f.y(1), class: "edge strong", "stroke-dasharray": "4 4" }, f.inner);
    var dRisk = el("circle", { r: 5, class: "dot s1" }, f.inner);
    var dNaive = el("circle", { r: 5, class: "dot s3" }, f.inner);

    var out = V.readouts(root, [
      { key: "risk", label: "True risk by this time", cls: "good" },
      { key: "naive", label: "Shortcut: rate × time", cls: "bad" },
      { key: "odds", label: "Odds by this time" },
      { key: "over", label: "How much the shortcut overstates" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Assumes a constant rate and no competing deaths. The shortcut and odds lines stop at the top of the chart; the shortcut can even pass 100%, which no risk can." }, root);

    function clipPath(fn) {
      var pts = [];
      for (var t = 0; t <= 30.001; t += 0.25) { var v = fn(t); if (v > 1) break; pts.push([f.x(t), f.y(v)]); }
      return V.line(pts);
    }

    function draw() {
      var lam = sr.value() / 100, T = st.value();
      var risk = function (t) { return 1 - Math.exp(-lam * t); };
      pRisk.setAttribute("d", clipPath(risk));
      pNaive.setAttribute("d", clipPath(function (t) { return lam * t; }));
      pOdds.setAttribute("d", clipPath(function (t) { var r = risk(t); return r / (1 - r); }));
      mark.setAttribute("x1", f.x(T)); mark.setAttribute("x2", f.x(T));
      var r = risk(T), n = lam * T, o = r / (1 - r);
      dRisk.setAttribute("cx", f.x(T)); dRisk.setAttribute("cy", f.y(r));
      dNaive.setAttribute("cx", f.x(T)); dNaive.setAttribute("cy", f.y(Math.min(n, 1)));
      dNaive.style.display = n > 1 ? "none" : "";
      out.risk(V.fmt.pct1(r));
      out.naive(V.fmt.pct1(n));
      out.odds(V.fmt.num(o, 2));
      out.over(r > 0 ? "×" + V.fmt.num(n / r, 2) : "–");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // 2×2 table: baseline risk, risk ratio, group size → RR, OR, RD, NNT.
  // Chart: holding the RR fixed, the OR at every baseline risk (log scale).
  V.register("two-by-two", function (root) {
    var ctr = V.controls(root);
    var s0 = V.slider(ctr, { label: "Risk in the unexposed", min: 1, max: 95, step: 1, value: 10, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sR = V.slider(ctr, { label: "True risk ratio (RR)", min: 0.2, max: 5, step: 0.01, value: 2, fmt: function (v) { return v.toFixed(2); }, onInput: draw });
    var sN = V.slider(ctr, { label: "People in each group", min: 100, max: 5000, step: 100, value: 1000, fmt: V.fmt.int, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Try:" }, pre);
    [["Rare outcome", 2, 2], ["Common outcome", 40, 2], ["Referral example", 91, 0.93]].forEach(function (p) {
      V.button(pre, p[0], function () { s0.set(p[1]); sR.set(p[2]); draw(); });
    });

    var tw = el("div", { class: "table-wrap" }, root);
    var tbl = el("table", null, tw);
    var th = el("thead", null, tbl), trh = el("tr", null, th);
    ["", "Outcome", "No outcome", "Total", "Risk", "Odds"].forEach(function (h) { el("th", { text: h }, trh); });
    var tb = el("tbody", null, tbl);
    function row(label) {
      var tr = el("tr", null, tb), cells = [];
      el("td", { html: "<strong>" + label + "</strong>" }, tr);
      for (var i = 0; i < 5; i++) cells.push(el("td", null, tr));
      return cells;
    }
    var rE = row("Exposed"), rU = row("Unexposed");
    var capNote = el("p", { class: "widget-note", style: "margin:0 0 0.6rem" }, root);

    var out = V.readouts(root, [
      { key: "rr", label: "Risk ratio (RR)", cls: "good" },
      { key: "or", label: "Odds ratio (OR) = ad ÷ bc", cls: "bad" },
      { key: "rd", label: "Risk difference (exposed − unexposed)" },
      { key: "nnt", label: "NNT or NNH = 1 ÷ |RD|" },
      { key: "gap", label: "OR ÷ RR (1 when they agree)" }
    ]);

    V.legend(root, [
      { cls: "s1", label: "Risk ratio (held at your value)", dashed: true },
      { cls: "s2", label: "Odds ratio at that baseline risk" },
      { cls: "s5", label: "Rare-outcome zone (under 10%)" }
    ]);
    var c = V.svg(root, 640, 290);
    c.setAttribute("aria-label", "Odds ratio and risk ratio plotted against the baseline risk, on a log scale");
    el("p", { class: "widget-note", text: "Illustrative numbers. Measures are computed from the true risks; table counts are rounded. The vertical scale is logarithmic, so 0.5 and 2 are equally far from 1." }, root);

    var CAND = [1 / 64, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 0.5, 1, 2, 4, 8, 16, 32, 64], FINE = [0.75, 1.5, 3, 6];
    function fmtRatio(v) {
      if (v >= 1) return V.fmt.num(v, v < 10 ? (v % 1 ? 2 : 0) : 0);
      var inv = 1 / v;
      return Math.abs(inv - Math.round(inv)) < 1e-9 && inv > 2 ? "1/" + Math.round(inv) : V.fmt.num(v, 2);
    }
    function odds(p) { return p / (1 - p); }

    function draw() {
      var p0 = s0.value() / 100, RR = sR.value(), n = sN.value();
      var p1raw = p0 * RR, p1 = Math.min(p1raw, 0.99), capped = p1raw > 0.99;
      var rr = p1 / p0, or = odds(p1) / odds(p0), rd = p1 - p0;

      // table
      var a = Math.round(n * p1), cc = Math.round(n * p0);
      [[rE, a, p1], [rU, cc, p0]].forEach(function (r) {
        var cells = r[0], k = r[1], p = r[2];
        cells[0].textContent = V.fmt.int(k);
        cells[1].textContent = V.fmt.int(n - k);
        cells[2].textContent = V.fmt.int(n);
        cells[3].textContent = V.fmt.pct1(p);
        cells[4].textContent = V.fmt.num(odds(p), 3);
      });
      capNote.textContent = capped
        ? "The exposed risk would pass 100%, so it is capped at 99%. Lower the baseline risk or the RR."
        : "Rows: exposed cells are a (outcome) and b (no outcome); unexposed are c and d.";

      out.rr(V.fmt.num(rr, 2));
      out.or(V.fmt.num(or, 2));
      out.rd(V.fmt.signed(rd * 100, 1) + " points");
      out.nnt(Math.abs(rd) < 1e-9 ? "–" : (rd < 0 ? "NNT " : "NNH ") + V.fmt.int(Math.ceil(1 / Math.abs(rd) - 1e-9)));
      out.gap(V.fmt.num(or / rr, 2));

      // chart
      clear(c);
      var xmax = 0.95, pts = [], lo = Math.min(1, RR), hi = Math.max(1, RR);
      for (var x = 0.005; x <= xmax + 1e-9; x += 0.005) {
        if (x * RR > 0.99) break;
        var o = odds(x * RR) / odds(x);
        pts.push([x, o]); lo = Math.min(lo, o); hi = Math.max(hi, o);
      }
      lo = Math.max(1 / 64, lo / 1.3); hi = Math.min(64, hi * 1.3);
      var L0 = Math.log2(lo), L1 = Math.log2(hi);
      var tk = CAND.filter(function (v) { return v >= lo && v <= hi; });
      if (L1 - L0 < 3.2) tk = tk.concat(FINE.filter(function (v) { return v >= lo && v <= hi; }));
      var f = V.frame(c, {
        x: [0, xmax], y: [L0, L1],
        xTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        yTicks: tk.map(function (v) { return Math.log2(v); }),
        fmtX: V.fmt.pct, fmtY: function (t) { return fmtRatio(Math.pow(2, t)); },
        xLabel: "Risk in the unexposed (baseline risk)", yLabel: "Ratio (log scale)"
      });
      var g = f.inner;
      var ly = function (v) { return f.y(Math.log2(Math.min(hi, Math.max(lo, v)))); };
      el("rect", { x: f.x(0), y: f.y(L1), width: f.x(0.1) - f.x(0), height: f.y(L0) - f.y(L1), class: "fill-soft s5" }, g);
      el("text", { x: f.x(0) + 6, y: f.y(L1) + 14, class: "viz-small viz-muted", text: "rare" }, g);
      el("line", { x1: f.x(0), x2: f.x(xmax), y1: ly(1), y2: ly(1), class: "edge" }, g);
      var xEnd = pts.length ? pts[pts.length - 1][0] : 0.005;
      el("line", { x1: f.x(0), x2: f.x(xEnd), y1: ly(RR), y2: ly(RR), class: "stroke s1 dashed" }, g);
      el("path", { d: V.line(pts.map(function (p) { return [f.x(p[0]), ly(p[1])]; })), class: "stroke s2" }, g);
      if (xEnd < xmax - 0.02) {
        el("line", { x1: f.x(xEnd), x2: f.x(xEnd), y1: f.y(L0), y2: f.y(L1), class: "edge", "stroke-dasharray": "2 4" }, g);
        el("text", { x: f.x(xEnd) + 8, y: f.y(L1) + 14, class: "viz-small viz-muted", text: "beyond here the exposed risk would pass 100%" }, g);
      }
      if (!capped) {
        el("line", { x1: f.x(p0), x2: f.x(p0), y1: ly(rr), y2: ly(or), class: "edge strong", "stroke-dasharray": "3 3" }, g);
        el("circle", { cx: f.x(p0), cy: ly(rr), r: 5, class: "dot s1" }, g);
        el("circle", { cx: f.x(p0), cy: ly(or), r: 5, class: "dot s2" }, g);
        var right = p0 < 0.15;
        el("text", { x: f.x(p0) + (right ? 12 : -12), y: ly(or) + (or >= rr ? -10 : 20), "text-anchor": right ? "start" : "end", class: "viz-small viz-bold colour s2", text: "OR " + V.fmt.num(or, 2) }, g);
      }
    }
    draw();
  });
})();
