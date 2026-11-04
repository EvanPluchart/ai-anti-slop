---
name: slop-check
description: Use when asked to audit, "unslop" or fix a web app or site that looks AI-made, generic, templated or vibe-coded (AI slop, design slop, UX slop), or to check an interface before shipping for design, copy, UX, accessibility and dark patterns. Also for French requests: « déslopper », « ça fait IA », « ça fait générique », « passe anti-slop », « vérifie l'interface avant la mise en ligne ». Sets a direction from the product, measures the code (static scan) and the real rendering (headless Chrome, axe-core), reports, and fixes only after approval. Covers Next.js, React, Vue, Svelte, Astro, Tailwind, shadcn and plain HTML/CSS. For a full pass of the whole app, use the audit skill; for screens that are empty, confusing or lying about their state, ui-ux-improver; for phones and tablets, mobile-ux.
---

# slop-check

Slop is an **absence of decision**: the tool's default value, left as it is. This skill measures it, reports it, and fixes it **only after approval**, without replacing it with another default.

Removing defaults is only half the job: a clean screen where nothing stands out is the next template. Each screen ends with one bright element and quiet chrome around it (UI-34).

The catalogue of 137 rules (`UI-`, `COPY-`, `VIS-`, `UX-`, `A11Y-`, `DARK-`, `CONV-`), with their sources, is in `references/catalogue.md`. Read only the section you need: `grep -n "UX-05" references/catalogue.md`.

## Steps

1. **Frame.** Find the project's style guide (DESIGN.md, BRAND.md, tokens, `tailwind.config`, `globals.css`) and the `.anti-slop.json` file (format in `references/toolkit.md`). Choices written in the style guide are decisions, not slop. If the written style guide and the code disagree ("dark-first" in the style guide, light theme only in `globals.css`), ask instead of deciding.
   - **Write the direction** before measuring, in four short lines:
     - *Product*: what it does and for whom, in one sentence.
     - *Character*: two or three concrete words (`calm, exact, a little warm`). Not clean, modern, sleek, minimal or premium, nor « épuré », « moderne », « sobre », « élégant »: they describe every template.
     - *Surface*: an app screen (worked in: dashboard, tool, back office) or a page (read and scrolled: landing, marketing). Some rules depend on it (UI-10), and so do the starting values.
     - *Bright element*: for each kind of screen, the one thing that carries the colour and the craft (the primary action, the selection, a key figure, a preview of the content). Everything else stays quiet.

     Two optional lines: a *signature*, one small detail only this product has, used everywhere; and on a page, the *world*, the place or material the product belongs to, which tints the neutrals and picks the visual (VIS-16). With a style guide, these lines come from it. Without one, take them from what the product does, never from what is trending, and propose them for DESIGN.md (CONV-03).
   - **Work on real data.** An empty or seeded database hides half the defects (status badges never seen, long titles, 80-row lists, overflowing columns). Before inspecting, copy real content read-only (production or staging, without token files) into the test data folder.
2. **Scan the code** (layer 1, no browser): `node ${CLAUDE_SKILL_DIR}/scripts/lint.mjs <src-folder>`. Add `--json` for script-friendly output. Exit code 2 means a blocker remains; it is not a crash.
3. **Inspect the rendering** (layers 2 and 3): `node ${CLAUDE_SKILL_DIR}/scripts/inspect.mjs <url> --out anti-slop/before`.
   - The script starts one headless Chrome, injects axe-core, measures at 1280 and 375 px, records the page's own errors (UX-27), then closes Chrome. The 375 px capture is not a phone simulation: for touch, use `--mobile` (mobile-ux skill).
   - Inspect **every** page in the navigation, not just three: structural defects (widths, left edge, headers) only show when pages are compared.
   - A page with tabs is measured tab by tab (`--click '[role="tab"]:nth-child(N)'`), and so are modals, drawers and popovers: a state that is never rendered is never audited.
   - To see the error state, rerun with `--fail-api` **targeted at the page's own API** (`"*/api/articles*"`). A global pattern also fails health or session routes, and the page redirects or crashes elsewhere, which hides its own error state.
   - `--help` lists the options.
4. **Look at the captures** (layer 4): one pass per page, with the checklist below. The vision model only ranks large gaps; it never decides between two close variants.
5. **Check what the scripts cannot see** by reading the code of the main flows:
   - empty, loading and error states (UX-01 to UX-03);
   - double submit (UX-04) and lost input (UX-05);
   - destructive actions (UX-08) and server-side validation (UX-12);
   - dark patterns (DARK-*).
6. **Triage, report, then STOP.** Read the findings honestly before planning anything:
   - *Heavy slop* (signs across colour, type, icons and copy): the full report and a visual pass.
   - *Light slop* (a designed screen with a few signs left): fix only the findings; keep the palette, type and layout; bigger ideas go to the suggestions.
   - *No slop*: say so plainly, give two or three refinements at most, with exact values, and stop. Never change a good screen just to make it different.

   Present the report (format below) and wait for the user to choose what gets fixed. Change nothing before their approval, even if they are in a hurry.
   - If the request already authorises fixes ("fix it directly"), fix the findings rated "blocker" and "warning" (as shown by the scripts), but not the "suggestions". Those, like the questions, wait for the user. If the user also authorises taste ("including suggestions", "carte blanche"), fix them too.
   - **The visual layer is part of the job.** Accessibility, state and flow fixes are real but invisible: a user who opens the app and sees no difference rightly concludes that no unslop happened. When the request is "unslop the app" and the triage is not "no slop", the visual pass (UI-*, CONV-*) is mandatory, and the report says what changed on screen.
7. **Fix** what was approved, in this order: accessibility and states, then copy, then visuals. Fix shared components at the root, then check that the fix breaks nothing elsewhere: a shared component is used by pages you have not looked at.
8. **Re-measure**: rerun lint and inspect with `--out anti-slop/after`, show before and after, and keep only the findings still open. Do not edit code while a measurement is running: hot reload skews the results. Stop after 3 rounds.
9. **Fill**: an app stripped of its ornaments with nothing in their place looks empty and soulless. Do not stop on a clean, hollow screen: continue with **ui-ux-improver** (see "The collection").

## Fixing rules

- **Never invent facts.** Missing figures, testimonials, customer logos, names and routes (COPY-03, COPY-04, DARK-01 to DARK-04) become **questions** for the user. Do not replace them with other invented values, and do not link to a route that does not exist.
- **Every new value comes from the style guide.** An added colour, font or radius must exist in the style guide. If it is missing, start from `references/starting-values.md` (spacing, rows, radius, type, motion: values that do not depend on a style) and propose it for DESIGN.md with its reason; never choose it silently.
- **Aim, do not only remove.** Each screen keeps one bright element with quiet chrome around it (UI-34). A clean screen where nothing stands out is not finished.
- **Do not swap in the next attractor.** Replacing Inter and purple with an italic serif, cream with terracotta, letter-spaced caps, monospace everywhere or a hairline "newspaper" layout is moving from 2025 slop to 2026 slop (CONV-02). Rerun the lint after fixing: it must stay clean.
- **Minimal diff, same stack.** On an existing file, make targeted edits; never overwrite the whole file. No framework migration, no new dependency without approval.
- **Check your own fixes for dark patterns.** LLMs add them unasked.

## The collection

Four skills sharing one toolkit (the scripts in this folder):

| Skill | Role | When |
|---|---|---|
| **slop-check** (this one) | Detect and remove the defaults of a generated design | "unslop it", "it looks AI-made", before shipping |
| **ui-ux-improver** | Make each screen useful, truthful and consistent with the others | empty or confusing screen, flows, forms, modals, lists, states |
| **mobile-ux** | Make the app usable with a finger, on phone and tablet | responsive, touch, virtual keyboard, safe areas |
| **audit** | Run the three in order, then one common re-measure | "the best app possible", "full quality pass" |

## Report

```
# Slop check: <project> (<date>)
Pages: … · Tools: lint, inspect (axe <version>), captures reviewed
## Direction     — product · character · surface · bright element (· signature) · triage: heavy, light or no slop
## The 3 changes that matter most
## Blockers      — ID · where (file:line or selector) · evidence · proposed fix
## Warnings      — same format
## Suggestions   — same format, grouped by ID
## Changed       — per file: the lines changed and the rule fixed (after fixing only)
## Questions for you — missing facts (COPY-03/04, DARK-*), brand exceptions to confirm
## Not verified  — what no layer could test
```

Taste rules (UI-*, CONV-*) are never blockers. A blocking rule backed by a single source (see the Evidence column of the catalogue) is asked as a question. Write the report in the user's language; rule IDs, selectors and code stay as they are.

## Checklist for the captures

For each capture, answer in one line per point. "Clearly worse than the style guide" is the bar for taste gaps; it must not let through a catalogue pattern you can see (point 6).
1. Do the focal point and the hierarchy read when you squint?
2. Swap the logo: could the page belong to any competitor?
3. Is there fake content, filler imagery or raw values (`undefined`, `NaN`) on screen?
4. At 375 px: any overflow, primary CTA off screen, or truncated text?
5. With `--fail-api`: is the error message useful, and does it offer an action?
6. Do you see a coloured band on one side (UI-19), a card inside a card (UI-14), letter-spaced caps (UI-08) or monospace outside code (UI-09)? The scripts miss some of them: look.
7. A raw native control next to the app's components (grey system `<select>`, native checkbox or date)? That is a default left in place (UI-26).
8. Does one element stand out, with the chrome quiet around it (UI-34)? Is the accent the style guide's exact colour, not a dull variant (UI-28)?
9. Same thing, same size: rows of a list, paddings of sibling cards, icons in one column, figures aligned (UI-32, UI-30)?
10. `New`/`Beta`/`PRO` badges, decorative charts, a change without its baseline (`+12%`), an image with a hard edge or a picture in every section (UI-35, UI-36, COPY-18, VIS-16)?

Consistency between screens, substance and truthful states: see the **ui-ux-improver** checklist.

## Configuration and machine

`.anti-slop.json` (brand exceptions with their reason, ignored paths, profiles), `anti-slop-ignore` comments, rules to spare the machine, and Next.js or shadcn pitfalls: `references/toolkit.md`. The essentials:
- reuse the running dev server;
- prefix long jobs with `nice -n 10`;
- one `inspect.mjs` at a time;
- no `ai-anti-slop` Chrome left open.

## Common mistakes

| Mistake | Do instead |
|---|---|
| Fixing directly because "it's urgent" | Report, then approval, then fixes |
| Replacing "Trusted by 10,000 teams" with another number | Remove it or ask for the real number |
| Choosing 5 new "tasteful" colours yourself | Use the style guide's, or ask |
| Rewriting the whole file to make it clean | Fix only the flagged lines |
| Flagging JetBrains Mono when the style guide mandates it | Read the style guide, add an `allow` exception |
| Declaring "fixed" without re-measuring | Rerun lint and inspect, then show before and after |
| Fixing only the invisible (a11y, states, flows) and saying "done" | Do the visual pass too; say what changed on screen |
| Allowing letter-spaced caps or monospace "because it's a system" | Fix them; a taste exception stays a question for the user |
| Stopping on a clean but empty screen | Continue with ui-ux-improver |
| A clean screen where nothing stands out | Give each screen its bright element (UI-34) |
| Changing a good screen to make it different | Triage "no slop": say so, two or three refinements, stop |
| Picking spacing, radius or motion values by feel | `references/starting-values.md`, then DESIGN.md with the reason |
| Rating headings at 500 as "flat" on an app screen | UI-10 is for landing pages; apps use size and position |
| Auditing an empty database | Copy real content read-only before inspecting |
| `--fail-api "*/api/*"` on the whole app | One pattern per page, on the page's own API |
| Measuring only the default tab of a page | `--click` each tab, modal and drawer |
