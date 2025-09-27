/* Alice Springs Rentals – polished UI & “New first” logic */

// Labels
const LABELS = {
  lastRefreshed: 'Last refreshed',
  daysAvailable: 'Days available',
  daysToLease: 'Days to lease',
};

// State
let ALL = [];
let PAGE = 1;
const PAGE_SIZE = 20;
let onlyNew = false; // quick filter
const qs = (s) => document.querySelector(s);

// Elements
const live = qs('#live');
const tbody = qs('#table tbody');
const searchEl = qs('#search');
const clearSearchEl = qs('#clearSearch');
const minBedsEl = qs('#minBeds');
const statusEl = qs('#statusFilter');
const sortEl = qs('#sort');

// pagination (top & bottom)
const prevEl = qs('#prev');
const nextEl = qs('#next');
const pageInfoEl = qs('#pageInfo');
const prevTopEl = qs('#prevTop');
const nextTopEl = qs('#nextTop');
const pageInfoTopEl = qs('#pageInfoTop');

// quick chips
const chipNewEl = qs('#chipNew');
const chip3plusEl = qs('#chip3plus');

// KPIs
const kpiNewEl = qs('#kpiNew');
const kpiAvailEl = qs('#kpiAvail');
const kpiLeasedEl = qs('#kpiLeased');

// Footer meta
const metaEl = qs('#meta');

function isNew(item) {
  if (item.status !== 'Available') return false;
  if (!item.firstSeen) return false;
  const d = daysBetween(item.firstSeen, todayStr());
  return d <= 3; // new within last 3 days
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysBetween(d1, d2) {
  return Math.max(0, Math.floor((Date.parse(d2) - Date.parse(d1)) / 86400000));
}

function parsePriceToNumber(priceStr) {
  if (!priceStr) return null;
  const m = priceStr.replace(/,/g, '').match(/\$?\s*([\d\.]+)/);
  return m ? parseInt(m[1], 10) : null;
}
function getDaysValue(item) {
  return item.status === 'Available' ? item.daysAvailable : (item.daysToLease ?? null);
}
function heatClass(days) {
  if (days == null) return '';
  if (days <= 7) return 'heat-1';
  if (days <= 21) return 'heat-2';
  return 'heat-3';
}

async function getJSON(url) {
  const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Filtering + sorting pipeline
function applyFiltersSort() {
  const term = (searchEl.value || '').toLowerCase().trim();
  let minBeds = parseInt(minBedsEl.value || '0', 10);
  const status = statusEl.value;

  if (chip3plusEl?.getAttribute('aria-pressed') === 'true' && (!minBeds || minBeds < 3)) {
    minBeds = 3;
    if (minBedsEl) minBedsEl.value = '3';
  }

  let rows = ALL.filter(it => {
    const addrOk = !term || (it.address || '').toLowerCase().includes(term);
    const bedsOk = !Number.isFinite(minBeds) ? true : ((it.beds ?? 0) >= minBeds);
    const statusOk = (status === 'All') ? true : (it.status === status);
    const newOk = !onlyNew || isNew(it);
    return addrOk && bedsOk && statusOk && newOk;
  });

  const by = sortEl.value;
  rows.sort((a, b) => {
    if (by === 'newFirst') {
      const an = isNew(a) ? 1 : 0;
      const bn = isNew(b) ? 1 : 0;
      if (bn - an !== 0) return bn - an; // new first
      // then available first
      const s = (a.status === 'Available' ? 0 : 1) - (b.status === 'Available' ? 0 : 1);
      if (s !== 0) return s;
      // then most recently seen available
      return String(b.lastSeenAvailable).localeCompare(String(a.lastSeenAvailable));
    }

    const daysA = getDaysValue(a);
    const daysB = getDaysValue(b);
    const priceA = parsePriceToNumber(a.price) ?? Number.POSITIVE_INFINITY;
    const priceB = parsePriceToNumber(b.price) ?? Number.POSITIVE_INFINITY;
    const bedsA = a.beds ?? -1;
    const bedsB = b.beds ?? -1;

    switch (by) {
      case 'bedsAsc': return bedsA - bedsB;
      case 'bedsDesc': return bedsB - bedsA;
      case 'priceAsc': return priceA - priceB;
      case 'priceDesc': return priceB - priceA;
      case 'daysAsc': return (daysA ?? 1e9) - (daysB ?? 1e9);
      case 'daysDesc': return (daysB ?? -1) - (daysA ?? -1);
      default: {
        const s = (a.status === 'Available' ? 0 : 1) - (b.status === 'Available' ? 0 : 1);
        if (s !== 0) return s;
        return String(b.lastSeenAvailable).localeCompare(String(a.lastSeenAvailable));
      }
    }
  });

  return rows;
}

// Rendering
function render(rows, page = 1) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  PAGE = Math.min(Math.max(1, page), pageCount);

  const start = (PAGE - 1) * PAGE_SIZE;
  const chunk = rows.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = chunk.map(item => {
    const days = getDaysValue(item);
    const daysLabel = item.status === 'Available' ? LABELS.daysAvailable : LABELS.daysToLease;
    const daysClass = `days ${heatClass(days)}`;
    const statusClass = item.status === 'Available' ? 'badge available' : 'badge leased';
    const safeLink = (item.link || '#');
    const newTag = isNew(item) ? `<span class="tag-new">NEW</span>` : '';

    return `<tr class="${isNew(item) ? 'new-row' : ''}">
      <td>
        <div class="address">
          ${newTag}
          <a class="address__text" href="${safe|| '—')}</a>
        </div>
      </td>
      <td class="td-numeric">${item.beds ?? '—'}</td>
      <td class="td-numeric">${escapeHtml(item.price || '—')}</td>
      <td><span class="${statusClass}">${item.status}</span></td>
      <td class="td-numeric"><span class="${daysClass}">${days ?? '—'}</span></td>
    </tr>`;
  }).join('');

  // pagination sync (bottom)
  prevEl.disabled = (PAGE <= 1);
  nextEl.disabled = (PAGE >= pageCount);
  pageInfoEl.textContent = `Page ${PAGE} / ${pageCount} — ${total} listing${total === 1 ? '' : 's'}`;

  // pagination sync (top)
  prevTopEl.disabled = (PAGE <= 1);
  nextTopEl.disabled = (PAGE >= pageCount);
  pageInfoTopEl.textContent = pageInfoEl.textContent;

  live.textContent = `Loaded ${total} listing${total === 1 ? '' : 's'}.`;
}

function updateKpis(all) {
  const avail = all.filter(x => x.status === 'Available').length;
  const leased = all.filter(x => x.status === 'Leased').length;
  const fresh = all.filter(isNew).length;
  kpiAvailEl.textContent = String(avail);
  kpiLeasedEl.textContent = String(leased);
  kpiNewEl.textContent = String(fresh);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Init
async function init() {
  try {
    const [listings, meta] = await Promise.all([
      getJSON('./data/listings.json').catch(() => []),
      getJSON('./data/_meta.json').catch(() => ({ generatedAt: null })),
    ]);
    ALL = Array.isArray(listings) ? listings : [];
    // Default filters: Available, New first
    statusEl.value = 'Available';
    sortEl.value = 'newFirst';
    updateKpis(ALL);

    const rows = applyFiltersSort();
    render(rows, 1);

    if (meta?.generatedAt) {
      const dt = new Date(meta.generatedAt);
      metaEl.textContent = `${LABELS.lastRefreshed}: ${dt.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`;
    } else {
      metaEl.textContent = `${LABELS.lastRefreshed}: n/a`;
    }
  } catch (err) {
    live.textContent = `Failed to load data: ${err.message}`;
  }
}

// Events
function reapply(resetPage = true) {
  const rows = applyFiltersSort();
  render(rows, resetPage ? 1 : PAGE);
}

searchEl.addEventListener('input', () => reapply(true));
clearSearchEl.addEventListener('click', () => { searchEl.value = ''; reapply(true); });
minBedsEl.addEventListener('input', () => reapply(true));
statusEl.addEventListener('change', () => reapply(true));
sortEl.addEventListener('change', () => reapply(true));

prevEl.addEventListener('click', () => { PAGE = Math.max(1, PAGE - 1); reapply(false); });
nextEl.addEventListener('click', () => { PAGE = PAGE + 1; reapply(false); });
prevTopEl.addEventListener('click', () => { PAGE = Math.max(1, PAGE - 1); reapply(false); });
nextTopEl.addEventListener('click', () => { PAGE = PAGE + 1; reapply(false); });

chipNewEl.addEventListener('click', () => {
  const on = chipNewEl.getAttribute('aria-pressed') === 'true';
  chipNewEl.setAttribute('aria-pressed', String(!on));
  onlyNew = !on;
  // If turning on, also force status to Available
  if (onlyNew) statusEl.value = 'Available';
  reapply(true);
});

chip3plusEl.addEventListener('click', () => {
  const on = chip3plusEl.getAttribute('aria-pressed') === 'true';
  chip3plusEl.setAttribute('aria-pressed', String(!on));
  if (!on) {
    minBedsEl.value = '3';
  } else {
    if (parseInt(minBedsEl.value || '0', 10) === 3) minBedsEl.value = '';
  }
  reapply(true);
});

init();
