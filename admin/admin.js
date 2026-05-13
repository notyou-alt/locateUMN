/**********************************************
 * LocateUMN - Admin Logic (Client-side only)
 **********************************************/

if (!sessionStorage.getItem('adminAuth')) {
  window.location.href = 'index.html';
}

const STORAGE_KEY = 'locateumn_data';
let locations = [];

const locationsListDiv = document.getElementById('locations-list');
const btnAddLocation = document.getElementById('btn-add-location');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const importFileInput = document.getElementById('import-file');
const btnLogout = document.getElementById('btn-logout');

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    locations = JSON.parse(saved);
    render();
    return;
  }
  fetch('locations.json')
    .then(res => res.json())
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

// ========== RENDER ACCORDION LOKASI ==========
function render() {
  locationsListDiv.innerHTML = '';
  locations.forEach((loc, locIdx) => {
    // Accordion wrapper
    const acc = document.createElement('div');
    acc.className = 'accordion-location';

    // Header
    const header = document.createElement('button');
    header.className = 'accordion-location-header';
    header.innerHTML = `
      <span class="loc-name-text">${loc.name || 'Tanpa Nama'}</span>
      <span class="accordion-arrow">&#9662;</span>
    `;
    // Klik header toggle buka/tutup
    header.addEventListener('click', () => {
      acc.classList.toggle('open');
    });

    // Body
    const body = document.createElement('div');
    body.className = 'accordion-location-body';

    // Kontrol nama + hapus
    const ctrlRow = document.createElement('div');
    ctrlRow.className = 'flex-row';
    ctrlRow.style.marginBottom = '12px';
    ctrlRow.innerHTML = `
      <input type="text" class="point-input" value="${loc.name}" placeholder="Nama lokasi" data-locidx="${locIdx}" data-action="rename" style="flex:1;">
      <button class="btn btn-small" style="color: var(--accent);" data-action="highlight-location" data-locidx="${locIdx}">Sorot</button>
      <button class="btn btn-small btn-danger" data-action="delete-location" data-locidx="${locIdx}">Hapus</button>
    `;
    body.appendChild(ctrlRow);

    // Titik-titik
    const pointsContainer = document.createElement('div');
    pointsContainer.className = 'points-container';
    (loc.points || []).forEach((point, ptIdx) => {
      const row = document.createElement('div');
      row.className = 'point-row';
      row.innerHTML = `
        <span>Titik ${ptIdx+1}</span>
        <input type="number" class="point-input" value="${point.lat}" step="any" data-locidx="${locIdx}" data-ptidx="${ptIdx}" data-coord="lat">
        <input type="number" class="point-input" value="${point.lng}" step="any" data-locidx="${locIdx}" data-ptidx="${ptIdx}" data-coord="lng">
        <button class="btn btn-small btn-danger" data-action="delete-point" data-locidx="${locIdx}" data-ptidx="${ptIdx}">X</button>
      `;
      pointsContainer.appendChild(row);
    });

    const addPtBtn = document.createElement('button');
    addPtBtn.className = 'btn btn-small btn-primary';
    addPtBtn.textContent = '+ Tambah Titik';
    addPtBtn.dataset.action = 'add-point';
    addPtBtn.dataset.locidx = locIdx;
    pointsContainer.appendChild(addPtBtn);

    body.appendChild(pointsContainer);
    acc.appendChild(header);
    acc.appendChild(body);
    locationsListDiv.appendChild(acc);
  });

  attachEvents();
}

function attachEvents() {
  document.querySelectorAll('input[data-action="rename"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.locidx);
      locations[idx].name = e.target.value;
      // Update teks nama di header accordion
      const headerText = input.closest('.accordion-location').querySelector('.loc-name-text');
      if (headerText) headerText.textContent = e.target.value || 'Tanpa Nama';
      saveToStorage();
    });
  });

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

  document.querySelectorAll('button[data-action="add-point"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const locIdx = parseInt(e.target.dataset.locidx);
      locations[locIdx].points.push({ lat: 0, lng: 0 });
      saveToStorage();
      render();
    });
  });
}

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

btnImport.addEventListener('click', () => importFileInput.click());

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
        alert('Format JSON tidak valid.');
      }
    } catch (err) {
      alert('Gagal parsing JSON.');
    }
  };
  reader.readAsText(file);
  importFileInput.value = '';
});

btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem('adminAuth');
  window.location.href = 'index.html';
});

// Accordion utama (3 metode)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const accordion = header.parentElement;
      document.querySelectorAll('.accordion.open').forEach(open => {
        if (open !== accordion) open.classList.remove('open');
      });
      accordion.classList.toggle('open');
    });
  });
});

loadData();