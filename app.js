/* global fetch */
const DATA_URL = './data/listings.json';
const META_URL = './data/_meta.json';

const $rows = document.getElementById('rows');
const $empty = document.getElementById('empty');
const $q = document.getElementById('q');
const $minBeds = document.getElementById('minBeds');
const $status = document.getElementById('status');
const $sortBy = document.getElementById('sortBy');
const $last = document.getElementById('lastRefreshed');

let listings = [];

async function load() {
  const [dataRes, metaRes] = await Promise.all([fetch(DATA_URL), fetch(META_URL)]);
  listings = await dataRes.json().catch(() => []);
  const meta = await metaRes.json().catch(() => ({}));
  if (meta.generatedAt) {
    const dt = new Date(meta.generatedAt);
    $last.textContent = `Last refreshed: ${dt.toUTCString()}`;
  } else {
    $last.textContent = `Last refreshed: unknown`;
  }
  render();
}

function parsePriceNum(p) {
  if (!p) return null;
  const m = p.replace(/,/g, '').match(/\$?\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
}

function applyFilters(data) {
  const needle = ($q.value || '').trim().toLowerCase();
  const minBeds = Number($minBeds.value || 0);
  const status = $status.value;

  return data.filter((x) => {
    const okQ = !needle || (x.address || '').toLowerCase().includes(needle);
    const okBeds = !Number.isFinite(minBeds) ? true : (Number(x.beds) || 0) >= minBeds;
    const okStatus = status === 'all' ? true : x.status === status;
    return okQ && okBeds && okStatus;
  });
}

function applySort(data) {
  const key = $sortBy.value;
  const byNum = (v) => (Number.isFinite(v) ? v : -Infinity);
  const byPrice = (p) => byNum(parsePriceNum(p));

  const copy = data.slice();
  switch (key) {
    case 'bedsAsc': copy.sort((a, b) => byNum(a.beds) - byNum(b.beds)); break;
    case 'bedsDesc': copy.sort((a, b) => byNum(b.beds) - byNum(a.beds)); break;
    case 'priceAsc': copy.sort((a, b) => byPrice(a.price) - byPrice(b.price)); break;
    case 'priceDesc': copy.sort((a, b) => byPrice(b.price) - byPrice(a.price)); break;
    case 'daysAsc': copy.sort((a, b) => byNum(a.status === 'Available' ? a.daysAvailable : a.daysToLease)
                                - byNum(b.status === 'Available' ? b.daysAvailable : b.daysToLease)); break;
    case 'daysDesc': copy.sort((a, b) => byNum(b.status === 'Available' ? b.daysAvailable : b.daysToLease)
                                - byNum(a.status === 'Available' ? a.daysAvailable : a.daysToLease)); break;
    default:
      // status: Available first, then daysAvailable desc
      copy.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'Available' ? -1 : 1;
        const da = a.status === 'Available' ? a.daysAvailable : a.daysToLease;
        const db = b.status === 'Available' ? b.daysAvailable : b.daysToLease;
        return byNum(db) - byNum(da);
      });
  }
  return copy;
}

function render() {
  const filtered = applyFilters(listings);
  const data = applySort(filtered);

  $rows.innerHTML = data.map((x) => {
    const days = x.status === 'Available' ? x.daysAvailable : x.daysToLease;
    const badge = x.status === 'Available'
      ? `<span class="badge available">Available</span>`
      : `<span class="badge leased">Leased</span>`;
    const link = x.link ? `${x.link}${x.address || '(address unavailable)'}</a>`
                        : `${x.address || '(address unavailable)'}`;
    return `<tr>
      <td>${link}</td>
      <td>${x.beds ?? ''}</td>
      <td>${x.price ?? ''}</td>
      <td>${badge}</td>
      <td>${Number.isFinite(days) ? days : ''}</td>
    </tr>`;
  }).join('');

  $empty.classList.toggle('hidden', data.length !== 0);
}

for (const el of [$q, $minBeds, $status, $sortBy]) {
  el.addEventListener('input', render);
}

load();
