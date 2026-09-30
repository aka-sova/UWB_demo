# Guided tutorial — design

## Goal
A **Tutorial** button next to Run/Step starts a step-by-step guided tour. Each step highlights one part of the lab (section, menu, tab or control) with a spotlight and explains it in a step card. Some steps act automatically (open a tab, open the controls panel); others ask the user to perform the action and advance when the resulting state is observed.

Decisions: UI tour followed by a short hands-on experiment; action steps wait for the user's real click with a "Do it for me" fallback; started only from the button; custom component, no new dependency.

## Components
- `components/lab/tutorial-steps.ts` — step data and pure predicates. No React.
  - `TourState`: `{view, stage, maskMode, advanced, controlsOpen, sigma, selected, zoomed}`.
  - `TourActions`: setters the Lab already owns (`setView`, `setStage`, `setMaskMode`, `setAdvanced`, `setControlsOpen`, `change`, `setSelected`, `setCursor`, `focusCursor`).
  - `TourStep`: `{id, target?, title, body, before?(actions), waitFor?: {hint, done(state, start), doIt(actions)}}`. `target` is a `data-tour` key; absent means a centered card.
- `components/lab/tutorial.tsx` — overlay. Spotlight hole around the target rect, four click-blocking rectangles around the hole, and the step card (`role="dialog"`, labelled by its title). Recomputes the rect every animation frame while open; scrolls the target into view on step entry.
- `components/lab/lab.tsx` — Tutorial button in `.transport`, tour open state, snapshot/restore, builds `TourState`/`TourActions`.
- `data-tour` attributes on existing elements in `lab.tsx`, `control-panel.tsx`, `receiver-view.tsx`, `stage-inspector.tsx`.

## Behaviour
- Start: snapshot `{scenario, config, view, stage, maskMode, advanced, controlsOpen, domain, cursor}`, load experiment 01, step 1.
- Step entry: run `before`, record `start = state`, scroll target into view.
- Wait steps: Next is replaced by "Do it for me" (runs `doIt`). When `done(state, start)` becomes true, the card shows a check and advances after 700 ms.
- Back returns to the previous step (its `before` runs again). Skip, Esc or the close button restore the snapshot. Finish keeps the current state.
- Keyboard: Esc exit; → / Enter next (non-wait steps); ← back. Focus moves to the card on each step.
- Placement: below the target if it fits, else above, else centered; clamped to the viewport. Under 760 px the card docks to the bottom.
- Missing target element: centered card without spotlight.
- `prefers-reduced-motion`: no transitions, instant scrolling.

## Steps
1 Welcome · 2 experiment picker · 3 control sections · 4 header with Run/Step · 5 main tabs · 6 pipeline (*click stage 06*) · 7 readouts · 8 time-domain plot · 9 zoom toolbar (*Focus cursor*) · 10 receiver spectrum · 11 spectrogram (*click Spots*) · 12 stage inspector · 13 pulse table (*select a row*) · 14 matched filter / reconstruction · 15 graduate detail (*turn on*) · 16 σ slider (*reduce to ≤ 0.30 ns*) · 17 bandwidth readout · 18 Bandwidth explorer (*click tab*) · 19 Applications (opened) · 20 Validation (*click tab*) · 21 theme toggle and finish.

## Testing
- `tests/tutorial.test.ts` (node:test): every step `target` appears as `data-tour="<target>"` in `components/lab/*.tsx`; each `waitFor.done` rejects its start state and accepts the state produced by its `doIt`.
- Manual browser walkthrough at desktop and 375 px widths, both themes.
