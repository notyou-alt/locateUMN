/**********************************************
 * LocateUMN - Admin Map Visualizer
 * Menggunakan Leaflet + OpenStreetMap
 **********************************************/

// Tunggu hingga DOM & admin.js selesai memuat data
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initMap, 100); // Beri waktu admin.js load
});

// Variabel global peta
let map;
let polygonGroup;          // LayerGroup untuk polygon & marker
let polygonLayers = {};    // Referensi per lokasi (key = index)
let vertexMarkers = {};    // Marker vertex per lokasi

function initMap() {
  // Inisialisasi peta dengan view default (akan di-fit setelah data ada)
  map = L.map('map', {
    center: [-6.2572, 106.618],   // Koordinat sekitar UMN (default)
    zoom: 16,
    zoomControl: true
  });

  // Tile layer OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  // LayerGroup khusus untuk polygon + marker vertex
  polygonGroup = L.layerGroup().addTo(map);

  // Render awal
  refreshMap();

  // Override saveToStorage agar setiap penyimpanan data langsung perbarui peta
  if (typeof saveToStorage === 'function') {
    const originalSave = saveToStorage;
    window.saveToStorage = function() {
      originalSave();
      refreshMap();
    };
  }

  // Event delegation untuk tombol "Sorot" di daftar lokasi
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="highlight-location"]');
    if (btn) {
      const idx = parseInt(btn.dataset.locidx, 10);
      if (!isNaN(idx)) highlightLocation(idx);
    }
  });
}

// ========== REFRESH PETA BERDASARKAN DATA TERKINI ==========
function refreshMap() {
  // Ambil data dari variabel global `locations` (admin.js)
  // Jika belum ada, coba dari localStorage
  if (typeof locations === 'undefined') {
    const saved = localStorage.getItem('locateumn_data');
    if (saved) {
      locations = JSON.parse(saved);
    } else {
      locations = [];
    }
  }

  // Bersihkan semua layer sebelumnya
  polygonGroup.clearLayers();
  polygonLayers = {};
  vertexMarkers = {};

  if (!locations.length) {
    // Jika tidak ada data, set view default
    map.setView([-6.2572, 106.618], 16);
    return;
  }

  // Loop setiap lokasi
  locations.forEach((loc, idx) => {
    // Abaikan jika tidak ada titik atau kurang dari 3
    if (!loc.points || loc.points.length < 3) return;

    const latLngs = loc.points.map(p => [p.lat, p.lng]);

    // Warna default (rotate warna untuk bedakan)
    const colors = ['#7aa2f7', '#f7768e', '#9ece6a', '#e0af68', '#bb9af7', '#73daca'];
    const color = colors[idx % colors.length];

    // Buat polygon
    const polygon = L.polygon(latLngs, {
      color: color,
      weight: 2,
      opacity: 0.8,
      fillColor: color,
      fillOpacity: 0.15,
      className: 'location-polygon'
    }).addTo(polygonGroup);

    // Popup saat diklik
    polygon.bindPopup(`
      <strong>${loc.name}</strong><br>
      Jumlah titik: ${loc.points.length}
    `);

    // Simpan referensi
    polygonLayers[idx] = polygon;

    // Tambahkan circleMarker untuk setiap vertex
    const markers = [];
    loc.points.forEach((p, ptIdx) => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 5,
        color: color,
        fillColor: '#fff',
        fillOpacity: 0.9,
        weight: 2
      }).addTo(polygonGroup);
      marker.bindTooltip(`Titik ${ptIdx+1}`, { direction: 'top' });
      markers.push(marker);
    });
    vertexMarkers[idx] = markers;
  });

  // Auto fit peta ke semua polygon
  if (Object.keys(polygonLayers).length > 0) {
    const bounds = polygonGroup.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }
}

// ========== HIGHLIGHT LOKASI TERTENTU ==========
function highlightLocation(idx) {
  // Reset semua polygon ke style default
  Object.entries(polygonLayers).forEach(([key, layer]) => {
    const originalColor = layer.options.color; // sudah tersimpan
    layer.setStyle({
      color: originalColor,
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.15
    });
  });

  // Jika idx tidak valid
  if (!polygonLayers[idx]) return;

  const targetPolygon = polygonLayers[idx];
  // Highlight dengan warna lebih terang, border tebal
  targetPolygon.setStyle({
    color: '#ffffff',
    weight: 5,
    opacity: 1,
    fillColor: targetPolygon.options.color,
    fillOpacity: 0.35
  });

  // Zoom ke bounds polygon ini
  const bounds = targetPolygon.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 18 });
  }

  // Scroll halus ke peta (opsional)
  document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
}