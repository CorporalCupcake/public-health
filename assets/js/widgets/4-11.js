// Lecture 4.11 — Natural experiments: a design chooser.
// Answer questions about how a policy was assigned and what data exist; get the designs that fit,
// their key assumption, the main threat for this policy, and the lecture to revisit.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  V.register("design-chooser", function (root) {
    var Q = [
      { key: "cut", label: "Is exposure set by a cut-off on a score, age or date?", opts: [["yes", "Yes"], ["no", "No"]] },
      { key: "nudge", label: "Is there something that shifts uptake but can’t affect the outcome otherwise?", opts: [["yes", "Yes"], ["no", "No"]] },
      { key: "comp", label: "Are comparable units unexposed (or exposed later) over the same period?", opts: [["yes", "Yes"], ["no", "No"]] },
      { key: "treated", label: "How many units are exposed?", opts: [["few", "One or a few"], ["many", "Many"]] },
      { key: "stagger", label: "Does the start date differ between exposed units?", opts: [["yes", "Yes"], ["no", "No"]] },
      { key: "pre", label: "Outcome time points before the policy?", opts: [["long", "8 or more"], ["short", "Fewer"]] },
      { key: "announce", label: "Was it announced well before it started?", opts: [["yes", "Yes"], ["no", "No"]] },
      { key: "cointer", label: "Did other policies or shocks start at about the same time?", opts: [["yes", "Yes"], ["no", "No"]] },
      { key: "spill", label: "Could the policy spill over to comparison units?", opts: [["yes", "Yes"], ["no", "No"]] }
    ];
    var ans = { cut: "no", nudge: "no", comp: "yes", treated: "few", stagger: "yes", pre: "long", announce: "yes", cointer: "yes", spill: "yes" };

    var presets = [
      ["Project 4: GCC sugary-drink taxes", { cut: "no", nudge: "no", comp: "yes", treated: "few", stagger: "yes", pre: "long", announce: "yes", cointer: "yes", spill: "yes" }],
      ["Smoke-free law, England 2007", { cut: "no", nudge: "no", comp: "no", treated: "few", stagger: "no", pre: "long", announce: "yes", cointer: "no", spill: "no" }],
      ["Statins from 20% risk", { cut: "yes", nudge: "yes", comp: "no", treated: "many", stagger: "no", pre: "short", announce: "no", cointer: "no", spill: "no" }],
      ["Saudi bread salt limit", { cut: "no", nudge: "no", comp: "no", treated: "few", stagger: "no", pre: "short", announce: "yes", cointer: "yes", spill: "no" }],
      ["Local policy, many regions", { cut: "no", nudge: "no", comp: "yes", treated: "many", stagger: "yes", pre: "short", announce: "no", cointer: "no", spill: "yes" }]
    ];

    var pre = el("div", { style: "display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin:0 0 0.9rem" }, root);
    el("span", { class: "widget-note", style: "margin:0", text: "Examples:" }, pre);

    var qwrap = el("div", { class: "widget-controls" }, root);
    var qnodes = {};
    function buildQuestions() {
      clear(qwrap);
      Q.forEach(function (q) {
        var box = el("div", { style: "display:flex;flex-direction:column;gap:0.35rem;font-size:0.88rem" }, qwrap);
        el("span", { class: "widget-slider-label", text: q.label }, box);
        qnodes[q.key] = V.toggle(box, {
          options: q.opts.map(function (o) { return { value: o[0], label: o[1] }; }),
          value: ans[q.key],
          onChange: function (v) { ans[q.key] = v; render(); }
        });
      });
    }
    presets.forEach(function (p) {
      V.button(pre, p[0], function () { ans = Object.assign({}, p[1]); buildQuestions(); render(); });
    });

    var out = V.readouts(root, [
      { key: "main", label: "Recommended design(s)", cls: "good" },
      { key: "tri", label: "Also run, to triangulate" }
    ]);
    var tableWrap = el("div", { class: "table-wrap", style: "margin:0.9rem 0 0" }, root);
    var threatsTitle = el("p", { class: "widget-note", style: "margin:0.8rem 0 0.2rem;font-weight:700" }, root);
    var threats = el("ul", { style: "font-family:var(--font-ui);font-size:0.88rem;margin:0.2rem 0 0;padding-left:1.2rem" }, root);
    el("p", { class: "widget-note", text: "A guide, not an oracle: it encodes the rules of thumb from Lectures 4.6–4.9. Real evaluations often combine designs (for example a comparative ITS is a DiD with a long pre-series)." }, root);

    function assess() {
      var a = ans, D = [];
      var did = { name: a.stagger === "yes" ? "Staggered DiD / event study" : "Difference-in-differences", lec: "4.6",
        assume: "Parallel trends: without the policy, exposed and comparison units would have moved together.",
        threat: a.spill === "yes" ? "Spillovers into comparison units push the estimate towards zero." : (a.stagger === "yes" ? "Two-way fixed effects mis-weights staggered timing; use Callaway–Sant’Anna or similar." : "Diverging pre-trends; check the event-study leads."),
        fit: "no", why: "Needs comparison units." };
      if (a.comp === "yes") {
        if (a.treated === "many") { did.fit = "main"; }
        else { did.fit = "tri"; did.why = "Few exposed units: inference is fragile; use permutation or placebo tests."; }
        if (a.pre === "short" && did.fit !== "no") did.threat = "With few pre-periods you can barely check parallel trends. " + did.threat;
      }
      var sc = { name: "Synthetic control", lec: "4.8",
        assume: "A weighted mix of donor units reproduces the exposed unit’s pre-policy path, and would have kept doing so.",
        threat: a.spill === "yes" ? "Donors affected by the policy (cross-border shopping, shared supply chains) bias the gap." : "Poor pre-period fit or a few donors doing all the work.",
        fit: "no", why: "" };
      if (a.comp !== "yes") sc.why = "Needs untreated donor units.";
      else if (a.pre !== "long") sc.why = "Needs a long pre-period to fit the weights.";
      else if (a.treated === "few") sc.fit = "main";
      else { sc.fit = "tri"; sc.why = "Many exposed units: possible (generalised or augmented SC), but DiD is the natural first choice."; }
      var its = { name: a.comp === "yes" ? "Comparative interrupted time series" : "Interrupted time series", lec: "4.7",
        assume: "The pre-policy level and trend would have continued unchanged.",
        threat: a.cointer === "yes" ? "Co-interventions at the same time are indistinguishable from the policy in a single series." : "Seasonality and autocorrelation; history (anything else that changed at the break).",
        fit: "no", why: "" };
      if (a.pre !== "long") its.why = "Needs a long, stable pre-series.";
      else if (a.comp === "yes") its.fit = "tri";
      else its.fit = "main";
      var rd = { name: "Regression discontinuity", lec: "4.9",
        assume: "Continuity: nothing else jumps at the cut-off, and nobody can sort across it.",
        threat: "Manipulation or heaping of the running variable; other rules that share the same cut-off.",
        fit: a.cut === "yes" ? "main" : "no", why: "Needs an assignment cut-off." };
      var iv = { name: a.cut === "yes" ? "IV (fuzzy RD: the cut-off as instrument)" : "Instrumental variables", lec: "4.9",
        assume: "The instrument moves uptake, shares no causes with the outcome, affects it only through uptake, and has no defiers.",
        threat: "Exclusion failure, made worse by a weak first stage; the answer is the compliers’ effect only.",
        fit: "no", why: "Needs a credible instrument." };
      if (a.nudge === "yes") iv.fit = "main";
      D.push(rd, iv, did, sc, its);
      return D;
    }

    function render() {
      var D = assess();
      var main = D.filter(function (d) { return d.fit === "main"; }), tri = D.filter(function (d) { return d.fit === "tri"; });
      out.main(main.length ? main.map(function (d) { return d.name; }).join(" + ") : "No credible design");
      out.tri(tri.length ? tri.map(function (d) { return d.name; }).join(" + ") : "–");

      clear(tableWrap);
      var t = el("table", null, tableWrap), th = el("thead", null, t), hr = el("tr", null, th);
      ["Design", "Fit here", "Key assumption", "Main threat for this policy", "Revisit"].forEach(function (h) { el("th", { text: h }, hr); });
      var tb = el("tbody", null, t);
      var order = { main: 0, tri: 1, no: 2 };
      D.slice().sort(function (x, y) { return order[x.fit] - order[y.fit]; }).forEach(function (d) {
        var tr = el("tr", null, tb);
        el("td", { html: "<strong>" + d.name + "</strong>" }, tr);
        el("td", { text: d.fit === "main" ? "Recommended" : d.fit === "tri" ? "Triangulate" + (d.why ? ". " + d.why : "") : "Not suitable. " + d.why }, tr);
        el("td", { text: d.fit === "no" ? "–" : d.assume }, tr);
        el("td", { text: d.fit === "no" ? "–" : d.threat }, tr);
        el("td", { text: "Lecture " + d.lec }, tr);
      });

      clear(threats);
      var list = [];
      if (!main.length) list.push("No design here gives a credible counterfactual. Options: build the data you lack before the next policy, run a process evaluation (is it implemented and complied with?), or predict impact with a simulation model, as Project 1 does for salt.");
      if (ans.announce === "yes") list.push("Anticipation: behaviour (or industry reformulation) may change between announcement and start. Treat the announcement as a possible second break, or drop the window between the two dates.");
      if (ans.cointer === "yes") list.push("Co-interventions: find a comparison unit that got the other change but not this policy, or an outcome the other change can’t affect.");
      if (ans.spill === "yes") list.push("Spillovers: exclude neighbouring units from the comparison group and test whether border areas behave differently.");
      if (ans.comp === "yes" && ans.treated === "few") list.push("Few exposed units: standard errors from clustered regression are unreliable; use placebo-in-space and permutation tests.");
      if (ans.cut === "yes") list.push("Check density and covariate balance at the cut-off before estimating anything.");
      threatsTitle.textContent = list.length ? "Before you start, plan for:" : "";
      list.forEach(function (s) { el("li", { text: s, style: "margin:0.2rem 0" }, threats); });
    }

    buildQuestions();
    render();
  });
})();
