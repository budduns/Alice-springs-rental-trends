import { load } from 'cheerio';
import fs from 'fs';
import path from 'path';

const URL = 'https://www.realestate.com.au/rent/in-alice+springs+-+greater+region,+nt/list-1?activeSort=relevance';
const LISTINGS_PATH = path.join('data', 'listings.json');
const META_PATH = path.join('data', '_meta.json');

function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage() {
  let attempts = 0;
  let html = null;
  while (attempts < 2) {
    try {
      const response = await fetch(URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      if (!response.ok) {
        console.error(`HTTP error! Status: ${response.status}`);
        attempts++;
        await sleep(5000);
        continue;
      }
      html = await response.text();
      if (!html || html.trim() === '') {
        console.error('Empty or invalid HTML response');
        attempts++;
        await sleep(5000);
        continue;
      }
      console.log('Fetched HTML successfully');
      return html;
    } catch (error) {
      console.error('Fetch error:', error.message);
      attempts++;
      if (attempts < 2) await sleep(5000);
    }
  }
  console.error('Failed to fetch page after retries');
  return null; // Return null if all attempts fail
}

function extractListings($) {
  const listings = [];
  $('article').each((i, el) => {
    const $el = $(el);
    let address = $el.find('[data-testid="listing-card-address"]').text().trim()
      || $el.find('.residential-card__address-heading').text().trim()
      || $el.find('address, h2, h3, .address').text().trim();
    if (!address) return;

    let bedsStr = $el.find('[aria-label*="bed"], [data-testid*="bed"]').text().trim();
    let beds = parseInt(bedsStr) || null;
    if (!beds) {
      const match = $el.text().match(/(\d+)\s*(bed|beds|br|bedroom|bedrooms)/i);
      beds = match ? parseInt(match[1]) : null;
    }

    let price = $el.find('[data-testid="listing-card-price"], .property-price, .residential-card__price').text().trim();
    if (!price || !price.includes('$')) {
      const priceMatch = $el.text().match(/\$[\d,]+(\s*per week)?/);
      price = priceMatch ? priceMatch[0] : null;
    }

    let link = $el.find('a[href*="/property-"]').attr('href');
    if (link) link = new URL(link, 'https://www.realestate.com.au').href;

    if (address && beds && price && link) {
      listings.push({ address, beds, price, link });
    }
  });
  return listings;
}

async function main() {
  try {
    const html = await fetchPage();
    if (!html) {
      console.log('No valid HTML to parse, exiting without changes.');
      return;
    }
    const $ = load(html);
    const newListings = extractListings($);
    if (newListings.length === 0) {
      console.log('No listings found, exiting without changes.');
      return;
    }

    let existing = [];
    if (fs.existsSync(LISTINGS_PATH)) {
      existing = JSON.parse(fs.readFileSync(LISTINGS_PATH, 'utf8'));
    }

    const existingMap = new Map(existing.map(l => [l.link, l]));

    for (const nl of newListings) {
      let listing = existingMap.get(nl.link);
      if (listing) {
        listing.lastSeen = todayStr;
        listing.lastSeenAvailable = todayStr;
        listing.daysAvailable = daysBetween(listing.firstSeen, todayStr);
      } else {
        listing = {
          ...nl,
          status: 'Available',
          firstSeen: todayStr,
          lastSeen: todayStr,
          lastSeenAvailable: todayStr,
          daysAvailable: 1,
          daysToLease: null
        };
      }
      existingMap.set(nl.link, listing);
    }

    for (const [link, listing] of existingMap) {
      if (listing.lastSeen !== todayStr) {
        listing.status = 'Leased';
        if (listing.daysToLease === null) {
          listing.daysToLease = daysBetween(listing.firstSeen, listing.lastSeenAvailable);
        }
      }
    }

    const updatedListings = Array.from(existingMap.values());
    updatedListings.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Available' ? -1 : 1;
      return a.daysAvailable - b.daysAvailable; // Small days first (new first)
    });

    fs.writeFileSync(LISTINGS_PATH, JSON.stringify(updatedListings, null, 2));
    fs.writeFileSync(META_PATH, JSON.stringify({ generatedAt: today.toISOString() }, null, 2));
  } catch (error) {
    console.error('Error in main:', error);
  }
}

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
main();


