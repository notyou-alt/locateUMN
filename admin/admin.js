/**********************************************
 * LocateUMN - Admin Logic (Client-side only)
 **********************************************/

// Cek autentikasi
if (!sessionStorage.getItem('adminAuth')) {
  window.location.href = 'index.html';
}

// Data disimpan di localStorage dengan key 'locateumn_data'
const STORAGE_KEY = 'locateumn_data';
let locations = [];

// Elemen DOM
const locationsListDiv = document.getElementById('locations-list');
const btnAddLocation = document.getElementById('btn-add-location');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const importFileInput = document.getElementById('import-file');
const btnLogout = document.getElementById('btn-logout');

// ========== LOAD DATA ==========
function loadData() {
  // 1. LocalStorage dulu (prioritas utama)
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      locations = JSON.parse(saved);
    } catch (e) {
      locations = [];
    }
    render();
    return;
  }

  // 2. Fallback dari file JSON (root project)
  fetch('./location.json')
    .then(res => {
      if (!res.ok) throw new Error('File not found');
      return res.json();
    })
    .then(json => {
      locations = json.locations || [];
      saveToStorage();
      render();
    })
    .catch(() => {
      locations = [];
      render();
    });
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
}

// ========== RENDER UI ==========
function render() {
  locationsListDiv.innerHTML = '';
  locations.forEach((loc, locIdx) => {
    const card = document.createElement('div');
    card.className = 'card location-card';
    card.style.marginBottom = '12px';

    // Nama lokasi
    const nameRow = document.createElement('div');
    nameRow.className = 'flex-row';
    nameRow.innerHTML = `
      <input type="text" class="point-input" style="width:200px;" value="${loc.name}" placeholder="Nama lokasi" data-locidx="${locIdx}" data-action="rename">
      <button class="btn btn-small" style="color: var(--accent);" data-action="highlight-location" data-locidx="${locIdx}">Sorot</button>
      <button class="btn btn-small btn-danger" data-action="delete-location" data-locidx="${locIdx}">Hapus</button>
    `;
    card.appendChild(nameRow);

    // Titik-titik
    const pointsDiv = document.createElement('div');
    pointsDiv.style.display = 'flex';
    pointsDiv.style.flexDirection = 'column';
    pointsDiv.style.gap = '8px';

    (loc.points || []).forEach((point, ptIdx) => {
      const row = document.createElement('div');
      row.className = 'point-row';
      row.innerHTML = `
        <span style="font-size:0.9rem;">Titik ${ptIdx+1}</span>
        <input type="number" class="point-input" value="${point.lat}" step="any" data-locidx="${locIdx}" data-ptidx="${ptIdx}" data-coord="lat">
        <input type="number" class="point-input" value="${point.lng}" step="any" data-locidx="${locIdx}" data-ptidx="${ptIdx}" data-coord="lng">
        <button class="btn btn-small btn-danger" data-action="delete-point" data-locidx="${locIdx}" data-ptidx="${ptIdx}">✕</button>
      `;
      pointsDiv.appendChild(row);
    });

    // Tombol tambah titik
    const addPtBtn = document.createElement('button');
    addPtBtn.className = 'btn btn-small btn-primary';
    addPtBtn.textContent = '+ Tambah Titik';
    addPtBtn.dataset.action = 'add-point';
    addPtBtn.dataset.locidx = locIdx;
    pointsDiv.appendChild(addPtBtn);

    card.appendChild(pointsDiv);
    locationsListDiv.appendChild(card);
  });

  // Event delegation
  attachEvents();
}

function attachEvents() {
  // Rename location (input event)
  document.querySelectorAll('input[data-action="rename"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.locidx);
      locations[idx].name = e.target.value;
      saveToStorage();
    });
  });

  // Edit point coordinate
  document.querySelectorAll('input[data-coord]').forEach(input => {
    input.addEventListener('input', (e) => {
      const locIdx = parseInt(e.target.dataset.locidx);
      const ptIdx = parseInt(e.target.dataset.ptidx);
      const coord = e.target.dataset.coord;
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        locations[locIdx].points[ptIdx][coord] = val;
        saveToStorage();
      }
    });
  });

  // Delete location
  document.querySelectorAll('button[data-action="delete-location"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.locidx);
      if (confirm(`Hapus lokasi "${locations[idx].name}"?`)) {
        locations.splice(idx, 1);
        saveToStorage();
        render();
      }
    });
  });

  // Delete point
  document.querySelectorAll('button[data-action="delete-point"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const locIdx = parseInt(e.target.dataset.locidx);
      const ptIdx = parseInt(e.target.dataset.ptidx);
      if (confirm('Hapus titik ini?')) {
        locations[locIdx].points.splice(ptIdx, 1);
        saveToStorage();
        render();
      }
    });
  });

  // Add point
  document.querySelectorAll('button[data-action="add-point"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const locIdx = parseInt(e.target.dataset.locidx);
      // Tambah titik baru dengan koordinat default (0,0)
      locations[locIdx].points.push({ lat: 0, lng: 0 });
      saveToStorage();
      render();
    });
  });
}

// ========== ADD NEW LOCATION ==========
btnAddLocation.addEventListener('click', () => {
  const name = prompt('Nama lokasi baru:');
  if (name) {
    locations.push({
      name: name,
      points: [
        { lat: 0, lng: 0 },
        { lat: 0.001, lng: 0 },
        { lat: 0.001, lng: 0.001 },
        { lat: 0, lng: 0.001 }
      ]
    });
    saveToStorage();
    render();
  }
});

// ========== EXPORT JSON ==========
btnExport.addEventListener('click', () => {
  const jsonStr = JSON.stringify({ locations }, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'locations.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// ========== IMPORT JSON ==========
btnImport.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.locations && Array.isArray(data.locations)) {
        locations = data.locations;
        saveToStorage();
        render();
        alert('Data berhasil diimpor!');
      } else {
        alert('Format JSON tidak valid. Harus memiliki properti "locations" (array).');
      }
    } catch (err) {
      alert('Gagal parsing JSON.');
    }
  };
  reader.readAsText(file);
  importFileInput.value = '';
});

// ========== LOGOUT ==========
btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem('adminAuth');
  window.location.href = 'index.html';
});

// Inisialisasi
loadData();