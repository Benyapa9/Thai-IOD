# Product tour

The tour is data, played by one component. You never need to touch the player
to add a step or a tour.

| File | What it is |
|---|---|
| `src/lib/tour/tours.ts` | Tours and their steps (data) |
| `src/lib/tour/engine.ts` | Pure logic: role filter, next step, card position (unit-tested) |
| `src/components/tour/tour-player.tsx` | The player (spotlight, card, keyboard, focus) |
| `src/lib/i18n.ts` | All tour text, `tour.<tourId>.<stepId>.title` / `.body` |
| `src/app/globals.css` | Tour colours (`.tour-*`), light and dark |

## Add a step

1. **Mark the element** you want to point at:
   ```tsx
   <div data-tour="my-thing">…</div>
   ```
2. **Add the step** to the tour in `tours.ts`:
   ```ts
   { id: "myThing", page: "/dashboard/main/kpi", target: "my-thing", permission: "upload" },
   ```
   - `page`: where the step lives (`null` = stay on the current page). The player navigates there.
   - `target`: the `data-tour` value, or `null` for a centred card.
   - `permission` (optional): users without it never get the step.
   - `open` (optional): something to expand first, e.g. `"sidebar"` (mobile menu). UI only.
3. **Add the text** in `src/lib/i18n.ts` (Thai and English):
   ```ts
   "tour.main.myThing.title": { th: "…", en: "…" },
   "tour.main.myThing.body": { th: "…", en: "…" },
   ```
   Keep titles to about 6 words and bodies to 2 sentences, and say how it helps
   the user, not just what it is called.
4. **Changed a lot?** Bump `version` in the tour so everyone who has seen the
   old one sees it again.
5. Run `npm test`. It also checks every level still gets 6–9 steps.

## Add a tour (e.g. for another role)

Add a new `TourDef` to `TOURS` in `tours.ts`, then add its texts. Start it with
`startTour("<tourId>")` from a menu.
Only the `main` tour auto-starts; to auto-start another one, add it next to
`MAIN_TOUR` in the player's auto-start effect.

## Behaviour (for reference)

- **Auto-start:** once, after the Microsoft consent dialog. When the user finishes or skips, it is remembered
  per user and version, on the server (`User.tourSeen`, `POST /api/me/tour`)
  and in localStorage. Storage errors (private windows) are ignored.
- **Replay:** from the profile menu, or the button on the profile page.
- **Refresh mid-tour:** the tour continues; the position is kept in sessionStorage.
- **Missing element:** if a step's element is not found within 1.5 s (still loading,
  or not available), the step is skipped. The tour never points at nothing.
- **Interaction:** the page behind is `inert` while the tour is open, and the tour never
  clicks or edits anything.
- **Keyboard:** Esc closes, ← → change step, Tab stays in the card. Focus moves to the card on each step
  and returns to where it was afterwards.
- **Phones:** at 640 px or narrower the card is a bottom sheet.
- **Reduced motion:** with `prefers-reduced-motion`, animations and smooth scrolling are off.
