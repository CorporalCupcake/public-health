// Lecture 1.2 — the prevention paradox, made interactive (illustrative numbers).
// A town of 100,000 adults. Systolic blood pressure is normal (mean about 122, SD 14 mmHg; 140 is the 90th centile).
// 10-year stroke risk rises smoothly with blood pressure (a logistic curve), calibrated so that
// the lecture's town table comes out: top 10% (≥140) 6%, next 40% 3%, bottom 50% 0.6%,
// i.e. 600 + 1,200 + 300 = 2,100 strokes.
(function () {
  var V = Viz, el = V.el;
  var N = 100000, MU = 122.06, SD = 14, H = 0.25, X0 = 40, X1 = 210;
  var L = 0.0721986, K = 0.1260213, XM = 132.805;

  function risk(bp) { return L / (1 + Math.exp(-K * (bp - XM))); }
  function pdf(x, mu) { var z = (x - mu) / SD; return Math.exp(-0.5 * z * z) / (SD * Math.sqrt(2 * Math.PI)); }
  var GRID = [];
  for (var x = X0 + H / 2; x < X1; x += H) GRID.push(x);

  // Round counts like the town table does (strokes to 10, people to 100).
  function r10(v) { return Math.round(v / 10) * 10; }
  function r100(v) { return Math.round(v / 100) * 100; }

  // Two stacked panels sharing the x axis: people (top) and strokes (bottom).
  function panels(root, legendItems) {
    V.legend(root, legendItems);
    var xr = [80, 175];
    var top = V.svg(root, 640, 170);
    var ft = V.frame(top, { x: xr, y: [0, 3150], yTicks: [], xTicks: [], margin: { left: 34, bottom: 10, top: 26 }, yLabel: "People" });
    var bot = V.svg(root, 640, 200);
    var fb = V.frame(bot, { x: xr, y: [0, 115], yTicks: [], margin: { left: 34, top: 14 }, xLabel: "Systolic blood pressure (mmHg)", yLabel: "Strokes" });
    return { top: ft, bot: fb, xr: xr };
  }

  // Curve points of f(x) on the visible range, optionally clipped to [a, b].
  function pts(f, fn, a, b) {
    var out = [];
    for (var x = f.x.domain[0]; x <= f.x.domain[1] + 1e-9; x += 0.5) {
      if (a !== undefined && (x < a || x > b)) continue;
      out.push([f.x(x), f.y(fn(x))]);
    }
    if (a !== undefined) {           // make the clipped edges exact
      if (a > f.x.domain[0]) out.unshift([f.x(a), f.y(fn(a))]);
      if (b < f.x.domain[1]) out.push([f.x(b), f.y(fn(b))]);
    }
    return out;
  }
  function base(p, f) { return p.map(function (q) { return [q[0], f.y(0)]; }); }
  function setArea(path, f, fn, a, b) { var p = pts(f, fn, a, b); path.setAttribute("d", p.length ? V.area(p, base(p, f)) : ""); }
  function setLine(path, f, fn) { path.setAttribute("d", V.line(pts(f, fn))); }

  function cutLine(f, parent, labelY) {
    var ln = el("line", { class: "edge strong", "stroke-dasharray": "4 4" }, parent);
    var tx = labelY !== null ? el("text", { class: "viz-small viz-bold" }, parent) : null;
    return function (c) {
      var X = f.x(c);
      ln.setAttribute("x1", X); ln.setAttribute("x2", X);
      ln.setAttribute("y1", f.y(0)); ln.setAttribute("y2", f.m.top - (tx ? 14 : 0));
      if (tx) {
        var right = X < 470;
        tx.setAttribute("x", right ? X + 6 : X - 6); tx.setAttribute("y", labelY);
        tx.setAttribute("text-anchor", right ? "start" : "end");
        tx.textContent = "“High” cut-off: " + c + " mmHg";
      }
    };
  }

  // ---------------------------------------------------------------- Widget 1
  // Where the strokes come from: move the cut-off on a fixed population.
  Viz.register("rose-cases", function (root) {
    var ctr = V.controls(root);
    var cut = V.slider(ctr, { label: "“High blood pressure” cut-off", min: 110, max: 170, step: 1, value: 140, fmt: function (v) { return v + " mmHg"; }, onInput: draw });

    var P = panels(root, [{ cls: "s1", label: "At or below the cut-off" }, { cls: "s3", label: "Above the cut-off (the high-risk group)" }]);
    var people = function (x) { return N * pdf(x, MU); };
    var strokes = function (x) { return N * pdf(x, MU) * risk(x); };
    var tLow = el("path", { class: "fill-soft s1" }, P.top.inner), tHigh = el("path", { class: "fill s3" }, P.top.inner);
    var tLine = el("path", { class: "stroke s1" }, P.top.inner);
    var bLow = el("path", { class: "fill-soft s1" }, P.bot.inner), bHigh = el("path", { class: "fill s3" }, P.bot.inner);
    var bLine = el("path", { class: "stroke s1" }, P.bot.inner);
    setLine(tLine, P.top, people); setLine(bLine, P.bot, strokes);
    var cT = cutLine(P.top, P.top.inner, 14), cB = cutLine(P.bot, P.bot.inner, null);

    var out = V.readouts(root, [
      { key: "flag", label: "People above the cut-off (out of 100,000)" },
      { key: "hi", label: "Strokes in 10 years among them: the most a perfect high-risk strategy could prevent", cls: "bad" },
      { key: "lo", label: "Strokes in 10 years among everyone else" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Risk rises smoothly with blood pressure; the cut-off only decides whom you label." }, root);

    function draw() {
      var c = cut.value(), nHi = 0, sHi = 0, sAll = 0;
      GRID.forEach(function (x) {
        var p = N * pdf(x, MU) * H, s = p * risk(x);
        sAll += s;
        if (x > c) { nHi += p; sHi += s; }
      });
      var hi = r10(sHi), all = r10(sAll), lo = all - hi;
      setArea(tLow, P.top, people, P.xr[0], c); setArea(tHigh, P.top, people, c, P.xr[1]);
      setArea(bLow, P.bot, strokes, P.xr[0], c); setArea(bHigh, P.bot, strokes, c, P.xr[1]);
      cT(c); cB(c);
      out.flag(V.fmt.int(r100(nHi)) + " (" + V.fmt.pct(r100(nHi) / N) + ")");
      out.hi(V.fmt.int(hi) + " (" + V.fmt.pct(hi / all) + ")");
      out.lo(V.fmt.int(lo) + " (" + V.fmt.pct(lo / all) + ")");
    }
    draw();
  });

  // ---------------------------------------------------------------- Widget 2
  // Shift the whole distribution: the tail shrinks and strokes fall, though each person gains little.
  Viz.register("rose-shift", function (root) {
    var CUT = 140;
    var ctr = V.controls(root);
    var shift = V.slider(ctr, { label: "Shift everyone’s blood pressure by", min: -10, max: 5, step: 1, value: -5, fmt: function (v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + " mmHg"; }, onInput: draw });

    var P = panels(root, [{ cls: "s5", label: "Before", dashed: true }, { cls: "s1", label: "After the shift" }, { cls: "s3", label: "After, above 140 mmHg" }]);
    var peopleAt = function (mu) { return function (x) { return N * pdf(x, mu); }; };
    var strokesAt = function (mu) { return function (x) { return N * pdf(x, mu) * risk(x); }; };
    var tFill = el("path", { class: "fill-soft s1" }, P.top.inner), tHigh = el("path", { class: "fill s3" }, P.top.inner);
    var tBefore = el("path", { class: "stroke dashed s5" }, P.top.inner), tAfter = el("path", { class: "stroke s1" }, P.top.inner);
    var bFill = el("path", { class: "fill-soft s1" }, P.bot.inner), bHigh = el("path", { class: "fill s3" }, P.bot.inner);
    var bBefore = el("path", { class: "stroke dashed s5" }, P.bot.inner), bAfter = el("path", { class: "stroke s1" }, P.bot.inner);
    setLine(tBefore, P.top, peopleAt(MU)); setLine(bBefore, P.bot, strokesAt(MU));
    cutLine(P.top, P.top.inner, 14)(CUT); cutLine(P.bot, P.bot.inner, null)(CUT);

    var out = V.readouts(root, [
      { key: "tail", label: "People above 140 mmHg (was 10,000)" },
      { key: "prev", label: "Strokes prevented in 10 years (of 2,100)", cls: "good" },
      { key: "arr", label: "Average change in one person’s 10-year stroke risk (percentage points)" }
    ]);
    var prevLabel = root.querySelectorAll(".widget-readout-label")[1];
    var prevBox = prevLabel.parentNode;
    el("p", { class: "widget-note", text: "For comparison: perfectly treating everyone above 140 could prevent at most the 600 strokes that arise there (section 2)." }, root);
    el("p", { class: "widget-note", text: "Illustrative numbers, same town as the table in section 2. Everyone moves by the same amount and keeps their place in the curve." }, root);

    // Before: fixed totals
    var s0 = 0;
    GRID.forEach(function (x) { s0 += N * pdf(x, MU) * H * risk(x); });

    function draw() {
      var d = shift.value(), mu = MU + d, n1 = 0, s1 = 0;
      GRID.forEach(function (x) {                   // x = a person's starting blood pressure
        var p = N * pdf(x, MU) * H, s = p * risk(x + d);
        s1 += s;
        if (x + d > CUT) n1 += p;
      });
      var change = s0 - s1;                         // positive = prevented
      setArea(tFill, P.top, peopleAt(mu), P.xr[0], P.xr[1]); setArea(tHigh, P.top, peopleAt(mu), CUT, P.xr[1]);
      setLine(tAfter, P.top, peopleAt(mu));
      setArea(bFill, P.bot, strokesAt(mu), P.xr[0], P.xr[1]); setArea(bHigh, P.bot, strokesAt(mu), CUT, P.xr[1]);
      setLine(bAfter, P.bot, strokesAt(mu));

      out.tail(V.fmt.int(r100(n1)));
      prevLabel.textContent = change < -0.5 ? "Extra strokes in 10 years (on top of 2,100)" : "Strokes prevented in 10 years (of 2,100)";
      prevBox.classList.toggle("good", change >= -0.5); prevBox.classList.toggle("bad", change < -0.5);
      out.prev(V.fmt.int(r10(Math.abs(change))));
      out.arr(d === 0 ? "0" : V.fmt.signed(-change / N * 100, 2));
    }
    draw();
  });
})();
