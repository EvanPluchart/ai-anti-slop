# mobile-ux rules (MOB-*)

Each rule: observable defect, fix, detection, severity, evidence. *Consensus* = several independent sources; *Supported* = a standard or two sources; *Single source* = raise as a question if the style guide says otherwise. Related rules in the unslop catalogue: UX-13 (field attributes), UX-20 (mobile collapse), A11Y-09 (24 px), A11Y-10 (hover), A11Y-14 (zoom), A11Y-17 (16 px), A11Y-18 (focus under a bar), A11Y-19 (tooltip), A11Y-20 (44 px).

Contents: 1. Height, safe areas, keyboard · 2. Targets and touch · 3. Hover and detecting "mobile" · 4. Reflow and content · 5. Gestures and drag · 6. Navigation · 7. Tablet and panels · 8. Sheets and dialogs · 9. Scrolling · 10. Fields and iOS Safari · 11. Images and performance · 12. Home screen · 13. What `inspect.mjs --mobile` measures · 14. To check on a real phone · 15. Myths

## 1. Height, safe areas, keyboard

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-01 | Full-screen height in `100vh` (`h-screen`, `min-h-screen`): footer, send bar or last button under the expanded address bar | `min-h-dvh` for the shell, `h-svh` when everything must fit with the bar expanded; animate nothing on `dvh` | Static; `inspect.mjs` (CSS rules); manual (in headless the bar never retracts) | Warning | Consensus: [web.dev](https://web.dev/blog/viewport-units), [Tailwind](https://tailwindcss.com/docs/height) |
| MOB-02 | `viewport-fit=cover` without `env(safe-area-inset-*)`: content under the notch or home indicator, bottom bar stuck to the edge | Insets with `max(1rem, env(safe-area-inset-left))`; iOS: `padding-bottom: env(safe-area-inset-bottom)`; Chrome Android 135+ edge to edge: `bottom: env(safe-area-inset-bottom, 0px)` (padding on the dynamic inset makes the layout jump); test both | Static; `inspect.mjs`; CDP `Emulation.setSafeAreaInsetsOverride`; manual | Warning | Supported: [WebKit](https://webkit.org/blog/7929/designing-websites-for-iphone-x/), [Chrome edge-to-edge](https://developer.chrome.com/docs/css-ui/edge-to-edge) |
| MOB-03 | Keyboard open: the sticky bottom bar (Send, editor tools) slides under the keyboard or covers the field being typed in | Android: `interactive-widget=resizes-content` (Next `viewport` export); iOS ignores it: position the bar from `visualViewport`, or put it back in the flow while typing | Static (`fixed bottom-0` bar on a screen with fields); manual essential | Warning; blocker if sending becomes unreachable | Consensus: [Chrome](https://developer.chrome.com/blog/viewport-resize-behavior), [MDN viewport](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport), [MDN Visual Viewport](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API) |
| MOB-04 | In landscape or zoomed, sticky header and footer eat the screen (less than 2 times more content than bands) | Sticky only if the height allows (`@media (min-height: 480px)`), static below; header that hides on scroll down; opaque background | `inspect.mjs` (content/bands ratio at 844×390) | Warning; blocker if focus is obscured (2.4.11) | Consensus: [WCAG C34](https://www.w3.org/WAI/WCAG22/Techniques/css/C34), [1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [NN/g sticky headers](https://www.nngroup.com/articles/sticky-headers/) |
| MOB-05 | Fixed elements stacked at the bottom (navigation, toast, floating button, mascot, banner) that overlap; last element impossible to scroll out from under the bar | A single fixed tier at the bottom; content `padding-bottom` = bar heights + safe area; toasts above the bar | `inspect.mjs` (fixed-box intersections); maximum scroll | Warning | Supported: [Chrome edge-to-edge](https://developer.chrome.com/docs/css-ui/edge-to-edge), [WCAG 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |

## 2. Targets and touch

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-06 | Crowded targets: 32 px action icons 4 px apart, several links in a list row | At least 8 px between two targets; on phones, one visible action per row, the rest in "⋯" | `inspect.mjs` (gap between small targets); axe `target-size` | Warning | Consensus: [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility), [web.dev](https://web.dev/articles/accessible-tap-targets), [Hoober 2013](https://www.uxmatters.com/mt/archives/2013/03/common-misconceptions-about-touch.php) |
| MOB-07 | Small target in a corner or on an edge (24 px "×" at the top right) | Larger near the edges than in the center; content in the center, secondary actions at the top and bottom | `inspect.mjs` (small target within 48 px of a corner) | Suggestion | Single source: [Hoober 2017](https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php) (7 mm in the center, ~12 mm in the corners) |
| MOB-39 | `-webkit-tap-highlight-color: transparent` everywhere with no `:active` state: no feedback on tap | Keep the highlight or a visible `:active` | Static; CDP `CSS.forcePseudoState` | Suggestion | Single source: [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-tap-highlight-color) |

44 px is a comfortable target (WCAG 2.5.5, AAA; Apple 44 pt, Android 48 dp); the AA minimum is 24 px with exceptions (A11Y-09). A 36 px target is never a blocker.

## 3. Hover and detecting "mobile"

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-08 | Action or information revealed on hover (`group-hover:opacity-100`): invisible to a finger. In Tailwind v4, `hover:` is compiled under `@media (hover: hover)` and never applies on touch | Visible by default on touch (`pointer-coarse:opacity-100`), hover stays an enhancement; do not restore the old `hover` to silence the problem | `inspect.mjs --mobile` (zero-opacity interactive elements under touch emulation); static | Blocker if there is no other access, warning otherwise | Consensus: [Tailwind upgrade](https://tailwindcss.com/docs/upgrade-guide), [web.dev](https://web.dev/learn/design/interaction) |
| MOB-09 | Menu that opens on hover: on iPhone, the first tap only triggers the hover | Open on tap (`aria-expanded` button); section link separate from the button that expands | Static (`onMouseEnter` that shows content); manual on iPhone | Warning | Single source: [Apple Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html) |
| MOB-10 | "Mobile" inferred from width or user agent (`useIsMobile`, `innerWidth < 768`): iPad, touch laptop or a phone with a mouse get the wrong interface | Layout by width (media and container queries), interaction by device (`pointer`, `hover`, `pointer-coarse:`) | Static (`navigator.userAgent`, `ontouchstart`, `innerWidth` in render); CDP at 1024 px touch | Warning | Consensus: [web.dev](https://web.dev/learn/design/interaction), [MDN pointer](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer) |
| MOB-11 | Mobile/desktop switch in JavaScript: the server renders desktop, then the screen jumps (shadcn `useIsMobile` hook is `false` until its effect); Dialog that flashes before becoming a Drawer | CSS variants (`hidden md:block`); a single `Dialog` styled as a bottom sheet below 640 px (`max-sm:`) | Static (`useIsMobile`, `useMediaQuery` that picks the component); CLS | Warning | Supported: [shadcn use-mobile](https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/hooks/use-mobile.ts), [Next hydration](https://nextjs.org/docs/messages/react-hydration-error) |
| MOB-12 | Tailwind prefixes read backwards (`sm:` for "on phones") | No prefix = phone, `sm:` = 640 px and up, `max-sm:` for the small screen only | Static; DOM at 390 px | Suggestion | Single source: [Tailwind](https://tailwindcss.com/docs/responsive-design) |

## 4. Reflow and content

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-13 | Information or action removed on phones (`hidden md:flex` with no equivalent); `overflow-x: hidden` on `body` that cuts content instead of fixing the overflow | Move, never remove: second line, "⋯", expandable panel, page | `inspect.mjs --mobile` (`<main>` labels at 1280 px missing at 390 px) | Blocker | Consensus: [WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [F102](https://www.w3.org/WAI/WCAG22/Techniques/failures/F102) |
| MOB-14 | Text cut off or overlapping when line and letter spacing are increased: fixed height, `truncate` or `line-clamp` with no access to the full text | `min-h-*` instead of fixed heights; full text reachable when truncating | `inspect.mjs --mobile` (1.4.12 test sheet) | Blocker (AA) | Supported: [WCAG 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) |
| MOB-15 | Table that makes the whole page scroll sideways, or columns crushed at 390 px | Below 640 px, a two-level list (identity and key figure, then the rest in gray); if a table remains: its own `overflow-x-auto` container, first column `sticky left-0`, sticky header | `inspect.mjs` (UX-20); DOM | Blocker if the page scrolls both ways | Consensus: [WCAG 1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [NN/g mobile tables](https://www.nngroup.com/articles/mobile-tables/) |
| MOB-16 | Horizontally scrolling area (table, chips, tabs) unreachable by keyboard and with no hint that more content remains | `role="region"`, `aria-labelledby`, `tabindex="0"`; last item cut off as a hint | axe `scrollable-region-focusable` | Warning | Consensus: [Roselli](https://adrianroselli.com/2020/11/under-engineered-responsive-tables.html), [NN/g](https://www.nngroup.com/articles/mobile-tables/) |
| MOB-17 | Locked orientation or "Rotate your device"; editor unusable in landscape | Accept both; low-height layout | Static (`orientation.lock`); landscape | Blocker (AA) | Consensus: [WCAG 1.3.4](https://www.w3.org/WAI/WCAG22/Understanding/orientation.html) |
| MOB-18 | Text too small: data in 12 px, sublines and badges in 10-11 px | Reading ~16 px, data 14 px, never under 12 px | `inspect.mjs --mobile` | Suggestion | Supported: [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility), app-screens §12 |

## 5. Gestures and drag

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-19 | Function reachable only by a gesture (swipe-only carousel, "swipe to delete" with no button, pinch-only zoom) | Equivalent visible control (previous/next, Delete in the menu, +/−); tap, double tap and long press are accepted alternatives | Static (`embla`, `swiper`, `@use-gesture`, `drag`) | Blocker (A) | Consensus: [WCAG 2.5.1](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html), [Apple HIG gestures](https://developer.apple.com/design/human-interface-guidelines/gestures) |
| MOB-20 | Reordering or scheduling only by dragging (calendar, sortable list): a keyboard alternative is not enough | Move up/down, "Move to…", select then tap the destination | Static (`@dnd-kit`, `sortablejs`, `draggable`) | Blocker (AA) | Supported: [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) |
| MOB-21 | Sortable list that prevents scrolling by finger (`touch-action: none` on the whole row) | `touch-action: none` on the handle only; touch sensor with a delay | Static (`touch-none`); CDP `Input.synthesizeScrollGesture` | Warning | Single source: [dnd-kit](https://dndkit.com/api-documentation/sensors/pointer) |
| MOB-22 | `touch-action: none` on a large surface (editor, canvas, page): pinch and scroll blocked | Targeted values (`pan-y`, `manipulation`); never on `body` | Static; DOM | Warning; blocker if zoom becomes impossible | Supported: [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) |
| MOB-23 | Action run on press (`onPointerDown`, `onTouchStart`): cannot be cancelled by sliding off the button | Run on release (`onClick`) | Static | Blocker (A) | Supported: [WCAG 2.5.2](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html) |
| MOB-24 | Long press as the only access (context menu, multi-select) | Visible "⋯" or Select mode; long press stays a shortcut | Static (`onContextMenu`, timer on `touchstart`) | Warning | Supported: [Apple HIG gestures](https://developer.apple.com/design/human-interface-guidelines/gestures) |

## 6. Navigation

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-25 | 3 to 5 main sections hidden behind a hamburger on phones | Bottom bar of 3 to 5 destinations with labels, or four visible plus "More"; actions ("New") in the screen header. Beyond ~6 destinations, a well-built drawer is still legitimate | `inspect.mjs --mobile` | Warning | Consensus: [NN/g](https://www.nngroup.com/articles/hamburger-menus/) (hidden navigation used 57% vs 86% combined), [Android](https://developer.android.com/develop/ui/compose/components/navigation-bar), [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/tab-bars) |
| MOB-26 | Icon-only bottom bar, bar that disappears depending on the section | One-word label under each icon; bar visible everywhere except under a modal | DOM | Suggestion | Supported: [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/tab-bars) |

## 7. Tablet and panels

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-27 | Tablet band ignored: desktop sidebar that squashes content at 768 px, phone layout stretched at 1024 px; on iPad (touch, desktop-version sites), hover actions disappear | 600 to 1100 px as a band of its own: rail or drawer, tables with 4-5 columns and sublines, two panels only if they stay readable | `inspect.mjs --mobile` (768 px touch); at 1024 px touch `--widths 1024 --mobile` | Warning | Supported: [Android window size classes](https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes) |
| MOB-28 | Component tuned to the window width while living inside a panel (`md:grid-cols-3` in a 360 px column) | Container queries (`@container`, `@sm:`, `@md:`) | DOM at 1280 px; static | Suggestion | Supported: [Tailwind](https://tailwindcss.com/docs/responsive-design) |

## 8. Sheets and dialogs

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-29 | Bottom sheet closable only by the handle or a swipe; system Back leaves the page; stacked sheets; multi-step flow inside a sheet | Visible Close button; Back and Esc close the sheet; one sheet at a time; a long flow goes to a page | DOM (`[role=dialog]` at the bottom with no Close button); CDP `history.back()` | Warning | Consensus: [NN/g bottom sheets](https://www.nngroup.com/articles/bottom-sheet/), [Apple HIG sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) |
| MOB-30 | Closing a sheet or modal (swipe, backdrop, back) throws away input without warning | Confirmation or draft kept when there are changes | Interaction | Warning | Supported: [Apple HIG sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) |
| MOB-31 | Centered dialog taller than the screen: footer buttons off screen, close control not found (especially in landscape) | Below 640 px: full screen for a long task, bottom sheet otherwise; body scrolls alone (`max-h-[calc(100dvh-2rem)]`), header and footer fixed inside the dialog | DOM at 390×844 and 844×390 | Warning | Supported: [Apple HIG modality](https://developer.apple.com/design/human-interface-guidelines/modality) |

## 9. Scrolling

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-32 | Scroll leaks: at the end of a list in a modal, the page behind scrolls; native pull-to-refresh reloads a screen being edited | `overscroll-behavior: contain` on the container; draft kept | DOM; CDP `Input.synthesizeScrollGesture` | Suggestion | Supported: [Chrome](https://developer.chrome.com/blog/overscroll-behavior) |
| MOB-33 | `scroll-snap-type: mandatory` on elements larger than the container: content unreachable | `proximity`, or `mandatory` for smaller elements; `scroll-padding` under a fixed header | Static (`snap-mandatory`) | Suggestion | Single source: [web.dev](https://web.dev/articles/css-scroll-snap) |

## 10. Fields and iOS Safari

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-34 | `type="number"` for a code (postal code, company ID, identifier): zeros lost, wheel changes the value | `type="text" inputmode="numeric"`; `inputmode="decimal"` for an amount | `inspect.mjs --mobile` | Warning | Supported: [GOV.UK](https://technology.blog.gov.uk/2020/02/24/why-the-gov-uk-design-system-team-changed-the-input-type-for-numbers/) |
| MOB-35 | Technical fields (slug, link, code, hashtag) with automatic capitalization and correction; generic Enter key | `autocapitalize="none" autocorrect="off" spellcheck="false"`; `enterkeyhint` (search, send, next, done) matching the action | `inspect.mjs --mobile`; static | Suggestion | Supported: [MDN autocapitalize](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocapitalize), [MDN enterkeyhint](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/enterkeyhint) |
| MOB-36 | File field with `capture`: the camera opens automatically | Remove `capture`, keep `accept="image/*"` | `inspect.mjs --mobile` | Suggestion | Single source: [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) |
| MOB-37 | iOS Safari turns displayed numbers and dates into links (blue links, call on tap, hydration error) | `<meta name="format-detection" content="telephone=no, date=no, email=no, address=no">` | `inspect.mjs --mobile`; manual | Warning | Single source: [Next hydration](https://nextjs.org/docs/messages/react-hydration-error) |
| MOB-38 | "Copy" silently fails on iOS Safari when `clipboard.writeText` comes after an `await fetch` | Write during the gesture (`ClipboardItem` with a promise) or text already in memory; "Copied" or a failure message | Static (`await` before `clipboard.write*`); manual | Warning | Single source: [WebKit](https://webkit.org/blog/10855/async-clipboard-api/) |
| MOB-44 | The mobile keyboard inserts what the app then rejects: iOS smart punctuation (curly apostrophes and quotes, long dash), automatic capitalization, correction; a typography check or validation flags it as an error while typing | Normalize on save (U+2018/2019 -> `'`, U+201C/201D -> `"`) instead of rejecting; `autocorrect="off"` on code or Markdown areas (effect on smart punctuation to verify on iPhone) | Read the code (rule that rejects these characters); manual on iPhone | Warning | Observed in a field audit; [MDN autocorrect](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/autocorrect) |
| MOB-45 | Web notifications promised on mobile that never arrive: `new Notification()` fails on Chrome Android, the API does not exist on iPhone outside an installed web app; permission requested anyway | Detect support; go through `ServiceWorkerRegistration.showNotification()`; otherwise an in-app signal (badge, toast on return) and no permission request | Static (`new Notification(`); manual | Warning | Supported: [MDN Notification()](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification), [WebKit, Web Push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| MOB-46 | `scroll-behavior: smooth` on the whole page: on mobile, every page change glides instead of opening at the top | Remove it from `html`, or turn it off during navigation (Next 16: `data-scroll-behavior="smooth"` on `<html>`); never without `prefers-reduced-motion` | Static (`scroll-behavior: smooth` on `html`) | Suggestion | Single source: Next 16 code (`disable-smooth-scroll`); A11Y-11 |

## 11. Images and performance

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-40 | Image much larger than its display: `next/image` with `fill` and no `sizes` (srcset computed for 100vw) | Real `sizes` (`(max-width: 768px) 100vw, 33vw`); check `currentSrc` | Static (`<Image fill` without `sizes`) | Warning | Supported: [Next Image](https://nextjs.org/docs/app/api-reference/components/image), [Web Almanac 2024](https://almanac.httparchive.org/en/2024/media) |
| MOB-41 | Main image (LCP) with `loading="lazy"` | No lazy above the fold; `fetchpriority="high"` on the LCP image only | CDP `PerformanceTimeline` | Warning | Supported: [Web Almanac 2025](https://almanac.httparchive.org/en/2025/performance) |
| MOB-42 | Performance judged on the dev machine; an internal tool has no field measurement (outside CrUX) | Throttled lab (CPU 4×, slow network) on every audit; `web-vitals` RUM (LCP, INP, CLS at the 75th percentile) | CDP `Emulation.setCPUThrottlingRate` | Warning | Consensus: [web.dev Web Vitals](https://web.dev/articles/vitals), [Web Almanac 2025](https://almanac.httparchive.org/en/2025/performance) (good INP on 77% of mobile pages vs 97% on desktop) |

## 12. Home screen

| ID | Defect | Fix | Detection | Severity | Evidence |
|---|---|---|---|---|---|
| MOB-43 | Tool added to the home screen with no manifest or in-app navigation: since iOS 26 it opens as a web app, with no URL bar, hence no back or reload | Minimal manifest (`name`, `short_name`, icons, `start_url`, `display`); Back and Refresh in the interface under `@media (display-mode: standalone)`; safe areas | Static; manual | Suggestion | Supported: [WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [MDN display](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display) |

## 13. What `inspect.mjs --mobile` measures

One reference at 1280 px without touch (inventory of `<main>`), then 320, 390 and 768 px and 844×390 in landscape, in **touch emulation** (`Emulation.setTouchEmulationEnabled`: it is what flips `hover: none` and `pointer: coarse`; the summary says whether the emulation took).

| Measurement | Rules |
|---|---|
| Horizontal page scroll and what causes it (excluding contents of a scrolling container) | UX-20, MOB-15 |
| `<main>` labels present at 1280 px and absent at 320/390 px | MOB-13 |
| Fixed bands that overlap; content/bands ratio | MOB-05, MOB-04 |
| `100vh` in CSS rules | MOB-01 |
| `viewport-fit=cover` without safe areas | MOB-02 |
| Information only in `title` | A11Y-19 |
| Text under 12 px; fields under 16 px | MOB-18, A11Y-17 |
| Targets under 44 px, gap under 8 px, small targets in corners | A11Y-20, MOB-06, MOB-07 |
| Interactive elements present but invisible on touch | MOB-08 |
| 3 to 5 sections behind a menu | MOB-25 |
| `type=number` for a code, technical fields without `autocapitalize`, `capture`, `format-detection` | MOB-34 to MOB-37 |
| Text cut off under the 1.4.12 spacing sheet | MOB-14 |

Not measured automatically (code reading, manual CDP or a real phone): MOB-03, 09 to 12, 16, 17, 19 to 24, 26 to 33, 38 to 46.

## 14. To check on a real phone (iOS Safari and Android Chrome)

1. Real keyboard on every form and in the editor: active field visible, send bar above the keyboard, validation without closing the keyboard (MOB-03, A11Y-18).
2. Address bar expanded then collapsed: nothing underneath, no jarring jump (MOB-01).
3. Safe areas on a notched iPhone and an Android with gesture navigation, portrait and landscape (MOB-02, MOB-05).
4. WebKit behaviors absent from headless Chrome: zoom on focus (A11Y-17), double tap on hover menus (MOB-09), numbers as links (MOB-37), Copy after a load (MOB-38), rubber-banding (MOB-32).
5. System gestures: edge back-swipe over carousels, drawers and swipeable rows; Back that closes the sheet without leaving the page (MOB-29); swipe to dismiss a sheet with input in it (MOB-30).
6. One-handed use, standing: frequent actions under the thumb, "×" and menus in the corners (MOB-06, MOB-07).
7. VoiceOver and TalkBack: order, names of buttons and icons, alternatives to gestures (MOB-19, MOB-20).
8. Pinch-zoom everywhere, text enlarged to 200%, rotation in the middle of typing (A11Y-14, MOB-17, MOB-22).
9. Entry-level phone on a mobile network: heavy screen, typing in the editor, filters (MOB-42).
10. Home screen on iOS 26: name, icon, back, refresh, safe areas in standalone mode (MOB-43).

## 15. Myths not to apply

- "`setEmulatedMedia` with `hover: none` simulates a phone": false, only touch emulation flips the pointer and hover.
- "44 px is the WCAG minimum": the AA minimum is 24 px (2.5.8); 44 px comes from 2.5.5 (AAA).
- "A target must be X mm, so Y px": conversions vary by device; the screen only registers the center of the contact ([Hoober](https://www.uxmatters.com/mt/archives/2013/03/common-misconceptions-about-touch.php)).
- "Everything at the bottom, in the thumb zone": grip changes often; people prefer to look at and touch the center. Keep navigation at the bottom and content in the center, not "everything at the bottom" ([Hoober 2017](https://www.uxmatters.com/mt/archives/2017/03/design-for-fingers-touch-and-people-part-1.php)).
- "`maximum-scale=1` against field zoom": blocks zoom on Android (A11Y-14); the fix is a 16 px font.
- "FastClick or `touch-action: manipulation` against the 300 ms delay": gone with `width=device-width`.
- "`-webkit-overflow-scrolling: touch`": useless since Safari 13.
- "`100dvh` or `interactive-widget` fix the keyboard": no unit accounts for the keyboard, and iOS Safari ignores `interactive-widget`.
- "`padding-bottom: env(safe-area-inset-bottom)` works everywhere": an anti-pattern on edge-to-edge Chrome Android 135+; test both patterns.
- "Long press is not a WCAG alternative": it is (2.5.1); the flaw is discoverability (MOB-24).
- "Google's Mobile-Friendly test or the Lighthouse `tap-targets` audit is authoritative": removed (2023) or replaced by `target-size` (24 px) in Lighthouse 12.
