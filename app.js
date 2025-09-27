let listings = [];
let meta = {};
let currentPage = 0;
const pageSize = 10;

function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

async function loadData() {
  listings = await fetch('data/listings.json').then(r => r.json());
  meta = await fetch('data/_meta.json').then(r => r.json());
  const tz = 'Australia/Brisbane';
  const refreshed = new Date(meta.generatedAt).toLocaleString('en-AU', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' });
  document.getElementById('lastRefreshed').textContent = refreshed || 'N/A';
  updateTable();
}

function getFilteredSorted() {
  const searchVal = document.getElementById('search').value.toLowerCase();
  const minB = parseInt(document.getElementById('minBeds').value) || 0;
  const st = document.getElementById('statusFilter').value;
  const isNewChipActive = document.querySelector('.chip[data-filter="new"]').classList.contains('active');
  const is3BedsChipActive = document.querySelector('.chip[data-filter="3beds"]').classList.contains('active');
  const sortVal = document.getElementById('sort').value;

  let filtered = listings.filter(l => {
    if (searchVal && !l.address.toLowerCase().includes(searchVal) && !l.price.toLowerCase().includes(searchVal)) return false;
    if (l.beds < minB) return false;
    if (st && l.status !== st) return false;
    if (isNewChipActive && (l.status !== 'Available' || l.daysAvailable > 3)) return false;
    if (is3BedsChipActive && l.beds < 3) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'Available' ? -1 : 1;
    let aVal, bVal;
    switch (sortVal) {
      case 'bedsAsc': return a.beds - b.beds;
      case 'bedsDesc': return b.beds - a.beds;
      case 'priceAsc':
        aVal = parseInt(a.price.replace(/\D/g, '')) || 0;
        bVal = parseInt(b.price.replace(/\D/g, '')) || 0;
        return aVal - bVal;
      case 'priceDesc':
        aVal = parseInt(a.price.replace(/\D/g, '')) || 0;
        bVal = parseInt(b.price.replace(/\D/g, '')) || 0;
        return bVal - aVal;
      case 'daysAsc':
        aVal = a.status === 'Available' ? a.daysAvailable : a.daysToLease;
        bVal = b.status === 'Available' ? b.daysAvailable : b.daysToLease;
        return aVal - bVal;
      case 'daysDesc':
        aVal = a.status === 'Available' ? a.daysAvailable : a.daysToLease;
        bVal = b.status === 'Available' ? b.daysAvailable : b.daysToLease;
        return bVal - aVal;
      case 'newFirst':
      default:
        return a.daysAvailable - b.daysAvailable; // Small days first (new)
    }
  });

  return filtered;
}

function renderTable(pageData) {
  const tbody = document.querySelector('#listingsTable tbody');
  tbody.innerHTML = '';
  const todayStr = new Date().toISOString().split('T')[0];
  pageData.forEach(l => {
    const tr = document.createElement('tr');
    const addressTd = document.createElement('td');
    addressTd.innerHTML = `<a href="${l.link}" target="_blank">${l.address}</a>`;
    if (daysBetween(l.firstSeen, todayStr) <= 3) addressTd.innerHTML += ' <span class="badge new">NEW</span>';
    tr.appendChild(addressTd);
    tr.appendChild(document.createElement('td')).textContent = l.beds;
    tr.appendChild(document.createElement('td')).textContent = l.price;
    const statusTd = document.createElement('td');
    statusTd.innerHTML = `<span class="badge ${l.status.toLowerCase()}">${l.status}</span>`;
    tr.appendChild(statusTd);
    tr.appendChild(document.createElement('td')).textContent = l.status === 'Available' ? l.daysAvailable : l.daysToLease;
    tbody.appendChild(tr);
  });
}

function updatePagination(filtered) {
  const pages = Math.ceil(filtered.length / pageSize);
  const tops = document.getElementById('paginationTop');
  const bottoms = document.getElementById('paginationBottom');
  [tops, bottoms].forEach(pag => {
    pag.innerHTML = '';
    for (let i = 0; i < pages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i + 1;
      if (i === currentPage) btn.classList.add('active');
      btn.addEventListener('click', () => {
        currentPage = i;
        updateTable();
      });
      pag.appendChild(btn);
    }
  });
}

function updateTable() {
  const filtered = getFilteredSorted();
  const start = currentPage * pageSize;
  const pageData = filtered.slice(start, start + pageSize);
  renderTable(pageData);
  updatePagination(filtered);
  document.getElementById('liveRegion').textContent = `Showing ${filtered.length} listings`;
}

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  document.getElementById('search').addEventListener('input', () => { currentPage = 0; updateTable(); });
  document.getElementById('clearSearch').addEventListener('click', () => {
    document.getElementById('search').value = '';
    currentPage = 0;
    updateTable();
  });
  document.getElementById('minBeds').addEventListener('input', () => { currentPage = 0; updateTable(); });
  document.getElementById('statusFilter').addEventListener('change', () => { currentPage = 0; updateTable(); });
  document.getElementById('sort').addEventListener('change', () => { currentPage = 0; updateTable(); });
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      currentPage = 0;
      updateTable();
    });
  });
});

init();

