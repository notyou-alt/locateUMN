/**********************************************
 * LocateUMN - Draw Polygon on Map
 * Menggunakan Leaflet Draw Plugin
 **********************************************/

// Variabel drawing
let drawnItems;          // LayerGroup untuk polygon sementara
let currentDrawnLayer = null;  // Layer polygon yang sedang/selesai digambar
let drawControl;         // Leaflet Draw control (hanya polygon)
let isDrawing = false;   // Status drawing aktif

// Elemen DOM
const btnDrawStart   = document.getElementById('btn-draw-start');
const btnDrawSave   = document.getElementById('btn-draw-save');
const btnDrawCancel = document.getElementById('btn-draw-cancel');
const btnDrawClear  = document.getElementById('btn-draw-clear');

// Inisialisasi setelah map siap
function initDrawTools() {
  if (typeof map === 'undefined') {
    setTimeout(initDrawTools, 200); // tunggu map.js inisialisasi
    return;
  }

  // LayerGroup untuk polygon temporary (bukan bagian polygonGroup)
  drawnItems = new L.FeatureGroup().addTo(map);

  // Opsi drawing polygon
  const drawOptions = {
    polygon: {
      allowIntersection: false,
      drawError: { color: '#e1e100', message: 'Garis tidak boleh berpotongan!' },
      shapeOptions: {
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillColor: '#7aa2f7',
        fillOpacity: 0.3
      }
    },
    polyline: false,
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false
  };

  // Edit options (biarkan edit sederhana jika ingin, kita hanya pakai draw)
  drawControl = new L.Control.Draw({
    draw: drawOptions,
    edit: false
  });

  // Jangan langsung tambahkan control ke map, kita trigger manual via tombol
  // Tapi kita perlu menangkap event draw:created
  map.on('draw:created', onDrawCreated);

  // Event tombol
  btnDrawStart.addEventListener('click', startDrawing);
  btnDrawSave.addEventListener('click', savePolygon);
  btnDrawCancel.addEventListener('click', cancelDrawing);
  btnDrawClear.addEventListener('click', clearDrawing);
}

// Mulai mode draw polygon
function startDrawing() {
  if (isDrawing) return; // sudah dalam mode draw

  // Hapus polygon temporary sebelumnya jika ada
  if (currentDrawnLayer) {
    drawnItems.removeLayer(currentDrawnLayer);
    currentDrawnLayer = null;
  }

  // Aktifkan draw polygon
  // Leaflet Draw memungkinkan kita memanggil handler secara manual melalui fitur L.Draw.Polygon
  if (drawControl) {
    // Nonaktifkan dulu jika ada, lalu aktifkan
    new L.Draw.Polygon(map, drawControl.options.draw.polygon).enable();
    isDrawing = true;

    // Ubah state tombol
    btnDrawStart.disabled = true;
    btnDrawSave.disabled = true;
    btnDrawCancel.disabled = false;
    btnDrawClear.disabled = true;
  }
}

// Ketika polygon selesai digambar
function onDrawCreated(e) {
  const layer = e.layer;
  // Hapus layer sebelumnya jika ada
  if (currentDrawnLayer) {
    drawnItems.removeLayer(currentDrawnLayer);
  }
  // Simpan layer baru
  currentDrawnLayer = layer;
  drawnItems.addLayer(layer);
  isDrawing = false;

  // Tombol: save, cancel, clear jadi aktif
  btnDrawStart.disabled = false;
  btnDrawSave.disabled = false;
  btnDrawCancel.disabled = false;
  btnDrawClear.disabled = false;

  // Matikan draw tool (karena sudah selesai)
  // Sebenarnya Leaflet Draw otomatis nonaktif, tapi pastikan
  if (drawControl) {
    // Tidak ada method disable, tapi bisa kita set manual
  }
}

// Simpan polygon ke locations array
function savePolygon() {
  if (!currentDrawnLayer) {
    alert('Belum ada polygon yang digambar.');
    return;
  }

  const name = prompt('Nama lokasi baru:');
  if (!name || name.trim() === '') {
    alert('Nama lokasi tidak boleh kosong.');
    return;
  }

  // Ambil koordinat dari layer
  const latLngs = currentDrawnLayer.getLatLngs();
  // Dapatkan array titik pertama (outer ring)
  const points = latLngs[0].map(ll => ({
    lat: ll.lat,
    lng: ll.lng
  }));

  // Pastikan polygon tertutup (titik pertama == terakhir) -> leaflet otomatis
  // Buang titik terakhir jika sama dengan pertama? Leaflet biasanya menyertakan titik terakhir duplikat untuk menutup.
  if (points.length > 1 &&
      points[0].lat === points[points.length-1].lat &&
      points[0].lng === points[points.length-1].lng) {
    points.pop(); // Hapus duplikat penutup
  }

  // Tambah ke locations global (dari admin.js)
  locations.push({
    name: name.trim(),
    points: points
  });

  // Simpan ke localStorage & refresh semua
  saveToStorage();  // akan memanggil map.js's override -> refreshMap()
  render();         // perbarui daftar admin

  // Bersihkan drawing
  clearDrawing();

  // Feedback
  alert(`Lokasi "${name}" berhasil disimpan!`);
}

// Batalkan drawing (sembunyikan layer, hentikan mode draw)
function cancelDrawing() {
  // Hentikan draw yang sedang aktif
  if (isDrawing) {
    // Matikan draw control (tidak langsung bisa, kita bisa nonaktifkan dengan cara disable handler)
    // Cara mudah: nonaktifkan semua tombol dan reset flag
    isDrawing = false;
  }

  // Hapus layer sementara
  if (currentDrawnLayer) {
    drawnItems.removeLayer(currentDrawnLayer);
    currentDrawnLayer = null;
  }

  // Reset tombol
  btnDrawStart.disabled = false;
  btnDrawSave.disabled = true;
  btnDrawCancel.disabled = true;
  btnDrawClear.disabled = true;
}

// Hapus drawing tanpa menyimpan (sama seperti cancel, tapi mungkin lebih tepat)
function clearDrawing() {
  cancelDrawing(); // perilaku sama
}

// Mulai setelah map.js selesai (karena map.js initMap dijalankan setelah DOMContentLoaded)
document.addEventListener('DOMContentLoaded', () => {
  // Tunggu sebentar agar map.js siap
  setTimeout(initDrawTools, 300);
});