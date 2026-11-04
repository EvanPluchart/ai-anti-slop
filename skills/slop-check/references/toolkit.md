# Toolkit (configuration, machine, stack pitfalls)

Shared by the collection (slop-check, ui-ux-improver, mobile-ux, audit). The scripts live in `scripts/` next to this folder: `lint.mjs` (static scan, no browser) and `inspect.mjs` (one headless Chrome, axe-core, layout probes, captures). Both need Node 22+; `inspect.mjs` also needs Chrome, Chromium or Edge (`CHROME_PATH` to point at a specific binary).

## `.anti-slop.json` (project root, optional)

```json
{
  "locale": "en-US",
  "designDoc": "docs/DESIGN.md",
  "ignorePaths": ["src/legacy"],
  "allow": [
    { "rule": "UI-06", "value": "Inter", "reason": "heading font set by the style guide" },
    { "value": "JetBrains Mono", "reason": "brand font, reserved for code" },
    { "value": "#fcd21d", "reason": "brand yellow" },
    { "rule": "UI-01", "path": "src/marketing/hero", "reason": "approved campaign gradient" }
  ],
  "profiles": { "forms.validation": "blur", "destructive": "undo-first", "buttons.disabledWhilePending": false }
}
```

- Every exception needs a reason; without one, ask for it.
- An exception limited to a `path` only applies to `lint.mjs` (a rendering has no file). Give it a `rule` or a `value`, otherwise it would accept everything.
- To ignore one line, add the comment `anti-slop-ignore UI-21 <reason>` on that line or the one before.
- Both scripts apply `allow`. `lint.mjs` looks for `.anti-slop.json` in the scanned folder and its parents; `inspect.mjs` reads it from the current folder, or `--config`.
- `locale` sets the copy rules: French-only rules (French typography, « » quotes, non-breaking spaces before « : ; ! ? ») apply when it starts with `fr`.
- `profiles` are read by no script: you apply them. They settle the rules on which the sources disagree (catalogue, section "Three consequences for the tool").

## Sparing the machine

- Reuse the dev server already running (`lsof -iTCP -sTCP:LISTEN -P | grep node`). Start one only if there is none, and stop it at the end.
- Run the scripts with `nice -n 10`. One `inspect.mjs` at a time, and no other automated browser open at the same time. Before a measurement, `pgrep -f 'ai-anti-slop-'`: if a Chrome from these scripts is running (another session's audit), wait.
- Measurements run one after the other; do not loop them tightly.
- Next.js in dev: right after a `next build` in the same folder, the dev server can recompile in a loop and reload the page forever (an inspection never ends). Restart it. Bound each inspection (`perl -e 'alarm 90; exec @ARGV' node inspect.mjs …`) and check that no `ai-anti-slop` Chrome remains.
- The Next.js dev badge drawn over a page skews the contrast of what is underneath: ignore that node, it does not exist in production.

## Stack pitfalls (Next.js, shadcn, Base UI, Tailwind)

| Mistake | Do instead |
|---|---|
| Wiring a shadcn button with raw `buttonVariants()` | `buttonVariants` must go through `cn` (tailwind-merge), otherwise the base `border-transparent` wins and the link-button loses its border |
| Assuming a `<SelectTrigger>` showing its value has an accessible name | Base UI and Radix give it `role="combobox"`, which does not take its name from its content: pair `<Label htmlFor>` with an `id`, or add `aria-label` (axe `button-name`) |
| Tinted backgrounds at 15-20 % under text of the same hue | Check the contrast; 5-10 % usually passes, 15 % rarely does |
| A drawer or sheet that the Back gesture does not close (MOB-29) | Next ≥ 14.1: `history.pushState({ menu: true }, "")` on open (Next copies its own state into it, no reload), `popstate` closes. Closing without navigation: `history.back()` if the top entry is yours. Links inside the drawer use `<Link replace>`. Never call `history.back()` right before a navigation: the asynchronous back would cancel it |
| A hand-made drawer (`createPortal`, `body.style.overflow`, Escape by hand) | Base UI Dialog: focus trap, Escape, scroll lock, `finalFocus` back to the button that opened it. When opened by touch, it focuses the panel without opening the keyboard |
| A shadcn badge moved from `h-5` to `min-h-5` (for text spacing, WCAG 1.4.12) | Add `h-fit`. Without a fixed height, a badge in a flex row (`align-items: stretch` by default) stretches to the height of the text next to it. A status column gets a fixed width (grid) and `w-full` badges: same size, aligned text |
| A scrolling panel (`overflow-y-auto`) without `position: relative` | `sr-only` text and absolutely positioned tooltips use the page as their containing block: they lengthen the page and the window scrolls a second time under the panel (UX-31). Put `relative` on the panel |
| A list that should scroll inside its card (pagination always visible), but the panel scrolls instead | Flex items have `min-height: auto`: `<main>` grows with its content and the list is never bounded. Lift the constraint only there (`lg:has-[[data-scroll-list]]:min-h-0` on `<main>`), page in `h-full flex flex-col`, list in `min-h-0 overflow-y-auto`; check with `--eval` that the list scrolls, not the panel |
| Touch sizes keyed on width (`md:h-9`, `sm:size-7`) | Key them on the pointer: `pointer-coarse:` and `pointer-fine:` (Tailwind v4). An iPhone in landscape or an iPad is wider than `md` |
| `container-type` (`@container`) on a wrapper that holds `position: fixed` elements | Container queries apply layout containment: the wrapper becomes the containing block of its fixed descendants (a floating button scrolls away). Put `@container` on a wrapper with no fixed descendants |
| A two-column template `minmax(0,1fr) minmax(16rem,22rem)` | The bounded column reaches its maximum before the flexible one grows. Use `clamp(16rem,32%,22rem)` for the side column |
| Assuming a class present in the CSS is used on the page | Tailwind v4 generates the classes seen in every git-tracked file, docs included; check with an element (`--eval "!!document.querySelector('.min-h-screen')"`) |

## Reading the probes

- A11Y-09 applies WCAG 2.5.8 the way axe does: under 24 px, unless the link sits in a sentence, or a 24 px circle centred on the target touches neither another target nor another small target's circle. A checkbox inside its `<label>` has the label as its target. Finger comfort (44 px) is A11Y-20, a suggestion.
- axe `target-size` also counts a focusable container as a neighbour (a Base UI tab panel with `tabindex="0"`, a scrollable region). `report.json` gives, for each node, `why` (axe's message) and `near` (the neighbours involved). If the neighbour is the link's own container, it is a false positive and the probe is right; do not remove the `tabindex` of a panel whose first content is not focusable (APG).
- `--click "<selector>"` (repeatable) opens a state before measuring: drawer, modal, tab, popover. The same clicks apply to the desktop reference run. Open modals are excluded from MOB-04 and MOB-05 (they cover the page by definition). For states after a risky action (send, publish, pay), read the code instead of clicking.
- `--eval "<expression>"` prints a value from the rendered DOM (size, neighbours, computed style): use it to settle a disagreement between the probe, axe and the capture without opening another browser.
- Image errors are grouped, with up to two sample URLs; React render errors are reported with their real message, not their `%o` template.
- The `--mobile` summary says whether touch emulation took effect; without it, hover findings are worthless.
- Content that is not rendered (a closed `<details>`, `content-visibility: hidden`) is ignored by every probe.
