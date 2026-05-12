export type CampaignCopyTemplate = {
  id: string;
  label: string;
  name: string;
  title: string;
  body: string;
  segmentDays: number;
};

/** Suggested push copy — owners should still adapt tone to their brand. */
export const CAMPAIGN_COPY_TEMPLATES: CampaignCopyTemplate[] = [
  {
    id: "welcome_back",
    label: "Welcome back (soft)",
    name: "Welcome back — soft nudge",
    title: "We’d love to see you again",
    body: "You’ve played at our place before — stop by this week for a drink and a quick round in Cafe Social.",
    segmentDays: 30,
  },
  {
    id: "happy_hour",
    label: "Happy hour / offer",
    name: "Happy hour reminder",
    title: "Something’s on today",
    body: "We’ve got a little extra on today — open the app at the venue to see the featured offer and your perks.",
    segmentDays: 14,
  },
  {
    id: "daily_word",
    label: "Daily ritual",
    name: "Daily word ritual",
    title: "Today’s word is live",
    body: "Open Cafe Social at the venue and try the daily word — quick, friendly, and on us.",
    segmentDays: 21,
  },
  {
    id: "friends_table",
    label: "Play with friends",
    name: "Bring a friend",
    title: "Grab a table, start a room",
    body: "Host a word match from the app and share the room code — perfect for a slow afternoon.",
    segmentDays: 30,
  },
];
