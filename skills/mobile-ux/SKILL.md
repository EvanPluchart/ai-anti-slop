---
name: mobile-ux
description: Use when a web app or site must work well on phones or tablets - mobile pass, responsive, "on my phone", horizontal overflow, menu or bottom bar, unreadable tables, buttons too small for a finger, virtual keyboard hiding a field, iOS zoom on focus, sticky bar covering content, tooltips or actions visible only on hover, notch and safe areas, landscape, tablet; in French « sur mon téléphone », « passe mobile », « ça déborde sur mobile », « boutons trop petits ». To remove generated-design defaults, use slop-check; for general screen UX, use ui-ux-improver; for a full pass of the whole app, use the audit skill.
---

# mobile-ux

On a phone, the user holds the device in one hand, aims with a thumb, hovers over nothing, and the virtual keyboard takes half the screen. A "responsive" page that merely drops to one column at 375 px misses almost all of this. The skill measures in touch emulation, reads the code for what emulation cannot see, transforms layouts, and lists what is left to verify on a real phone.

Rules: `references/rules.md` (MOB-*, with sources): height and keyboard, targets, hover, reflow, gestures, navigation, tablet, sheets and dialogs, scrolling, fields and iOS Safari, images and performance, home screen; then what the tool measures (section 13), real-phone verification (14) and myths (15). Neighboring rules in the slop-check catalogue: A11Y-09, A11Y-10, A11Y-14, A11Y-17 to A11Y-20, UX-13, UX-20.
**Full pass**: the audit skill runs this skill after slop-check and ui-ux-improver, because it transforms layouts that are already settled; common re-measure at the end.
Tool: `${CLAUDE_SKILL_DIR}/../slop-check/scripts/inspect.mjs <url> --mobile`: a reference at 1280 px, then 320, 390, 768 px and 844×390 in landscape, in **touch emulation** (it is what flips `hover: none` and `pointer: coarse`; the summary says whether it took). One page at a time, prefixed with `nice -n 10`. `--help` for options.

## Steps

1. **Inventory** all screens and the floating or sticky elements (header, send bar, floating button, mascot, banner, toasts): on a phone, these are what overlap.
2. **Measure** each screen with `inspect.mjs <url> --mobile`, one page at a time (list of measurements: section 13 of the rules). Findings only count if the summary says "touch emulated". Open states are measured too: `--click "<selector>"` opens the drawer, sheet or tab before measuring, and `--eval` checks Back (MOB-29): `history.back()` then the dialog and URL state.
3. **Look at** the screenshots at 320, 390 and 768 px and in landscape with the grid below.
4. **Read the code** for what emulation does not show. Closed list, to search across all of `src/` (`grep -rn`):
   - keyboard: `fixed bottom-0` bars on a screen with fields, panel positioned from `innerHeight`, `viewport` export without `interactiveWidget`, save action out of reach when the keyboard is open;
   - implicit submit: costly `<form>` with `type="submit"` (Enter launches the action);
   - hover: `group-hover`, `hover:opacity`, `onMouseEnter`, `onMouseUp`/`mouseup` alone (finger selection), `title=` carrying information;
   - fields: `md:text-`/`text-sm` on `input`/`textarea`, `type="number"` for a code, `inputmode`, `enterkeyhint`, `autocapitalize`;
   - iOS Safari: `new Notification(`, `clipboard`/`execCommand` (copy after an `await`, `setSelectionRange`), `URL.revokeObjectURL` right after a download, `format-detection`;
   - layout: `scroll-behavior: smooth`, toasts (`<Toaster`, position and offset), floating elements (`fixed`), long words without `overflow-wrap`, `useIsMobile`/`innerWidth` choosing a component, `sm:`/`md:` used to mean "touch";
   - gestures and safe areas: drag without an alternative (`draggable`, `@dnd-kit`), `touch-action: none`, `viewport-fit=cover` without `env(safe-area-inset-*)`.
5. **Transform** rather than shrink (details in the rules):
   - collapsed navigation: drawer or bottom bar depending on the number of destinations;
   - table -> two-level row list; side column -> below the content or in a tab;
   - filters -> a scrolling row of chips or a sheet; action bar -> primary action + a menu;
   - long modal -> full screen or bottom sheet; primary action within thumb reach;
   - targets enlarged on touch in the shared components (`pointer-coarse:` in Tailwind v4 for `sm` buttons, options, tabs), without changing the mouse display.
6. **Fix** if the request allows, in the shared components first (shell, fields, buttons, modals, lists), then **re-measure** the same screens.
7. **List the real-phone verification** (iOS Safari and Android Chrome): what emulation does not prove is reported as not verified.

## Report

```
# Mobile pass: <screens> (<date>)
## The three changes that matter most
## Measurements       — per screen and width (320, 390, 768, landscape): MOB-*, UX-20, A11Y-* findings; touch emulation confirmed or not
## Findings by severity — each: what the user experiences on their phone, rule, file:line, fix
## Transformations    — shared components first (shell, fields, buttons, modals, lists)
## To check on a real phone — iOS Safari and Android Chrome (section 14 of the rules)
## Not verified       — and probe false positives
```

During tests: never trigger an action that publishes, schedules, sends or generates; if the environment is wired to real services, stay read-only.

## Mobile screenshot grid

1. Horizontal page scroll? (never; a table scrolls in its own frame)
2. Is the primary action visible and reachable by thumb without scrolling?
3. Does a fixed or sticky element cover content, another fixed element or the bottom of the page?
4. Are frequent targets 44 px, spaced out?
5. Is text readable (16 px for body and fields) without zooming?
6. Does any information exist only on hover (`title` tooltip, actions that appear on hover)?
7. Does the first useful row (list, form) start in the first screen, or do three rows of controls push it down?
8. In landscape and at 768 px, does the layout hold (no 200 px column, no 120-character line)?

## Common mistakes

| Mistake | Do this instead |
|---|---|
| Validating on a single 375 px screenshot | Touch emulation, 320 / 390 / 768 px and landscape; then a real phone |
| Shrinking the desktop into one column | Transform: table to list, side column below the content, actions in a menu |
| `h-screen` or `100vh` for a full-height area | `100dvh` (or `svh`), otherwise the mobile address bar cuts off the bottom |
| Sticky bottom bar with no thought for the keyboard or notch | Test with the keyboard open; `env(safe-area-inset-bottom)` if `viewport-fit=cover` |
| `title` tooltip or hover action for useful information | Always visible, or a popover openable by touch |
| Field in `md:text-sm` "because it's mobile" | `text-base pointer-fine:text-sm`: an iPhone in landscape exceeds 768 px and would zoom |
| Costly form where Enter submits (keyboard "Go") | Enter moves to the next field; submit by the button (UXI-73 in ui-ux-improver) |
| Trusting emulation for the keyboard, notch or Safari | Report them as "to check on a real phone" (section 14 of the rules) |
| Disabling zoom to "avoid" iOS zoom | Never `maximum-scale=1`: fix the field size |
