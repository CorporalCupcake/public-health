// Lecture 2.2 — loss to follow-up bias; immortal time bias simulation. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // Loss to follow-up: true risks p0, p1; share lost L0, L1; lost people have
  // k times the risk of those who stay. Risk among stayers r = p / (1 − L + L·k).
  V.register("loss-followup", function (root) {
    var P0 = 0.10;
    var ctr = V.controls(root);
    var sR = V.slider(ctr, { label: "True risk ratio (exposed vs unexposed)", min: 1, max: 3, step: 0.1, value: 2, fmt: function (v) { return v.toFixed(1); }, onInput: draw });
    var sL0 = V.slider(ctr, { label: "Lost from the unexposed group", min: 0, max: 50, step: 1, value: 20, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sL1 = V.slider(ctr, { label: "Lost from the exposed group", min: 0, max: 50, step: 1, value: 20, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sk = V.slider(ctr, { label: "Risk of the lost, relative to those who stay", min: 0.5, max: 3, step: 0.1, value: 2, fmt: function (v) { return "×" + v.toFixed(1); }, onInput: draw });

    V.legend(root, [
      { cls: "s5", label: "True risk (everyone, if fully followed)" },
      { cls: "s1", label: "Risk seen among those who stayed" }
    ]);
    var c = V.svg(root, 640, 230);
    c.setAttribute("aria-label", "Bars comparing true risk and observed risk among people who stayed, in the unexposed and exposed groups");
    var out = V.readouts(root, [
      { key: "t", label: "True risk ratio", cls: "good" },
      { key: "o", label: "Risk ratio among those who stayed", cls: "bad" },
      { key: "b", label: "Bias in the ratio" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Risk in the unexposed is 10%. With equal loss the ratio survives here, but both absolute risks are still wrong; with unequal loss the ratio moves too." }, root);

    function draw() {
      var RR = sR.value(), k = sk.value(), L1 = sL1.value() / 100, L0 = sL0.value() / 100;
      var p0 = P0, p1 = P0 * RR;
      var r0 = p0 / (1 - L0 + L0 * k), r1 = p1 / (1 - L1 + L1 * k);
      var ymax = Math.max(0.1, Math.ceil(Math.max(p1, r1) * 1.25 * 20) / 20);
      clear(c);
      var f = V.frame(c, { x: [0, 4], y: [0, ymax], xTicks: [], fmtY: V.fmt.pct, yLabel: "Risk", margin: { bottom: 34 } });
      var g = f.inner, bw = (f.x(1) - f.x(0)) * 0.7;
      var bars = [[0.5, p0, "s5"], [1.5, r0, "s1"], [2.5, p1, "s5"], [3.5, r1, "s1"]];
      bars.forEach(function (b) {
        var x = f.x(b[0]) - bw / 2;
        el("rect", { x: x, y: f.y(b[1]), width: bw, height: f.y(0) - f.y(b[1]), class: (b[2] === "s5" ? "fill-soft " : "fill ") + b[2] }, g);
        el("text", { x: f.x(b[0]), y: f.y(b[1]) - 6, "text-anchor": "middle", class: "viz-small viz-bold", text: V.fmt.pct1(b[1]) }, g);
      });
      el("text", { x: f.x(1), y: c.H - 12, "text-anchor": "middle", class: "viz-label", text: "Unexposed · lost " + V.fmt.pct(L0) }, g);
      el("text", { x: f.x(3), y: c.H - 12, "text-anchor": "middle", class: "viz-label", text: "Exposed · lost " + V.fmt.pct(L1) }, g);
      var obs = r1 / r0;
      out.t(V.fmt.num(RR, 2));
      out.o(V.fmt.num(obs, 2));
      out.b(V.fmt.signed((obs / RR - 1) * 100, 0) + "%");
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Immortal time: 4,000 patients, constant death hazard, 24 months follow-up.
  // Some are scheduled to fill a prescription after an exponential wait; they are
  // "treated" only if alive when the wait ends. Naive analysis: ever-treated from
  // time zero. Correct: waiting time counted as untreated (time-varying exposure).
  V.register("immortal-time", function (root) {
    var N = 4000, F = 24, H = 0.04, SHOW = 10;
    var rand = V.rng(2025), U = [];
    for (var w0 = 0; w0 < 200; w0++) rand();   // warm up the generator
    for (var i = 0; i < N; i++) U.push([rand(), rand(), rand(), rand()]);

    var ctr = V.controls(root);
    var sw = V.slider(ctr, { label: "Average wait before the first prescription", min: 0.5, max: 12, step: 0.5, value: 4, fmt: function (v) { return V.fmt.num(v, 1) + " months"; }, onInput: draw });
    var ss = V.slider(ctr, { label: "Share who would eventually be prescribed", min: 20, max: 80, step: 5, value: 50, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sh = V.slider(ctr, { label: "True effect of the drug (hazard ratio)", min: 0.5, max: 1.5, step: 0.05, value: 1, fmt: function (v) { return v.toFixed(2) + (Math.abs(v - 1) < 1e-9 ? " (useless)" : ""); }, onInput: draw });
    var view = V.toggle(root, { options: [{ value: "naive", label: "Naive: ever vs never treated" }, { value: "tv", label: "Correct: waiting time counted as untreated" }], value: "naive", onChange: draw });

    var leg = el("div", null, root);
    var c = V.svg(root, 640, 390);
    c.setAttribute("aria-label", "Timelines for 20 sample patients: waiting time before the prescription, time on the drug, untreated time and deaths");
    var out = V.readouts(root, [
      { key: "naive", label: "Rate ratio, naive (ever vs never treated)", cls: "bad" },
      { key: "tv", label: "Rate ratio, waiting time counted as untreated", cls: "good" },
      { key: "truth", label: "True effect of the drug" },
      { key: "imm", label: "Share of “treated” person-time that is immortal (naive)" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Death risk about 4% a month for everyone; follow-up 24 months. Rate ratio = deaths per person-month in the treated ÷ in the untreated." }, root);

    function simulate() {
      var mean = sw.value(), share = ss.value() / 100, hr = sh.value();
      var P = [];
      for (var i = 0; i < N; i++) {
        var u = U[i], e1 = -Math.log(u[0]) / H, sched = u[2] < share, w = -mean * Math.log(u[3]);
        var treated = sched && w < Math.min(e1, F), death = treated ? w + (-Math.log(u[1]) / (H * hr)) : e1;
        P.push({ t: treated, w: treated ? w : null, end: Math.min(death, F), died: death <= F });
      }
      return P;
    }

    function draw() {
      var P = simulate(), tvView = view.value() === "tv";
      // naive
      var nT = { d: 0, pt: 0 }, nU = { d: 0, pt: 0 }, cT = { d: 0, pt: 0 }, cU = { d: 0, pt: 0 }, imm = 0;
      P.forEach(function (p) {
        if (p.t) {
          nT.d += p.died; nT.pt += p.end; imm += p.w;
          cU.pt += p.w; cT.pt += p.end - p.w; cT.d += p.died;
        } else {
          nU.d += p.died; nU.pt += p.end;
          cU.d += p.died; cU.pt += p.end;
        }
      });
      var rrN = (nT.d / nT.pt) / (nU.d / nU.pt), rrC = (cT.d / cT.pt) / (cU.d / cU.pt);
      out.naive(V.fmt.num(rrN, 2));
      out.tv(V.fmt.num(rrC, 2));
      out.truth(V.fmt.num(sh.value(), 2));
      out.imm(V.fmt.pct(imm / nT.pt));

      clear(leg);
      V.legend(leg, [
        { cls: "s1", label: "On the drug" },
        { cls: tvView ? "s5" : "s2", label: tvView ? "Waiting time, counted as untreated" : "Waiting time, counted as treated (immortal)" },
        { cls: "s5", label: "Never treated" },
        { cls: "s3", label: "Death" }
      ]);

      // timelines for 10 treated and 10 untreated patients
      clear(c);
      var tr = [], un = [];
      for (var i = 0; i < N && (tr.length < SHOW || un.length < SHOW); i++) {
        if (P[i].t && tr.length < SHOW) tr.push(P[i]);
        if (!P[i].t && un.length < SHOW) un.push(P[i]);
      }
      var byEnd = function (a, b) { return b.end - a.end; };
      tr.sort(byEnd); un.sort(byEnd);
      var x = V.scale(0, F, 150, 624), rowH = 11, gap = 3;
      [[tr, 30, "Ever treated"], [un, 30 + SHOW * (rowH + gap) + 30, "Never treated"]].forEach(function (grp) {
        var y0 = grp[1];
        el("text", { x: 8, y: y0 + (SHOW * (rowH + gap)) / 2 - 4, class: "viz-small viz-bold", text: grp[2] }, c);
        el("text", { x: 8, y: y0 + (SHOW * (rowH + gap)) / 2 + 12, class: "viz-small viz-muted", text: tvView || grp[2] === "Never treated" ? "" : "(from time zero)" }, c);
        grp[0].forEach(function (p, j) {
          var y = y0 + j * (rowH + gap);
          if (p.t) {
            el("rect", { x: x(0), y: y, width: x(p.w) - x(0), height: rowH, class: tvView ? "fill-soft s5" : "fill s2" }, c);
            el("rect", { x: x(p.w), y: y, width: Math.max(0, x(p.end) - x(p.w)), height: rowH, class: "fill s1" }, c);
          } else {
            el("rect", { x: x(0), y: y, width: x(p.end) - x(0), height: rowH, class: "fill-soft s5" }, c);
          }
          if (p.died) el("circle", { cx: x(p.end), cy: y + rowH / 2, r: 5, class: "dot s3" }, c);
        });
      });
      var yAxis = 30 + 2 * SHOW * (rowH + gap) + 30 + 6;
      el("line", { x1: x(0), x2: x(F), y1: yAxis, y2: yAxis, class: "viz-axis" }, c);
      [0, 6, 12, 18, 24].forEach(function (t) {
        el("text", { x: x(t), y: yAxis + 16, "text-anchor": "middle", class: "viz-tick", text: t }, c);
      });
      el("text", { x: (x(0) + x(F)) / 2, y: yAxis + 34, "text-anchor": "middle", class: "viz-label", text: "Months since discharge (time zero)" }, c);
      el("text", { x: 632, y: 18, "text-anchor": "end", class: "viz-small viz-muted", text: "20 of the 4,000 patients" }, c);
    }
    draw();
  });
})();
