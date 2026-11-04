#!/usr/bin/env node
// Layer 1: static scan with no dependency and no browser.
// Usage: node lint.mjs <folder> [--json] [--config path/.anti-slop.json]
// Output: findings sorted by severity; exit code 2 if a blocker remains.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, extname, resolve, sep, dirname } from "node:path";

const args = process.argv.slice(2);
if (args.includes("--help")) { console.log("Usage: node lint.mjs <folder> [--json] [--config path/.anti-slop.json]"); process.exit(0); }
const root = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
const asJson = args.includes("--json");
const cfgIdx = args.indexOf("--config");
// Without --config: .anti-slop.json from the scanned folder or a parent (scanning src/ finds the one at the project root).
const findUp = (name, dir) => { for (let d = dir; ; d = dirname(d)) { if (existsSync(join(d, name))) return join(d, name); if (d === dirname(d) || existsSync(join(d, ".git"))) return null; } };
const cfgPath = cfgIdx >= 0 ? resolve(args[cfgIdx + 1]) : findUp(".anti-slop.json", root) ?? join(root, ".anti-slop.json");
const projectRoot = existsSync(cfgPath) ? dirname(cfgPath) : root;
const config = existsSync(cfgPath) ? JSON.parse(readFileSync(cfgPath, "utf8")) : {};
const locale = config.locale ?? "en-US";
const allow = config.allow ?? [];

const EXT = new Set([".html", ".htm", ".jsx", ".tsx", ".js", ".ts", ".mjs", ".vue", ".svelte", ".astro", ".css", ".scss"]);
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", "out", "coverage", ".turbo", ".vercel", "output", "vendor", "__fixtures__", "__mocks__", "__tests__"]);
const ignorePaths = config.ignorePaths ?? [];

// Rules: catalogue id (references/catalogue.md), severity, pattern, short message.
const B = "blocker", W = "warning", S = "suggestion";
const R = (id, sev, re, msg, opts = {}) => ({ id, sev, re, msg, ...opts });
const RULES = [
  R("UI-01", W, /\b(?:from|via|to)-(?:purple|violet|indigo|fuchsia)-\d{2,3}\b|\bbg-indigo-\d{3}\b/g, "Tailwind default purple/indigo gradient or background"),
  R("UI-02", W, /\bbg-clip-text\b|background-clip:\s*text/g, "gradient heading (background-clip: text)"),
  R("UI-04", S, /\bblur-3xl\b|radial-gradient\(/g, "decorative blurred halo or radial gradient"),
  R("UI-06", S, /font-family:\s*["']?(?:Inter|Roboto|Geist|Open Sans|Arial)\b|\b(?:Inter|Geist|Roboto)\s*\(\s*\{/g, "default font (Inter, Roboto, Geist…)"),
  R("CONV-02", S, /Instrument Serif|Playfair Display|Fraunces|Space Grotesk|#F4F1EA|#D97757/gi, "dated attractor (2025-2026 anti-slop wave: editorial serif, cream, terracotta)"),
  R("UI-08", W, /\buppercase\b[^"'`\n]*\btracking-(?:wide|wider|widest|\[)|\btracking-(?:wider|widest|\[)[^"'`\n]*\buppercase\b|text-transform:\s*uppercase;[^}]*letter-spacing|letter-spacing:[^;]+;[^}]*text-transform:\s*uppercase/g, "'eyebrow' label in spaced uppercase"),
  // Added after a real-world audit (November 2026): these three patterns had slipped past the lint.
  R("UI-19", W, /\bborder-[lr]-(?:[2-8]\b|\[[2-8]px\])|\bw-\[[2-4]px\][^"'`\n]*\babsolute\b|\babsolute\b[^"'`\n]*\bw-\[[2-4]px\]|border-left:\s*[2-8]px/g, "colored stripe on one side (card or nav entry): reserve it for real alerts", { unlessLine: /blockquote|critique|alert|erreur/ }),
  R("UI-09", S, /\bfont-mono\b/g, "monospace font outside code (dates, statuses, labels): reserve it for code", { unlessLine: /<code|<pre|<kbd|[Tt]extarea|_code|>code|\[&_(?:pre|code)|slug|json|JSON|html|HTML|\/\$?\{|command|cmd|--font-mono|variable:|min-h-|resize-|overflow-(?:auto|y-auto)/ }),
  R("UI-05", S, /\b(?:bg|text|border|ring)-(?:green|emerald|red|rose|blue|sky|yellow|amber|orange|cyan|teal|zinc|slate|gray)-[1-9]00\b/g, "default Tailwind color (status, badge): take the design tokens instead"),
  R("UI-12", W, /\bmin-h-screen\b[^"'`\n]*\btext-center\b|\btext-center\b[^"'`\n]*\bmin-h-screen\b/g, "centered full-height hero"),
  R("UI-16", S, /\brounded-(?:2xl|3xl)\b|border-radius:\s*(?:1[6-9]|[2-4]\d)px/g, "uniform large radius (rounded-2xl/3xl)"),
  R("UI-17", S, /\bshadow-(?:lg|xl|2xl)\b|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.1\s*\)/g, "default soft shadow"),
  R("UI-18", S, /\bbackdrop-blur(?:-\w+)?\b|backdrop-filter:\s*blur/g, "decorative frosted glass (glassmorphism)"),
  R("UI-21", W, /[\u{1F300}-\u{1FAFF}\u2728\u26A1\u2B50]/gu, "emoji used as an icon or ornament", { textOnly: true }),
  R("UI-23", S, /\btransition-all\b|transition:\s*all\b/g, "transition-all (same effect everywhere, expensive)"),
  R("UI-24", S, /cubic-bezier\([^)]*\b(?:1\.[0-9]+|[2-9](?:\.\d+)?)\b[^)]*\)/g, "easing that bounces or overshoots"),
  R("UI-25", S, /→\s*<|\banimate-pulse\b/g, "'template chrome' (arrow → in CTAs, pulsing dot)"),
  R("COPY-01", W, /Build faster|Ship (?:faster|smarter)|Scale without limits|all-in-one platform|next[- ]generation|game[- ]chang|Unlock the power|Work smarter|Construisez plus vite|La plateforme tout-en-un/gi, "interchangeable tagline"),
  R("COPY-02", S, /\b(?:supercharge|unlock|empower|streamline|revolutioni[sz]e|seamless(?:ly)?|leverage|elevate|effortless(?:ly)?|boostez|révolutionnez|libérez|sans effort|en toute simplicité)\b/gi, "catalogue verb or adjective"),
  R("COPY-03", W, /Trusted by [\d,.]+|\b\d[\d,.]*[kKM]?\+?\s+(?:teams|users|customers|companies|clients|utilisateurs|entreprises|équipes)\b|99[.,]9+\s?%|\b10x\b/gi, "metric or social proof to verify (never invent a replacement)"),
  R("COPY-04", B, /lorem ipsum|John Doe|Jane Doe|Sarah Johnson|Michael Chen|\bAcme\b|\bGlobex\b|\[Your [^\]]+\]|@faker-js|\bfaker\.|picsum\.photos|placehold\.co|via\.placeholder|placekitten|Trending up this month|Visitors for the last 6 months|Acquisition needs attention|Eddie Lake|Jamik Tashpulatov|Evil Corp\.|m@example\.com|January - June 2024|github\.com\/shadcn\.png/gi, "placeholder content shipped (name, logo, image or filler text)"),
  R("COPY-05", W, />\s*(?:Submit|Learn More|Get Started|Click here|Read more|En savoir plus|Cliquez ici|Valider|Envoyer)\s*(?:→)?\s*</gi, "generic label: name the action and its result"),
  R("COPY-11", W, /[ÊE]tes[- ]vous (?:sûr|certain)|&Ecirc;tes-vous|Are you sure|Cette action est irr(?:é|&eacute;)versible|This action cannot be undone|>\s*(?:Confirmer|Confirm|OK)\s*</gi, "generic confirmation: question as title, the object apart, the real consequence, a button that names the action"),
  // Added after the 2026-11-04 research (templates, shadcn blocks, Vercel guides, Hallmark, Primer)
  R("COPY-12", B, /Create Next App|Generated by create next app|Vite \+ React(?: \+ TS)?|Lovable Generated Project|content=["']Lovable["']/g, "template metadata shipped (create-next-app, Vite or Lovable title or description)"),
  R("COPY-13", S, /toast(?:\.success)?\(\s*[`'"][^`'"]*(?:!\s*[`'"]|[\u2705\u{1F389}\u{1F680}]|avec succès|successfully)/giu, "celebration toast (exclamation mark, emoji, 'successfully'): stay silent on success if the effect is visible"),
  R("COPY-14", W, /\.toFixed\(\d\)\s*\}?\s*€|€\s*\$\{[^}]*\.toFixed\(|\.toLocaleString\(\s*\)|["']en-US["']|\bMM\/DD\/YYYY\b/g, "English or browser-dependent format in a French interface: Intl.NumberFormat('fr-FR'), Intl.DateTimeFormat('fr-FR')"),
  // Added on 2026-11-04 after a full app pass: writing shortcuts left on screen.
  R("COPY-15", S, /(?<![.\w$])[a-zà-ÿ]{3,}\([sx]\)(?=\s+[a-zà-ÿ«]|\s*<|\s*["'`]|\s*$)/gm, "plural written '(s)': agree with the number ('1 source', '4 sources')", { markupOnly: true }),
  R("COPY-15", S, /<li\b[^>]*>\s*[-–•*]\s/g, "bullet typed in a list item's text: the bullet comes from the list (list-disc), not from a dash", { markupOnly: true }),
  R("UX-29", B, /\/\/\s*(?:[Ss]imulat(?:e|ion)|[Mm]ock|[Ff]ake|[Ss]imule[rz]?)\b[^\n]*(?:API|appel|call|request|requête|save|envoi)/g, "simulated success: mocked call instead of a real request"),
  R("UX-29", B, /new Promise\(\s*\(?r(?:es(?:olve)?)?\)?\s*=>\s*setTimeout\(\s*r(?:es(?:olve)?)?\s*,\s*\d{3,}/g, "artificial delay on a screen that announces success: check that a real request is sent", { markupOnly: true, ifFile: /toast\.success|setSuccess|onSubmit|handleSubmit/ }),
  R("UX-30", W, /<CommandShortcut>\s*⌘\s*[PSFZB]\s*<\/CommandShortcut>/g, "Command demo shortcut displayed (⌘P, ⌘S…): show only wired shortcuts, and not the browser's"),
  R("UXI-05", W, /onClick=\{\s*\(\)\s*=>\s*router\.push\(|<tr\b[^>]*\bonClick=/g, "JS navigation (router.push on click, <tr onClick>): a real link allows Ctrl/Cmd+click and middle click", { markupOnly: true }),
  R("UI-26", W, /<select\b/g, "native <select> although the project has its own Select component: use the app's component", { markupOnly: true, onlyIfProjectHas: /components\/ui\/select\.tsx$/ }),
  R("COPY-06", B, /Something went wrong|\bOops\b|Invalid input|[Uu]ne erreur (?:est survenue|s'est produite)|[Ee]rreur inconnue/g, "generic error message: say what to do"),
  R("UX-06", W, /href=\{?["']#["']\}?|onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}|onClick=\{\s*\(\)\s*=>\s*console\.log/g, "dead control (href=\"#\", empty handler)"),
  R("UX-13", B, /onPaste=|onpaste=|addEventListener\(\s*["']paste["']/g, "paste potentially blocked"),
  R("A11Y-02", B, /<img\b(?![^>]*\balt=)[^>]*>|\balt=["'](?:image|photo|picture|logo|img|icon)["']/gi, "image without alt, or meaningless alt", { markupOnly: true }),
  R("A11Y-05", B, /<html\b(?![^>]*\blang=)[^>]*>/gi, "document language missing", { markupOnly: true }),
  R("A11Y-06", B, /\b(?:focus:)?outline-none\b|outline:\s*(?:none|0)\b/g, "focus outline removed", { unlessLine: /focus-visible|focus:ring|focus-within/, unlessFile: /:focus-visible/ }),
  R("A11Y-07", B, /<(?:div|span|li|section)\b[^>]*\bon[cC]lick=/g, "non-interactive element made clickable (no keyboard)", { markupOnly: true }),
  R("A11Y-10", B, /\bgroup-hover:(?:opacity|visible|block|flex)\b|\bhover:opacity-100\b/g, "action visible only on hover", { unlessLine: /focus/ }),
  R("A11Y-12", B, /\banimate-marquee\b|<marquee\b|\bautoplay\b(?!\s*=\s*\{?\s*false)/gi, "content that scrolls by itself: provide a pause"),
  R("A11Y-14", B, /user-scalable\s*=\s*["']?no|maximum-scale\s*=\s*["']?1(?:\.0)?\b|userScalable:\s*false|maximumScale:\s*1\b/g, "zoom blocked"),
  R("DARK-01", W, /offer ends|ends soon|limited time|se termine bientôt|dernière chance|countdown|compte à rebours/gi, "urgency: check that the deadline is real"),
  R("DARK-02", B, /Only \d+ left|Plus que \d+|\d+ (?:people|personnes) (?:are )?(?:viewing|watching|regardent)|Math\.random\(\)[^;\n]*(?:stock|left|viewers|restant)/gi, "scarcity or crowd pressure potentially fake"),
  R("DARK-05", B, /No thanks, I(?: don't| do not)|Non merci, je (?:ne veux pas|n'aime pas|préfère)/gi, "confirmshaming"),
  R("DARK-06", B, /(?:defaultChecked|\bchecked)(?:=\{true\})?[^>]*(?:newsletter|consent|marketing|optin|opt-in)|(?:newsletter|consent|marketing|optin)[^>]*(?:defaultChecked|\bchecked\b)/gi, "consent or option pre-checked"),
];

function allowed(id, file, text) {
  return allow.some((a) =>
    (!a.rule || a.rule === id) &&
    (!a.path || file.includes(a.path)) &&
    (!a.value || text.toLowerCase().includes(String(a.value).toLowerCase())));
}

function hue(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return -1;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (ignorePaths.some((ip) => relative(root, p).startsWith(ip))) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(extname(name)) && st.size < 512_000 && !/\.(?:test|spec)\.|\.min\./.test(name)) out.push(p);
  }
  return out;
}

const findings = [];
const add = (f) => { if (!allowed(f.id, f.file, f.match ?? "")) findings.push(f); };
const files = walk(root);
let hasReducedMotion = false, hasMotion = false;
// Rules that only make sense if the project has its own component (UI-26: a custom Select).
const projectHas = (re) => files.some((f) => re.test(f.split(sep).join("/")));

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(root, file);
  const lines = src.split("\n");
  if (/prefers-reduced-motion|useReducedMotion|motion-reduce:|motion-safe:/.test(src)) hasReducedMotion = true;
  if (/@keyframes|\banimate-|transition|framer-motion|motion\/react|gsap/.test(src)) hasMotion = true;
  const isCode = /\.(?:jsx?|tsx?|mjs)$/.test(file);
  const isMarkup = /\.(?:html?|jsx|tsx|vue|svelte|astro)$/.test(file);
  lines.forEach((line, i) => {
    const prev = lines[i - 1] ?? "";
    for (const r of RULES) {
      if (r.markupOnly && !isMarkup) continue;
      if (r.onlyIfProjectHas && !(r._has ??= projectHas(r.onlyIfProjectHas))) continue;
      if (r.unlessFile?.test(src)) continue;
      if (r.ifFile && !r.ifFile.test(src)) continue;
      if (r.unlessLine?.test(line)) continue;
      if (r.textOnly && isCode && /^\s*(?:\/\/|\*|import )/.test(line)) continue;
      r.re.lastIndex = 0;
      const m = r.re.exec(line);
      if (!m) continue;
      if (new RegExp(`anti-slop-ignore[^\\n]*${r.id}`).test(line + prev)) continue;
      add({ id: r.id, sev: r.sev, file: rel, line: i + 1, match: m[0].slice(0, 80), msg: r.msg });
    }
    const ignored = (id) => new RegExp(`anti-slop-ignore[^\\n]*${id}`).test(line + prev);
    // UI-31: one-off Tailwind values off the 4 px grid (mt-[13px], h-[31px]); 1-2 px nudges and hairlines stay.
    if (!ignored("UI-31"))
      for (const m of line.matchAll(/(?<![\w-])-?(?:[mp][trblxyse]?|gap(?:-[xy])?|space-[xy]|h|min-h|max-h|top|right|bottom|left|inset(?:-[xy])?|translate-[xy]|scroll-[mp][trblxy]?)-\[(\d+(?:\.\d+)?)px\]/g))
        if (+m[1] > 2 && +m[1] % 4) { add({ id: "UI-31", sev: S, file: rel, line: i + 1, match: m[0], msg: "one-off value off the 4 px grid: use a step of the scale" }); break; }
    // COPY-16: copy that shouts, in text between tags and in string literals. Class strings ("flex!", the Tailwind v4
    // important modifier) and toasts (COPY-13) are left out. French puts a (non-breaking) space before "!".
    if (!/toast/.test(line) && !(isCode && /^\s*(?:\/\/|\*|import )/.test(line)) && !ignored("COPY-16")) {
      const greet = line.match(/\b(?:Welcome back|Bon retour|Bienvenue|Content de vous revoir|Ravi de vous revoir|Hello|Bonjour|Salut|Hi|Hey)\b[^"'`<>{}]{0,40}(?:!|\u{1F44B})/u);
      const tag = line.match(/>([^<>{}]*[\p{L}\p{N})][   ]?!+)[   ]*</u);
      // A class string: most of its words are utilities (a hyphen, colon, slash or bracket after a letter), or one lowercase word with "!".
      const classy = (s) => { const w = s.trim().split(/\s+/); return w.filter((t) => /[a-z0-9\]][-:\/[]|^[a-z]+!$/.test(t)).length >= Math.max(1, w.length / 2); };
      const lit = [...line.matchAll(/(["'`])((?:(?!\1)[^\\\n])*?[\p{L}\p{N})}][   ]?!+)[   ]*\1/gu)].find((m) => !classy(m[2]));
      const hit = greet ?? tag ?? lit;
      if (hit) add({ id: "COPY-16", sev: S, file: rel, line: i + 1, match: hit[0].slice(0, 80), msg: greet ? "greeting as the title (\"Welcome back!\"): use the page or the period as the title" : "exclamation mark in interface copy: state it plainly" });
    }
    // UI-01 in raw CSS: linear gradient with a purple hex color (hue 250-300°).
    for (const g of line.match(/linear-gradient\([^)]*\)/g) ?? [])
      if ((g.match(/#[0-9a-f]{6}\b/gi) ?? []).some((h) => { const d = hue(h); return d >= 250 && d <= 300; }))
        add({ id: "UI-01", sev: W, file: rel, line: i + 1, match: g.slice(0, 80), msg: "purple/indigo gradient" });
    // A11Y-05: lang="en" on a French project.
    if (locale.startsWith("fr") && /<html\b[^>]*\blang=["']en/i.test(line))
      add({ id: "A11Y-05", sev: B, file: rel, line: i + 1, match: line.trim().slice(0, 80), msg: "lang=\"en\" although the project is in French" });
  });
  // COPY-09: em dashes in bursts (a sign of AI writing), threshold per file.
  const dashes = (src.match(/ — /g) ?? []).length;
  if (dashes >= 5) add({ id: "COPY-09", sev: S, file: rel, line: 0, match: `${dashes} × " — "`, msg: "em dashes in series" });
  // UX-03: request without error handling in the same file.
  if (isCode && /\bfetch\(|\baxios\.|\buseQuery\(/.test(src) && !/\.catch\(|catch\s*\(|catch\s*\{|onError|isError|error\b/.test(src))
    add({ id: "UX-03", sev: B, file: rel, line: 0, match: "fetch without catch", msg: "request without visible error handling: silent failure likely" });
}

// Project-level findings.
if (hasMotion && !hasReducedMotion)
  add({ id: "A11Y-11", sev: W, file: "(project)", line: 0, match: "", msg: "animations without any prefers-reduced-motion branch" });
const designDocs = ["DESIGN.md", "design.md", "BRAND.md", "MARQUE.md", "CHARTE.md", "docs/DESIGN.md", "docs/design.md"];
const designDoc = config.designDoc ?? designDocs.find((d) => existsSync(join(projectRoot, d)));
if (!designDoc)
  add({ id: "CONV-03", sev: W, file: "(project)", line: 0, match: "", msg: "no written design decision (DESIGN.md or equivalent)" });

const order = { [B]: 0, [W]: 1, [S]: 2 };
findings.sort((a, b) => order[a.sev] - order[b.sev] || a.id.localeCompare(b.id) || a.file.localeCompare(b.file) || a.line - b.line);

if (asJson) {
  console.log(JSON.stringify({ root, config: existsSync(cfgPath) ? cfgPath : null, designDoc: designDoc ?? null, files: files.length, findings }, null, 2));
} else {
  const count = (s) => new Set(findings.filter((f) => f.sev === s).map((f) => `${f.id} ${f.file}`)).size;
  console.log(`# ai-anti-slop static scan: ${relative(process.cwd(), root) || "."}`);
  console.log(`${files.length} files · ${count(B)} blockers · ${count(W)} warnings · ${count(S)} suggestions (one line per rule and per file)`);
  console.log(`Config: ${existsSync(cfgPath) ? cfgPath : "none (.anti-slop.json missing)"} · Design doc: ${designDoc ?? "none"}\n`);
  for (const sev of [B, W, S]) {
    const group = findings.filter((f) => f.sev === sev);
    if (!group.length) continue;
    console.log(`## ${sev[0].toUpperCase() + sev.slice(1)}s (${count(sev)})`);
    const byKey = new Map();
    for (const f of group) {
      const k = `${f.id} ${f.file}`;
      if (!byKey.has(k)) byKey.set(k, { ...f, lines: [] });
      if (f.line) byKey.get(k).lines.push(f.line);
    }
    for (const f of byKey.values()) {
      const ls = f.lines.length > 6 ? `${f.lines.slice(0, 6).join(",")}… (${f.lines.length}×)` : f.lines.join(",");
      console.log(`- ${f.id} ${f.file}${ls ? `:${ls}` : ""} — ${f.msg}${f.match ? ` · \`${f.match}\`` : ""}`);
    }
    console.log("");
  }
}
process.exit(findings.some((f) => f.sev === B) ? 2 : 0);
