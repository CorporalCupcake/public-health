// "Mark as done" progress, stored in this browser's localStorage.
// Lecture pages get a toggle button above the pager; the index shows ticks and per-block progress.
(function () {
  var KEY = "ph-curriculum-done";

  function load() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY)) || []); }
    catch (e) { return new Set(); }
  }
  function save(set) {
    try { localStorage.setItem(KEY, JSON.stringify(Array.from(set).sort())); } catch (e) {}
  }
  function toggle(id) {
    var done = load();
    if (done.has(id)) done.delete(id); else done.add(id);
    save(done);
    return done.has(id);
  }

  // Lecture id from a filename like 1-07-comparative-risk-assessment.html → "1.7"
  function idFromPath(path) {
    var m = /(\d+)-(\d+)-[^/]*\.html$/.exec(path);
    return m ? parseInt(m[1], 10) + "." + parseInt(m[2], 10) : null;
  }

  function setButton(btn, isDone) {
    btn.classList.toggle("is-done", isDone);
    btn.setAttribute("aria-pressed", isDone ? "true" : "false");
    btn.innerHTML = isDone
      ? '<span class="done-icon">✓</span> Done <span class="done-undo">· tap to undo</span>'
      : '<span class="done-icon">○</span> Mark as done';
  }

  function initLecture() {
    var id = idFromPath(location.pathname);
    var pager = document.querySelector("nav.pager");
    if (!id || !pager) return;
    var wrap = document.createElement("div");
    wrap.className = "done-bar";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "done-button";
    setButton(btn, load().has(id));
    btn.addEventListener("click", function () { setButton(btn, toggle(id)); });
    wrap.appendChild(btn);
    pager.parentNode.insertBefore(wrap, pager);
  }

  function refreshIndex() {
    var done = load();
    var total = 0, totalDone = 0;
    document.querySelectorAll("details.block").forEach(function (block) {
      var items = block.querySelectorAll("li[data-id]");
      var nDone = 0;
      items.forEach(function (li) {
        var isDone = done.has(li.dataset.id);
        li.classList.toggle("is-done", isDone);
        var btn = li.querySelector(".done-toggle");
        if (btn) {
          btn.setAttribute("aria-pressed", isDone ? "true" : "false");
          btn.setAttribute("aria-label", (isDone ? "Mark not done: " : "Mark done: ") + li.dataset.id);
        }
        if (isDone) nDone++;
      });
      total += items.length; totalDone += nDone;
      var label = block.querySelector(".block-done");
      if (label) label.textContent = nDone ? " · " + nDone + " done" : "";
      var bar = block.querySelector(".progress-bar > span");
      if (bar) bar.style.width = (items.length ? Math.round(100 * nDone / items.length) : 0) + "%";
    });
    var overall = document.querySelector(".overall-done");
    if (overall) overall.textContent = totalDone + " of " + total + " done";
  }

  function initIndex() {
    if (!document.querySelector("details.block")) return;
    document.querySelectorAll(".done-toggle").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        toggle(btn.closest("li").dataset.id);
        refreshIndex();
      });
    });
    refreshIndex();
    // Keep in sync when returning to the index (back button / other tab).
    window.addEventListener("pageshow", refreshIndex);
    window.addEventListener("storage", function (e) { if (e.key === KEY) refreshIndex(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLecture();
    initIndex();
  });
})();
