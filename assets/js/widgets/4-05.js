// Lecture 4.5 — Target trial emulation: time zero, immortal time and clone–censor–weight.
// Simulated cohort of critically ill patients with new-onset AF. Anticoagulation does NOTHING (true RR = 1).
// Some clinicians plan to start it within 0–96 h; it only starts if the patient is still alive. Optionally,
// the sickest patients are passed over more often (a measured covariate). Four analyses of 30-day mortality.
// Illustrative numbers throughout.
(function () {
  var V = Viz, el = V.el;
  var N = 10000, HMAX = 720, GRACE = 48;   // hours: 30-day follow-up, 48-hour grace period

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function stream(seed) {
    var r = V.rng(seed);
    for (var i = 0; i < 200; i++) r();
    return function () { var u = r(); return u <= 0 ? 1e-12 : u; };
  }

  // Patients: sick (40%), death time T (Weibull, hazard falling over time), start time S (Infinity if never started).
  function simulate(seed, pass) {
    var r = stream(seed), P = [];
    for (var i = 0; i < N; i++) {
      var sick = r() < 0.4;
      var lam = (sick ? 92 : 620) * 24;                     // hours; ~40% vs ~15% die within 30 days
      var T = lam * Math.pow(-Math.log(r()), 1 / 0.6);
      var pPlan = sick ? 0.7 * (1 - 0.6 * pass) : 0.7;     // chance a start is planned
      var plan = r() < pPlan, Splan = 96 * r();
      var S = plan && Splan < Math.min(T, HMAX) ? Splan : Infinity;   // can only start if alive
      P.push({ sick: sick ? 1 : 0, T: T, S: S });
    }
    return P;
  }

  // Kaplan–Meier 30-day risk in hourly steps; optional inverse-probability-of-censoring weights by stratum.
  function kmRisk(rows, weighted) {
    var byH = [];
    for (var h = 0; h <= HMAX; h++) byH.push([]);
    rows.forEach(function (x) { byH[Math.min(HMAX, Math.ceil(x.t))].push(x); });
    var nr = [0, 0]; rows.forEach(function (x) { nr[x.sick]++; });
    var Sc = [1, 1], surv = 1;
    for (var k = 0; k <= HMAX; k++) {
      var L = byH[k], d = [0, 0], c = [0, 0], all = [0, 0];
      L.forEach(function (x) { all[x.sick]++; if (x.ev) d[x.sick]++; else if (x.cens) c[x.sick]++; });
      var num = 0, den = 0;
      for (var s = 0; s < 2; s++) {
        var w = weighted ? 1 / Sc[s] : 1;
        num += w * d[s]; den += w * nr[s];
      }
      if (den > 0) surv *= 1 - num / den;
      for (var s2 = 0; s2 < 2; s2++) {
        var atr = nr[s2] - d[s2];
        if (atr > 0) Sc[s2] *= 1 - c[s2] / atr;
        nr[s2] -= all[s2];
      }
    }
    return 1 - surv;
  }

  function analyse(P) {
    var tr = P.filter(function (p) { return p.S < Infinity; }), un = P.filter(function (p) { return p.S === Infinity; });
    var share = function (arr, f) { return arr.filter(f).length / arr.length; };
    var rU = share(un, function (p) { return p.T <= HMAX; });
    var A = [share(tr, function (p) { return p.T <= HMAX; }), rU];
    var B = [share(tr, function (p) { return p.T <= p.S + HMAX; }), rU];
    var arm1 = P.map(function (p) { var cens = p.S > GRACE && p.T > GRACE; return { t: cens ? GRACE : Math.min(p.T, HMAX), ev: !cens && p.T <= HMAX, cens: cens, sick: p.sick }; });
    var arm0 = P.map(function (p) { var cens = p.S <= GRACE; return { t: cens ? p.S : Math.min(p.T, HMAX), ev: !cens && p.T <= HMAX, cens: cens, sick: p.sick }; });
    var sickNot = P.filter(function (p) { return p.sick && p.T > GRACE; });
    var keptSick = sickNot.filter(function (p) { return p.S <= GRACE; }).length / Math.max(1, sickNot.length);
    return { A: A, B: B, C: [kmRisk(arm1, false), kmRisk(arm0, false)], D: [kmRisk(arm1, true), kmRisk(arm0, true)], wSick: 1 / Math.max(keptSick, 1e-6) };
  }

  // Six illustrative patients for the timeline (S in hours, T in days; Infinity = never / alive at day 10).
  var PTS = [
    { id: "P1", S: 10, T: Infinity }, { id: "P2", S: 30, T: 7 }, { id: "P3", S: Infinity, T: 20 / 24 },
    { id: "P4", S: 70, T: Infinity }, { id: "P5", S: Infinity, T: Infinity }, { id: "P6", S: Infinity, T: 5, sick: true }
  ];

  V.register("time-zero", function (root) {
    var seed = 4647543, method = "A", res = null;
    var ctr = V.controls(root);
    var gm = el("div", { style: "display:flex;flex-direction:column;gap:0.3rem;grid-column:1/-1" }, ctr);
    el("span", { class: "widget-slider-label", style: "font-size:0.88rem", text: "Analysis" }, gm);
    V.toggle(gm, { options: [
      { value: "A", label: "Ever vs never" }, { value: "B", label: "Clock at treatment start" },
      { value: "C", label: "Clone–censor" }, { value: "D", label: "Clone–censor–weight" }
    ], value: method, onChange: function (v) { method = v; draw(); } });
    var tgEl = gm.querySelector(".widget-toggle");
    tgEl.style.flexWrap = "wrap"; tgEl.style.borderRadius = "14px";
    var sPass = V.slider(ctr, { label: "How often the sickest are passed over", min: 0, max: 1, step: 0.25, value: 0, fmt: function (v) { return v === 0 ? "never" : v === 1 ? "very often" : Math.round(v * 100) + "%"; }, onInput: function () { recompute(); } });
    var bwrap = el("div", { style: "display:flex;align-items:end" }, ctr);
    V.button(bwrap, "New random cohort", function () { seed += 2 * 7919; recompute(); });

    var tl = V.svg(root, 640, 290);
    tl.setAttribute("aria-label", "Timeline of six example patients showing how the chosen analysis assigns their follow-up");
    var dp = V.svg(root, 640, 200);
    dp.setAttribute("aria-label", "Risk ratios for 30-day mortality from the four analyses, against the truth of 1");
    var out = V.readouts(root, [
      { key: "r1", label: "30-day mortality: anticoagulated arm" },
      { key: "r0", label: "30-day mortality: not anticoagulated arm" },
      { key: "rr", label: "Risk ratio (truth = 1.00)" }
    ]);
    var rrBox = root.querySelectorAll(".widget-readout")[2];
    var msg = el("p", { class: "widget-note" }, root);
    el("p", { class: "widget-note", text: "Illustrative numbers. 10,000 simulated patients; anticoagulation has no effect on death. Clinicians plan a start for 70% of patients at a random time in the first 96 hours, and it happens only if the patient is alive. “Passed over” lowers the planned-start rate in the 40% who are sickest (high SOFA, measured). The grace period is 48 hours." }, root);

    var DESC = {
      A: "Ever-treated vs never-treated, clock at AF onset. The treated had to survive until their start, and that guaranteed survival is credited to them: immortal time.",
      B: "Treated followed from their start, untreated from AF onset. Time zero differs between groups: the treated enter only if they survived to start, the untreated include everyone who died early.",
      C: "Every patient is cloned into both strategies at AF onset and censored when they deviate. Time zero is aligned; with no confounding this is right. Pass over the sick and it breaks: censoring is now related to prognosis.",
      D: "As clone–censor, but the uncensored clones are weighted by the inverse probability of staying uncensored given severity. This restores the balance artificial censoring destroyed."
    };

    function recompute() { res = analyse(simulate(seed, sPass.value())); draw(); }

    function draw() {
      drawTimeline();
      drawDots();
      var r = res[method], rr = r[0] / r[1];
      out.r1(V.fmt.pct1(r[0])); out.r0(V.fmt.pct1(r[1])); out.rr(rr.toFixed(2));
      var bad = Math.abs(Math.log(rr)) > 0.08;
      rrBox.classList.toggle("bad", bad); rrBox.classList.toggle("good", !bad);
      msg.textContent = DESC[method] + (method === "D" ? " A sick clone still uncensored at 48 h in the start arm counts about " + res.wSick.toFixed(1) + " times." : "");
    }

    function drawTimeline() {
      clear(tl);
      var x0 = 90, pxd = 32, x = function (d) { return x0 + pxd * d; }, yRow = function (i) { return 66 + i * 30; };
      var clone = method === "C" || method === "D";
      el("text", { x: 10, y: 16, class: "viz-bold", text: "Six example patients · day 0 = new-onset AF on the ECG" }, tl);
      var h1 = clone ? "Start-by-48 h arm" : "Counted as", h2 = clone ? "No-start arm" : "Clock starts";
      el("text", { x: 492, y: 40, "text-anchor": "middle", class: "viz-small viz-bold", text: h1 }, tl);
      el("text", { x: 590, y: 40, "text-anchor": "middle", class: "viz-small viz-bold", text: h2 }, tl);
      if (clone) {
        el("rect", { x: x(0), y: 48, width: pxd * 2, height: 186, class: "fill-soft s4" }, tl);
        el("text", { x: x(1), y: 40, "text-anchor": "middle", class: "viz-small colour s4", text: "48-h grace" }, tl);
      }
      PTS.forEach(function (p, i) {
        var y = yRow(i), sd = p.S / 24, end = p.T === Infinity ? 10 : p.T, treated = p.S < Infinity;
        el("text", { x: 10, y: y + 4, class: "viz-small", text: p.id + (p.sick ? " (sick)" : "") }, tl);
        if (method === "A") {
          if (treated) {
            el("line", { x1: x(0), x2: x(sd), y1: y, y2: y, class: "stroke s2", "stroke-width": 6 }, tl);
            el("line", { x1: x(sd), x2: x(end), y1: y, y2: y, class: "stroke s1" }, tl);
          } else el("line", { x1: x(0), x2: x(end), y1: y, y2: y, class: "stroke s5" }, tl);
        } else if (method === "B" && treated) {
          el("line", { x1: x(0), x2: x(sd), y1: y, y2: y, class: "edge", "stroke-dasharray": "3 4" }, tl);
          el("line", { x1: x(sd), x2: x(end), y1: y, y2: y, class: "stroke s1" }, tl);
        } else {
          el("line", { x1: x(0), x2: x(end), y1: y, y2: y, class: method === "B" ? "stroke s5" : "edge strong" }, tl);
        }
        if (treated) el("path", { d: "M" + x(sd) + "," + (y - 7) + "l7,7l-7,7l-7,-7Z", class: "dot s1" }, tl);
        if (p.T < Infinity) el("circle", { cx: x(p.T), cy: y, r: 5.5, class: "dot s3" }, tl);
        else el("circle", { cx: x(10), cy: y, r: 5, class: "node s5" }, tl);
        var c1, c2, k1 = "s5", k2 = "s5";
        if (clone) {
          var diedGrace = p.T * 24 <= GRACE && !(p.S <= p.T * 24);
          if (diedGrace) { c1 = c2 = "event in grace"; k1 = k2 = "s2"; }
          else {
            if (p.S <= GRACE) { c1 = "kept"; k1 = "s1"; c2 = "censored " + p.S + " h"; k2 = "s3"; }
            else { c1 = "censored 48 h"; k1 = "s3"; c2 = "kept"; k2 = "s1"; }
          }
        } else {
          c1 = treated ? "treated" : "untreated"; k1 = treated ? "s1" : "s5";
          c2 = method === "B" && treated ? p.S + " h" : "day 0"; k2 = method === "B" && treated ? "s3" : "s5";
        }
        el("text", { x: 492, y: y + 4, "text-anchor": "middle", class: "viz-small colour " + k1, text: c1 }, tl);
        el("text", { x: 590, y: y + 4, "text-anchor": "middle", class: "viz-small colour " + k2, text: c2 }, tl);
      });
      el("line", { x1: x(0), x2: x(10), y1: 240, y2: 240, class: "viz-axis" }, tl);
      [0, 2, 4, 6, 8, 10].forEach(function (d) { el("text", { x: x(d), y: 255, "text-anchor": "middle", class: "viz-tick", text: d === 0 ? "0" : d + " d" }, tl); });
      // legend
      var ly = 279;
      el("path", { d: "M16," + (ly - 7) + "l7,7l-7,7l-7,-7Z", class: "dot s1" }, tl);
      el("text", { x: 28, y: ly + 4, class: "viz-small", text: "anticoagulation starts" }, tl);
      el("circle", { cx: 176, cy: ly, r: 5.5, class: "dot s3" }, tl);
      el("text", { x: 187, y: ly + 4, class: "viz-small", text: "death" }, tl);
      el("circle", { cx: 240, cy: ly, r: 5, class: "node s5" }, tl);
      el("text", { x: 251, y: ly + 4, class: "viz-small", text: "alive at day 10" }, tl);
      if (method === "A") {
        el("line", { x1: 362, x2: 388, y1: ly, y2: ly, class: "stroke s2", "stroke-width": 6 }, tl);
        el("text", { x: 396, y: ly + 4, class: "viz-small", text: "immortal time credited to the treated" }, tl);
      } else if (method === "B") {
        el("line", { x1: 362, x2: 388, y1: ly, y2: ly, class: "edge", "stroke-dasharray": "3 4" }, tl);
        el("text", { x: 396, y: ly + 4, class: "viz-small", text: "before the treated’s clock starts: ignored" }, tl);
      } else {
        el("text", { x: 362, y: ly + 4, class: "viz-small", text: "each patient = two clones, one per arm" }, tl);
      }
    }

    function drawDots() {
      clear(dp);
      var lx = function (v) { return Math.log(v); };
      var f = V.frame(dp, { x: [lx(0.3), lx(1.6)], y: [0, 4], yTicks: [], xTicks: [0.3, 0.5, 0.7, 1, 1.4].map(lx), fmtX: function (t) { return (+Math.exp(t).toFixed(2)).toString(); }, margin: { left: 200, right: 20, top: 24, bottom: 40 }, xLabel: "Risk ratio for 30-day mortality (log scale)" });
      var g = f.inner;
      el("line", { x1: f.x(0), x2: f.x(0), y1: f.y(4), y2: f.y(0), class: "stroke s1 dashed", "stroke-width": 2 }, g);
      el("text", { x: f.x(0), y: 14, "text-anchor": "middle", class: "viz-small colour s1", text: "truth: RR 1 (drug does nothing)" }, g);
      var names = { A: "Ever vs never", B: "Clock at treatment start", C: "Clone–censor", D: "Clone–censor–weight" };
      ["A", "B", "C", "D"].forEach(function (k, i) {
        var y = f.y(3.5 - i), rr = res[k][0] / res[k][1], on = k === method;
        var cx = f.x(lx(Math.max(0.3, Math.min(1.6, rr))));
        el("line", { x1: f.x(lx(0.3)), x2: f.x(lx(1.6)), y1: y, y2: y, class: "viz-grid" }, g);
        el("text", { x: 190, y: y + 4, "text-anchor": "end", class: on ? "viz-bold" : "viz-small viz-muted", text: names[k] }, dp);
        el("circle", { cx: cx, cy: y, r: on ? 7 : 5, class: "dot " + (on ? "s3" : "s5") }, g);
        var left = rr > 1.3 || (rr > 0.8 && rr < 1);
        el("text", { x: cx + (left ? -12 : 12), y: y + 4, "text-anchor": left ? "end" : "start", class: "viz-small" + (on ? " viz-bold" : " viz-muted"), text: rr.toFixed(2) }, g);
      });
    }

    recompute();
  });
})();
