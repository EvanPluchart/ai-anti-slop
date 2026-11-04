# Starting values

Use these only where the style guide says nothing, then propose each value for DESIGN.md with its reason (CONV-03). They are starting points, not a house style. Colours, typefaces and icon sets are left out on purpose: they come from the brand or from the direction (slop-check, step 1), and a fixed list of them would become the next template.

## Spacing (UI-15, UI-31, UI-32)

- A 4 px grid: margins, paddings, gaps and fixed heights are multiples of 4. 2 px is fine for nudges inside small controls, and a value that exactly centres something stays.
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.
- Inside a control 4 to 12; between related items, like the rows of a list, 2 to 8; between groups 12 to 24; between sections 32 to 64, or 80 to 128 on a landing page.
- Less space inside a group than between groups, so a list reads as one block and sections read apart.
- Padding follows density: compact panels and sidebars about 16, cards 20 to 24, page edges 24 to 32 (16 on a phone).

## Rows and controls

- Row heights: 32 compact, 36 default, 44 on touch (A11Y-20).
- Navigation rows 32 to 36 with 2 to 4 between them; a section label sits closer to its own items than to the section above, about 24 above and 8 below.
- Buttons: 32 to 36 in toolbars and navigation, 40 to 48 for a page's primary action, never under 44 on touch.

## Radius (UI-16, UI-33)

- By size: tag or keycap 4 to 6; row, input or button 8 to 10; card 12 to 16; panel or window 14 to 20.
- Nested: inner radius = outer radius minus the padding between them, never below 4.

## Type (UI-10, UI-29, UI-30)

- App screens: a few sizes from one scale, weights 400 to 600, hierarchy from size and position; no headings at 700 to 900. Body text 14 to 16 px, 16 px or more for reading pages.
- Landing pages: a clear jump between the headline and everything else.
- Letter-spacing: 0 under 16 px, slightly positive for small muted text; negative only on display text, about -0.02em from 40 px and -0.03em from 56 px.
- Figures that line up (tables, stat cards, prices): tabular figures, right-aligned in columns, one format per kind of figure in the project's locale.

## Colour roles (UI-05, UI-28, UI-34)

- Three text roles from one neutral ramp: primary, secondary and muted. Muted is for meta and captions only, and still reaches 4.5:1 (A11Y-01).
- One accent, used for the primary action, the selection and one key figure: a few per cent of the screen. Solid fills use the style guide's exact colour.
- Hairlines at 6 to 10 % of the text colour rather than coloured borders.

## Depth (UI-17)

- Dark themes: steps between surfaces and a hairline, no glow.
- Light themes: a faint shadow for small raised things, a wider soft one only for what floats (menus, popovers, dialogs).

## Motion (UI-23, UI-24, A11Y-11)

- One ease-out curve for entrances and state changes, such as `cubic-bezier(0.22, 1, 0.36, 1)`, and a shorter ease-in for exits.
- Hover, press and toggles 120 to 180 ms; menus, popovers and tooltips 160 to 220 ms; entrances, sheets and layout changes 300 to 500 ms.
- Stagger 40 to 60 ms, six items at most; rise on enter 6 to 12 px; press scale 0.97 to 0.98.
- Animate colour, background, border, opacity and transform only. Under `prefers-reduced-motion`, fades replace movement.

---

Several values are adapted from [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): the spacing scale and density ranges, row heights, radius by size and the nesting rule, letter-spacing thresholds, text roles, hairline opacity and motion durations. Changes: touch sizes follow WCAG and Apple (44 px), exits use an ease-in curve, body text sizes are widened, and the colour ramps, typefaces and icon set of the original are removed.
