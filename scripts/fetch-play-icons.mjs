import gplay from 'google-play-scraper';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DELAY_MS = 400;
const BATCH_SIZE = 5;
const OUTPUT_PATH = resolve(ROOT, 'src/data/playStoreIcons.json');

const EXTRA_PACKAGES = [
  'com.google.android.youtube','com.google.android.gm',
  'com.google.android.apps.docs','com.google.android.apps.tachyon',
  'com.google.android.apps.messaging','com.google.android.apps.photos',
  'com.google.android.calendar','com.google.android.apps.translate',
  'com.google.android.apps.maps','com.google.android.apps.bard',
  'com.google.android.apps.podcasts','com.google.android.apps.subscriptions.red',
  'com.google.android.apps.walletnfcrel','com.google.android.apps.nbu.paisa.user',
  'com.google.android.googlequicksearchbox','com.google.android.apps.magazines',
  'com.google.android.apps.nbu.files','com.google.android.apps.authenticator2',
  'com.google.android.apps.docs.editors.docs','com.google.android.apps.docs.editors.sheets',
  'com.google.android.apps.docs.editors.slides','com.google.android.videos',
  'com.google.android.apps.chromecast.app','com.google.android.apps.work.clouddpc',
  'com.google.ar.lens','com.google.android.dialer','com.google.android.contacts',
  'com.android.chrome','com.android.vending',
  'com.microsoft.office.outlook','com.microsoft.office.excel',
  'com.microsoft.office.onenote','com.microsoft.skydrive','com.microsoft.teams',
  'com.microsoft.todos','com.microsoft.copilot','com.microsoft.emmx',
  'com.microsoft.appmanager','com.azure.authenticator',
  'com.netflix.mediaclient','com.spotify.music',
  'com.google.android.apps.youtube.music','org.videolan.vlc',
  'com.letterboxd.letterboxd','com.lemon.lvoverseas',
  'com.instagram.barcelona','com.whatsapp.w4b','com.facebook.orca',
  'us.zoom.videomeetings','com.linkedin.android','com.grammarly.android.keyboard',
  'com.github.android','com.openai.chatgpt','ai.perplexity.app.android',
  'ai.x.grok','com.anthropic.claude','com.anydesk.anydeskandroid',
  'com.Splitwise.SplitwiseMobile','org.zwanoo.android.speedtest',
  'com.substack.app','com.deepstash','com.glasswire.android','com.termux',
  'com.wakdev.wdnfc','com.intsig.camscanner','com.cliffweitzman.speechify2',
  'com.desmos.calculator','free.vpn.unblock.proxy.turbovpn',
  'com.musescore.playerlite','com.moodle.moodlemobile','com.truecaller',
  'com.ubercab','com.ubercab.eats','com.booking','com.coinbase.android',
  'com.coinmarketcap.android','io.metamask','com.binance.dev',
  'org.kde.kdeconnect_tp','com.niksoftware.snapseed','com.kmplayer',
  'com.rdiscovery','com.nglreactnative','lk.bhasha.helakuru',
  'com.ceb.lk.cebcare','com.slt.selfcare','com.mobitel.selfcare',
  'com.ofss.fcdb.mobile.android.phone.boc.launcher','com.bankofceylon.smartpay',
  'com.boc.itdiv.smartpassbook','net.combank.passbook',
  'com.euronetindia.combankqpluscustomer','com.nationstrust.frimi',
  'lk.mintpay.app','com.sl.koko.bnpl','com.pickme.passenger',
  'lk.gamma.pizzakraft.PizzaHut','com.jkit.keellsretailapp','com.keellsnexus.lk',
  'com.daraz.android','gen.tech.impulse.android','com.dominos.srilanka',
  'com.spaceylon.lk','com.playcloud.console','com.noodlecake.altosadventure',
  'com.vectorunit.cobalt.googleplay','com.pocketchamps.game',
  'games.vaveda.militaryoverturn','com.hp.printercontrol','com.tplink.tether',
  'com.tplink.networktoolsbox','com.connect.enduser','com.sony.songpal.mdr',
  'com.bose.app.android.brussels','com.solaxcloud.starter','com.bumble.app',
  'com.quickcursor','advanced.scientific.calculator.calc991.plus',
  'pdf.pdfreader.viewer.editor.free','com.brokenscrnapp.blocktouchinbrokenscreen',
  'io.faceapp','com.heytap.cloud','com.whatnot_mobile',
  'com.burockgames.timeclocker','musclebooster.workout.home.gym.abs.loseweight',
  'com.gymstreaklabs.GymLevels','com.v2raytun.android',
  'org.chromium.webapk.af4a744e87696345c_v2',
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function extractCatalogPackages() {
  const catalogPath = resolve(ROOT, 'src/data/kidsAppCatalog.ts');
  if (!existsSync(catalogPath)) return [];
  const src = readFileSync(catalogPath, 'utf8');
  return [...src.matchAll(/packageName:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

async function fetchAppData(packageName) {
  try {
    const data = await gplay.app({ appId: packageName, lang: 'en', country: 'us' });
    return { iconUrl: data.icon, title: data.title, score: data.score ?? null, genre: data.genre ?? null };
  } catch { return null; }
}

async function fetchBatch(packages, existingData) {
  const results = { ...existingData };
  const toFetch = packages.filter((p) => !Object.prototype.hasOwnProperty.call(results, p));
  console.log(`\n📦 Fetching icons for ${toFetch.length} packages (${packages.length - toFetch.length} cached)...\n`);
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchAppData));
    batch.forEach((pkg, idx) => {
      const data = batchResults[idx];
      results[pkg] = data;
      console.log(data ? `  ✅  ${pkg.padEnd(55)} → ${data.title}` : `  ❌  ${pkg.padEnd(55)} → not found`);
    });
    writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
    if (i + BATCH_SIZE < toFetch.length) await sleep(DELAY_MS);
  }
  return results;
}

async function main() {
  console.log('🎮 GuardHUB — Play Store icon fetcher\n');
  const catalogPackages = extractCatalogPackages();
  const allPackages = [...new Set([...catalogPackages, ...EXTRA_PACKAGES])];
  console.log(`📋 Total unique packages: ${allPackages.length}`);
  let existingData = {};
  if (existsSync(OUTPUT_PATH)) {
    try { existingData = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')); } catch {}
  }
  const finalData = await fetchBatch(allPackages, existingData);
  const found = Object.values(finalData).filter(Boolean).length;
  console.log(`\n✅ Done! ${found} icons found. Output: ${OUTPUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
