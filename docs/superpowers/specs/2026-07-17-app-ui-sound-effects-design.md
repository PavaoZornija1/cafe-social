# App UI Sound Effects Design

## Goal

Extend the existing feedback system with dedicated, quiet UI sounds for navigation, reward success, and recoverable errors.

## Scope

- Add `uiTap`, `uiSuccess`, and `uiError` WAV assets.
- Play `uiTap` only when a bottom-tab press causes navigation.
- Play `uiSuccess` after offer claim, staff QR/member-card success, offer fulfillment, and staff redemption acknowledgement.
- Play `uiError` after rejected/unrecognized staff scans.
- Keep all sounds behind the existing Sound effects preference.
- Keep UI sounds out of the background-music duck list.
- Update Settings copy in English, German, Spanish, and Croatian.

## Sound character

- `uiTap`: 40–80 ms, soft and dry, lower volume than reward sounds.
- `uiSuccess`: short two-note upward chime, positive but not celebratory.
- `uiError`: short muted downward tone, gentler than the game `wrong` sound.

## Non-goals

- No generic sound on every button.
- No post-game carousel sound.
- No new audio preference.
- No changes to game, lobby, or BGM behavior.
