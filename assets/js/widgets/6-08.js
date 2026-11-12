// Lecture 6.8 — Raw SMRs vs empirical Bayes smoothing (global or neighbour-based) on a grid of small areas. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function stream(seed) { var r = V.rng(seed); for (var i = 0; i < 200; i++) r(); return r; }
  function poisson(r, mu) {
    if (mu > 50) return Math.max(0, Math.round(mu + Math.sqrt(mu) * V.normal(r)));
    var L = Math.exp(-mu), k = 0, p = 1;
    do { k++; p *= r(); } while (p > L);
    return k - 1;
  }

  var NX = 14, NY = 9, N = NX * NY, CS = 14, HIGH = 1.25;

  // Queen neighbours (cells touching at an edge or corner)
  var NB = [];
  (function () {
    for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
      var list = [];
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        var ii = i + di, jj = j + dj;
        if (ii >= 0 && ii < NX && jj >= 0 && jj < NY) list.push(jj * NX + ii);
      }
      NB.push(list);
    }
  })();

  function makeData(seed) {
    var r = stream(seed), E = [], th = [], O = [], k, i, j, mean = 0;
    var hx = 2 + Math.floor(r() * 10), hy = 1 + Math.floor(r() * 7), ph = r() * 6.28;
    for (j = 0; j < NY; j++) for (i = 0; i < NX; i++) {
      var lt = 0.28 * Math.sin(i / 2.6 + ph) + 0.22 * Math.cos(j / 2.2 - ph / 2) +
        0.7 * Math.exp(-((i - hx) * (i - hx) + (j - hy) * (j - hy)) / 2.5) + 0.06 * V.normal(r);
      th.push(lt); mean += lt;
    }
    mean /= N;
    for (k = 0; k < N; k++) {
      th[k] = Math.exp(th[k] - mean);
      E.push(Math.min(300, Math.max(0.6, Math.exp(Math.log(8) + 1.2 * V.normal(r)))));
      O.push(poisson(r, E[k] * th[k]));
    }
    return { E: E, th: th, O: O };
  }

  // Marshall (1991) moment estimates: shrink r_i toward a target mean m_i with weight v / (v + k * m_i / E_i)
  function smooth(d, k, local) {
    var sO = 0, sE = 0, i, n;
    for (i = 0; i < N; i++) { sO += d.O[i]; sE += d.E[i]; }
    var m = sO / sE, raw = [], tgt = [];
    for (i = 0; i < N; i++) raw.push(d.O[i] / d.E[i]);
    for (i = 0; i < N; i++) {
      if (!local) { tgt.push(m); continue; }
      var o = 0, e = 0;
      NB[i].forEach(function (j) { o += d.O[j]; e += d.E[j]; });
      tgt.push(o / e);
    }
    var s2 = 0, eBar = sE / N;
    for (i = 0; i < N; i++) s2 += d.E[i] * (raw[i] - tgt[i]) * (raw[i] - tgt[i]);
    var v = Math.max(0.004, s2 / sE - m / eBar), est = [];
    for (i = 0; i < N; i++) {
      n = (k === 0) ? 1 : v / (v + k * tgt[i] / d.E[i]);
      est.push(tgt[i] + n * (raw[i] - tgt[i]));
    }
    return { raw: raw, est: est };
  }

  function top10(vals) {
    return vals.map(function (v, i) { return [v, i]; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, 10).map(function (p) { return p[1]; });
  }

  V.register("smr-smooth", function (root) {
    var seed = 680001, local = false, data = makeData(seed);
    var ctr = V.controls(root);
    var sK = V.slider(ctr, { label: "Smoothing strength (0 = raw SMR, 1 = standard empirical Bayes)", min: 0, max: 3, step: 0.1, value: 1, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    V.toggle(ctr, { options: [{ value: false, label: "Shrink to overall mean" }, { value: true, label: "Shrink to neighbours" }], value: local, onChange: function (v) { local = v; draw(); } });
    var row = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    V.button(row, "New data", function () { seed += 2; data = makeData(seed); draw(); });

    V.legend(root, [{ cls: "s3", label: "Risk above average (darker = higher)" }, { cls: "s1", label: "Risk below average" }, { cls: "s2", label: "Outline: top 10 areas on that map" }]);
    var c = V.svg(root, 640, 172);
    c.setAttribute("aria-label", "Three grid maps of 126 small areas: the true relative risk, the raw SMR and the smoothed estimate");
    var c2 = V.svg(root, 640, 250);
    c2.setAttribute("aria-label", "Funnel-style scatter of each area's estimate against its expected count, showing raw SMRs and smoothed estimates");
    var out = V.readouts(root, [
      { key: "errRaw", label: "Typical error vs truth, raw SMR", cls: "bad" },
      { key: "errSm", label: "Typical error vs truth, smoothed", cls: "good" },
      { key: "topRaw", label: "Truly high-risk areas in the raw top 10" },
      { key: "topSm", label: "Truly high-risk areas in the smoothed top 10" },
      { key: "eRaw", label: "Median expected cases: raw top 10 vs all areas" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Expected counts range from under 1 to a few hundred; observed counts are Poisson around expected × true risk. \"Truly high-risk\" means true relative risk above 1.25. Typical error is the median of |estimate − truth| on the relative-risk scale. Smoothing uses Marshall's empirical Bayes; the neighbour version shrinks toward the 8 surrounding areas, a simple stand-in for BYM." }, root);

    function colour(g, x0, vals, outline, title) {
      el("text", { x: x0 + NX * CS / 2, y: 14, "text-anchor": "middle", class: "viz-bold", text: title }, g);
      for (var k = 0; k < N; k++) {
        var i = k % NX, j = Math.floor(k / NX), lv = Math.log(Math.max(0.05, vals[k]));
        var op = Math.min(1, 0.08 + Math.pow(Math.min(1, Math.abs(lv) / 1.0), 0.8) * 0.92);
        el("rect", { x: x0 + i * CS, y: 24 + j * CS, width: CS - 1, height: CS - 1, class: "fill " + (lv >= 0 ? "s3" : "s1"), opacity: op.toFixed(2) }, g);
      }
      outline.forEach(function (k) {
        var i = k % NX, j = Math.floor(k / NX);
        el("rect", { x: x0 + i * CS - 0.5, y: 24 + j * CS - 0.5, width: CS, height: CS, class: "stroke s2", "stroke-width": 2 }, g);
      });
    }

    function draw() {
      var k = sK.value(), s = smooth(data, k, local), i;
      var trueHigh = data.th.map(function (t) { return t > HIGH; });
      var tTrue = top10(data.th), tRaw = top10(s.raw), tSm = top10(s.est);

      clear(c);
      var gap = (640 - 3 * NX * CS) / 2;
      colour(c, 0, data.th, tTrue, "Truth");
      colour(c, NX * CS + gap, s.raw, tRaw, "Raw SMR");
      colour(c, 2 * (NX * CS + gap), s.est, tSm, k === 0 ? "Smoothed (k = 0: raw)" : "Smoothed");

      clear(c2);
      var ly = function (v) { return Math.log(Math.max(0.2, Math.min(5, v))); };
      var f = V.frame(c2, { x: [Math.log(0.5), Math.log(300)], y: [Math.log(0.2), Math.log(5)],
        xTicks: [0.5, 1, 3, 10, 30, 100, 300].map(Math.log), fmtX: function (v) { var e = Math.exp(v); return e < 1 ? e.toFixed(1) : Math.round(e).toString(); },
        yTicks: [0.25, 0.5, 1, 2, 4].map(Math.log), fmtY: function (v) { var e = Math.exp(v); return e < 1 ? e.toFixed(2) : Math.round(e).toString(); },
        xLabel: "Expected cases in the area (log scale)", yLabel: "Relative risk (log scale)" });
      el("line", { x1: f.x(Math.log(0.5)), x2: f.x(Math.log(300)), y1: f.y(0), y2: f.y(0), class: "viz-grid" }, f.inner);
      for (i = 0; i < N; i++) {
        var lx = f.x(Math.log(data.E[i]));
        el("line", { x1: lx, x2: lx, y1: f.y(ly(s.raw[i])), y2: f.y(ly(s.est[i])), class: "stroke s5", "stroke-width": 1, opacity: 0.45 }, f.inner);
        el("circle", { cx: lx, cy: f.y(ly(s.raw[i])), r: 2.4, class: "dot s5", opacity: 0.6 }, f.inner);
        el("circle", { cx: lx, cy: f.y(ly(s.est[i])), r: 2.8, class: "dot " + (trueHigh[i] ? "s3" : "s1"), opacity: 0.9 }, f.inner);
      }
      el("text", { x: f.x(Math.log(300)) - 4, y: f.y(Math.log(5)) + 12, "text-anchor": "end", class: "viz-small viz-muted", text: "grey = raw SMR · coloured = smoothed (red if truly high-risk)" }, f.inner);

      function medErr(est) {
        var e = est.map(function (v, j) { return Math.abs(v - data.th[j]); }).sort(function (a, b) { return a - b; });
        return (e[N / 2 - 1] + e[N / 2]) / 2;
      }
      function hits(list) { return list.filter(function (j) { return trueHigh[j]; }).length; }
      var eTop = tRaw.map(function (j) { return data.E[j]; }).sort(function (a, b) { return a - b; });
      out.errRaw(medErr(s.raw).toFixed(2));
      out.errSm(medErr(s.est).toFixed(2));
      out.topRaw(hits(tRaw) + " of 10");
      out.topSm(hits(tSm) + " of 10");
      out.eRaw(V.fmt.num((eTop[4] + eTop[5]) / 2, 1) + " vs " + V.fmt.num(median(data.E), 1));
    }
    function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }); return (b[N / 2 - 1] + b[N / 2]) / 2; }
    draw();
  });
})();
