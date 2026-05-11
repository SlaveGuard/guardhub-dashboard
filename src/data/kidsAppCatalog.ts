// src/data/kidsAppCatalog.ts
// Curated catalog of popular Android apps for children's devices.
// Categories match Kidslox grouping conventions.

export type AppCategory =
  | 'Social Media'
  | 'Games & Gaming'
  | 'Entertainment & Streaming'
  | 'Messaging & Chat'
  | 'Shopping'
  | 'Browsers'
  | 'Education'
  | 'Productivity & Tools';

export interface CatalogApp {
  name: string;
  packageName: string;
  category: AppCategory;
  /** Domain used to fetch the app icon via https://icon.horse/icon/<domain> */
  iconDomain: string;
  /** Hex background colour for the letter-avatar fallback */
  iconColor: string;
  /** Single letter shown inside the avatar when the icon URL fails to load */
  iconLetter: string;
  /** True = show in the "Most Blocked" pinned section */
  popular?: boolean;
}

export const APP_CATEGORIES: AppCategory[] = [
  'Social Media',
  'Games & Gaming',
  'Entertainment & Streaming',
  'Messaging & Chat',
  'Shopping',
  'Browsers',
  'Education',
  'Productivity & Tools',
];

export const CATEGORY_EMOJI: Record<AppCategory, string> = {
  'Social Media': '📱',
  'Games & Gaming': '🎮',
  'Entertainment & Streaming': '🎬',
  'Messaging & Chat': '💬',
  'Shopping': '🛍️',
  'Browsers': '🌐',
  'Education': '📚',
  'Productivity & Tools': '⚙️',
};

export const APP_CATALOG: CatalogApp[] = [
  // ── Social Media ─────────────────────────────────────────────────────────
  { name: 'TikTok',      packageName: 'com.zhiliaoapp.musically',  category: 'Social Media',              iconDomain: 'tiktok.com',      iconColor: '#010101', iconLetter: 'T', popular: true },
  { name: 'Instagram',   packageName: 'com.instagram.android',     category: 'Social Media',              iconDomain: 'instagram.com',   iconColor: '#E1306C', iconLetter: 'I', popular: true },
  { name: 'Snapchat',    packageName: 'com.snapchat.android',      category: 'Social Media',              iconDomain: 'snapchat.com',    iconColor: '#FFFC00', iconLetter: 'S', popular: true },
  { name: 'Facebook',    packageName: 'com.facebook.katana',       category: 'Social Media',              iconDomain: 'facebook.com',    iconColor: '#1877F2', iconLetter: 'F' },
  { name: 'X (Twitter)', packageName: 'com.twitter.android',       category: 'Social Media',              iconDomain: 'x.com',           iconColor: '#000000', iconLetter: 'X' },
  { name: 'Reddit',      packageName: 'com.reddit.frontpage',      category: 'Social Media',              iconDomain: 'reddit.com',      iconColor: '#FF4500', iconLetter: 'R' },
  { name: 'Pinterest',   packageName: 'com.pinterest',             category: 'Social Media',              iconDomain: 'pinterest.com',   iconColor: '#E60023', iconLetter: 'P' },
  { name: 'BeReal',      packageName: 'com.bereal.ft',             category: 'Social Media',              iconDomain: 'bereal.com',      iconColor: '#000000', iconLetter: 'B' },
  // ── Games & Gaming ───────────────────────────────────────────────────────
  { name: 'Roblox',                packageName: 'com.roblox.client',                    category: 'Games & Gaming', iconDomain: 'roblox.com',         iconColor: '#E42B2B', iconLetter: 'R', popular: true },
  { name: 'Minecraft',             packageName: 'com.mojang.minecraftpe',               category: 'Games & Gaming', iconDomain: 'minecraft.net',      iconColor: '#62B800', iconLetter: 'M', popular: true },
  { name: 'Fortnite',              packageName: 'com.epicgames.fortnite',               category: 'Games & Gaming', iconDomain: 'fortnite.com',       iconColor: '#1C1C1E', iconLetter: 'F' },
  { name: 'PUBG Mobile',           packageName: 'com.tencent.ig',                       category: 'Games & Gaming', iconDomain: 'pubgmobile.com',     iconColor: '#F7A400', iconLetter: 'P' },
  { name: 'Call of Duty Mobile',   packageName: 'com.activision.callofduty.shooter',    category: 'Games & Gaming', iconDomain: 'callofduty.com',     iconColor: '#1A1A2E', iconLetter: 'C' },
  { name: 'Free Fire',             packageName: 'com.dts.freefireth',                   category: 'Games & Gaming', iconDomain: 'garena.com',         iconColor: '#FF5722', iconLetter: 'F' },
  { name: 'Among Us',              packageName: 'com.innersloth.spacemafia',             category: 'Games & Gaming', iconDomain: 'innersloth.com',     iconColor: '#C51111', iconLetter: 'A' },
  { name: 'Clash of Clans',        packageName: 'com.supercell.clashofclans',           category: 'Games & Gaming', iconDomain: 'supercell.com',      iconColor: '#1E4D8C', iconLetter: 'C' },
  { name: 'Clash Royale',          packageName: 'com.supercell.clashroyale',            category: 'Games & Gaming', iconDomain: 'supercell.com',      iconColor: '#0057B8', iconLetter: 'C' },
  { name: 'Mobile Legends',        packageName: 'com.mobile.legends',                   category: 'Games & Gaming', iconDomain: 'mobilelegends.net',  iconColor: '#C8A000', iconLetter: 'M' },
  { name: 'Genshin Impact',        packageName: 'com.miHoYo.GenshinImpact',             category: 'Games & Gaming', iconDomain: 'genshin.hoyoverse.com', iconColor: '#4A90D9', iconLetter: 'G' },
  { name: 'Pokémon GO',            packageName: 'com.nianticlabs.pokemongo',             category: 'Games & Gaming', iconDomain: 'pokemongo.com',      iconColor: '#FFCB05', iconLetter: 'P' },
  { name: 'Subway Surfers',        packageName: 'com.kiloo.subwaysurf',                 category: 'Games & Gaming', iconDomain: 'subwaysurf.com',     iconColor: '#F5A623', iconLetter: 'S' },
  // ── Entertainment & Streaming ────────────────────────────────────────────
  { name: 'YouTube',       packageName: 'com.google.android.youtube',       category: 'Entertainment & Streaming', iconDomain: 'youtube.com',    iconColor: '#FF0000', iconLetter: 'Y', popular: true },
  { name: 'YouTube Kids',  packageName: 'com.google.android.apps.youtube.kids', category: 'Entertainment & Streaming', iconDomain: 'youtubekids.com', iconColor: '#FF6D00', iconLetter: 'Y' },
  { name: 'Netflix',       packageName: 'com.netflix.mediaclient',          category: 'Entertainment & Streaming', iconDomain: 'netflix.com',    iconColor: '#E50914', iconLetter: 'N' },
  { name: 'Spotify',       packageName: 'com.spotify.music',                category: 'Entertainment & Streaming', iconDomain: 'spotify.com',    iconColor: '#1DB954', iconLetter: 'S' },
  { name: 'Disney+',       packageName: 'com.disney.disneyplus',            category: 'Entertainment & Streaming', iconDomain: 'disneyplus.com', iconColor: '#113CCF', iconLetter: 'D' },
  { name: 'Prime Video',   packageName: 'com.amazon.avod.thirdpartyclient', category: 'Entertainment & Streaming', iconDomain: 'primevideo.com', iconColor: '#00A8E1', iconLetter: 'P' },
  { name: 'Twitch',        packageName: 'tv.twitch.android.app',            category: 'Entertainment & Streaming', iconDomain: 'twitch.tv',      iconColor: '#9146FF', iconLetter: 'T' },
  { name: 'Apple Music',   packageName: 'com.apple.android.music',          category: 'Entertainment & Streaming', iconDomain: 'music.apple.com', iconColor: '#FC3C44', iconLetter: 'A' },
  { name: 'SoundCloud',    packageName: 'com.soundcloud.android',           category: 'Entertainment & Streaming', iconDomain: 'soundcloud.com', iconColor: '#FF5500', iconLetter: 'S' },
  // ── Messaging & Chat ─────────────────────────────────────────────────────
  { name: 'WhatsApp',   packageName: 'com.whatsapp',                category: 'Messaging & Chat', iconDomain: 'whatsapp.com',  iconColor: '#25D366', iconLetter: 'W', popular: true },
  { name: 'Telegram',   packageName: 'org.telegram.messenger',      category: 'Messaging & Chat', iconDomain: 'telegram.org',  iconColor: '#2AABEE', iconLetter: 'T' },
  { name: 'Discord',    packageName: 'com.discord',                 category: 'Messaging & Chat', iconDomain: 'discord.com',   iconColor: '#5865F2', iconLetter: 'D', popular: true },
  { name: 'Signal',     packageName: 'org.thoughtcrime.securesms',  category: 'Messaging & Chat', iconDomain: 'signal.org',    iconColor: '#3A76F0', iconLetter: 'S' },
  { name: 'Messenger',  packageName: 'com.facebook.orca',           category: 'Messaging & Chat', iconDomain: 'messenger.com', iconColor: '#006AFF', iconLetter: 'M' },
  { name: 'Viber',      packageName: 'com.viber.voip',              category: 'Messaging & Chat', iconDomain: 'viber.com',     iconColor: '#7360F2', iconLetter: 'V' },
  { name: 'Skype',      packageName: 'com.skype.raider',            category: 'Messaging & Chat', iconDomain: 'skype.com',     iconColor: '#00AFF0', iconLetter: 'S' },
  // ── Shopping ─────────────────────────────────────────────────────────────
  { name: 'Amazon Shopping', packageName: 'com.amazon.mShop.android.shopping', category: 'Shopping', iconDomain: 'amazon.com', iconColor: '#FF9900', iconLetter: 'A' },
  { name: 'eBay',            packageName: 'com.ebay.mobile',                   category: 'Shopping', iconDomain: 'ebay.com',   iconColor: '#E53238', iconLetter: 'e' },
  { name: 'Shein',           packageName: 'com.zzkko',                          category: 'Shopping', iconDomain: 'shein.com',  iconColor: '#000000', iconLetter: 'S' },
  { name: 'Temu',            packageName: 'com.einnovation.temu',               category: 'Shopping', iconDomain: 'temu.com',   iconColor: '#FB6600', iconLetter: 'T' },
  // ── Browsers ─────────────────────────────────────────────────────────────
  { name: 'Chrome',            packageName: 'com.android.chrome',          category: 'Browsers', iconDomain: 'google.com/chrome', iconColor: '#4285F4', iconLetter: 'C', popular: true },
  { name: 'Firefox',           packageName: 'org.mozilla.firefox',         category: 'Browsers', iconDomain: 'mozilla.org',       iconColor: '#FF7139', iconLetter: 'F' },
  { name: 'Samsung Internet',  packageName: 'com.sec.android.app.sbrowser', category: 'Browsers', iconDomain: 'samsung.com',      iconColor: '#1428A0', iconLetter: 'S' },
  { name: 'Opera',             packageName: 'com.opera.browser',           category: 'Browsers', iconDomain: 'opera.com',         iconColor: '#FF1B2D', iconLetter: 'O' },
  { name: 'Brave',             packageName: 'com.brave.browser',           category: 'Browsers', iconDomain: 'brave.com',         iconColor: '#FB542B', iconLetter: 'B' },
  { name: 'DuckDuckGo',        packageName: 'com.duckduckgo.mobile.android', category: 'Browsers', iconDomain: 'duckduckgo.com', iconColor: '#DE5833', iconLetter: 'D' },
  // ── Education ────────────────────────────────────────────────────────────
  { name: 'Duolingo',         packageName: 'com.duolingo',                       category: 'Education', iconDomain: 'duolingo.com',      iconColor: '#58CC02', iconLetter: 'D' },
  { name: 'Khan Academy',     packageName: 'org.khanacademy.android',             category: 'Education', iconDomain: 'khanacademy.org',   iconColor: '#14BF96', iconLetter: 'K' },
  { name: 'Google Classroom', packageName: 'com.google.android.apps.classroom',   category: 'Education', iconDomain: 'classroom.google.com', iconColor: '#1A73E8', iconLetter: 'G' },
  { name: 'Photomath',        packageName: 'com.microblink.photomath',            category: 'Education', iconDomain: 'photomath.com',     iconColor: '#6A0DAD', iconLetter: 'P' },
  { name: 'Quizlet',          packageName: 'com.quizlet.quizletandroid',          category: 'Education', iconDomain: 'quizlet.com',       iconColor: '#4257B2', iconLetter: 'Q' },
  { name: 'Coursera',         packageName: 'org.coursera.android',                category: 'Education', iconDomain: 'coursera.org',      iconColor: '#0056D2', iconLetter: 'C' },
  // ── Productivity & Tools ─────────────────────────────────────────────────
  { name: 'Google Docs',     packageName: 'com.google.android.apps.docs',        category: 'Productivity & Tools', iconDomain: 'docs.google.com',   iconColor: '#4285F4', iconLetter: 'G' },
  { name: 'Google Sheets',   packageName: 'com.google.android.apps.spreadsheets', category: 'Productivity & Tools', iconDomain: 'sheets.google.com', iconColor: '#0F9D58', iconLetter: 'G' },
  { name: 'Microsoft Word',  packageName: 'com.microsoft.office.word',           category: 'Productivity & Tools', iconDomain: 'microsoft.com',     iconColor: '#2B579A', iconLetter: 'W' },
  { name: 'Notion',          packageName: 'notion.id',                            category: 'Productivity & Tools', iconDomain: 'notion.so',         iconColor: '#000000', iconLetter: 'N' },
  { name: 'Zoom',            packageName: 'us.zoom.videomeetings',               category: 'Productivity & Tools', iconDomain: 'zoom.us',           iconColor: '#2D8CFF', iconLetter: 'Z' },
  { name: 'Google Meet',     packageName: 'com.google.android.apps.meetings',    category: 'Productivity & Tools', iconDomain: 'meet.google.com',   iconColor: '#00AC47', iconLetter: 'M' },
  { name: 'VPN apps',        packageName: 'com.nordvpn.android',                 category: 'Productivity & Tools', iconDomain: 'nordvpn.com',       iconColor: '#4687FF', iconLetter: 'V' },
];

/** Popular apps pinned at the top of the Apps tab */
export const POPULAR_APPS: CatalogApp[] = APP_CATALOG.filter((app) => app.popular);

/** Apps grouped by category */
export function getAppsByCategory(): Record<AppCategory, CatalogApp[]> {
  const result = {} as Record<AppCategory, CatalogApp[]>;
  for (const category of APP_CATEGORIES) {
    result[category] = APP_CATALOG.filter((app) => app.category === category);
  }
  return result;
}

/** Filter all apps by a search string (matches name or package name) */
export function searchApps(query: string): CatalogApp[] {
  const q = query.toLowerCase().trim();
  if (!q) return APP_CATALOG;
  return APP_CATALOG.filter(
    (app) =>
      app.name.toLowerCase().includes(q) ||
      app.packageName.toLowerCase().includes(q) ||
      app.category.toLowerCase().includes(q),
  );
}
