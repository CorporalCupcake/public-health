// Renders LaTeX in lecture pages with the vendored KaTeX (works offline).
// Inline: \( ... \)   Display: \[ ... \]  (also $$ ... $$)
document.addEventListener("DOMContentLoaded", function () {
  if (typeof renderMathInElement !== "function") return;
  renderMathInElement(document.body, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false }
    ],
    throwOnError: false
  });
});
