// Lecture 5.11 — "Which pathway?" navigator. An educational simplification of US, EU and Saudi routes
// for drugs, biologics, devices and software, with the evidence usually expected and where RWE can feed in.
(function () {
  var V = Viz, el = V.el;

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function labelled(parent, label, opts, value, onChange) {
    var box = el("div", { style: "display:flex;flex-direction:column;gap:0.3rem" }, parent);
    el("span", { class: "widget-slider-label", style: "font-size:0.85rem", text: label }, box);
    var t = V.toggle(box, { options: opts, value: value, onChange: onChange });
    return { box: box, value: t.value };
  }

  V.register("pathway-navigator", function (root) {
    var ctr0 = V.controls(root);
    ctr0.style.marginBottom = "0.2rem";
    var cType = labelled(ctr0, "Product", [{ value: "drug", label: "Drug" }, { value: "bio", label: "Biologic" }, { value: "device", label: "Device" }, { value: "sw", label: "Software" }], "drug", draw);
    var ctr = V.controls(root);
    var cNov = labelled(ctr, "Novelty", [{ value: "new", label: "New" }, { value: "newuse", label: "New use" }, { value: "copy", label: "Copy" }], "new", draw);
    var cUnmet = labelled(ctr, "Serious condition, unmet need?", [{ value: "y", label: "Yes" }, { value: "n", label: "No" }], "n", draw);
    var cRare = labelled(ctr, "Rare disease?", [{ value: "y", label: "Yes" }, { value: "n", label: "No" }], "n", draw);
    var cRisk = labelled(ctr, "Device risk", [{ value: "low", label: "Low" }, { value: "mod", label: "Moderate" }, { value: "high", label: "High" }], "mod", draw);
    var cPred = labelled(ctr, "Similar device already on the US market?", [{ value: "y", label: "Yes" }, { value: "n", label: "No" }], "y", draw);
    var cRef = labelled(ctr, "Already approved by FDA / EU?", [{ value: 0, label: "Neither" }, { value: 1, label: "One" }, { value: 2, label: "Both" }], 0, draw);

    el("p", { class: "widget-note", text: "New = new active substance or new type of device. New use = new indication for an approved product. Copy = generic, biosimilar, or a device like one already marketed." }, root);

    var tableHost = el("div", { class: "table-wrap", style: "margin:0.9rem 0 0.4rem" }, root);
    var evid = el("div", { style: "font-family:var(--font-ui);font-size:0.92rem;line-height:1.5" }, root);
    el("p", { class: "widget-note", text: "An educational simplification, not regulatory advice. Real routes depend on details (claims, combination products, paediatric plans, national rules) and change over time; status as of late 2026." }, root);

    function draw() {
      var type = cType.value(), nov = cNov.value(), unmet = cUnmet.value() === "y", rare = cRare.value() === "y";
      var risk = cRisk.value(), pred = cPred.value() === "y", ref = cRef.value();
      var isDev = type === "device" || type === "sw";
      cRisk.box.style.display = isDev ? "" : "none";
      cPred.box.style.display = isDev ? "" : "none";

      var rows = [], evidence = [], rwe = [], hta;

      if (!isDev) {
        var bio = type === "bio";
        // United States
        var us = nov === "new" ? (bio ? "Biologics License Application (BLA)" : "New Drug Application (NDA)")
          : nov === "newuse" ? "Efficacy supplement to the existing " + (bio ? "BLA" : "NDA")
          : (bio ? "Biosimilar application (351(k) BLA)" : "Abbreviated NDA (generic)");
        var usX = [];
        if (unmet && nov !== "copy") usX.push("fast track; breakthrough therapy if early data show substantial improvement; priority review; accelerated approval on a surrogate endpoint, with a confirmatory trial");
        if (rare && nov !== "copy") usX.push("orphan designation (incentives, not a lower bar)");
        if (rare && unmet && nov === "new") usX.push("Rare Disease Evidence Principles if the population is very small");
        // European Union
        var eu = nov === "new" ? "Centralised procedure: CHMP opinion, then European Commission decision" + (bio || rare ? " (mandatory for biotech and orphan medicines)" : " (mandatory for cancer and several other areas; otherwise national routes are possible)")
          : nov === "newuse" ? "Type II variation to extend the indication"
          : (bio ? "Biosimilar application, centralised procedure" : "Generic application, central or national");
        var euX = [];
        if (unmet && nov !== "copy") euX.push("PRIME support; accelerated assessment (150 instead of 210 days); conditional marketing authorisation, renewed yearly");
        if (rare && nov !== "copy") euX.push("orphan designation (market exclusivity)");
        // Saudi Arabia
        var sa = nov === "copy" ? (bio ? "Biosimilar registration with comparability data" : "Generic registration with bioequivalence data")
          : nov === "newuse" ? "Variation to add the indication"
          : ref === 2 ? "Verification pathway: relies on existing FDA and EMA approvals"
          : ref === 1 ? "Abridged pathway: relies on one reference approval (FDA or EMA)"
          : "Full registration review";
        var saX = [];
        if (unmet && nov !== "copy") saX.push("Breakthrough Medicines Program; priority review; conditional approval");
        if (rare && nov !== "copy") saX.push("orphan drug designation under the SFDA rare-disease framework");
        rows = [["United States (FDA)", us, usX], ["European Union (EMA)", eu, euX], ["Saudi Arabia (SFDA)", sa, saX]];

        if (nov === "copy") evidence.push(bio ? "Analytical similarity to the reference biologic, with clinical data as needed to resolve residual uncertainty." : "Bioequivalence to the reference drug; no new efficacy trials.");
        else if (nov === "newuse") evidence.push("Trials in the new indication or population. In selected cases a well-designed RWE study has supported a new use (palbociclib in men, 2019; tacrolimus in lung transplant, 2021).");
        else evidence.push("Usually two adequate and well-controlled trials, or one plus confirmatory evidence, and a safety database across phases.");
        if (unmet && nov !== "copy") evidence.push("Accelerated or conditional routes accept an effect on a surrogate endpoint reasonably likely to predict benefit, with confirmatory trials required afterwards.");
        if (rare && nov !== "copy") evidence.push("Small or single-arm trials with external or natural history controls may be accepted when the effect is large and the course predictable (Lecture 5.10).");

        if (rare && nov !== "copy") rwe.push("External or natural history controls for single-arm trials (Lecture 5.10).");
        if (nov === "newuse") rwe.push("Label expansion from a target trial emulation on fit-for-purpose RWD (Lecture 5.9).");
        rwe.push("Post-marketing safety: spontaneous reports, Sentinel and DARWIN EU studies, ICH M14 safety studies (Lecture 5.12).");
        if (rwe.length < 3) rwe.push("Saudi transportability: local data on effect modifiers to carry a multi-regional trial result to Saudi patients (SFDA RWE framework, 2026).");
        if (rwe.length < 3) rwe.push("Trial design: event rates, eligibility and feasibility estimated from RWD.");
        hta = "Licence is not reimbursement. Next comes HTA: NICE appraises cost per QALY; EU joint clinical assessment covers new cancer medicines and ATMPs since January 2025 (orphan medicines from 2028); in Saudi Arabia, SFDA pricing asks for economic evaluation studies for innovative medicines.";
      } else {
        var sw = type === "sw";
        var usD, usDX = [];
        if (risk === "low") usD = "Class I: most are exempt from premarket review (general controls apply)";
        else if (risk === "high") usD = "Premarket approval (PMA), class III";
        else if (pred || nov === "copy") usD = "510(k): substantial equivalence to a predicate device";
        else usD = "De Novo request: a new low-to-moderate-risk device type";
        if (nov === "newuse" && risk !== "low") usD += "; a new indication usually needs a new submission or PMA supplement";
        if (unmet && risk !== "low") usDX.push("Breakthrough Devices Program (more interaction, priority review)");
        if (sw) usDX.push("for AI that will be updated: a predetermined change control plan (Lecture 5.14)");
        var euD = risk === "low" ? "Class I: manufacturer’s self-declaration (a notified body is needed if sterile or measuring)"
          : risk === "mod" ? "Class IIa or IIb: notified body conformity assessment, then CE mark"
          : "Class III: notified body assessment of the clinical evaluation, usually with a clinical investigation";
        var euDX = [];
        if (sw) euDX.push("MDR Rule 11 puts most diagnostic or treatment-decision software in class IIa or higher; the EU AI Act adds duties for AI (Lecture 5.14)");
        euDX.push("legacy devices may stay on the market under the extended MDR transition (to end 2027 or 2028, with conditions)");
        var saClass = risk === "low" ? "class A" : risk === "mod" ? "class B or C" : "class D";
        var saD = "Medical Device Marketing Authorization (MDMA), " + saClass;
        var saDX = [];
        if (ref >= 1) saDX.push("reliance route on an existing authorisation from a recognised regulator");
        rows = [["United States (FDA)", usD, usDX], ["European Union (MDR)", euD, euDX], ["Saudi Arabia (SFDA)", saD, saDX]];

        if (risk === "low") evidence.push("General controls: registration, labelling, a quality system. Little or no clinical data.");
        else if (risk === "high") evidence.push("Valid scientific evidence of safety and effectiveness, usually a pivotal clinical study.");
        else if (pred || nov === "copy") evidence.push("Comparison with the predicate: bench and performance testing, and clinical data only sometimes. For AI devices this is often a retrospective accuracy study (Project 5B).");
        else evidence.push("Reasonable assurance of safety and effectiveness for the new device type, with special controls; usually clinical performance data.");
        if (sw) evidence.push("For software: analytical and clinical validation on data the model has not seen, and a plan for performance monitoring after release.");

        rwe.push("Registries and EHR data for post-market surveillance and label expansion (FDA device RWE guidance, final December 2025).");
        if (sw) rwe.push("Real-world performance monitoring for drift and decay (Lecture 5.16).");
        rwe.push("Impact evidence after deployment: cluster or stepped-wedge trials, difference-in-differences on rollouts (Lecture 5.15).");
        hta = "Clearance is not adoption. Payers and HTA bodies ask whether the device improves outcomes or saves money; 510(k)-style accuracy evidence often cannot answer that.";
      }

      clear(tableHost);
      var t = el("table", null, tableHost);
      var hr = el("tr", null, el("thead", null, t));
      ["Regulator", "Likely route", "Expedited or special options"].forEach(function (h) { el("th", { text: h }, hr); });
      var tb = el("tbody", null, t);
      rows.forEach(function (r) {
        var tr = el("tr", null, tb);
        el("td", { html: "<strong>" + r[0] + "</strong>" }, tr);
        el("td", { text: r[1] }, tr);
        el("td", { text: r[2].length ? r[2].join("; ") : "standard review" }, tr);
      });

      clear(evid);
      el("p", { html: "<strong>Evidence typically expected.</strong> " + evidence.join(" ") , style: "margin:0.5rem 0" }, evid);
      var p = el("p", { html: "<strong>Where real-world evidence can feed in:</strong>", style: "margin:0.5rem 0 0.2rem" }, evid);
      var ul = el("ul", { style: "margin:0 0 0.5rem 1.2rem;padding:0" }, evid);
      rwe.slice(0, 3).forEach(function (x) { el("li", { text: x }, ul); });
      el("p", { html: "<strong>Then:</strong> " + hta, style: "margin:0.5rem 0" }, evid);
      p = null;
    }
    draw();
  });
})();
