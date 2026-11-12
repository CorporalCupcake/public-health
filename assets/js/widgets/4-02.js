// Lecture 4.2 — DAGs and adjustment sets.
// Widget: dag-adjustment. A fixed 8-node DAG for Project 5A. Click nodes to adjust for them;
// the widget enumerates every path from treatment to outcome, applies d-separation, and checks
// the backdoor criterion for the total effect.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  V.register("dag-adjustment", function (root) {
    // ----- the graph -----
    var N = {
      A: { label: "Anticoagulation", short: "Anticoag", x: 170, y: 184, role: "treatment" },
      Y: { label: "90-day death", short: "Death", x: 500, y: 184, role: "outcome" },
      Age: { label: "Age", short: "Age", x: 255, y: 34, role: "confounder" },
      Sev: { label: "Illness severity", short: "Severity", x: 440, y: 34, role: "confounder" },
      BR: { label: "Bleeding risk", short: "Bleed risk", x: 150, y: 314, role: "confounder, acting through bleeding" },
      Pref: { label: "Prescriber preference", short: "Preference", x: 100, y: 79, role: "instrument" },
      Bl: { label: "Major bleed", short: "Bleed", x: 330, y: 284, role: "mediator" },
      Tr: { label: "Transfusion", short: "Transfusion", x: 510, y: 329, role: "collider and descendant of treatment" }
    };
    var order = ["Age", "Sev", "BR", "Pref", "Bl", "Tr"];
    var E = [
      ["Age", "A"], ["Age", "Y"], ["Sev", "A"], ["Sev", "Y"], ["Sev", "Tr"], ["BR", "A"], ["BR", "Bl"],
      ["Pref", "A"], ["A", "Bl"], ["Bl", "Y"], ["Bl", "Tr"], ["A", "Y"]
    ];
    Object.keys(N).forEach(function (k) { N[k].w = Math.max(70, N[k].label.length * 7.4 + 22); N[k].h = 36; });

    function isEdge(u, v) { for (var i = 0; i < E.length; i++) if (E[i][0] === u && E[i][1] === v) return true; return false; }
    function nbrs(u) {
      var out = [];
      E.forEach(function (e) { if (e[0] === u) out.push(e[1]); else if (e[1] === u) out.push(e[0]); });
      return out;
    }
    function descendants(u) {
      var seen = {}, stack = [u];
      while (stack.length) {
        var x = stack.pop();
        E.forEach(function (e) { if (e[0] === x && !seen[e[1]]) { seen[e[1]] = true; stack.push(e[1]); } });
      }
      return seen;
    }
    var DESC = {}; Object.keys(N).forEach(function (k) { DESC[k] = descendants(k); });
    var descA = DESC.A;

    // all simple undirected paths A … Y
    var PATHS = [];
    (function dfs(path, seen) {
      var u = path[path.length - 1];
      if (u === "Y") { PATHS.push(path.slice()); return; }
      nbrs(u).forEach(function (v) { if (!seen[v]) { seen[v] = true; path.push(v); dfs(path, seen); path.pop(); seen[v] = false; } });
    })(["A"], { A: true });

    var RANK = { causal: 0, backdoor: 1, noncausal: 2 };
    function classify(p) {
      var causal = true;
      for (var i = 0; i < p.length - 1; i++) if (!isEdge(p[i], p[i + 1])) causal = false;
      if (causal) return "causal";
      if (isEdge(p[1], p[0])) return "backdoor";
      return "noncausal";
    }
    // d-separation status of one path given set Z
    function pathState(p, Z) {
      var blockers = [], openedBy = [], closedAt = [];
      for (var i = 1; i < p.length - 1; i++) {
        var v = p[i], col = isEdge(p[i - 1], v) && isEdge(p[i + 1], v);
        if (col) {
          var condDesc = null;
          if (Z[v]) condDesc = v;
          else Object.keys(DESC[v]).forEach(function (d) { if (Z[d]) condDesc = d; });
          if (condDesc) openedBy.push([v, condDesc]); else closedAt.push(v);
        } else if (Z[v]) blockers.push(v);
      }
      return { open: blockers.length === 0 && closedAt.length === 0, blockers: blockers, closedAt: closedAt, openedBy: openedBy };
    }

    // ----- UI -----
    var Z = {};
    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.8rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Sets:" }, pre);
    [["Nothing", []], ["Everything", order], ["Confounders + mediator", ["Age", "Sev", "BR", "Bl"]], ["Minimal sufficient set", null]].forEach(function (p) {
      V.button(pre, p[0], function () {
        Z = {};
        (p[1] || minimalSets()[0] || []).forEach(function (k) { Z[k] = true; });
        draw();
      });
    });

    V.legend(root, [
      { cls: "s2", label: "Adjusted for (click to toggle)" },
      { cls: "s3", label: "Edge on an open biasing path" },
      { cls: "s1", label: "Edge on an open causal path" }
    ]);
    var c = V.svg(root, 640, 372);
    c.setAttribute("aria-label", "Causal diagram for Project 5A with eight nodes; click a node to adjust for it");
    var out = V.readouts(root, [
      { key: "bd", label: "Backdoor paths still open" },
      { key: "ca", label: "Causal paths still open" },
      { key: "nc", label: "Other biasing paths opened by adjustment" },
      { key: "v", label: "Verdict for the total effect" }
    ]);
    var vBox = root.querySelectorAll(".widget-readout")[3];
    var expl = el("p", { class: "widget-note" }, root);
    el("div", { class: "widget-title", style: "margin-top:1rem", text: "Every path from anticoagulation to death" }, root).className = "diagram-title";
    var pl = V.svg(root, 640, 30 + PATHS.length * 38);
    pl.setAttribute("aria-label", "List of every path between anticoagulation and death, with whether each is open or closed");
    el("p", { class: "widget-note", text: "Illustrative DAG, simplified for teaching; a real Project 5A DAG would have more nodes, including unmeasured ones such as frailty and goals of care. With an unmeasured common cause of treatment and death, no set of measured variables would be sufficient." }, root);

    function minimalSets() {
      var cand = order.filter(function (k) { return !descA[k]; }), sets = [];
      for (var m = 0; m < (1 << cand.length); m++) {
        var S = {}; cand.forEach(function (k, i) { if (m & (1 << i)) S[k] = true; });
        if (sufficient(S)) sets.push(S);
      }
      var minimal = sets.filter(function (S) {
        return !sets.some(function (T) {
          if (T === S) return false;
          var tk = Object.keys(T), sk = Object.keys(S);
          return tk.length < sk.length && tk.every(function (k) { return S[k]; });
        });
      });
      return minimal.map(function (S) { return order.filter(function (k) { return S[k]; }); });
    }
    function sufficient(S) {
      for (var k in S) if (S[k] && descA[k]) return false;
      return PATHS.every(function (p) { return classify(p) !== "backdoor" || !pathState(p, S).open; });
    }

    var markers = el("defs", {}, c);
    [["m", "arrowhead"], ["a", "arrowhead accent"], ["r", "dot s3"]].forEach(function (mk) {
      var m = el("marker", { id: "l42w-arrow-" + mk[0], viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto" }, markers);
      el("path", { d: "M0,0L10,5L0,10Z", class: mk[1] }, m);
    });
    var gE = el("g", {}, c), gN = el("g", {}, c);

    // point on the border of node n's box, heading towards (tx, ty)
    function border(n, tx, ty) {
      var dx = tx - n.x, dy = ty - n.y, hw = n.w / 2 + 3, hh = n.h / 2 + 3;
      var s = Math.min(Math.abs(dx) > 1e-9 ? hw / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? hh / Math.abs(dy) : Infinity);
      return [n.x + dx * s, n.y + dy * s];
    }

    PATHS.sort(function (a, b) { return RANK[classify(a)] - RANK[classify(b)] || a.length - b.length; });

    function draw() {
      // path states
      var states = PATHS.map(function (p) { var t = classify(p); return { p: p, type: t, st: pathState(p, Z) }; });
      var redEdges = {}, tealEdges = {};
      states.forEach(function (s) {
        if (!s.st.open) return;
        for (var i = 0; i < s.p.length - 1; i++) {
          var a = s.p[i], b = s.p[i + 1], key = isEdge(a, b) ? a + ">" + b : b + ">" + a;
          if (s.type === "causal") tealEdges[key] = true; else redEdges[key] = true;
        }
      });

      clear(gE);
      E.forEach(function (e) {
        var key = e[0] + ">" + e[1], u = N[e[0]], v = N[e[1]];
        var cls = redEdges[key] ? "stroke s3" : tealEdges[key] ? "edge accent" : "edge";
        var mk = redEdges[key] ? "r" : tealEdges[key] ? "a" : "m";
        var attrs = { class: cls, "marker-end": "url(#l42w-arrow-" + mk + ")" };
        if (redEdges[key]) attrs["stroke-width"] = 2.6;
        if (e[0] === "Sev" && e[1] === "Tr") {
          attrs.d = "M" + (u.x + u.w / 2 + 2) + "," + (u.y + 4) + " C 625,54 630,284 " + (v.x + v.w / 2 + 3) + "," + (v.y - 4);
        } else {
          var p0 = border(u, v.x, v.y), p1 = border(v, u.x, u.y);
          attrs.d = "M" + p0[0].toFixed(1) + "," + p0[1].toFixed(1) + " L" + p1[0].toFixed(1) + "," + p1[1].toFixed(1);
        }
        el("path", attrs, gE);
      });

      clear(gN);
      Object.keys(N).forEach(function (k) {
        var n = N[k], fixed = k === "A" || k === "Y", adj = !!Z[k];
        var g = el("g", fixed ? {} : { tabindex: 0, role: "button", "aria-pressed": adj, "aria-label": n.label + (adj ? ", adjusted" : ", not adjusted"), style: "cursor:pointer" }, gN);
        var sc = k === "A" ? "s1" : k === "Y" ? "s4" : adj ? "s2" : "s5";
        el("rect", { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: adj ? 2 : 10, class: (fixed || adj ? "node-fill " : "node ") + sc, "stroke-width": adj ? 3 : 2 }, g);
        el("text", { x: n.x, y: n.y + 4.5, "text-anchor": "middle", class: "viz-bold", text: n.label }, g);
        if (!fixed) {
          var toggle = function () { if (Z[k]) delete Z[k]; else Z[k] = true; draw(); };
          g.addEventListener("click", toggle);
          g.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
        }
      });
      el("text", { x: 8, y: 368, class: "viz-small viz-muted", text: "Square box = adjusted for. Nodes have no roles shown: work them out, then check below." }, gN);

      // readouts
      var nBd = 0, nBdOpen = 0, nCa = 0, nCaOpen = 0, nNcOpen = 0;
      states.forEach(function (s) {
        if (s.type === "backdoor") { nBd++; if (s.st.open) nBdOpen++; }
        else if (s.type === "causal") { nCa++; if (s.st.open) nCaOpen++; }
        else if (s.st.open) nNcOpen++;
      });
      var adjDesc = order.filter(function (k) { return Z[k] && descA[k]; });
      var suff = sufficient(Z);
      out.bd(nBdOpen + " of " + nBd);
      out.ca(nCaOpen + " of " + nCa);
      out.nc(String(nNcOpen));
      var verdict, good = false, bad = false;
      if (suff) { verdict = Z.Pref ? "Sufficient, but inefficient" : "Sufficient"; good = !Z.Pref; }
      else if (adjDesc.length) { verdict = "Biased"; bad = true; }
      else { verdict = "Not sufficient"; bad = true; }
      out.v(verdict);
      vBox.classList.toggle("good", good); vBox.classList.toggle("bad", bad);

      var msgs = [];
      var chosen = order.filter(function (k) { return Z[k]; });
      if (chosen.length) msgs.push("You adjusted for: " + chosen.map(function (k) { return N[k].label + " (" + N[k].role + ")"; }).join("; ") + ".");
      else msgs.push("Nothing adjusted: the crude comparison.");
      if (Z.Bl) msgs.push("Major bleed is on the causal path, so adjusting for it removes the part of the effect that runs through bleeding.");
      if (Z.Tr) msgs.push("Transfusion is a descendant of treatment: it carries information about the mediator (bleeding), so conditioning on it distorts the effect even if every path is closed; because severity also causes it, it opens a biasing path unless severity is adjusted too.");
      if (Z.Pref) msgs.push("Prescriber preference is an instrument: it closes no backdoor path, adds variance, and would amplify any unmeasured confounding.");
      if (nBdOpen && !adjDesc.length) msgs.push("At least one backdoor path is still open: see the list below.");
      if (suff && !Z.Pref) msgs.push("Every backdoor path is closed and nothing caused by treatment is adjusted: this set identifies the total effect, if the DAG is right.");
      var ms = minimalSets().map(function (S) { return "{" + S.map(function (k) { return N[k].label; }).join(", ") + "}"; });
      msgs.push("Minimal sufficient set" + (ms.length > 1 ? "s" : "") + " in this DAG: " + ms.join(" or ") + ".");
      expl.textContent = msgs.join(" ");

      // path list
      clear(pl);
      states.forEach(function (s, i) {
        var y = 20 + i * 38;
        var txt = "";
        for (var j = 0; j < s.p.length; j++) {
          if (j) txt += isEdge(s.p[j - 1], s.p[j]) ? " → " : " ← ";
          txt += N[s.p[j]].short;
        }
        var okState = s.type === "causal" ? s.st.open : !s.st.open;
        var typeName = s.type === "causal" ? "Causal path" : s.type === "backdoor" ? "Backdoor path" : "Non-causal path through a descendant of treatment";
        var why;
        if (s.st.open) {
          why = s.type === "causal" ? "open (good: this is the effect)" :
            s.st.openedBy.length ? (s.st.openedBy[0][0] === s.st.openedBy[0][1] ? "open: " + N[s.st.openedBy[0][0]].label + " is a collider here and you adjusted for it" : "open: adjusting for " + N[s.st.openedBy[0][1]].label + " opened the collider at " + N[s.st.openedBy[0][0]].label) :
            "open: confounding, not yet blocked";
        } else {
          if (s.st.blockers.length) why = "closed by adjusting for " + s.st.blockers.map(function (k) { return N[k].label; }).join(" and ") + (s.type === "causal" ? " (bad: part of the effect is removed)" : "");
          else why = "closed at the collider " + s.st.closedAt.map(function (k) { return N[k].label; }).join(" and ") + " (left alone)";
        }
        el("circle", { cx: 12, cy: y - 4, r: 5, class: "dot " + (okState ? "s1" : "s3") }, pl);
        el("text", { x: 26, y: y, class: "viz-small viz-bold", text: txt }, pl);
        el("text", { x: 26, y: y + 16, class: "viz-small colour " + (okState ? "s1" : "s3"), text: typeName + " · " + why }, pl);
      });
    }
    draw();
  });
})();
