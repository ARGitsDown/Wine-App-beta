#!/usr/bin/env node
// Turns LEARNING.md into a printable PDF.
//
//   npm run print:learning                 -> LEARNING.pdf, answers moved to
//                                             an answer key at the back
//   npm run print:learning -- --with-answers
//                                          -> answers left under each question
//   npm run print:learning -- --out some/where.pdf
//
// Why it isn't just "print the page from GitHub": the answers sit inside
// collapsed <details> blocks, which print collapsed - so a printout would
// have questions and no answers. And the point of the questions is to try
// them first, so by default the answers are pulled out of the text and
// gathered at the back, where they can't be read by accident.
//
// Uses `marked` for the Markdown and Playwright's Chromium for the PDF,
// both already devDependencies. LEARNING.pdf is gitignored: it is a
// build product, and goes stale the moment the Markdown changes.

import { readFile, writeFile } from "node:fs/promises";
import { marked } from "marked";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const withAnswers = args.includes("--with-answers");
const outIndex = args.indexOf("--out");
const out = outIndex >= 0 ? args[outIndex + 1] : "LEARNING.pdf";

let source = await readFile(new URL("../LEARNING.md", import.meta.url), "utf8");

// Walk the document, tracking the current "## " heading, so each pulled-out
// answer block can be filed under the section it belongs to.
const key = [];
let section = "Introduction";
const lines = source.split("\n");
const kept = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  const heading = line.match(/^##\s+(.*)$/);
  if (heading) section = heading[1].replace(/\*+/g, "").trim();

  if (/^<details>/.test(line)) {
    const block = [];
    // Collect up to the closing tag; the first line is "<details><summary>..</summary>".
    i++;
    while (i < lines.length && !/^<\/details>/.test(lines[i])) block.push(lines[i++]);
    i++; // the closing tag
    const body = block.join("\n").trim();
    if (withAnswers) {
      kept.push("", "**Answers**", "", body, "");
    } else {
      key.push({ section, body });
      kept.push("", `*Answers: see the answer key at the back, under "${section}".*`, "");
    }
    continue;
  }
  kept.push(line);
  i++;
}
source = kept.join("\n");

if (key.length) {
  source += "\n\n<div class=\"page-break\"></div>\n\n# Answer key\n\nTry every question first. Answers follow in the order the questions appeared.\n";
  for (const { section: title, body } of key) {
    source += `\n### ${title}\n\n${body}\n`;
  }
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>What I (should) have learned</title>
<style>
  @page { size: Letter; margin: 0.8in 0.75in; }
  html { font-size: 10.5pt; }
  body { font-family: Georgia, "Times New Roman", serif; line-height: 1.45; color: #111; }
  h1 { font-size: 22pt; margin: 0 0 0.4em; }
  h2 { font-size: 15pt; margin: 1.6em 0 0.4em; padding-bottom: 0.15em; border-bottom: 1.5px solid #444; break-before: page; }
  h2:first-of-type { break-before: auto; }
  h3 { font-size: 12pt; margin: 1.2em 0 0.3em; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: #111; text-decoration: underline; }
  code { font-family: Menlo, Consolas, monospace; font-size: 0.88em; background: #f1f1f1; padding: 0 0.25em; border-radius: 2px; }
  pre { background: #f6f6f6; border: 1px solid #ccc; padding: 0.6em 0.8em; white-space: pre-wrap; word-break: break-word; font-size: 8.6pt; line-height: 1.3; break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: inherit; }
  table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 9.2pt; }
  th, td { border: 1px solid #888; padding: 0.3em 0.5em; vertical-align: top; text-align: left; }
  th { background: #e9e9e9; }
  tr { break-inside: avoid; }
  blockquote { margin: 0.8em 0; padding: 0.1em 0.9em; border-left: 3px solid #888; color: #333; }
  hr { border: 0; border-top: 1px solid #aaa; margin: 1.4em 0; }
  .page-break { break-after: page; }
  em { font-style: italic; }
</style></head>
<body>${marked.parse(source, { gfm: true })}</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: out,
    format: "Letter",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="font-size:8px;width:100%;text-align:center;color:#555;font-family:Georgia,serif">What I (should) have learned &mdash; page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    margin: { top: "0.8in", bottom: "0.8in", left: "0.75in", right: "0.75in" },
  });
} finally {
  await browser.close();
}
console.log(`Wrote ${out}${withAnswers ? " (answers inline)" : ` (${key.length} answer blocks moved to the answer key)`}`);
