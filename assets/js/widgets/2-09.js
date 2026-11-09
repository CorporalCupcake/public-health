// Lecture 2.9 — Two exposures, four risks: effect modification and interaction on both scales.
// Illustrative numbers.
(function () {
  var V = Viz, el = V.el;
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  V.register("interaction-table", function (root) {
    var pct = function (v) { return v.toFixed(1) + "%"; };
    var ctr = V.controls(root);
    var s00 = V.slider(ctr, { label: "Risk with neither A nor B", min: 0.5, max: 60, step: 0.1, value: 2, fmt: pct, onInput: draw });
    var s10 = V.slider(ctr, { label: "Risk with A only", min: 0.5, max: 60, step: 0.1, value: 6, fmt: pct, onInput: draw });
    var s01 = V.slider(ctr, { label: "Risk with B only", min: 0.5, max: 60, step: 0.1, value: 10, fmt: pct, onInput: draw });
    var s11 = V.slider(ctr, { label: "Risk with both A and B", min: 0.5, max: 60, step: 0.1, value: 14, fmt: pct, onInput: draw });

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Presets:" }, pre);
    [
      ["Effects add", [2, 6, 10, 14]],
      ["Effects multiply", [2, 6, 10, 30]],
      ["Asbestos-like (×5, ×11, ×53)", [1, 5.2, 10.9, 53.2]],
      ["Less than additive", [4, 12, 14, 16]]
    ].forEach(function (p) {
      V.button(pre, p[0], function () { s00.set(p[1][0]); s10.set(p[1][1]); s01.set(p[1][2]); s11.set(p[1][3]); draw(); });
    });

    V.legend(root, [
      { cls: "s5", label: "A absent" },
      { cls: "s1", label: "A present" },
      { cls: "s2", label: "“Both” if effects added", dashed: true },
      { cls: "s4", label: "“Both” if effects multiplied", dashed: true }
    ]);
    var c = V.svg(root, 640, 310);
    c.setAttribute("aria-label", "Bar chart of risk in four groups defined by exposures A and B, with expected joint risks under additive and multiplicative models");

    var verdict = el("p", { class: "widget-note", style: "font-weight:700;color:var(--text)" }, root);
    var out = V.readouts(root, [
      { key: "rrN", label: "RR for A, when B absent" },
      { key: "rrY", label: "RR for A, when B present" },
      { key: "rdN", label: "RD for A, when B absent" },
      { key: "rdY", label: "RD for A, when B present" },
      { key: "reri", label: "RERI = RR₁₁ − RR₁₀ − RR₀₁ + 1", cls: "good" },
      { key: "mult", label: "RR₁₁ ÷ (RR₁₀ × RR₀₁): multiplicative interaction" }
    ]);
    el("p", { class: "widget-note", text: "Illustrative numbers. RD is in percentage points. All ratios use the “neither” group as the shared reference." }, root);

    function draw() {
      var r00 = s00.value(), r10 = s10.value(), r01 = s01.value(), r11 = s11.value();
      var eAdd = r10 + r01 - r00, eMul = r10 * r01 / r00;
      var top = Math.max(r00, r10, r01, r11, eAdd, Math.min(eMul, 100)) * 1.12;
      top = Math.max(10, Math.ceil(top / 10) * 10);

      clear(c);
      var f = V.frame(c, { x: [0, 1], y: [0, top], xTicks: [], fmtY: function (t) { return t + "%"; }, yLabel: "Risk", margin: { bottom: 56, left: 56, right: 150 } });
      var g = f.inner, y0 = f.y(0), bw = 62;
      var groups = [
        { label: "B absent", x: f.x(0.25), r0: r00, r1: r10 },
        { label: "B present", x: f.x(0.75), r0: r01, r1: r11 }
      ];
      groups.forEach(function (gr, i) {
        var xa = gr.x - bw - 4, xb = gr.x + 4;
        el("rect", { x: xa, y: f.y(gr.r0), width: bw, height: y0 - f.y(gr.r0), class: "fill s5" }, g);
        el("rect", { x: xb, y: f.y(gr.r1), width: bw, height: y0 - f.y(gr.r1), class: "fill s1" }, g);
        el("text", { x: xa + bw / 2, y: f.y(gr.r0) - 6, "text-anchor": "middle", class: "viz-small", text: gr.r0.toFixed(1) + "%" }, g);
        el("text", { x: xb + bw / 2, y: f.y(gr.r1) - 6, "text-anchor": "middle", class: "viz-small", text: gr.r1.toFixed(1) + "%" }, g);
        el("text", { x: gr.x, y: y0 + 18, "text-anchor": "middle", class: "viz-bold", text: gr.label }, g);
        var rr = gr.r1 / gr.r0, rd = gr.r1 - gr.r0;
        el("text", { x: gr.x, y: y0 + 36, "text-anchor": "middle", class: "viz-small viz-muted", text: "A: RR " + V.fmt.num(rr, 2) + " · RD " + V.fmt.signed(rd, 1) + " pts" }, g);
        if (i === 1) {
          // Expected joint risks under each model, as dashed marks on the "both" bar
          var xr = xb + bw;
          var marks = [];
          if (eAdd > 0) marks.push({ v: eAdd, cls: "s2", t: "if added " + eAdd.toFixed(1) + "%" });
          if (eMul <= top) marks.push({ v: eMul, cls: "s4", t: "if multiplied " + eMul.toFixed(1) + "%" });
          else marks.push({ v: top, cls: "s4", t: "if multiplied " + V.fmt.int(eMul) + "% ↑", off: true });
          marks.forEach(function (m) {
            m.y = f.y(m.v);
            if (!m.off) el("line", { x1: xb - 6, x2: xr + 6, y1: m.y, y2: m.y, class: "stroke dashed " + m.cls }, g);
          });
          // keep labels at least 15px apart
          marks.sort(function (a, b) { return a.y - b.y; });
          for (var k = 1; k < marks.length; k++) if (marks[k].y - marks[k - 1].y < 15) marks[k].y = marks[k - 1].y + 15;
          marks.forEach(function (m) {
            el("text", { x: xr + 12, y: m.y + 4, class: "viz-small colour " + m.cls, text: m.t }, g);
          });
        }
      });

      var rr10 = r10 / r00, rr01 = r01 / r00, rr11 = r11 / r00;
      var reri = rr11 - rr10 - rr01 + 1, mult = rr11 / (rr10 * rr01);
      out.rrN(V.fmt.num(rr10, 2));
      out.rrY(V.fmt.num(r11 / r01, 2));
      out.rdN(V.fmt.signed(r10 - r00, 1) + " pts");
      out.rdY(V.fmt.signed(r11 - r01, 1) + " pts");
      out.reri(V.fmt.signed(reri, 2));
      out.mult(V.fmt.num(mult, 2));

      var add = Math.abs(reri) < 0.05 ? 0 : (reri > 0 ? 1 : -1);
      var mul = Math.abs(Math.log(mult)) < 0.03 ? 0 : (mult > 1 ? 1 : -1);
      var word = { "1": "positive", "-1": "negative", "0": "no" };
      var s;
      if (add === 0 && mul === 0) s = "No interaction on either scale (this happens only when A or B has no effect).";
      else if (add === 0) s = "No interaction on the additive scale, but " + word[mul] + " interaction on the multiplicative scale.";
      else if (mul === 0) s = "Interaction on the additive scale (" + word[add] + ") but not on the multiplicative scale.";
      else if (add === mul) s = word[add].charAt(0).toUpperCase() + word[add].slice(1) + " interaction on both scales.";
      else s = "Opposite directions: " + word[add] + " on the additive scale, " + word[mul] + " on the multiplicative scale.";
      verdict.textContent = "Verdict: " + s;
    }
    draw();
  });
})();
