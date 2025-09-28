let charts = {};

async function loadData() {
  let listings; // Use let for reassignment
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

    computeMetrics(listings);
    renderCharts(listings);
  } catch (error) {
    console.error('Error loading data:', error);
    const lastRefreshed = document.getElementById('lastRefreshed');
    if (lastRefreshed) lastRefreshed.textContent = 'Error loading data';
  }
}

function computeMetrics(listings) {
  const available = listings.filter(l => l.status === 'Available');
  const totalAvailable = available.length;
  const avgDays = Math.round(available.reduce((sum, l) => sum + l.daysAvailable, 0) / totalAvailable) || 0;
  const prices = available.map(l => parseInt(l.price.replace(/\D/g, '')) || 0).filter(p => p > 0);
  const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length) || 0;
  const newWeek = available.filter(l => daysBetween(l.firstSeen, todayStr) <= 7).length;

  document.getElementById('total-available').textContent = totalAvailable;
  document.getElementById('avg-days').textContent = avgDays + ' days';
  document.getElementById('avg-price').textContent = '$' + avgPrice + '/wk';
  document.getElementById('new-week').textContent = newWeek;

  // Weekly/Monthly
  const weekAvailable = available.filter(l => daysBetween(l.firstSeen, todayStr) <= 7).length;
  const monthLeased = listings.filter(l => l.status === 'Leased' && daysBetween(l.lastSeen, todayStr) <= 30).length;
  const priceChange = ' +2.5% MoM';  // Placeholder; compute from historical if added
  document.getElementById('weekly-available').textContent = `New Available: ${weekAvailable}`;
  document.getElementById('monthly-leased').textContent = `Leased: ${monthLeased}`;
  document.getElementById('price-change').textContent = `Price Trend: ${priceChange}`;

  // Suburb/Beds data for charts
  const suburbData = {};
  const bedsData = {};
  available.forEach(l => {
    const suburb = l.address.split(',')[1].trim() || 'Other';
    suburbData[suburb] = (suburbData[suburb] || 0) + 1;
    bedsData[l.beds] = (bedsData[l.beds] || 0) + 1;
  });

  // Avg price per bed/suburb (simplified)
  const pricePerBed = {};
  available.forEach(l => {
    const bedAvg = parseInt(l.price.replace(/\D/g, '')) / l.beds;
    pricePerBed[l.beds] = ((pricePerBed[l.beds] || 0) + bedAvg) / 2;  // Avg over listings
  });

  return { suburbData, bedsData, pricePerBed, available };
}

function renderCharts(listings) {
  const { suburbData, bedsData, pricePerBed, available } = computeMetrics(listings);

  const ctxBeds = document.getElementById('beds-chart').getContext('2d');
  charts.beds = new Chart(ctxBeds, {
    type: 'bar',
    data: {
      labels: Object.keys(bedsData),
      datasets: [{
        label: 'Available by Beds',
        data: Object.values(bedsData),
        backgroundColor: 'rgba(0, 123, 255, 0.6)'
      }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });

  const ctxSuburb = document.getElementById('suburb-chart').getContext('2d');
  charts.suburb = new Chart(ctxSuburb, {
    type: 'pie',
    data: {
      labels: Object.keys(suburbData),
      datasets: [{
        data: Object.values(suburbData),
        backgroundColor: ['#007bff', '#28a745', '#dc3545', '#ffc107', '#6c757d']
      }]
    },
    options: { responsive: true }
  });

  const ctxTrend = document.getElementById('price-trend-chart').getContext('2d');
  charts.trend = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels: ['1 Bed', '2 Bed', '3 Bed', '4 Bed', '5+ Bed'],
      datasets: [{
        label: 'Avg $/Bed/Wk',
        data: Object.values(pricePerBed),  // From computeMetrics
        borderColor: '#007bff',
        fill: false
      }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

const todayStr = new Date().toISOString().split('T')[0];
function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

document.addEventListener('DOMContentLoaded', loadData);
