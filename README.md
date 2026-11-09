# Public Health & Epidemiology

A self-study curriculum (about 119 weeks, 9 blocks) for a career in AI-enabled public health and epidemiology. The lectures are plain HTML and CSS, so they work in any browser, on a phone, and offline.

## Structure

```
Curriculum.md            the master plan (blocks, lectures, projects, rules)
index.html               study hub, generated from Curriculum.md by build.py
build.py                 rebuilds index.html (Python 3, standard library only)
lectures/
  _template.html         starting point for every lecture
  block-1/1-01-*.html    one file per lecture, named N-MM-slug.html
assets/
  css/style.css          shared styles (mobile, dark mode, print)
  js/math.js             maths rendering setup
  js/progress.js         mark-as-done (saved in the browser)
  js/viz.js              tiny chart/diagram kit for interactive widgets (no dependencies)
  js/widgets/N-MM.js     one file of interactive widgets per lecture
  vendor/katex/          KaTeX 0.16.22 (MIT), bundled so maths renders offline
```

## Studying

Open `index.html` in a browser. Each lecture has collapsible exercise answers, and **Print → Save as PDF** gives a clean copy with all answers expanded.

**Mark as done:** each lecture has a button at the bottom, and the index has a tick circle per lecture. Progress is saved in the browser (`localStorage`), so it is per device and per browser, and clearing site data resets it.

## Lecture style

- **Intuition first.** For each idea: what it is, why it matters, how to read a value (good, bad, typical), and what a change means.
- **Every idea gets its trap**, one concrete example, and an everyday analogy where it helps.
- **No derivations or proofs.** Each formula becomes one or two plain sentences. Keep at most one or two short formulas per lecture, and only ones used day to day.
- **Lead with the point.** Short sentences and plain words. Define jargon on first use. Use bullets or small tables for parallel items, and keep lists to the top 3.
- **Check-yourself questions** test meaning and judgement, not arithmetic. Calculation practice happens in the projects.

## Adding a lecture

1. Copy `lectures/_template.html` to `lectures/block-N/N-MM-short-slug.html`.
2. Write it. For maths, use `\( … \)` inline and `\[ … \]` for display equations.
3. For diagrams, use inline SVG in `<figure class="diagram">`. For an interactive, add `<div class="widget" data-widget="name">`, load `viz.js` and `widgets/N-MM.js` with `defer`, and register the widget with `Viz.register("name", fn)`. See lecture 1.11 for an example.
4. Run `python3 build.py` to link it from the index.
