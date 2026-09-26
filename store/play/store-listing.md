# Google Play — store listing copy (draft)

Adapted from the App Store description that shipped with iOS 1.0, so the two
stores tell the same story. Play's fields differ from Apple's: there is no
keywords field (Play indexes the descriptions instead), the short description is
hard-capped at 80 characters, and the full description at 4000.

Character counts below are exact. Verify after any edit — Play rejects overruns.

---

## App name (30 max)

```
Cafe Social
```
`11 / 30`

## Short description (80 max)

Shown under the title in search results and at the top of the listing. This is
the single highest-impact string in the listing.

```
Walk into your local cafe and it turns into a game. Play the people around you.
```
`79 / 80`

**Alternates, if you want a different emphasis:**

| Variant | Chars | Angle |
|---|---|---|
| `Word games and arena battles at your local cafe. Earn perks at the counter.` | 75 | feature-led |
| `Your local cafe, but it's a game. Word battles, arena matches, real perks.` | 74 | punchier |
| `Turn cafe visits into games, streaks and perks you redeem at the counter.` | 73 | loyalty-led |

## Full description (4000 max)

```
Cafe Social turns your local cafe into a game.

Walk into a partner venue and the app unlocks: word games against the people sitting around you, a fast real-time Brawler arena, daily challenges, and perks you can redeem at the counter.

AT THE VENUE
• Word games — play solo, co-operatively, or race head-to-head
• Brawler — real-time arena matches, 1v1 or party free-for-all
• Daily word puzzle, with streaks for every venue you play at
• Challenges that earn XP and unlock perks from the cafe
• See who else is playing, when they choose to be visible

SOCIAL
• Add friends by username, or share an invite link
• Create parties and play together
• Venue, city, country and global XP leaderboards
• Available in English, German, Spanish and Croatian

FOR CAFES
Partner venues get their own dashboard: challenges, perks, offers and visit analytics. If you run a cafe and want to take part, get in touch through the website.

CAFE SOCIAL PRO
Pro removes the location requirement, so you can play word games and the Brawler arena from anywhere, not just inside a partner cafe. It also unlocks parties of up to 200 members, removes the daily play limit, and lets you discover other subscribers remotely.

Includes a 7-day free trial. Subscriptions renew automatically until cancelled; you can manage or cancel at any time in Settings or in your Google Play account.

PRIVACY
Location is used only to detect when you are inside a partner cafe, so venue games and challenges can unlock. It is never used for advertising, and there is no continuous background tracking. You control notifications and visibility in Settings.

You can delete your account at any time in Settings, or at
https://partner.cafe-social.com/delete-account
```
`~1750 / 4000`

### What changed from the App Store version, and why

- **"App Store account" → "Google Play account"** in the subscription paragraph.
  Leaving Apple's wording in a Play listing is a common, avoidable rejection.
- **Hyphen bullets → `•`.** Play renders plain text; bullet characters survive,
  leading hyphens read as dashes.
- **Added the account-deletion URL.** Play looks for it, and it now exists.
- **Kept the Brawler claim.** Verified against `brawler.service.ts:1039` —
  subscribers genuinely queue from anywhere, so "word games and the Brawler
  arena from anywhere" is accurate.

---

## Translations

The app already ships English, German, Spanish and Croatian, so the listing
should offer the same four. Localised listings measurably lift install rate in
those markets, and claiming four languages in an English-only listing is a poor
look.

Translations are not drafted here — they should be done against the final
English copy once you've picked a short-description variant, not before.

---

## Remaining graphical assets

| Asset | Requirement | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | Derive from `app/assets/brand/icon.png` |
| Feature graphic | **1024×500** JPG/PNG, no alpha | **Missing** — Play will not let you publish without it. No Apple equivalent, so it was never produced. |
| Phone screenshots | 2–8, min 320px, max 3840px, 16:9–9:16 | Capturing on the Pixel 8 emulator |
| Tablet screenshots | optional | Skip — `supportsTablet: false` |

The feature graphic is the one genuine gap. It is a wide banner, not a resized
screenshot — it needs to be designed.
