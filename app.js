let listings = [];
let currentPage = 1;
const itemsPerPage = 10;
let sortColumn = 'address';
let sortDirection = 1;

function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

async function loadData() {
  try {
    console.log('Fetching listings.json...');
    const response = await fetch('data/listings.json');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    listings = await response.json();
    console.log('Listings loaded:', listings.length, 'items');
    const metaResponse = await fetch('data/_meta.json');
    if (!metaResponse.ok) throw new Error(`HTTP error for _meta.json! Status: ${metaResponse.status}`);
    const meta = await metaResponse.json();
    const tz = 'Australia/Brisbane';
    const refreshed = new Date(meta.generatedAt).toLocaleString('en-AU', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' });
    document.getElementById('lastRefreshed').textContent = refreshed || 'N/A';
  } catch (error) {
    console.error('Error loading data:', error);
    const lastRefreshed = document.getElementById('lastRefreshed');
    if (lastRefreshed) lastRefreshed.textContent = 'Error loading data';
    else console.warn('lastRefreshed element not found');
  }
  if (document.readyState === 'complete') {
    renderTable();
    setupEventListeners();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      renderTable();
      setupEventListeners();
    });
  }
}

function renderTable() {
  const tbody = document.querySelector('#listings-table tbody');
  tbody.innerHTML = '';

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedListings = listings.slice().sort((a, b) => {
    let valueA = a[sortColumn];
    let valueB = b[sortColumn];
    if (sortColumn === 'daysAvailable' || sortColumn === 'beds') {
      valueA = parseInt(valueA) || 0;
      valueB = parseInt(valueB) || 0;
    } else if (sortColumn === 'price') {
      valueA = parseInt(valueA.replace(/\D/g, '')) || 0;
      valueB = parseInt(valueB.replace(/\D/g, '')) || 0;
    }
    return valueA > valueB ? sortDirection : -sortDirection;
  });

  const searchTerm = document.getElementById('search-bar').value.toLowerCase();
  const filteredListings = searchTerm
    ? paginatedListings.filter(listing =>
        listing.address.toLowerCase().includes(searchTerm) ||
        listing.beds.toString().includes(searchTerm) ||
        listing.price.toLowerCase().includes(searchTerm) ||
        listing.status.toLowerCase().includes(searchTerm)
      )
    : paginatedListings;

  filteredListings.slice(start, end).forEach(listing => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${listing.address}</td>
      <td>${listing.beds}</td>
      <td>${listing.price}</td>
      <td>${listing.daysAvailable || 'N/A'}</td>
      <td>${listing.status}</td>
      <td><a href="${listing.link}" target="_blank">View</a></td>
    `;
    tbody.appendChild(row);
  });

  updatePagination(filteredListings.length);
}

function updatePagination(totalItems) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  document.getElementById('prev-page').disabled = currentPage === 1;
  document.getElementById('next-page').disabled = currentPage === totalPages;
  document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
}

function setupEventListeners() {
  document.querySelectorAll('#listings-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      if (sortColumn === column) {
        sortDirection *= -1;
      } else {
        sortColumn = column;
        sortDirection = 1;
      }
      const sortIcon = th.querySelector('.sort-icon');
      document.querySelectorAll('.sort-icon').forEach(icon => icon.classList.remove('asc'));
      if (sortDirection === -1) sortIcon.classList.add('asc');
      renderTable();
    });
  });

  document.getElementById('search-bar').addEventListener('input', renderTable);
  document.getElementById('clear-search').addEventListener('click', () => {
    document.getElementById('search-bar').value = '';
    renderTable();
  });

  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  document.getElementById('next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(listings.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });
}

document.addEventListener('DOMContentLoaded', loadData);

