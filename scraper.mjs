/**
 * Alice Springs Rentals Scraper (Node 20 ESM + Cheerio)
 * Fix: Use Cheerio ESM named export (import { load } from 'cheerio')
 */

import { load } from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Config ----
const TARGET_URL = 'https://www.realestate.com.au/rent/in-alice+springs+-+greater+region,+nt/list-1?source=refinement';
const DATA_DIR = path.join(__dirname, 'data');
const LISTINGS_PATH = path.join(DATA_DIR, 'listings.json');
const META_PATH = path.join(DATA_DIR, '_meta.json');

// ---- Helpers ----
const ONE_DAY_MS = 86_400_000;
const todayStr = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function daysBetween(isoStart, isoEnd) {
  try {
    const a = new Date(isoStart);
    const b = new Date(isoEnd);
    return Math.max(1, Math.floor((b - a) / ONE_DAY_MS) + 1);
  } catch {
    return 1;
  }
}

const textOrNull = (s) => (s ? s.trim() : null);

  }

  let beds = null;
  const bedsNode = $(card).find('[aria-label*="bed"], [data-testid*="bed"]').first();
  if (bedsNode.length) {
    const t = bedsNode.attr('aria-label') || bedsNode.text();
    const m = t && t.match(/(\d+)\s*(bed|br)/i);
    if (m) beds = Number(m[1]);
  }
  if (beds == null) {
    const features = textOrNull($(card).find('[data-testid="property-features-text"]').first().text());
    if (features) {
      const m = features.match(/(^|\s)(\d+)\s+(\d+)?\s+(\d+)?/); // e.g. "3 2 1 • House"
      if (m) beds = Number(m[2]);
    }
  }
  if (beds == null) {
    const txt = $(card).text();
    const m = txt.match(/(\d+)\s*(?:bed|beds|br|Bedroom|Bedrooms)/i);
    if (m) beds = Number(m[1]);
  }

  return {
    address: address || null,
    price: price || null,
    beds: Number.isFinite(beds) ? beds : null,
    link: linkAbs
  };
}

async function loadExisting() {
  try {
    const raw = await fs.readFile(LISTINGS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

}
async function saveAll(items) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LISTINGS_PATH, JSON.stringify(items, null, 2) + '\n', 'utf8');
  await fs.writeFile(META_PATH, JSON.stringify({ generatedAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');
}


async function fetchHtml() {
  const res = await fetch(TARGET_URL, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; AliceSpringsRentalTrends/1.0; +https://github.com/)',
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

async function main() {
  console.log(`Start refresh ${new Date().toUTCString()}`);
  const existing = await loadExisting();
  const byKey = new Map(existing.map((x) => [x.link || `${x.address}|${x.beds}|${x.price}`, x]));

  let html;
  try {
    html = await fetchHtml();
  } catch (err) {
    console.error('Fetch error:', err.message);
    console.error('Aborting without changes.');
    return;
  }

  await sleep(750);

  const $ = cheerio.load(html);
  const anchors = $('a[href*="/property-"]').toArray();

  const seenToday = new Set();
  const upserts = [];

  for (const a of anchors) {
    const href = $(a).attr('href');
    if (!href) continue;
    const linkAbs = href.startsWith('http') ? href : `https://www.realestate.com.au${href}`;

    const card = $(a).closest('article, li, div').first();
    if (!card || card.length === 0) continue;

    const row = extractFields($, card, linkAbs);
    if (!row.address && !row.price) continue;

    const key = row.link || `${row.address}|${row.beds}|${row.price}`;
    seenToday.add(key);

    const ex = byKey.get(key);
    if (ex) {
      ex.address = row.address ?? ex.address;
      ex.price = row.price ?? ex.price;
      ex.beds = row.beds ?? ex.beds;
      ex.link = row.link;
      ex.status = 'Available';
      ex.lastSeen = todayStr;
      ex.lastSeenAvailable = todayStr;
      ex.daysAvailable = daysBetween(ex.firstSeen, ex.lastSeenAvailable);
      upserts.push(ex);
    } else {
      const first = {
        address: row.address,
        beds: row.beds,
        price: row.price,
        link: row.link,
        status: 'Available',
        firstSeen: todayStr,
        lastSeen: todayStr,
        lastSeenAvailable: todayStr,
        daysAvailable: 1,
        daysToLease: null
      };
      upserts.push(first);
    }
  }

  for (const old of existing) {
    const key = old.link || `${old.address}|${old.beds}|${old.price}`;
    if (!seenToday.has(key)) {
      if (old.status !== 'Leased') {
        old.status = 'Leased';
        if (!old.daysToLease) {
          old.daysToLease = daysBetween(old.firstSeen, old.lastSeenAvailable || old.lastSeen || todayStr);
        }
      }
      upserts.push(old);
    }
  }

  const merged = [];
  const seenKeys = new Set();
  for (const it of upserts) {
    const k = it.link || `${it.address}|${it.beds}|${it.price}`;
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    merged.push(it);
  }

  merged.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Available' ? -1 : 1;
    const da = a.status === 'Available' ? a.daysAvailable : a.daysToLease || -1;
    const db = b.status === 'Available' ? b.daysAvailable : b.daysToLease || -1;
    if (db !== da) return db - da;
    return (b.beds || 0) - (a.beds || 0);
  });

  await saveAll(merged);
  console.log(`Saved ${merged.length} rows at ${new Date().toUTCString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


