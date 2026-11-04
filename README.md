# ai-anti-slop

Claude Code skills that audit and fix web apps that look AI-generated: default-looking UI, filler copy, screens that lie about their state, accessibility gaps, and layouts that break on a phone.

Slop is an absence of decision: the tool's default, left as it is. These skills measure it in the code and in a real browser, report it with evidence, and fix it only after you approve, without replacing one default with the next one.

## The skills

| Skill | What it does | Ask for it with |
|---|---|---|
| `ai-anti-slop:audit` | Full pass: unslop, then ui-ux-improver, then mobile-ux on the same real data, then a before/after re-measure of every screen, with one commit per batch | "Run a full audit of this app on a new branch" |
| `ai-anti-slop:unslop` | Removes the defaults of a generated design: copy, visuals, accessibility, dark patterns (123 rules with sources) | "Unslop this app", "this looks AI-made" |
| `ai-anti-slop:ui-ux-improver` | Makes each screen useful, truthful about its state (loading, empty, error, stale data) and consistent with the others: flows, forms, modals, lists, filters | "This screen feels empty", "improve the UX of this page" |
| `ai-anti-slop:mobile-ux` | Makes the app work with a finger: touch targets, 16 px fields (iOS zoom), sheets, Back gesture, keyboard, safe areas, landscape | "Make it work on my phone" |

## How it measures

1. **Static scan** (`lint.mjs`, no browser): class names, copy patterns, missing states, known shadcn and Tailwind defaults.
2. **Real rendering** (`inspect.mjs`):
   - one headless Chrome, with axe-core injected;
   - layout probes at several widths (target sizes, overflow, contrast, field outlines, text spacing), and the page's own errors (exceptions, failed requests);
   - with `--mobile`, real touch emulation: `hover: none` and `pointer: coarse`;
   - `--click` measures open states (tabs, modals, drawers) and `--eval` checks a hypothesis on the rendered DOM.
3. **Captures** reviewed with a fixed checklist.
4. **Code reading** of the main flows, for what no script sees: double submit, lost input, destructive actions, dark patterns.

Each run writes a `report.json` and PNG captures. The skills then report:
- the three changes that matter most;
- blockers, warnings and suggestions, each with evidence;
- questions about missing facts;
- what could not be verified.

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

Manual install: copy the four folders of `skills/` into `~/.claude/skills/`, keeping them side by side. The skills reach the shared scripts through `${CLAUDE_SKILL_DIR}/../unslop/scripts/`.

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
/ai-anti-slop:unslop the settings and billing pages
```

```
Use ai-anti-slop:mobile-ux on the checkout flow, then fix the blockers.
```

The tools can also run on their own:

```bash
node skills/unslop/scripts/lint.mjs src            # static scan (exit code 2 = a blocker remains)
node skills/unslop/scripts/inspect.mjs http://localhost:3000/ --out anti-slop/before
node skills/unslop/scripts/inspect.mjs http://localhost:3000/ --mobile --click '[role="tab"]:nth-child(2)'
node skills/unslop/scripts/inspect.mjs --help
```

## What the skills will and will not do

- They **stop after the report** unless you said "fix it directly". Then they fix blockers and warnings and leave suggestions to you.
- They **never invent facts**: missing numbers, testimonials, logos or names become questions.
- **New values come from your style guide** (DESIGN.md, tokens), or are proposed with a reason.
- They make **minimal diffs on your stack**: no framework migration, no new dependency without approval.
- They **spare your machine**: one headless Chrome at a time, `nice -n 10`, and a wait while another audit holds the browser.

## Configuration

An optional `.anti-slop.json` at the project root:
- records brand exceptions, each with a reason, so your style guide's fonts and colours are not reported;
- ignores paths;
- sets the locale.

French-locale projects get the French copy rules: typography, « » quotes, and non-breaking spaces before « : ; ! ? ».

The format, the machine rules and the stack pitfalls (Next.js, shadcn, Base UI, Tailwind v4) are described in [`skills/unslop/references/toolkit.md`](skills/unslop/references/toolkit.md).

## Tests

```bash
node --test tests/
```

## License

MIT
