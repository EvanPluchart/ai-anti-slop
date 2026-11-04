#!/usr/bin/env node
// Layers 2 and 3: real rendering in a SINGLE headless Chrome (CDP, no npm dependency).
// Usage: node inspect.mjs <url> [--out folder] [--widths 1280,375] [--mobile] [--fail-api pattern] [--no-axe] [--wait ms] [--click selector]… [--eval expression]
//   --fail-api "*/api/*"  answers 500 to matching requests (shows the error state, UX-02/UX-03)
// Writes <out>/report.json and one screenshot per width; closes Chrome and deletes its profile at the end.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve, dirname } from "node:path";

const args = process.argv.slice(2);
const USAGE = "Usage: node inspect.mjs <url> [--out folder] [--widths 1280,375] [--mobile] [--fail-api pattern] [--no-axe] [--wait ms] [--click selector]… [--config .anti-slop.json]\n" +
  "  --eval    JavaScript expression evaluated in the page after the measurements, result printed (to debug a probe)\n" +
  "  --click   clicks the element before the measurements (repeatable, in order): opens a menu, modal or popover\n" +
  "  --mobile  touch emulation without hover (hover: none, pointer: coarse), 320, 390 and 768 px then 844×390 in landscape, MOB-* measurements (mobile-ux skill)";
if (args.includes("--help")) { console.log(USAGE); process.exit(0); }
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const url = args.find((a) => /^(https?|file):/.test(a));
if (!url) { console.error(USAGE); process.exit(1); }
const out = resolve(opt("--out", "anti-slop-out"));
const mobileMode = args.includes("--mobile");
const widths = opt("--widths", mobileMode ? "320,390,768" : "1280,375").split(",").map(Number);
// Mobile mode: each width in portrait, then a phone in landscape.
const runs = widths.map((w) => ({ width: w, height: w < 500 ? 812 : w < 1024 ? 1024 : 900, mobile: mobileMode || w < 500, landscape: false, reference: false }));
if (mobileMode && !args.includes("--no-landscape")) runs.push({ width: 844, height: 390, mobile: true, landscape: true, reference: false });
// Desktop reference: what exists at 1280 px must exist on a phone (WCAG 1.4.10, F102).
if (mobileMode) runs.unshift({ width: 1280, height: 900, mobile: false, landscape: false, reference: true });
const failApi = opt("--fail-api", null);
const waitMs = Number(opt("--wait", "1500"));
// Open states (drawer, modal, popover): their defects are not visible on the page at rest.
const clicks = args.flatMap((a, i) => (a === "--click" && args[i + 1] ? [args[i + 1]] : []));
// Check a hypothesis on the rendered DOM (element size, neighbors) without opening another browser.
const evalExpr = opt("--eval", null);
const AXE_VERSION = "4.10.2";
const cfgPath = resolve(opt("--config", ".anti-slop.json"));
// Exceptions limited to a file path (`path`) only apply to lint.mjs: applied to the render,
// an exception with no rule and no value would accept every finding on the page.
const allow = (existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")).allow ?? [] : []).filter((a) => !a.path && (a.rule || a.value));
const allowed = (x) => allow.some((a) => (!a.rule || a.rule === x.id) &&
  (!a.value || `${x.msg} ${x.el ?? ""} ${x.text ?? ""}`.toLowerCase().includes(String(a.value).toLowerCase())));

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const p of ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"])
    if (existsSync(p)) return p;
  for (const bin of ["google-chrome", "chromium", "chromium-browser"])
    try { return execFileSync("which", [bin]).toString().trim(); } catch {}
  throw new Error("Chrome not found: set CHROME_PATH");
}

async function loadAxe() {
  if (args.includes("--no-axe")) return null;
  for (let d = process.cwd(); d !== dirname(d); d = dirname(d)) {
    const p = join(d, "node_modules/axe-core/axe.min.js");
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  const cache = join(homedir(), ".cache/ai-anti-slop", `axe-${AXE_VERSION}.min.js`);
  if (!existsSync(cache)) {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/axe-core@${AXE_VERSION}/axe.min.js`);
    if (!res.ok) return null;
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(cache, await res.text());
  }
  return readFileSync(cache, "utf8");
}

// Probe run inside the page: inventory of computed styles and DOM checks.
const PROBE = String.raw`(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    // checkVisibility: also rules out the content of a closed <details> and content-visibility: hidden subtrees.
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0 && (el.checkVisibility?.() ?? true); };
  const all = [...document.querySelectorAll("body *")].filter(vis);
  // Visually hidden (sr-only, skip link, hidden field of a Select): excluded from size and outline measurements.
  const srOnly = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return (r.width <= 2 && r.height <= 2) || s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)" || !!el.closest("[aria-hidden=true]"); };
  const tally = (arr) => Object.entries(arr.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]);
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
  const txt = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
  const f = []; const push = (id, sev, msg, el, extra) => f.push({ id, sev, msg, el: el ? sel(el) : null, ...extra });
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const t = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e);
    if (s.backgroundImage !== "none") return null; const c = parse(s.backgroundColor); if (c && c.a > 0.95) return c; } return { r: 255, g: 255, b: 255 }; };
  const hueOf = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };

  // Inventories (CONV-05, UI-06, UI-16, UI-17)
  const textEls = all.filter((el) => txt(el).length > 1);
  const fonts = tally(textEls.map((el) => getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim()));
  const radii = tally(all.map((el) => getComputedStyle(el).borderRadius).filter((r) => r !== "0px"));
  const shadows = tally(all.map((el) => getComputedStyle(el).boxShadow).filter((s) => s !== "none"));
  const colors = tally(textEls.map((el) => getComputedStyle(el).color));
  const bgs = tally(all.map((el) => getComputedStyle(el).backgroundColor).filter((c) => !/rgba\(0, 0, 0, 0\)|transparent/.test(c)));
  const sizes = tally(textEls.map((el) => getComputedStyle(el).fontSize));
  if (fonts.length === 1) push("UI-10", "suggestion", "a single font family for all text: " + fonts[0][0]);
  if (/^(Inter|Roboto|Geist|Arial|Helvetica|system-ui|-apple-system|Open Sans)$/i.test(fonts[0]?.[0] || "")) push("UI-06", "suggestion", "default dominant font: " + fonts[0][0]);
  if (radii[0] && radii[0][1] >= 6 && parseFloat(radii[0][0]) >= 16 && radii.length <= 2) push("UI-16", "suggestion", "same large radius everywhere: " + radii[0][0] + " ×" + radii[0][1]);
  if (shadows[0] && shadows[0][1] >= 3) push("UI-17", "suggestion", "same shadow repeated ×" + shadows[0][1] + " : " + shadows[0][0].slice(0, 60));
  if (fonts.length > 3) push("CONV-05", "suggestion", fonts.length + " font families");
  if (colors.length + bgs.length > 24) push("CONV-05", "suggestion", (colors.length + bgs.length) + " distinct colors (text + backgrounds)");

  // Purple gradients and gradient headings (UI-01, UI-02)
  for (const el of all) { const s = getComputedStyle(el);
    if (s.backgroundImage.includes("gradient")) {
      const cs = (s.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
      if (cs.some((c) => { const h = hueOf(c); return h >= 250 && h <= 300; })) push("UI-01", "warning", "purple/indigo gradient", el);
    }
    if ((s.webkitBackgroundClip || s.backgroundClip) === "text") { push("UI-02", "warning", "gradient text", el); push("A11Y-01", "blocker", "contrast cannot be measured (gradient text): check on the screenshot", el); }
  }

  // Contrast (A11Y-01), fallback when axe-core is unavailable
  for (const el of textEls) { const s = getComputedStyle(el), fg = parse(s.color), bg = bgOf(el); if (!fg || !bg) continue;
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(s.fontSize), large = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) push("A11Y-01", "blocker", "contrast " + ratio.toFixed(2) + ":1 (" + s.color + " on rgb(" + bg.r + "," + bg.g + "," + bg.b + "))", el, { text: txt(el).slice(0, 40) }); }

  // Interactive elements (A11Y-04, A11Y-07, A11Y-09)
  const inter = all.filter((el) => el.matches("a[href],button,input,select,textarea,[role=button],[role=link],[tabindex]"));
  const targets = [];
  for (const el of inter) { const r = el.getBoundingClientRect();
    const name = (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || el.value || [...el.querySelectorAll("img[alt]")].map((i) => i.alt).join("") || "").trim();
    if (el.matches("a,button,[role=button]") && !name && !el.getAttribute("aria-labelledby")) push("A11Y-04", "blocker", "link or button without an accessible name", el);
    // Link inside a sentence (the 'inline' exception of 2.5.8): text outside the link in the same block.
    const inline = el.tagName === "A" && el.parentElement && /^(P|LI|SPAN|TD|DD|BLOCKQUOTE)$/.test(el.parentElement.tagName) && txt(el.parentElement).length > txt(el).length + 1;
    // A checkbox inside its <label> is also checked by tapping the label: the target is the label.
    const lab = el.matches("input") && (el.closest("label") || (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')));
    if (!inline && !srOnly(el) && r.width > 0) targets.push({ el, r: lab ? lab.getBoundingClientRect() : r }); }
  // A11Y-09 (WCAG 2.5.8): under 24 px, unless a 24 px circle centered on the target touches
  // no other target nor the circle of another small target (spacing exception).
  const tiny = (t) => t.r.width < 24 || t.r.height < 24;
  const center = (r) => [r.left + r.width / 2, r.top + r.height / 2];
  const distToRect = ([x, y], r) => Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
  for (const t of targets.filter(tiny)) { const c = center(t.r);
    const crowded = targets.some((o) => o !== t && !o.el.contains(t.el) && !t.el.contains(o.el) &&
      (distToRect(c, o.r) < 12 || (tiny(o) && Math.hypot(c[0] - center(o.r)[0], c[1] - center(o.r)[1]) < 24)));
    if (crowded) push("A11Y-09", "blocker", "target of " + Math.round(t.r.width) + "×" + Math.round(t.r.height) + " px (< 24) too close to another", t.el); }
  for (const el of all) { if ((el.hasAttribute("onclick") || getComputedStyle(el).cursor === "pointer") && !el.closest("a,button,label,input,select,summary,[role],[tabindex]") && txt(el))
    push("A11Y-07", "blocker", "clickable element that cannot take focus (cursor:pointer without a role)", el, { text: txt(el).slice(0, 40) }); }

  // Images and fields (A11Y-02, A11Y-03)
  for (const img of document.querySelectorAll("img")) { const a = img.getAttribute("alt");
    if (a === null) push("A11Y-02", "blocker", "image without an alt attribute: " + (img.currentSrc || img.src).slice(0, 60), img);
    else if (/^(image|photo|picture|logo|img|icon)$/i.test(a.trim())) push("A11Y-02", "blocker", "meaningless alt: " + a, img); }
  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea")) {
    if (srOnly(el)) continue;
    const labelled = el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    if (!labelled) push("A11Y-03", "blocker", "field without a label" + (el.placeholder ? " (placeholder only: " + el.placeholder + ")" : ""), el); }
  // Fields: readable outline (A11Y-16, WCAG 1.4.11) and a font of at least 16 px on mobile (A11Y-17, iOS zoom)
  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]),select,textarea,[data-slot=select-trigger]")) {
    if (!vis(el) || srOnly(el)) continue; const s = getComputedStyle(el), fill = parse(s.backgroundColor), page = bgOf(el.parentElement), edge = parse(s.borderTopColor);
    const ratioOf = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
    const fillVisible = fill && fill.a > 0.95 && page && ratioOf(fill, page) >= 3;
    const borderRatio = edge && edge.a > 0.5 && parseFloat(s.borderTopWidth) > 0 && page ? ratioOf(edge, fill && fill.a > 0.95 ? fill : page) : 0;
    // The outline may be carried by the field's frame (prefix, search icon): the parent is checked too.
    const frame = el.parentElement, fs2 = frame ? getComputedStyle(frame) : null, fedge = fs2 ? parse(fs2.borderTopColor) : null;
    const frameRatio = fedge && fedge.a > 0.5 && parseFloat(fs2.borderTopWidth) > 0 ? ratioOf(fedge, bgOf(frame.parentElement) || { r: 255, g: 255, b: 255 }) : 0;
    if (!fillVisible && borderRatio < 3 && frameRatio < 3) push("A11Y-16", "warning", "field outline at " + borderRatio.toFixed(2) + ":1 (3:1 expected, WCAG 1.4.11)", el);
    // On a touch device at any width: an iPhone in landscape exceeds 768 px and falls under md:text-sm.
    if ((Math.min(innerWidth, screen.width) < 500 || matchMedia("(pointer: coarse)").matches) && el.matches("input,textarea,select") && parseFloat(s.fontSize) < 16) push("A11Y-17", "warning", "field font at " + s.fontSize + " on a touch device: iOS zooms on focus (16 px at least; text-base pointer-fine:text-sm rather than md:text-sm)", el); }

  // Document (A11Y-05, A11Y-14, A11Y-15, UX-20)
  const lang = document.documentElement.lang;
  if (!lang) push("A11Y-05", "blocker", "lang attribute missing on <html>");
  const vp = document.querySelector("meta[name=viewport]")?.content || "";
  if (!vp) push("UX-20", "warning", "no meta viewport");
  if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(vp)) push("A11Y-14", "blocker", "zoom blocked: " + vp);
  const h1 = document.querySelectorAll("h1").length; if (h1 !== 1) push("A11Y-15", "warning", h1 + " h1 headings");
  if (!document.querySelector("main,[role=main]")) push("A11Y-15", "warning", "no <main>");

  if (!vp && screen.width < 500) push("UX-20", "blocker", "without a meta viewport, mobile shows the page at 980 px wide");
  // UX-20: the page scrolls horizontally (WCAG 1.4.10). Measured against the emulated screen: a page that overflows is
  // zoomed out and innerWidth follows the content. A table in its own scrolling container is not a defect.
  const SW = Math.min(innerWidth, screen.width), over = document.documentElement.scrollWidth - SW;
  if (over > 1) {
    const clipped = (el) => { for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) if (getComputedStyle(e).overflowX !== "visible") return true; return false; };
    const fixedUp = (el) => { for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).position === "fixed") return true; return false; };
    const wide = all.filter((el) => el.getBoundingClientRect().right > SW + 1 && !clipped(el) && !fixedUp(el));
    const culprits = wide.filter((el) => !wide.some((o) => o !== el && el.contains(o))).sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right).slice(0, 3);
    if (culprits.length) push("UX-20", "blocker", "the page scrolls horizontally by " + over + " px (" + culprits.map(sel).join(", ") + ")", culprits[0]);
  }
  // UX-31: double scroll. A large panel already scrolls and the window scrolls too, because an absolutely positioned
  // element (sr-only text, tooltip) uses the page as its containing block instead of the panel, which is not position: relative.
  const overY = document.documentElement.scrollHeight - innerHeight;
  if (overY > 1) {
    const panels = all.filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1 && el.getBoundingClientRect().height >= innerHeight * 0.5);
    for (const panel of panels) {
      const out = all.filter((el) => panel.contains(el) && getComputedStyle(el).position === "absolute" && !panel.contains(el.offsetParent) && el.getBoundingClientRect().bottom > innerHeight + 1);
      if (out.length) { push("UX-31", "warning", "the window scrolls " + overY + " px under a panel that already scrolls: " + out.length + " absolutely positioned element(s) escape the panel (add position: relative to the panel)", out[0]); break; }
    }
  }

  // Visual signs and rendered text (UI-08, UI-11, UI-12, UI-21, COPY-04)
  const eyebrows = textEls.filter((el) => { const s = getComputedStyle(el); return s.textTransform === "uppercase" && parseFloat(s.letterSpacing) >= 1 && parseFloat(s.fontSize) <= 14; });
  if (eyebrows.length) push("UI-08", "warning", eyebrows.length + " letter-spaced uppercase label(s)", eyebrows[0]);
  for (const el of all) { const kids = [...el.children].filter(vis);
    if (kids.length === 3 && kids.every((k) => k.tagName === kids[0].tagName && k.className === kids[0].className && k.querySelector("h2,h3,h4")))
      push("UI-11", "warning", "three identical blocks (icon/title/text?)", el); }
  const hero = document.querySelector("h1")?.closest("section,header,div");
  if (hero) { const r = hero.getBoundingClientRect(); if (getComputedStyle(document.querySelector("h1")).textAlign === "center" && r.height >= innerHeight * 0.6) push("UI-12", "warning", "centered hero of " + Math.round(r.height) + " px", hero); }
  const body = document.body.innerText;
  const emoji = body.match(/[\u{1F300}-\u{1FAFF}✨⚡⭐]/gu); if (emoji) push("UI-21", "warning", emoji.length + " emoji in the rendered text: " + [...new Set(emoji)].join(" "));
  // Raw values, case-sensitive and whole-word: 'nan' sits inside the French word 'maintenant', 'undefined' sits inside nothing.
  const fake = [...(body.match(/lorem ipsum|John Doe|Jane Doe|Sarah Johnson|Michael Chen|\bAcme\b|\bGlobex\b/gi) || []), ...(body.match(/\bundefined\b|\bNaN\b|\[object Object\]/g) || [])];
  if (fake.length) push("COPY-04", "blocker", "placeholder content or raw value shown: " + [...new Set(fake)].join(", "));
  const imgs = [...document.querySelectorAll("img")].filter((i) => /picsum|placehold|placekitten|unsplash\.it/.test(i.src)); if (imgs.length) push("COPY-04", "blocker", imgs.length + " filler image(s)");

  // Application screens (ui-ux-improver skill)
  const here = location.pathname.replace(/\/$/, "") || "/";
  const navHere = [...document.querySelectorAll("nav a[href], aside a[href]")].filter((a) => vis(a) && (new URL(a.href, location.href).pathname.replace(/\/$/, "") || "/") === here);
  if (navHere.length && !navHere.some((a) => a.getAttribute("aria-current"))) push("UXI-02", "warning", "the current page is not marked in the navigation (aria-current=\"page\" missing)", navHere[0]);
  const rootBg = parse(getComputedStyle(document.body).backgroundColor) || parse(getComputedStyle(document.documentElement).backgroundColor);
  if (rootBg && rootBg.a > 0.5 && lum(rootBg) < 0.1 && !/dark/.test(getComputedStyle(document.documentElement).colorScheme)) push("UI-27", "warning", "dark theme without color-scheme: dark (scrollbars and native controls stay light)");
  const restDisabled = [...document.querySelectorAll("button[type=submit][disabled], form button:not([type])[disabled]")].filter(vis);
  if (restDisabled.length) push("UXI-18", "suggestion", restDisabled.length + " submit button(s) disabled on load: keep enabled, show errors on submit (unless the design doc says otherwise)", restDisabled[0], { text: (restDisabled[0].innerText || "").slice(0, 40) });
  // A running text block (not a list row in a grid or flex), whose own text is long.
  const longLines = [...document.querySelectorAll("p, li")].filter((el) => { if (!vis(el) || txt(el).length < 120) return false; const st = getComputedStyle(el), fs = parseFloat(st.fontSize), lh = parseFloat(st.lineHeight) || fs * 1.5;
    if (!/^(block|list-item)$/.test(st.display)) return false;
    return el.getBoundingClientRect().height >= lh * 2 && st.whiteSpace !== "nowrap" && el.getBoundingClientRect().width / (fs * 0.5) > 95; });
  if (longLines.length) push("UXI-31", "suggestion", longLines.length + " paragraph(s) over ~95 characters per line: aim for a reading column of about 70 ch", longLines[0]);
  // Lines of the text alone (an icon next to the text is not a second line), within 4 px.
  const lines = (el) => { const tops = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(n);
      for (const x of r.getClientRects()) if (x.width > 1 && !tops.some((t) => Math.abs(t - x.top) < 4)) tops.push(x.top); }
    return tops.length; };
  // Desktop only: on a phone, a long help label that wraps is normal.
  const wrapped = Math.min(innerWidth, screen.width) < 1024 ? [] : [...document.querySelectorAll("button, [role=tab], nav a, aside a")].filter((el) => { if (!vis(el) || srOnly(el)) return false; const t = (el.innerText || "").trim();
    return t.length > 3 && t.length < 40 && !t.includes("\n") && lines(el) > 1; });
  if (wrapped.length) push("UXI-92", "suggestion", wrapped.length + " button, tab or navigation label(s) that wrap onto a second line", wrapped[0], { text: (wrapped[0].innerText || "").slice(0, 40) });

  // Motion (A11Y-11)
  let rm = false; try { for (const ss of document.styleSheets) for (const r of ss.cssRules || []) if (String(r.conditionText || r.media?.mediaText || "").includes("prefers-reduced-motion")) rm = true; } catch {}
  return { title: document.title, lang, viewport: [innerWidth, innerHeight], inventory: { fonts, sizes: sizes.slice(0, 10), radii, shadows: shadows.slice(0, 5), textColors: colors.slice(0, 10), backgrounds: bgs.slice(0, 10) }, reducedMotionCss: rm, findings: f };
})()`;

// Phone-specific measurements (mobile-ux skill, rule IDs from its rules reference).
const PROBE_MOBILE = String.raw`(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    // checkVisibility: also rules out the content of a closed <details> and content-visibility: hidden subtrees.
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0 && (el.checkVisibility?.() ?? true); };
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
  const f = []; const push = (id, sev, msg, el, extra) => f.push({ id, sev, msg, el: el ? sel(el) : null, ...extra });
  // A page that overflows is zoomed out and innerWidth follows the content: we measure against the emulated screen.
  const W = Math.min(innerWidth, screen.width), H = Math.min(innerHeight, screen.height);
  const all = [...document.querySelectorAll("body *")].filter(vis);
  const INTER = "a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=combobox],[role=menuitem]";
  const fixedUp = (el) => { for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).position === "fixed") return true; return false; };
  const srOnly = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return (r.width <= 2 && r.height <= 2) || s.clip === "rect(0px, 0px, 0px, 0px)" || s.clipPath === "inset(50%)" || !!el.closest("[aria-hidden=true]"); };

  // Inventory of the <main> labels (compared with the 1280 px reference: MOB-13)
  const main = document.querySelector("main") || document.body;
  const inventory = [...new Set([...main.querySelectorAll("a[href],button,[role=button],[role=tab],th,dt,h1,h2,h3,label")]
    .filter((el) => el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : vis(el))
    .map((el) => (el.getAttribute("aria-label") || el.innerText || "").trim().replace(/\s+/g, " ").toLowerCase()).filter((t) => t && t.length < 60))];

  // MOB-04 and MOB-05: fixed or sticky bars
  // Fixed elements sit in the real window, which follows the zoom-out: we measure against it.
  const IW = innerWidth, IH = innerHeight;
  const fixed = all.filter((el) => { const p = getComputedStyle(el).position; return p === "fixed" || p === "sticky"; })
    .filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < IH && r.width * r.height > 400; })
    // Open modal (--click): it and its backdrop cover the page by definition; we measure the shell behind it.
    .filter((el) => { const r = el.getBoundingClientRect(), M = '[aria-modal="true"], [role="dialog"], [role="alertdialog"], dialog[open]';
      return !el.closest(M) && !el.querySelector(M) && !(r.width >= IW * 0.9 && r.height >= IH * 0.9); });
  const outer = fixed.filter((el) => !fixed.some((o) => o !== el && o.contains(el)));
  const fx = outer.filter((el) => getComputedStyle(el).position === "fixed");
  const inter = (a, b) => { const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect(); const w = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left), h = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top); return w > 4 && h > 4; };
  for (let i = 0; i < fx.length; i++) for (let j = i + 1; j < fx.length; j++) if (inter(fx[i], fx[j])) push("MOB-05", "warning", "two fixed elements overlap: " + sel(fx[i]) + " and " + sel(fx[j]), fx[i]);
  const band = (els) => els.reduce((n, el) => { const r = el.getBoundingClientRect(); return n + Math.max(0, Math.min(r.bottom, IH) - Math.max(r.top, 0)); }, 0);
  const full = (el) => el.getBoundingClientRect().width >= IW * 0.6;
  const chrome = band(outer.filter(full));
  if (chrome > 0 && (IH - chrome) / chrome <= 2) push("MOB-04", "warning", "fixed or sticky bars take " + Math.round(chrome) + " px out of " + Math.round(IH) + ": " + Math.round(IH - chrome) + " px of content left", outer.filter(full)[0]);

  // MOB-01: 100vh (the mobile address bar cuts off the bottom; dvh for the shell, svh if everything must fit)
  const vh = new Set();
  // A style rule now has its own cssRules (CSS nesting): keep the rule and its children.
  const walk = (rules) => [...rules].flatMap((r) => [r, ...(r.cssRules ? walk(r.cssRules) : [])]);
  let rules = []; try { for (const ss of document.styleSheets) try { rules.push(...walk(ss.cssRules)); } catch {} } catch {}
  // Only the rules that apply to the page: Tailwind also generates the classes seen in the repository docs.
  const used = (sel) => { try { return !!sel && !!document.querySelector(sel); } catch { return true; } };
  for (const r of rules) if (r.style && used(r.selectorText)) for (const prop of ["height", "min-height", "max-height"]) if (/(^|[^dsl])100vh/.test(r.style.getPropertyValue(prop))) vh.add(r.selectorText);
  if (vh.size) push("MOB-01", "suggestion", "100vh in " + vh.size + " CSS rule(s) (" + [...vh].slice(0, 3).join(", ") + "): 100dvh for the shell, 100svh if everything must fit");

  // MOB-02: viewport-fit=cover without safe areas
  const vp = document.querySelector("meta[name=viewport]")?.content || "";
  const safe = rules.some((r) => r.cssText && r.cssText.includes("safe-area-inset"));
  if (/viewport-fit\s*=\s*cover/.test(vp) && !safe && fx.length) push("MOB-02", "warning", "viewport-fit=cover without env(safe-area-inset-*): the notch or home bar covers the fixed elements", fx[0]);

  // A11Y-19: information only in a title (invisible to touch)
  // A title that repeats the accessible name (icon button) adds nothing: only what it alone says counts.
  const titled = all.filter((el) => { const t = (el.getAttribute("title") || "").trim();
    return t && t !== (el.innerText || "").trim() && t !== (el.getAttribute("aria-label") || "").trim() && !el.matches("iframe,abbr"); });
  if (titled.length) push("A11Y-19", "warning", titled.length + " element(s) whose information lives only in a title attribute, invisible to touch (e.g. '" + titled[0].getAttribute("title").slice(0, 50) + "')", titled[0]);

  // MOB-18: text too small for a phone
  const tiny = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1) && parseFloat(getComputedStyle(el).fontSize) < 12);
  if (tiny.length) push("MOB-18", "suggestion", tiny.length + " text(s) under 12 px (smallest: " + Math.min(...tiny.map((el) => parseFloat(getComputedStyle(el).fontSize))) + " px)", tiny[0], { text: (tiny[0].innerText || "").slice(0, 30) });

  // A11Y-20, MOB-06, MOB-07: touch targets (size, gap, corners), excluding links inside a sentence
  const inline = (el) => el.tagName === "A" && [...el.parentElement.childNodes].some((n) => n !== el && n.nodeType === 3 && n.textContent.trim());
  const T = all.filter((el) => el.matches(INTER) && !inline(el) && !srOnly(el)).map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el }, i, arr) => !arr.some((o) => o.el !== el && o.el.contains(el) && o.el.matches(INTER)));
  const small = T.filter(({ r }) => Math.min(r.width, r.height) < 44);
  if (small.length) { const worst = small.sort((a, b) => Math.min(a.r.width, a.r.height) - Math.min(b.r.width, b.r.height))[0];
    push("A11Y-20", "suggestion", small.length + " touch target(s) under 44 px (smallest: " + Math.round(Math.min(worst.r.width, worst.r.height)) + " px)", worst.el); }
  const gap = (a, b) => Math.max(a.left - b.right, b.left - a.right, a.top - b.bottom, b.top - a.bottom);
  let tight = 0, tightEl = null;
  for (let i = 0; i < small.length; i++) for (let j = i + 1; j < small.length; j++) { const g = gap(small[i].r, small[j].r); if (g >= 0 && g < 8) { tight++; tightEl = tightEl || small[i].el; } }
  if (tight) push("MOB-06", "warning", tight + " pair(s) of small targets less than 8 px apart: the neighbor gets tapped", tightEl);
  const corner = small.filter(({ r }) => Math.min(r.left, W - r.right) < 48 && Math.min(r.top, H - r.bottom) < 48 && r.top < H);
  if (corner.length) push("MOB-07", "suggestion", corner.length + " small target(s) in a screen corner, where the finger is least precise", corner[0].el);

  // MOB-08: action present but invisible to touch (revealed on hover)
  const ghost = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (+s.opacity < 0.1 || s.visibility === "hidden") return true; } return false; };
  // In the content and the header (a gauge or header menu on hover counts too).
  const hidden = [...document.querySelectorAll(["main", "header"].flatMap((z) => INTER.split(",").map((q) => z + " " + q)).join(", "))].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && ghost(el); });
  if (hidden.length) push("MOB-08", "warning", hidden.length + " action(s) present but invisible to touch (revealed on hover?)", hidden[0]);

  // MOB-25: 3 to 5 sections hidden behind a menu
  const navLinks = [...document.querySelectorAll("nav a[href], aside a[href]")];
  const burger = [...document.querySelectorAll("header button[aria-expanded], header button[aria-haspopup]")].find(vis);
  if (burger && navLinks.length >= 3 && navLinks.length <= 5 && navLinks.filter(vis).length <= 1) push("MOB-25", "suggestion", navLinks.length + " sections behind a menu: a bottom bar with 3 to 5 destinations would show them", burger);

  // MOB-34, MOB-35, MOB-36, MOB-37: iOS fields and meta tags
  const fields = [...document.querySelectorAll("input,textarea")];
  const key = (e) => ((e.name || "") + " " + (e.id || "") + " " + (e.labels?.[0]?.innerText || "") + " " + (e.placeholder || "")).toLowerCase();
  const numAsCode = fields.filter((e) => e.type === "number" && ["code", "postal", "siret", "iban", "carte", "tél", "phone"].some((w) => key(e).includes(w)));
  if (numAsCode.length) push("MOB-34", "warning", numAsCode.length + " type=number field(s) used for a code: type=text inputmode=numeric", numAsCode[0]);
  const tech = fields.filter((e) => (e.type === "text" || e.tagName === "TEXTAREA") && ["slug", "identifiant", "username", "hashtag", "url", "lien", "code"].some((w) => key(e).includes(w)) && !e.hasAttribute("autocapitalize"));
  if (tech.length) push("MOB-35", "suggestion", tech.length + " technical field(s) (slug, link, code) without autocapitalize=\"none\": automatic capitalization and correction on mobile", tech[0]);
  const capture = document.querySelectorAll("input[type=file][capture]");
  if (capture.length) push("MOB-36", "suggestion", capture.length + " file field(s) with capture: the camera opens straight away", capture[0]);
  if (!document.querySelector("meta[name=format-detection]") && /\d{2}[ .]\d{2}[ .]\d{2}|\d{4}-\d{2}-\d{2}/.test(document.body.innerText)) push("MOB-37", "suggestion", "no meta format-detection: Safari iOS may turn numbers and dates into links");

  // MOB-14: text cut off when spacing is increased (WCAG 1.4.12)
  const textEls = all.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));
  // Text truncated inside a link that leads to the full content is not a loss (WCAG 1.4.12 allows it).
  const cut = () => new Set(textEls.filter((el) => { if (el.closest("a[href]")) return false; const s = getComputedStyle(el); return [s.overflowX, s.overflowY].some((v) => v === "hidden" || v === "clip") && Math.max(el.scrollHeight - el.clientHeight, el.scrollWidth - el.clientWidth) > 1; }));
  const before = cut(); const st = document.createElement("style");
  st.textContent = "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}";
  document.head.append(st); const after = [...cut()].filter((el) => !before.has(el)); st.remove();
  if (after.length) push("MOB-14", "warning", after.length + " text(s) cut off when line and letter spacing is increased (fixed height, truncate, line-clamp without access to the full text)", after[0], { text: (after[0].innerText || "").slice(0, 30) });

  const media = { hoverNone: matchMedia("(hover: none)").matches, pointerCoarse: matchMedia("(pointer: coarse)").matches, maxTouchPoints: navigator.maxTouchPoints, viewport: vp };
  return { findings: f, media, inventory };
})()`;

async function main() {
  const axe = await loadAxe();
  for (const d of readdirSync(tmpdir())) if (d.startsWith("ai-anti-slop-")) {
    const p = join(tmpdir(), d); if (Date.now() - statSync(p).mtimeMs > 3600_000) rmSync(p, { recursive: true, force: true }); }
  const profile = mkdtempSync(join(tmpdir(), "ai-anti-slop-"));
  const chrome = spawn(findChrome(), ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio", "--disable-extensions", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const exited = new Promise((r) => chrome.on("exit", r));
  const cleanup = async () => {
    try { chrome.kill("SIGKILL"); } catch {}
    await Promise.race([exited, new Promise((r) => setTimeout(r, 3000))]);
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  };
  process.on("SIGINT", async () => { await cleanup(); process.exit(130); });
  try {
    const port = await new Promise((ok, ko) => {
      let buf = ""; const t = setTimeout(() => ko(new Error("Chrome is not responding")), 15000);
      chrome.stderr.on("data", (d) => { buf += d; const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) { clearTimeout(t); ok(m[1]); } });
    });
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((ok) => ws.addEventListener("open", ok, { once: true }));
    let seq = 0; const pending = new Map(); const listeners = [];
    ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const { ok, ko } = pending.get(m.id); pending.delete(m.id); m.error ? ko(new Error(m.error.message)) : ok(m.result); }
      else listeners.forEach((l) => l(m)); });
    const send = (method, params = {}) => new Promise((ok, ko) => { const id = ++seq; pending.set(id, { ok, ko }); ws.send(JSON.stringify({ id, method, params })); });
    const once = (method, ms = 20000) => new Promise((ok) => { const t = setTimeout(ok, ms); listeners.push(function l(m) { if (m.method === method) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); ok(m.params); } }); });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const evaluate = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
    // Page errors (UX-27): a React crash or a failed hydration is not visible on a screenshot.
    let pageErrors = [];
    listeners.push((m) => {
      if (m.method === "Runtime.exceptionThrown") pageErrors.push({ kind: "exception", text: (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").split("\n")[0].slice(0, 200) });
      else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
        // React 19 writes its render errors to console.error("%o\n\n%s…", error, …): the message without the template.
        const parts = m.params.args.map((a) => String(a.value ?? a.description ?? "")).filter((t) => !/^%[osdif]/.test(t));
        pageErrors.push({ kind: "console", text: parts.join(" · ").split("\n").filter(Boolean).slice(0, 2).join(" ").slice(0, 300) });
      }
      else if (m.method === "Network.responseReceived" && m.params.response.status >= 400 && !failApi)
        // Missing images grouped: often a thumbnail with a fallback, but every 404 costs a request.
        pageErrors.push(m.params.type === "Image" ? { kind: "images with status " + m.params.response.status, text: "(grouped)", url: m.params.response.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 120) } : { kind: "http " + m.params.response.status, text: m.params.response.url.slice(0, 160) });
    });
    if (failApi) {
      await send("Fetch.enable", { patterns: [{ urlPattern: failApi }] });
      listeners.push((m) => { if (m.method === "Fetch.requestPaused")
        send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 500, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from('{"error":"simulated"}').toString("base64") }).catch(() => {}); });
    }
    mkdirSync(out, { recursive: true });
    const report = { url, date: new Date().toISOString(), failApi, clicks, axe: axe ? AXE_VERSION : null, runs: [] };
    let refInventory = null;
    for (const { width, height, mobile, landscape, reference } of runs) {
      // screenWidth/screenHeight: without them, the screen of a headless Chrome stays at 800×600 and screen.width lies.
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height,
        screenOrientation: landscape ? { type: "landscapePrimary", angle: 90 } : { type: "portraitPrimary", angle: 0 } });
      if (mobileMode) {
        // Touch emulation switches (hover: none) and (pointer: coarse); setEmulatedMedia cannot do that.
        await send("Emulation.setTouchEmulationEnabled", reference ? { enabled: false } : { enabled: true, maxTouchPoints: 5 });
      }
      pageErrors = [];
      const loaded = once("Page.loadEventFired"); await send("Page.navigate", { url }); await loaded; await sleep(waitMs);
      // Same clicks on the desktop reference: MOB-13 compares the same state (tab, modal) at both sizes.
      for (const sel of clicks) {
        const hit = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.scrollIntoView({ block: "center" }); el.click(); return true; })()`);
        if (!hit) pageErrors.push({ kind: "--click", text: "selector not found: " + sel });
        await sleep(Math.max(800, waitMs / 2)); // time for a lazy load (drawer, modal)
      }
      const run = { width, height, landscape, reference, ...(await evaluate(PROBE)) };
      if (evalExpr && !reference) run.eval = await evaluate(evalExpr).catch((e) => "error: " + e.message);
      if (mobileMode) {
        const m = await evaluate(PROBE_MOBILE);
        if (reference) { refInventory = m.inventory; run.findings = []; }
        else {
          run.findings.push(...m.findings); run.media = m.media;
          // MOB-13: labels present at 1280 px in <main>, missing here
          if (refInventory && width < 500) {
            const here = new Set(m.inventory); const gone = refInventory.filter((t) => !here.has(t));
            if (gone.length) run.findings.push({ id: "MOB-13", sev: "warning", msg: gone.length + " <main> label(s) present at 1280 px and missing here: " + gone.slice(0, 5).map((t) => "'" + t + "'").join(", ") + " (move, do not remove)", el: null });
          }
        }
      }
      const imgErr = pageErrors.filter((e) => e.text === "(grouped)"), imgMiss = imgErr.length;
      run.pageErrors = [...new Map(pageErrors.filter((e) => e.text !== "(grouped)").map((e) => [e.kind + e.text, e])).values()];
      if (imgMiss) run.pageErrors.push({ kind: "images", text: imgMiss + " image(s) with an HTTP error: only request the ones that exist (" + [...new Set(imgErr.map((e) => e.url))].slice(0, 2).join(", ") + ")" });
      run.findings = run.findings.filter((x) => !allowed(x));
      if (axe) {
        await evaluate(axe + ";0");
        const res = await evaluate(`axe.run(document, { runOnly: ["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa","best-practice"], resultTypes: ["violations"] }).then(r => r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => n.target.join(" ")), why: v.nodes.slice(0, 3).map(n => (n.failureSummary || "").split(String.fromCharCode(10)).slice(1).join(" ").slice(0, 200)), near: v.nodes.slice(0, 3).map(n => [...n.any, ...n.all, ...n.none].flatMap(c => (c.relatedNodes || []).map(r => r.target.join(" "))).slice(0, 3)) })))`);
        run.axe = res;
      }
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: await (async () => {
        const { cssContentSize: s } = await send("Page.getLayoutMetrics"); return { x: 0, y: 0, width, height: Math.min(s.height, 4000), scale: 1 }; })() });
      run.screenshot = join(out, `capture-${width}${landscape ? "-landscape" : ""}${failApi ? "-api-error" : ""}.png`);
      writeFileSync(run.screenshot, Buffer.from(shot.data, "base64"));
      report.runs.push(run);
      await sleep(1000); // one page, one screenshot, one pause
    }
    ws.close();
    writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
    // Readable summary
    console.log(`# ai-anti-slop inspection: ${url}${failApi ? ` (API failing: ${failApi})` : ""}${clicks.length ? ` (after click: ${clicks.join(" then ")})` : ""}`);
    for (const r of report.runs) {
      if (r.reference) { console.log(`\n## ${r.width} px — desktop reference (inventory of <main> for MOB-13)`); continue; }
      console.log(`\n## ${r.width} px${r.landscape ? ` × ${r.height} (landscape)` : ""}${r.media ? ` · touch ${r.media.pointerCoarse && r.media.hoverNone ? "emulated (hover: none, pointer: coarse)" : "NOT emulated: hover findings unreliable"}` : ""} — ${r.findings.length} probe findings${r.axe ? `, ${r.axe.length} axe rules failing` : ", axe unavailable"}`);
      console.log(`Fonts: ${r.inventory.fonts.map(([k, v]) => `${k} ×${v}`).join(", ") || "—"} · Radii: ${r.inventory.radii.slice(0, 4).map(([k, v]) => `${k} ×${v}`).join(", ") || "—"}`);
      const seen = new Map();
      for (const x of r.findings) { const k = x.id + x.msg.replace(/\d+(\.\d+)?/g, "#"); if (!seen.has(k)) seen.set(k, { ...x, n: 0 }); seen.get(k).n++; }
      const order = { blocker: 0, warning: 1, suggestion: 2 };
      for (const x of [...seen.values()].sort((a, b) => order[a.sev] - order[b.sev]))
        console.log(`- [${x.sev}] ${x.id} ${x.msg}${x.el ? ` · ${x.el}` : ""}${x.n > 1 ? ` (${x.n}×)` : ""}`);
      for (const e of r.pageErrors ?? []) console.log(`- [UX-27 ${e.kind}] ${e.text}`);
      if (r.eval !== undefined) console.log(`--eval: ${JSON.stringify(r.eval)}`);
      for (const v of r.axe ?? []) console.log(`- [axe ${v.impact}] ${v.id} — ${v.help} (${v.nodes} nodes) · ${v.targets[0] ?? ""}`);
      console.log(`Capture: ${r.screenshot}`);
    }
    console.log(`\nFull report: ${join(out, "report.json")}`);
  } finally { await cleanup(); }
}
main().catch((e) => { console.error("Error: " + e.message); process.exit(1); });
