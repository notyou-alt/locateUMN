/**********************************************
 * LocateUMN - Public App Logic
 **********************************************/

// Variabel global
let locationsData = [];
let userPosition = null;

// Elemen DOM
const btnLocate = document.getElementById('btn-locate');
const btnSearch = document.getElementById('btn-search');
const btnAdmin = document.getElementById('btn-admin');
const outputDiv = document.getElementById('output');
const passwordOverlay = document.getElementById('password-overlay');
const passwordInput = document.getElementById('password-input');
const btnLogin = document.getElementById('btn-login');
const btnCancel = document.getElementById('btn-cancel');
const locListOverlay = document.getElementById('loc-list-overlay');
const locListContainer = document.getElementById('loc-list');
const btnCloseList = document.getElementById('btn-close-list');

// ========== LOAD LOCATIONS ==========
async function loadLocations() {
  try {
    const res = await fetch('./locations.json');
    if (!res.ok) throw new Error('Gagal memuat data');
    const json = await res.json();
    locationsData = json.locations || [];
    // Precompute centroid untuk tiap lokasi
    locationsData.forEach(loc => {
      const sumLat = loc.points.reduce((s, p) => s + p.lat, 0);
      const sumLng = loc.points.reduce((s, p) => s + p.lng, 0);
      loc.centroid = {
        lat: sumLat / loc.points.length,
        lng: sumLng / loc.points.length
      };
    });
  } catch (err) {
    console.error(err);
    outputDiv.textContent = 'Gagal memuat data lokasi.';
  }
}

// ========== GPS ==========
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation tidak didukung'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// ========== POINT IN POLYGON (Ray Casting) ==========
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ========== HAVERSINE DISTANCE (meter) ==========
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meter
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ========== BEARING (derajat) ==========
function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
}

// ========== COMPASS DIRECTION (8 arah) ==========
function compassDirection(deg) {
  const directions = [
    { min: 337.5, max: 360, text: 'Utara' },
    { min: 0, max: 22.5, text: 'Utara' },
    { min: 22.5, max: 67.5, text: 'Timur Laut' },
    { min: 67.5, max: 112.5, text: 'Timur' },
    { min: 112.5, max: 157.5, text: 'Tenggara' },
    { min: 157.5, max: 202.5, text: 'Selatan' },
    { min: 202.5, max: 247.5, text: 'Barat Daya' },
    { min: 247.5, max: 292.5, text: 'Barat' },
    { min: 292.5, max: 337.5, text: 'Barat Laut' }
  ];
  const d = deg % 360;
  const found = directions.find(dir => d >= dir.min && d < dir.max);
  return found ? found.text : 'Utara';
}

// ========== TAMPILKAN OUTPUT ==========
function showOutput(text) {
  outputDiv.innerHTML = text;
}

// ========== LOKASI SAYA ==========
async function handleLokasiSaya() {
  showOutput('<span class="spinner"></span> Mendapatkan posisi...');
  try {
    userPosition = await getCurrentPosition();
    const { lat, lng } = userPosition;

    // Integrasi kompas: perbarui posisi pengguna dan reset target
    window.userPosition = userPosition;
    if (typeof Compass !== 'undefined') {
      Compass.updateUserPosition(lat, lng);
      Compass.clearTarget();
    }

    let found = null;
    for (const loc of locationsData) {
      if (pointInPolygon(lat, lng, loc.points)) {
        found = loc;
        break;
      }
    }
    if (found) {
      showOutput(`✅ Anda berada di:<br><strong>${found.name}</strong>`);
    } else {
      showOutput('❌ Lokasi anda berada jauh dari UMN');
    }
  } catch (err) {
    showOutput(`⚠️ Gagal mendapatkan lokasi: ${err.message}`);
  }
}

// ========== CARI LOKASI ==========
async function handleCariLokasi() {
  if (locationsData.length === 0) {
    showOutput('Data lokasi belum dimuat.');
    return;
  }
  // Tampilkan daftar lokasi di overlay
  locListContainer.innerHTML = '';
  locationsData.forEach((loc, idx) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-small';
    btn.textContent = loc.name;
    btn.addEventListener('click', () => onPilihLokasi(idx));
    locListContainer.appendChild(btn);
  });
  locListOverlay.style.display = 'flex';
}

async function onPilihLokasi(index) {
  locListOverlay.style.display = 'none';
  const loc = locationsData[index];
  showOutput('<span class="spinner"></span> Mengecek posisi...');
  try {
    userPosition = await getCurrentPosition();
    const { lat, lng } = userPosition;

    // Integrasi kompas: perbarui posisi pengguna
    window.userPosition = userPosition;
    if (typeof Compass !== 'undefined') {
      Compass.updateUserPosition(lat, lng);
    }

    const inside = pointInPolygon(lat, lng, loc.points);
    if (inside) {
      showOutput(`📍 Anda di lokasi:<br><strong>${loc.name}</strong>`);
    } else {
      const jarak = haversineDistance(lat, lng, loc.centroid.lat, loc.centroid.lng);
      const arah = compassDirection(bearing(lat, lng, loc.centroid.lat, loc.centroid.lng));
      showOutput(`🧭 <strong>${loc.name}</strong> berada di <strong>${arah}</strong><br>dengan jarak <strong>${Math.round(jarak)} meter</strong>`);
    }

    // Integrasi kompas: tetapkan target lokasi untuk indikator arah
    if (typeof Compass !== 'undefined') {
      Compass.setTarget(loc.name, loc.centroid.lat, loc.centroid.lng);
    }
  } catch (err) {
    showOutput(`⚠️ Gagal mendapatkan lokasi: ${err.message}`);
  }
}

// ========== ADMIN LOGIN ==========
function openAdminLogin() {
  passwordOverlay.style.display = 'flex';
  passwordInput.value = '';
  passwordInput.focus();
}

function closeAdminLogin() {
  passwordOverlay.style.display = 'none';
}

function doLogin() {
  const pass = passwordInput.value.trim();
  if (pass === '12345678') {
    sessionStorage.setItem('adminAuth', 'true');
    window.location.href = 'admin.html';
  } else {
    alert('Password salah!');
    closeAdminLogin();
  }
}

// ========== EVENT LISTENERS ==========
btnLocate.addEventListener('click', handleLokasiSaya);
btnSearch.addEventListener('click', handleCariLokasi);
btnAdmin.addEventListener('click', openAdminLogin);
btnCancel.addEventListener('click', closeAdminLogin);
btnLogin.addEventListener('click', doLogin);
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') doLogin();
});
btnCloseList.addEventListener('click', () => {
  locListOverlay.style.display = 'none';
});

// Inisialisasi
loadLocations();