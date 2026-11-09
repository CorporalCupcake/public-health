// Lecture 2.16 — depletion of susceptibles (new vs prevalent users) and a disproportionality 2×2 table. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // Depletion of susceptibles. Comparator hazard h0 for everyone. On the drug, a
  // susceptible share s has hazard hs; everyone else keeps h0. The population HR
  // falls over time as susceptibles have their events and leave the risk set.
  V.register("new-vs-prevalent", function (root) {
    var H0 = 0.02, W = 3, TMAX = 10;
    var ctr = V.controls(root);
    var sS = V.slider(ctr, { label: "Share of starters who are susceptible", min: 1, max: 30, step: 1, value: 10, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sH = V.slider(ctr, { label: "Yearly event risk in susceptibles on the drug", min: 5, max: 80, step: 1, value: 40, fmt: function (v) { return v + "%"; }, onInput: draw });
    var sL = V.slider(ctr, { label: "Prevalent users: years on the drug before the study starts", min: 1, max: 7, step: 0.5, value: 3, fmt: function (v) { return v + " years"; }, onInput: draw });

    V.legend(root, [
      { cls: "s5", label: "Hazard ratio at each time since starting" },
      { cls: "s1", label: "New-user cohort: first 3 years" },
      { cls: "s3", label: "Prevalent-user cohort: 3 years after joining" }
    ]);
    var c = V.svg(root, 640, 330);
    c.setAttribute("aria-label", "Hazard ratio for the drug against time since starting it, falling as susceptible people have their events, with the follow-up windows of a new-user and a prevalent-user study shaded");
    var host = el("g", null, c);
    host.W = 640; host.H = 330;

    var out = V.readouts(root, [
      { key: "nu", label: "New-user study: HR over first 3 years" },
      { key: "pu", label: "Prevalent-user study: HR over its 3 years" },
      { key: "left", label: "Susceptibles still event-free when prevalent users enter" },
      { key: "trueSus", label: "HR in the susceptibles themselves" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Comparator risk 2% a year for everyone; the drug harms only the susceptible minority, and does so early. Real drugs are rarely this tidy, but early adverse events (bleeding on anticoagulants, GI bleeding on NSAIDs, angioedema on ACE inhibitors) follow this shape." }, root);

    function surv(t, s, hs) { return s * Math.exp(-hs * t) + (1 - s) * Math.exp(-H0 * t); }
    function hrAt(t, s, hs) {
      var a = s * Math.exp(-hs * t), b = (1 - s) * Math.exp(-H0 * t);
      return (a * hs + b * H0) / (a + b) / H0;
    }
    function windowHR(L, s, hs) {
      var ev = surv(L, s, hs) - surv(L + W, s, hs);
      var pt = s * (Math.exp(-hs * L) - Math.exp(-hs * (L + W))) / hs + (1 - s) * (Math.exp(-H0 * L) - Math.exp(-H0 * (L + W))) / H0;
      return ev / pt / H0;
    }

    function draw() {
      var s = sS.value() / 100, hs = -Math.log(1 - sH.value() / 100), L = sL.value();
      var top = Math.max(3, Math.ceil(hrAt(0, s, hs)));
      clear(host);
      var f = V.frame(host, { x: [0, TMAX], y: [0, top], xTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], fmtX: function (v) { return v; }, fmtY: function (v) { return v; }, xLabel: "Years since starting the drug", yLabel: "Hazard ratio vs comparator" });
      var g = f.inner;
      el("rect", { x: f.x(0), y: f.y(top), width: f.x(W) - f.x(0), height: f.y(0) - f.y(top), class: "fill-soft s1" }, g);
      el("rect", { x: f.x(L), y: f.y(top), width: f.x(Math.min(TMAX, L + W)) - f.x(L), height: f.y(0) - f.y(top), class: "fill-soft s3", style: "fill-opacity:0.18" }, g);
      el("line", { x1: f.x(0), x2: f.x(TMAX), y1: f.y(1), y2: f.y(1), class: "stroke s5 dashed", style: "stroke-width:1.5" }, g);
      var pts = [];
      for (var i = 0; i <= 200; i++) { var t = TMAX * i / 200; pts.push([f.x(t), f.y(hrAt(t, s, hs))]); }
      el("path", { d: V.line(pts), class: "stroke s5", style: "stroke-width:3" }, g);
      var nu = windowHR(0, s, hs), pu = windowHR(L, s, hs);
      el("line", { x1: f.x(0), x2: f.x(W), y1: f.y(nu), y2: f.y(nu), class: "stroke s1" }, g);
      el("line", { x1: f.x(L), x2: f.x(Math.min(TMAX, L + W)), y1: f.y(pu), y2: f.y(pu), class: "stroke s3" }, g);
      el("text", { x: f.x(0) + 6, y: f.y(nu) - 8, class: "viz-small viz-bold colour s1", text: "HR " + nu.toFixed(2) }, g);
      el("text", { x: f.x(Math.min(TMAX, L + W)) - 6, y: f.y(pu) - 8, "text-anchor": "end", class: "viz-small viz-bold colour s3", text: "HR " + pu.toFixed(2) }, g);
      el("text", { x: f.x(TMAX) - 4, y: f.y(1) + 16, "text-anchor": "end", class: "viz-small viz-muted", text: "1 = no effect" }, g);

      out.nu(nu.toFixed(2));
      out.pu(pu.toFixed(2));
      out.left(V.fmt.pct(Math.exp(-hs * L)));
      out.trueSus((hs / H0).toFixed(0));
    }
    draw();
  });

  // ---------------------------------------------------------------------------
  // Disproportionality: PRR and ROR from a spontaneous-report 2×2 table.
  V.register("disproportionality", function (root) {
    var ctr = V.controls(root);
    var sA = V.slider(ctr, { label: "a: reports of the event with drug X", min: 1, max: 60, step: 1, value: 12, fmt: V.fmt.int, onInput: draw });
    var sB = V.slider(ctr, { label: "b: other reports with drug X", min: 200, max: 5000, step: 50, value: 1200, fmt: V.fmt.int, onInput: draw });
    var sC = V.slider(ctr, { label: "c: reports of the event with all other drugs", min: 100, max: 5000, step: 50, value: 1000, fmt: V.fmt.int, onInput: draw });
    var D = 250000;
    var tg = V.toggle(root, { options: [{ value: "normal", label: "Usual reporting" }, { value: "media", label: "After a media story (a × 3)" }], value: "normal", onChange: draw });

    var tableHost = el("div", { class: "table-wrap", style: "margin:0.8rem 0" }, root);
    var c = V.svg(root, 640, 130);
    c.setAttribute("aria-label", "Bars comparing the share of drug X's reports that mention the event with the share for all other drugs");
    var host = el("g", null, c);

    var out = V.readouts(root, [
      { key: "prr", label: "PRR" },
      { key: "ror", label: "ROR (95% CI)" },
      { key: "chi", label: "χ² (with Yates correction)" },
      { key: "sig", label: "Signal by the Evans criteria?" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. Evans criteria: PRR at least 2, χ² at least 4 and at least 3 reports. A signal is a reason to look harder, not an estimate of risk: the table counts reports, not patients." }, root);

    function draw() {
      var a = sA.value() * (tg.value() === "media" ? 3 : 1), b = sB.value(), cc = sC.value(), d = D, N = a + b + cc + d;
      var pX = a / (a + b), pO = cc / (cc + d);
      var prr = pX / pO, ror = (a * d) / (b * cc);
      var se = Math.sqrt(1 / a + 1 / b + 1 / cc + 1 / d);
      var lo = Math.exp(Math.log(ror) - 1.96 * se), hi = Math.exp(Math.log(ror) + 1.96 * se);
      var num = Math.abs(a * d - b * cc) - N / 2; num = Math.max(0, num);
      var chi = N * num * num / ((a + b) * (cc + d) * (a + cc) * (b + d));
      var sig = prr >= 2 && chi >= 4 && a >= 3;

      clear(tableHost);
      var t = el("table", null, tableHost);
      var th = el("thead", null, t), hr = el("tr", null, th);
      ["", "Event of interest", "All other events", "Total reports"].forEach(function (h) { el("th", { text: h }, hr); });
      var tb = el("tbody", null, t);
      [["Drug X", a, b], ["All other drugs", cc, d]].forEach(function (r, i) {
        var tr = el("tr", null, tb);
        el("td", { html: "<strong>" + r[0] + "</strong>" }, tr);
        el("td", { text: (i ? "c = " : "a = ") + V.fmt.int(r[1]) }, tr);
        el("td", { text: (i ? "d = " : "b = ") + V.fmt.int(r[2]) }, tr);
        el("td", { text: V.fmt.int(r[1] + r[2]) }, tr);
      });

      clear(host);
      var maxP = Math.max(pX, pO) * 1.15, x0 = 150, x1 = 560;
      function bx(p) { return x0 + (x1 - x0) * p / maxP; }
      [["Drug X", pX, "s1", 22], ["All other drugs", pO, "s5", 72]].forEach(function (r) {
        el("text", { x: x0 - 10, y: r[3] + 15, "text-anchor": "end", class: "viz-small", text: r[0] }, host);
        el("rect", { x: x0, y: r[3], width: Math.max(1, bx(r[1]) - x0), height: 30, rx: 4, class: "fill " + r[2] }, host);
        el("text", { x: bx(r[1]) + 8, y: r[3] + 15, "dominant-baseline": "middle", class: "viz-small viz-bold", text: V.fmt.pct1(r[1]) + " of reports" }, host);
      });
      el("text", { x: x0, y: 122, class: "viz-small viz-muted", text: "Share of each drug’s reports that mention the event. PRR = the ratio of the two bars." }, host);

      out.prr(prr.toFixed(2));
      out.ror(ror.toFixed(1) + " (" + lo.toFixed(1) + "–" + hi.toFixed(1) + ")");
      out.chi(chi.toFixed(1));
      out.sig(sig ? "Yes" : "No");
    }
    draw();
  });
})();
