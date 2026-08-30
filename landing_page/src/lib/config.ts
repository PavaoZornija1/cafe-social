export const siteConfig = {
  name: "Cafe Social",
  contactEmail: "privacy@cafesocial.app",
  appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() || "",
  playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() || "",
};

export const navAnchors = [
  { key: "howItWorks", href: "#how-it-works" },
  { key: "games", href: "#games" },
  { key: "forCafes", href: "#for-cafes" },
  { key: "faq", href: "#faq" },
] as const;

export const partnerVenueSlots = [
  { id: "01", status: "pilot" as const },
  { id: "02", status: "open" as const },
  { id: "03", status: "open" as const },
  { id: "04", status: "open" as const },
  { id: "05", status: "open" as const },
];

export const gameHeroes = [
  { id: "golem", image: "/heroes/golem.webp" },
  { id: "mage", image: "/heroes/mage.webp" },
  { id: "skater", image: "/heroes/skater.webp" },
  { id: "scientist", image: "/heroes/scientist.webp" },
] as const;
