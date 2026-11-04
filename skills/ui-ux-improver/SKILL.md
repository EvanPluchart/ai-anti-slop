---
name: ui-ux-improver
description: Use when improving the UI and UX of an existing web application (internal tool, back office, dashboard, editor, SaaS) - empty, soulless or unclear screens, layout that changes from page to page, badly built forms, modals, lists, filters, tabs or confirmations, loading or error states that lie, stale data after an action, "the app feels empty", "improve the UX of this screen", "do a UX pass on these pages", and in French « l'app fait vide », « améliore l'UX de cet écran », « passe UX sur ces pages ». A full pass of the whole app ("the best possible app") starts with the audit skill, which chains this one; to remove generated-design defaults, use slop-check; for phones and tablets, use mobile-ux. It improves existing screens; it does not design new ones.
---

# ui-ux-improver

An app screen is good when it **answers right away the question it was opened for**, **tells the truth** about the state of the data, and **behaves like the app's other screens**. The skill rates each screen on these three axes, triages, fixes in the shared components, then verifies in the rendered page.

Rules: `references/rules.md` (UXI-*, with sources): screen, truthful states, navigation and shell, lists and filters, forms, modals and messages, copy, heavy use, method, myths not to apply. `grep -n "UXI-13" references/rules.md` for one rule. The UX-* and A11Y-* rules of the slop-check catalogue still apply: `grep -n "UX-05" ${CLAUDE_SKILL_DIR}/../slop-check/references/catalogue.md`.
**Full pass** ("the best possible app"): the audit skill chains slop-check first (remove the defaults), this skill next, mobile-ux last, then a common re-measure of every screen.
Tools (shared across the collection): `${CLAUDE_SKILL_DIR}/../slop-check/scripts/inspect.mjs` (render, axe, page errors) and `${CLAUDE_SKILL_DIR}/../slop-check/scripts/lint.mjs` (code). `--help` for options.

## Steps

1. **Frame.** The project's style guide (DESIGN.md, tokens, `globals.css`), the user's known preferences (memory, CLAUDE.md), `.anti-slop.json`. **Real data**: a read-only copy of real content if the test database is empty; an empty screen hides half the defects.
2. **Inventory every screen**, not only the ones you are shown: each navigation entry, detail pages, states (empty, loading, error, success), and each component family (`grep -rn "<DialogContent" src`, forms, lists, filters, tabs, toasts). For each screen write one line: **Question** (what the user comes to find out) · **Main task** · **Data shown**. A screen whose question you cannot write is the first problem.
3. **Measure** each screen at 1280 px (`inspect.mjs <url> --widths 1280`, one page at a time; `--click "<selector>"` for an open modal or tab) and compare across screens: `h1` position, margins, content width, headers, tab bar height. Shell inconsistencies only show when comparing.
4. **Evaluate each screen in two passes** (`references/rules.md`, section 9): first the **main task walkthrough** (at each step: does the user see the action, connect it to their goal, see they are progressing?), then element by element with the grid below and the rules. Then **read the flow code** for what the screenshot does not show: loading, error, after-action, lost input (section 2 of the rules). For a full pass, a second independent evaluator (a subagent that does not read your report) finds what you miss.
5. **Triage**, after collection: Nielsen severity 4 catastrophe (data loss, publishing to the wrong place), 3 major (blocked task, false information), 2 minor (slows down, confuses), 1 cosmetic. Group by **shared component**: a defect seen on one modal is fixed in the component behind all modals. The three changes that matter most go first.
6. **Report, then fix** if the request allows (otherwise wait for approval), in this order: data truth and lost input -> walkthrough -> shared components -> layout and substance -> copy -> polish. Minimal diff, values taken from the style guide, no new dependency without approval.
7. **Re-measure** the touched screens (before/after screenshots) and say what **is visible** on screen; anything verified only in the code is reported as such.

## Report

```
# UI/UX pass: <screens> (<date>)
## The three changes that matter most     — severity, consequence for the user, where
## Inventory          — table: screen or state · question · main task · data
## Walkthrough        — the main task step by step, and where it breaks
## Measurements       — shell compared across screens, screenshots, probes (what was seen or not)
## Findings by severity — 4 to 1; each: finding, rule (UXI-, UX-, A11Y-…), file:line, fix, proof (seen on screen / code / measured)
## Fixes              — in step order; "Changed" per file if the request allowed fixes
## Questions          — product choices, glossary, style-guide exceptions
## Not verified       — and probe false positives, to improve the tool
```

During tests: never trigger an action that publishes, schedules, sends or generates. If the test environment is wired to real services (`.env.local`), say so and stay read-only; opening a screen may be enough to start a sync.

## The three axes, in brief

**Answer the question**
- The title and a status sentence with numbers at the top ("27 posts: 25 drafts, 2 published"); no subtitle that paraphrases the title (rare explanation: ⓘ popover).
- The product's substance: real thumbnails, authors, dates, statuses, what is left to do. Removing ornaments without putting anything in their place gives a clean, hollow screen. A mascot does not replace content.
- One primary action per screen; the others secondary or in a menu.

**Tell the truth** (the most serious and most frequent defect, invisible on a screenshot taken once loaded)
- While loading: a skeleton shaped like the content, never "0", "Nothing to do" or an empty list.
- On error: message, cause and action ("Retry"); panels that depend on the failed data do not render a false empty state; a third-party error returned as 200 must still be visible.
- After an action or a sync (including one the screen starts itself on open): the screen re-reads (lists, counters, selectors elsewhere in the app); success is announced only if the server confirmed it.
- Derived data follows its status: for each number or date displayed, trace it back to the function that computes it and ask what happens when the status changes (an item moved back to draft does not keep its scheduled date and no longer counts in the cadence).
- Input is never lost: click on the backdrop of a modified modal, navigation, failed submit.

**Behave like the rest of the app**
- One shell: same container, same left edge, same margins, same header; the tab bar does not move from tab to tab; nothing jumps on load.
- One component per need: one confirmation, one filter, one field, one list, one modal, one selector. The same logic everywhere (a filter that "shows only" here does not "hide" elsewhere). No raw native control next to the app's components.
- One verb per action across the app ("Schedule" or "Plan", not both for the same thing).

If a rule contradicts the style guide or a written user preference (for example a disabled submit button that says why, UXI-18), the style guide wins and the deviation becomes a question, not a fix.

## Per-screenshot grid

One line per point:
1. Is the screen's question answered in the first screen, without scrolling?
2. Can the focal point and primary action be read when squinting?
3. Are the `h1`, margins, width and header those of the other screens?
4. Does the screen have substance (real objects, state, numbers) or does it feel empty?
5. Do the fields stand out from the background (own background, 3:1 border)?
6. Are there two nested scrolls (preview, list in a modal, panel)?
7. Does a text explain the interface instead of giving information?
8. Does a component differ from its siblings elsewhere in the app?

## Common mistakes

| Mistake | Do this instead |
|---|---|
| Fixing the modal (the filter, the field) you were shown | Inventory and fix the whole component family |
| Judging a screen from a screenshot taken once loaded | Also read loading, error and after-action in the code |
| 40 flat findings | Triage by severity, group by shared component, three priorities first |
| Cleaning up without filling in | Put the product's substance where the ornaments were |
| A help sentence under every title | Data or state: keep; explanation: ⓘ popover; paraphrase: delete |
| Changing the header width per tab | Identical full-width header above the tabs |
| Announcing "done" after an invisible fix | Say what is visible on screen, and what is verified only in the code |
| Inventing a number, a testimonial or a route to fill space | Ask the user |
