// Lecture 5.14 — AI as a medical device: a PCCP sandbox (does a proposed update fit the authorised plan?) and an
// EU MDR Rule 11 classification walkthrough. Educational simplifications of FDA's PCCP guidance (Dec 2024, reissued
// Aug 2025) and MDR Annex VIII Rule 11; not regulatory advice.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ---------------------------------------------------------------------------
  // PCCP sandbox
  var OPTS = [
    { v: "pccp", label: "Covered by the PCCP: release, update the labelling, document it" },
    { v: "new", label: "Outside the PCCP: a new marketing submission first" },
    { v: "fail", label: "The update failed the PCCP’s own test: do not release it" },
    { v: "qms", label: "No submission needed: record it in the quality system" }
  ];
  var SCEN = [
    {
      title: "Routine retraining",
      text: "Two more years of 12-lead ECGs and echocardiograms from adults in the intended-use population are added. The model is retrained exactly as the modification protocol describes. On the sequestered test set, specificity rises and sensitivity stays within the pre-specified non-inferiority margin.",
      ans: "pccp",
      why: "This is the textbook PCCP case: retraining on new data from the intended-use population, same input type, tested against pre-specified acceptance criteria. FDA’s guidance lists exactly this (quantitative performance changes from retraining) as appropriate. Update the labelling with the new performance, tell users, and document it in the quality system."
    },
    {
      title: "Retraining that misses its target",
      text: "The same retraining is run per protocol, but on the test set sensitivity falls just outside the pre-specified non-inferiority margin. The team argues the drop is clinically trivial.",
      ans: "fail",
      why: "The acceptance criteria are the deal. If the modified model fails them, the guidance says the modification is not implemented under the PCCP; the authorised version stays in use. Arguing afterwards that the margin was too strict is moving the goalposts. To release this version anyway, the manufacturer would need a new submission."
    },
    {
      title: "A new ECG cart",
      text: "A hospital buys ECG carts from another manufacturer. They meet the minimum acquisition specifications written into the PCCP (sampling rate, filtering, lead set). Analytical testing per the protocol shows equivalent performance.",
      ans: "pccp",
      why: "New sources of the same input signal type, meeting pre-specified specifications, are one of the three kinds of modification the guidance names (inputs and compatibility). FDA’s own skin-lesion example does this with extra smartphones whose cameras meet the minimum specification."
    },
    {
      title: "Smartwatch single-lead ECG",
      text: "Marketing wants the model to accept single-lead ECGs from consumer smartwatches. The PCCP covered only 12-lead resting ECGs.",
      ans: "new",
      why: "A new kind of input with different signal properties, not described in the plan. FDA’s parallel example is a thermographic camera added to a device validated on ordinary photos: it could significantly affect safety or effectiveness, so a new marketing submission is required."
    },
    {
      title: "Lowering the alert threshold",
      text: "Clinicians ask for more sensitivity, so the team lowers the operating threshold. The model is unchanged, but sensitivity and specificity both move. The PCCP did not mention threshold changes.",
      ans: "new",
      why: "Changing the operating point changes the device’s performance specifications, and it was not pre-specified. Had the PCCP described a bounded threshold change with its own test and acceptance criteria, it could have been covered (performance changes, possibly as a local, site-specific adaptation). Unplanned, it most likely needs a new submission. A good PCCP anticipates the changes users will ask for."
    },
    {
      title: "Predicting the future",
      text: "The retrained model turns out to predict which patients will develop low ejection fraction within five years, not just who has it now. The company wants to add this claim.",
      ans: "new",
      why: "A new clinical claim changes the indications for use. FDA’s patient-monitoring example is almost identical: a model that starts predicting instability before onset needs a new marketing submission. PCCP modifications must keep the device within its intended use, and FDA expects most changes to indications to be outside a PCCP."
    },
    {
      title: "A different reference standard",
      text: "During retraining, echocardiograms are not available for many patients, so the team labels them using cardiologists’ ECG reads instead of measured ejection fraction. The protocol specified echo as the reference standard.",
      ans: "new",
      why: "The modification was planned, but not implemented in conformance with the protocol. FDA’s ventilator example covers exactly this: switching reference standard is a deviation, and the update could significantly affect safety or effectiveness, so it needs a new submission. In evidence terms, a weaker reference standard also changes what ‘accuracy’ means (Lecture 2.15)."
    },
    {
      title: "Cybersecurity patch",
      text: "A vulnerability is found in the cloud service that hosts the model. Engineers patch the server software. The model, inputs, outputs and performance are untouched.",
      ans: "qms",
      why: "Not every change needs a PCCP. FDA’s software-change guidance treats changes made solely to strengthen cybersecurity, with no effect on performance, as generally not needing a new 510(k). They are verified and documented under the quality system. (This is the simplified rule; real cases are judged against the device-modification guidances.)"
    }
  ];

  V.register("pccp-sandbox", function (root) {
    var order = SCEN.map(function (s, i) { return i; });
    var cur = 0, score = 0, answered = {};

    var card = el("div", { class: "widget-readout", style: "margin-bottom:0.8rem" }, root);
    el("div", { class: "widget-readout-label", text: "The device: AI software that flags probable low ejection fraction from a resting 12-lead ECG in adults, to prompt an echocardiogram. Cleared by 510(k) with a PCCP covering (1) retraining on new data from the intended-use population, with pre-specified non-inferiority margins for sensitivity and a target for specificity, and (2) compatibility with additional ECG carts that meet stated acquisition specifications." }, card);

    var head = el("div", { style: "display:flex;justify-content:space-between;align-items:baseline;gap:0.6rem;margin:0.2rem 0 0.4rem" }, root);
    var htitle = el("strong", null, head);
    var hscore = el("span", { class: "widget-note", style: "margin:0" }, head);
    var body = el("p", { style: "margin:0 0 0.8rem" }, root);
    var opts = el("div", { style: "display:flex;flex-direction:column;gap:0.45rem" }, root);
    var fb = el("div", { style: "margin-top:0.8rem" }, root);
    var nav = el("div", { style: "display:flex;gap:0.6rem;margin-top:0.8rem;flex-wrap:wrap" }, root);
    V.button(nav, "← Previous", function () { cur = (cur + SCEN.length - 1) % SCEN.length; render(); });
    V.button(nav, "Next scenario →", function () { cur = (cur + 1) % SCEN.length; render(); });
    el("p", { class: "widget-note", text: "Educational simplification of FDA’s final PCCP guidance for AI-enabled device software functions (issued December 2024, reissued August 2025) and its Appendix B examples. Real decisions depend on the specific plan, the device’s risk and FDA feedback through the Q-Submission programme." }, root);

    function render() {
      var s = SCEN[order[cur]];
      htitle.textContent = "Scenario " + (cur + 1) + " of " + SCEN.length + " · " + s.title;
      hscore.textContent = "Score: " + score + " / " + Object.keys(answered).length;
      body.textContent = s.text;
      clear(opts); clear(fb);
      OPTS.forEach(function (o) {
        var b = el("button", { type: "button", class: "widget-button", style: "text-align:left;border-radius:10px;width:100%", text: o.label }, opts);
        b.addEventListener("click", function () { choose(o.v); });
      });
      if (answered[cur] !== undefined) show(answered[cur]);
    }
    function choose(v) {
      var s = SCEN[order[cur]];
      if (answered[cur] === undefined) { answered[cur] = v; if (v === s.ans) score++; }
      render();
    }
    function show(v) {
      var s = SCEN[order[cur]], ok = v === s.ans;
      var right = OPTS.filter(function (o) { return o.v === s.ans; })[0].label;
      var box = el("div", { class: "widget-readout " + (ok ? "good" : "bad") }, fb);
      el("div", { class: "widget-readout-value", text: ok ? "Right" : "Not quite" }, box);
      el("div", { class: "widget-readout-label", style: "font-size:0.9rem", text: (ok ? "" : "Best answer: " + right + ". ") + s.why }, box);
    }
    render();
  });

  // ---------------------------------------------------------------------------
  // EU MDR Rule 11 walkthrough
  V.register("rule11", function (root) {
    var state = { fn: "decide", sev: "serious", vital: "no", ai: "yes" };
    var ctr = el("div", { style: "display:flex;flex-direction:column;gap:0.75rem;margin:0.4rem 0 1rem;font-size:0.88rem" }, root);
    function group(label) {
      var g = el("div", { style: "display:flex;flex-direction:column;gap:0.35rem" }, ctr);
      if (label) el("div", { class: "widget-slider-label", text: label }, g);
      return g;
    }
    V.toggle(group("1. What is the software intended to do?"), { options: [{ value: "decide", label: "Inform diagnosis or treatment" }, { value: "monitor", label: "Monitor physiology" }, { value: "other", label: "Something else" }], value: state.fn, onChange: function (v) { state.fn = v; draw(); } });
    var q2 = group(null);
    V.toggle(group("3. Does it use AI (machine learning or similar)?"), { options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], value: state.ai, onChange: function (v) { state.ai = v; draw(); } });

    var out = V.readouts(root, [
      { key: "cls", label: "MDR class under Rule 11" },
      { key: "nb", label: "Notified body needed?" },
      { key: "aia", label: "High-risk under the EU AI Act?" },
      { key: "when", label: "AI Act high-risk duties apply from" }
    ]);
    var why = el("p", { class: "widget-note" }, root);
    el("p", { class: "widget-note", text: "Simplified. Real classification also depends on the full intended purpose, MDCG 2019-11 (revised June 2025) and other MDR rules. A December 2025 Commission proposal would rewrite Rule 11 to default most software to class I; as of late 2026 it is not law. AI Act date as amended by Regulation (EU) 2026/1744." }, root);

    function draw() {
      clear(q2);
      if (state.fn === "decide") {
        el("div", { class: "widget-slider-label", text: "2. Worst realistic impact of a decision made with its output" }, q2);
        V.toggle(q2, { options: [{ value: "death", label: "Death or irreversible" }, { value: "serious", label: "Serious harm or surgery" }, { value: "other", label: "Less serious" }], value: state.sev, onChange: function (v) { state.sev = v; draw(); } });
      } else if (state.fn === "monitor") {
        el("div", { class: "widget-slider-label", text: "2. Vital parameters whose changes could mean immediate danger?" }, q2);
        V.toggle(q2, { options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], value: state.vital, onChange: function (v) { state.vital = v; draw(); } });
      } else {
        el("div", { class: "widget-slider-label", text: "2. (No further question: Rule 11’s last line applies.)" }, q2);
      }
      var cls, text;
      if (state.fn === "decide") {
        cls = state.sev === "death" ? "III" : state.sev === "serious" ? "IIb" : "IIa";
        text = "Rule 11, first paragraph: software that provides information used to take diagnostic or therapeutic decisions is class IIa, rising to IIb if those decisions could cause serious deterioration or surgery, and to III if they could cause death or irreversible deterioration.";
      } else if (state.fn === "monitor") {
        cls = state.vital === "yes" ? "IIb" : "IIa";
        text = "Rule 11, second paragraph: software that monitors physiological processes is class IIa, or IIb when it monitors vital parameters whose variations could result in immediate danger to the patient.";
      } else {
        cls = "I";
        text = "Rule 11, last line: all other software is class I. Note that software that is not a medical device at all is outside the MDR entirely.";
      }
      var nb = cls !== "I";
      var high = nb && state.ai === "yes";
      out.cls("Class " + cls);
      out.nb(nb ? "Yes" : "No (self-declared)");
      out.aia(state.ai === "no" ? "Not an AI system" : high ? "Yes" : "No");
      out.when(high ? "2 Aug 2028" : "—");
      why.textContent = text + (state.ai === "yes" ? (high ? " Because a notified body must assess it under the MDR, an AI device in this class is high-risk under Article 6(1) of the AI Act, and a single notified-body conformity assessment covers both laws." : " A class I AI device needs no notified body, so Article 6(1) of the AI Act does not make it high-risk.") : "");
    }
    draw();
  });
})();
