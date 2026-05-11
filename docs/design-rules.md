# Design Rules

Rules and decisions made during development. These override anything in earlier planning docs when there's a conflict.

---

## Overall Aesthetic

Clean, minimal, card-based. Reference: TripGlide-style mobile UI — bold typography, white cards on light gray surface, generous whitespace, rounded everything. No images anywhere in the app — icons and typography carry the visual weight.

- Background: `#F9FAFB` (light gray surface)
- Cards: `#FFFFFF` with subtle shadow (`shadowColor: #000`, opacity 0.06, radius 8, offset y2)
- Border radius on cards: 20
- Spacing: generous — 16px horizontal page padding minimum
- Typography: **Plus Jakarta Sans**. Headers bold (700). Body regular (400). Numbers semibold (600).
- Primary color is forest green (`#16A34A`), not indigo. Every place the old spec says "indigo" → use green.

---

## Modals

- All modals are **centered on screen**, not bottom sheets.
- Animation: **fade in / fade out** only — no slide, spring, or other transitions.
- Backdrop: `rgba(0,0,0,0.45)`, tapping it closes the modal.
- Modal panel: white background, `borderRadius: 16`, `paddingHorizontal: 24`, `paddingVertical: 28`.
- Width: full width minus 48px horizontal margin (`marginHorizontal: 24`).
- The shared component for this is `components/ui/BottomSheet.tsx` (name is legacy — it behaves as a centered modal).

---

## Bottom Navigation

- The tab bar renders as a **floating pill** — white background, `borderRadius: 32`, indigo-tinted shadow.
- Container background matches the screen background (`#F9FAFB`) so the pill appears to hover over the page.
- Active tab: filled icon + indigo label (`#4F46E5`). Inactive: outline icon + gray label (`#9CA3AF`).
- Implemented in `components/ui/NavPill.tsx`, wired via the `tabBar` prop on `<Tabs>` in `app/(tabs)/_layout.tsx`.
- Missed-review red dot sits top-right of the Log icon with a white border so it reads clearly against any background.

---

## Hero / Primary Stat Card

- The "Left today" number lives in a **forest green card** (`#16A34A`, `borderRadius: 20`, `marginHorizontal: 16`).
- It is a card — same system as all other cards, just larger and with a coloured background.
- Two subtle semi-transparent decorative circles are positioned inside for depth (no images, pure `View` elements).
- Shadow uses the brand colour (`shadowColor: '#16A34A'`) at 35% opacity so it reads as a coloured glow, not a generic drop shadow.
- The "Day X of Y" counter sits in a frosted badge (white at 15% opacity) in the top-right of the hero card.
