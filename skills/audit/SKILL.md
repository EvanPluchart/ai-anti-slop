---
name: audit
description: Use for a full quality pass over a whole web app - "the best app possible", "full audit", "audit everything", "quality pass before launch", "unslop and improve the whole app". Chains unslop, then ui-ux-improver, then mobile-ux on the same real data, then one common re-measure of every screen, with fixes committed per batch and a before/after report. For a single concern (only the visual defaults, one screen's UX, only mobile), use that skill directly.
---

# audit

A full pass runs the three skills of the collection in this order, on the same real data, then measures every screen again:

1. **unslop**: remove the defaults of a generated design (copy, visuals, accessibility, dark patterns).
2. **ui-ux-improver**: make each screen useful, truthful about its state, and consistent with the others.
3. **mobile-ux**: make it work with a finger, on phone and tablet.

Removing defaults first avoids polishing a screen you are about to recompose. Mobile comes last because it reshapes layouts that are already settled.

The tools are the unslop scripts: `node ${CLAUDE_SKILL_DIR}/../unslop/scripts/lint.mjs` and `node ${CLAUDE_SKILL_DIR}/../unslop/scripts/inspect.mjs` (`--help` for the options). Each skill's own rules are in its `references/`.

## Before you start

- **Work on a branch or a worktree**, never on the main branch. One commit per batch, in the project's commit format. Push or open a merge request only if the user asked for it.
- **Real data, read-only.** Copy real content (production or staging, no token files) into the test data folder. An empty database hides half the defects.
- **Read the environment files** (`.env.local`, …) before navigating. If they point at a real service (production, payments, email, publishing, social networks, paid AI), tell the user and use test values. During the pass, only read and navigate: nothing that writes to an external service or spends quota.
- **Spare the machine**:
  - one dev server, reused;
  - one Chrome at a time, through `inspect.mjs` only; before each measurement, `pgrep -f 'ai-anti-slop-'`, and wait if another session's audit is running;
  - `nice -n 10` on long jobs, 3 workers at most for tests and builds;
  - check `uptime` before heavy steps; if the load is above the core count, wait.
- **Find the style guide** (DESIGN.md, tokens, `globals.css`) and write `.anti-slop.json` with the brand exceptions, each with its reason.

## Steps

1. **Baseline, every page.** Run `lint.mjs` on the source. Then run `inspect.mjs` on every page of the navigation, in desktop mode and with `--mobile`, into `anti-slop/measures-before/<page>/<mode>`. Measure the closed states too with `--click`: each tab of a detail page, modals, drawers, popovers. A state that is never rendered is never audited. Use a loop like the one below; do not edit code while it runs.
2. **unslop** (see that skill): report, then fix what is approved.
3. **ui-ux-improver** (see that skill): flows, states, forms, modals, lists, consistency between screens.
4. **mobile-ux** (see that skill): touch sizes, fields at 16 px on touch, sheets, Back gesture, landscape, keyboard.
5. **After each batch**: lint, typecheck, tests, and a look at the captures of the screens you touched. Then commit.
6. **Re-measure everything** into `anti-slop/measures-after`. Run the production build last.
7. **Report** (format below), then clean up: stop what you started, and leave no `ai-anti-slop` Chrome or loop running.

Fixing authority follows the unslop rule: without explicit approval, report and stop. With "fix it directly", fix blockers and warnings; suggestions, missing facts (numbers, testimonials, names) and brand choices stay questions for the user.

### Measurement loop

```bash
#!/bin/zsh
# One page at a time, waits when the machine is busy or another audit holds Chrome.
OUT=anti-slop/measures-before; mkdir -p "$OUT"; : > "$OUT/summary.txt"
PAGES=("/" "/projects" "/projects/demo" "/settings")   # every page of the navigation, plus detail pages
busy() { [ "$(uptime | awk -F'load averages?: ' '{print $2}' | awk '{printf "%d", $1}')" -ge "$(sysctl -n hw.ncpu 2>/dev/null || nproc)" ] || pgrep -f 'ai-anti-slop-' >/dev/null; }
for p in "${PAGES[@]}"; do
  name=$(echo "$p" | sed -E 's#^/##; s#[/?=]#_#g; s#^$#home#' | cut -c1-60)
  for mode in desktop mobile; do
    while busy; do sleep 20; done
    [ $mode = desktop ] && extra=() || extra=(--mobile --no-axe)
    echo "=== $p ($mode)" >> "$OUT/summary.txt"
    nice -n 10 perl -e 'alarm 240; exec @ARGV' node "$SKILL_DIR/../unslop/scripts/inspect.mjs" "http://localhost:3000$p" \
      --out "$OUT/$name/$mode" --wait 3500 "${extra[@]}" 2>&1 | grep -E "^## |^- \[" >> "$OUT/summary.txt"
    sleep 2
  done
done
echo DONE >> "$OUT/summary.txt"
```

Set `SKILL_DIR` to this skill's folder and the port to the project's dev server. Add `--click` runs for the tabs and modals of each detail page.

## Report

```
# Full audit: <project> (<date>)
Branch · commits · tests, typecheck, lint, build (and on which commit)
## The 3 changes that matter most
## Measures before / after — comparable rules only
## Changed, by batch — commit, what is visible on screen
## Questions for you — missing facts, brand choices, product decisions
## Not verified — real devices, screen readers, risky actions not exercised
```

- **Count findings, not elements.** One field flagged at six widths is six findings: say "findings".
- **Keep the comparison honest.** If a probe was fixed between the two measurements, list that rule apart as "not comparable". Use a third-party tool that did not change (axe-core, same version) as the stable metric.
- **Say what each claim rests on.** For example, "build passed on `abc123`; the last commit was only checked by typecheck and tests".

## Common mistakes

| Mistake | Do instead |
|---|---|
| Measuring 3 pages and calling it a full audit | Every page, desktop and mobile, plus tabs and modals with `--click` |
| Editing code while a measurement runs | Wait for the end: hot reload skews the results (and can show errors that are not in the app) |
| Fixing a shared component and stopping there | Re-measure the pages that use it: a badge that grows with its text also stretches in a flex row |
| Adding a side column inside a page that already has one | Put secondary content (history, versions) under the main content |
| Reporting "60 fields without a label" | "60 findings" — one component can produce half of them |
| Comparing before/after while the probe changed | Separate "comparable" from "probe fixed in between" |
| Leaving the user to discover what changed | Say what is visible on screen, per batch |
