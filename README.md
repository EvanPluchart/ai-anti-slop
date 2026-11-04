# ai-anti-slop

Claude Code skills that find what makes a web app look AI-generated, measure it in the code and in a real browser, and fix it with you.

![The same newsletter dashboard twice. Top, before: a purple gradient, emoji icons, glowing badges, gradient headings, sparklines and a rainbow bar chart, with fourteen numbered red markers on the defects the scripts measured. Bottom, after: quiet neutrals, line icons, tabular figures, and one ink-blue chart as the only bright element.](docs/before-after.jpg)

Top: [`examples/before`](examples/before/index.html), a vibe-coded dashboard, with what the scripts measured on it. Bottom: [`examples/after`](examples/after/index.html), the same screen after `/ai-anti-slop:slop-check`, built from a direction written first ([`DESIGN.md`](examples/after/DESIGN.md)). The same scripts find nothing left on it.

Slop is an absence of decision: the tool's default, left as it is. These skills measure it, report it with evidence, and fix it only after you approve. They do not swap one default for the next one, and they do not stop at a clean screen where nothing stands out: each screen keeps one bright element, with quiet chrome around it.

## The skills

| Skill | What it does | Ask for it with |
|---|---|---|
| `ai-anti-slop:audit` | Full pass: slop-check, then ui-ux-improver, then mobile-ux on the same real data, then a before/after re-measure of every screen, with one commit per batch | "Run a full audit of this app on a new branch" |
| `ai-anti-slop:slop-check` | Writes a direction, then removes the defaults of a generated design: visuals, copy, accessibility, dark patterns (137 rules with sources) | "Unslop this app", "this looks AI-made" |
| `ai-anti-slop:ui-ux-improver` | Makes each screen useful, truthful about its state (loading, empty, error, stale data) and consistent with the others: flows, forms, modals, lists, filters | "This screen feels empty", "improve the UX of this page" |
| `ai-anti-slop:mobile-ux` | Makes the app work with a finger: touch targets, 16 px fields (iOS zoom), sheets, Back gesture, keyboard, safe areas, landscape | "Make it work on my phone" |

The skills also answer French requests (« déslopper », « passe qualité de toute l'app », « sur mon téléphone »), and write their reports in your language.

## How a pass goes

1. **Direction.** Four lines before anything is measured: what the product does and for whom, its character in concrete words ("calm, literate, exact", never "clean and modern"), whether the screen is an app or a page, and the one bright element each screen keeps. With a style guide, they come from it.
2. **Measure.**
   - `lint.mjs` scans the code, with no browser: class names, copy patterns, missing states, known shadcn and Tailwind defaults, values off the 4 px grid.
   - `inspect.mjs` renders each page in one headless Chrome, injects axe-core, and runs layout probes at several widths: target sizes, overflow, contrast, field outlines, letter-spacing, figures, double scroll, and the page's own errors. With `--mobile`, it emulates touch (`hover: none`, `pointer: coarse`). `--click` opens tabs, modals and drawers before measuring.
   - The captures are read with a fixed checklist, and the code of the main flows is read for what no script sees: double submit, lost input, destructive actions, dark patterns.
3. **Triage.** Heavy slop gets the full report and a visual pass. Light slop gets only its findings fixed, keeping the palette, type and layout. A screen with no slop gets two or three refinements at most: the skill says so instead of redesigning it.
4. **Report, then stop.** The three changes that matter most, then blockers, warnings and suggestions with their evidence, questions about missing facts, and what could not be verified. Nothing changes before you approve.
5. **Fix and re-measure.** Accessibility and states first, then copy, then visuals; then the same measurements again, before and after.

## Try it on the example

```bash
node skills/slop-check/scripts/lint.mjs examples/before
node skills/slop-check/scripts/inspect.mjs "file://$PWD/examples/before/index.html" --widths 1440
```

Then ask Claude Code for `/ai-anti-slop:slop-check examples/before/index.html` and compare its fixes with `examples/after`.

## Install

The repository is both a marketplace and a plugin. In Claude Code:

```
/plugin marketplace add EvanPluchart/ai-anti-slop
/plugin install ai-anti-slop@ai-anti-slop
```

From a terminal:

```bash
claude plugin marketplace add EvanPluchart/ai-anti-slop
claude plugin install ai-anti-slop@ai-anti-slop
```

While the repository is private, the marketplace is cloned with your own git access: an SSH key or a credential helper that can read it.

**Updates.** Auto-update is off by default for this marketplace. After a new release:

```bash
claude plugin update ai-anti-slop@ai-anti-slop
```

Or turn on auto-update for the marketplace in `/plugin`. For a private repository, background updates need a credential stored without a prompt, for example `gh auth login` then `gh auth setup-git`.

Manual install: copy the four folders of `skills/` into `~/.claude/skills/`, keeping them side by side. The skills reach the shared scripts through `${CLAUDE_SKILL_DIR}/../slop-check/scripts/`.

## Requirements

- Node.js 22 or later.
- Chrome, Chromium or Edge for `inspect.mjs`; set `CHROME_PATH` to pick a binary.
- The app running locally (the skills reuse your dev server).

Nothing is installed: the scripts are single files with no dependencies. axe-core comes from the project's `node_modules` when present, otherwise from jsDelivr at run time.

## Use

```
Run a full audit of this app with ai-anti-slop:audit, on a new branch from main. Report before fixing.
```

```
/ai-anti-slop:slop-check the settings and billing pages
```

```
Use ai-anti-slop:mobile-ux on the checkout flow, then fix the blockers.
```

The tools also run on their own:

```bash
node skills/slop-check/scripts/lint.mjs src            # static scan (exit code 2 = a blocker remains)
node skills/slop-check/scripts/inspect.mjs http://localhost:3000/ --out anti-slop/before
node skills/slop-check/scripts/inspect.mjs http://localhost:3000/ --mobile --click '[role="tab"]:nth-child(2)'
node skills/slop-check/scripts/inspect.mjs --help
```

## What the skills will and will not do

- They **stop after the report** unless you said "fix it directly". Then they fix blockers and warnings and leave suggestions to you.
- They **never invent facts**: missing numbers, testimonials, logos or names become questions.
- **New values come from your style guide** (DESIGN.md, tokens). Where it says nothing, they start from [style-independent values](skills/slop-check/references/starting-values.md) (spacing, rows, radius, type, motion) and propose each one with its reason.
- They make **minimal diffs on your stack**: no framework migration, no new dependency without approval.
- They **spare your machine**: one headless Chrome at a time, `nice -n 10`, and a wait while another audit holds the browser.

## Configuration

An optional `.anti-slop.json` at the project root:
- records brand exceptions, each with a reason, so your style guide's fonts and colours are not reported;
- ignores paths;
- sets the locale.

French-locale projects get the French copy rules: typography, « » quotes, and non-breaking spaces before « : ; ! ? ».

The format, the machine rules and the stack pitfalls (Next.js, shadcn, Base UI, Tailwind v4) are described in [`skills/slop-check/references/toolkit.md`](skills/slop-check/references/toolkit.md).

## Tests

```bash
node --test tests/
```

## Credits

The direction step, the triage, the starting values and several rules (UI-29 to UI-36, COPY-16 to COPY-18, VIS-16) are adapted from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Each adapted rule cites it in the Evidence column of the catalogue, and the starting values list what changed.

## License

MIT, except the adapted material credited above, which stays under CC BY 4.0.
