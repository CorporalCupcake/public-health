// Lecture 5.2 — comparator choice for a drug with no effect: non-users, untreated patients with the
// indication, an active comparator among new users, and adherent vs non-adherent users. Illustrative numbers.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function expit(x) { return 1 / (1 + Math.exp(-x)); }

  V.register("comparator-choice", function (root) {
    var N = 60000;
    var rand = V.rng(918273645);
    for (var w = 0; w < 300; w++) rand();
    var F = [], U = [];
    for (var i = 0; i < N; i++) { F.push(V.normal(rand)); U.push([rand(), rand(), rand(), rand()]); }

    var ctr = V.controls(root);
    var sG = V.slider(ctr, { label: "How strongly frailty stops doctors prescribing", min: 0, max: 2, step: 0.1, value: 1, fmt: function (v) { return v === 0 ? "not at all" : v.toFixed(1); }, onInput: draw });
    var sD = V.slider(ctr, { label: "Channelling: frail patients steered towards drug A", min: 0, max: 1.5, step: 0.1, value: 0.2, fmt: function (v) { return v === 0 ? "none" : v.toFixed(1); }, onInput: draw });
    var sK = V.slider(ctr, { label: "How strongly frailty lowers adherence", min: 0, max: 2, step: 0.1, value: 1, fmt: function (v) { return v === 0 ? "not at all" : v.toFixed(1); }, onInput: draw });

    var c = V.svg(root, 640, 300);
    c.setAttribute("aria-label", "Dot plot of risk ratios for death comparing users of a useless drug with four different comparison groups, on a log scale with the true value of 1 marked");
    var host = el("g", null, c);
    var out = V.readouts(root, [
      { key: "nonuse", label: "A users vs all non-users" },
      { key: "untr", label: "A users vs untreated with the condition" },
      { key: "acnu", label: "A starters vs B starters (ACNU)", cls: "good" },
      { key: "adh", label: "Adherent vs non-adherent A users", cls: "bad" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative simulation of 60,000 people. The condition raises the risk of death and is commoner in the frail; frailty raises death risk further. Drugs A and B have no effect at all, so every risk ratio should be 1. Frailty is not recorded, so none of these comparisons can be adjusted for it." }, root);

    function draw() {
      var g = sG.value(), d = sD.value(), k = sK.value();
      var S = { all: [0, 0], non: [0, 0], untr: [0, 0], A: [0, 0], B: [0, 0], adh: [0, 0], nonadh: [0, 0] };
      function add(key, p) { S[key][0] += p; S[key][1] += 1; }
      for (var i = 0; i < N; i++) {
        var f = F[i], u = U[i];
        var ind = u[0] < expit(-1 + 0.5 * f);
        var risk = expit(-3 + 1.0 * f + (ind ? 0.7 : 0));
        if (!ind) { add("non", risk); continue; }
        var treated = u[1] < expit(1 - g * f);
        if (!treated) { add("non", risk); add("untr", risk); continue; }
        var isA = u[2] < expit(d * f);
        if (isA) {
          add("A", risk);
          if (u[3] < expit(0.8 - k * f)) add("adh", risk); else add("nonadh", risk);
        } else add("B", risk);
      }
      function r(key) { return S[key][0] / S[key][1]; }
      var est = [
        { key: "nonuse", label: "A users vs all non-users", v: r("A") / r("non"), cls: "s4" },
        { key: "untr", label: "A users vs untreated with the condition", v: r("A") / r("untr"), cls: "s2" },
        { key: "acnu", label: "A starters vs B starters (ACNU)", v: r("A") / r("B"), cls: "s1" },
        { key: "adh", label: "Adherent vs non-adherent A users", v: r("adh") / r("nonadh"), cls: "s3" }
      ];

      clear(host);
      var lo = 0.25, hi = 4, x0 = 250, x1 = 615;
      var lx = V.scale(Math.log(lo), Math.log(hi), x0, x1);
      function X(v) { return lx(Math.log(Math.min(hi, Math.max(lo, v)))); }
      var top = 20, rowH = 56, bottom = top + rowH * est.length;
      [0.25, 0.5, 1, 2, 4].forEach(function (t) {
        el("line", { x1: X(t), x2: X(t), y1: top - 6, y2: bottom, class: "viz-grid" }, host);
        el("text", { x: X(t), y: bottom + 18, "text-anchor": "middle", class: "viz-tick", text: String(t) }, host);
      });
      el("line", { x1: X(1), x2: X(1), y1: top - 10, y2: bottom, class: "edge strong", "stroke-dasharray": "5 4" }, host);
      el("text", { x: X(1), y: top - 12, "text-anchor": "middle", class: "viz-small viz-muted", text: "truth: no effect" }, host);
      el("text", { x: (x0 + x1) / 2, y: bottom + 40, "text-anchor": "middle", class: "viz-label", text: "Risk ratio for death (log scale)" }, host);
      el("text", { x: X(0.5), y: bottom + 58, "text-anchor": "middle", class: "viz-small viz-muted", text: "← drug looks protective" }, host);
      el("text", { x: X(2), y: bottom + 58, "text-anchor": "middle", class: "viz-small viz-muted", text: "drug looks harmful →" }, host);

      est.forEach(function (e, j) {
        var y = top + rowH * j + rowH / 2;
        var words = e.label.split(" vs ");
        el("text", { x: 4, y: y - 4, class: "viz-small viz-bold", text: words[0] }, host);
        el("text", { x: 4, y: y + 12, class: "viz-small viz-muted", text: "vs " + words[1] }, host);
        el("line", { x1: X(1), x2: X(e.v), y1: y, y2: y, class: "stroke " + e.cls }, host);
        el("circle", { cx: X(e.v), cy: y, r: 7, class: "dot " + e.cls }, host);
        var right = e.v >= 1 || X(e.v) < x0 + 40;
        el("text", { x: X(e.v) + (right ? 12 : -12), y: y + 4, "text-anchor": right ? "start" : "end", class: "viz-small viz-bold colour " + e.cls, text: e.v.toFixed(2) }, host);
        out[e.key](e.v.toFixed(2));
      });
    }
    draw();
  });
})();
