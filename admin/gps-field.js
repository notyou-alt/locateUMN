/**********************************************
 * LocateUMN - GPS Field Polygon Mode
 * Merekam titik berdasarkan posisi nyata admin
 **********************************************/
const GPSField = {
  // Status mode
  active: false,
  watchId: null,
  currentPos: null,          // { lat, lng, accuracy }
  tempPoints: [],           // array { lat, lng }

  // Leaflet layer untuk preview
  tempLayer: null,          // L.layerGroup
  polyline: null,           // L.polyline sementara
  markers: [],              // L.marker[]

  // DOM elements
  init() {
    if (typeof map === 'undefined') {
      setTimeout(() => this.init(), 300);
      return;
    }
    // Ambil elemen
    this.btnToggle = document.getElementById('btn-gps-toggle');
    this.btnSavePoint = document.getElementById('btn-gps-save-point');
    this.btnUndo = document.getElementById('btn-gps-undo');
    this.btnReset = document.getElementById('btn-gps-reset');
    this.btnSaveArea = document.getElementById('btn-gps-save-area');
    this.inputName = document.getElementById('gps-location-name');
    this.latEl = document.getElementById('gps-lat');
    this.lngEl = document.getElementById('gps-lng');
    this.accEl = document.getElementById('gps-accuracy');
    this.hintEl = document.getElementById('gps-hint');

    // Event
    this.btnToggle.addEventListener('click', () => this.toggleMode());
    this.btnSavePoint.addEventListener('click', () => this.savePoint());
    this.btnUndo.addEventListener('click', () => this.undoLast());
    this.btnReset.addEventListener('click', () => this.resetPolygon());
    this.btnSaveArea.addEventListener('click', () => this.saveArea());
    this.inputName.addEventListener('input', () => this.updateSaveButton());

    // Buat layer sementara di map (di luar polygonGroup)
    this.tempLayer = L.layerGroup().addTo(map);
  },

  // ========== TOGGLE MODE GPS ==========
  toggleMode() {
    if (this.active) {
      this.stopGPS();
    } else {
      this.startGPS();
    }
  },

  startGPS() {
    if (!navigator.geolocation) {
      alert('Geolocation tidak didukung');
      return;
    }
    this.active = true;
    this.btnToggle.textContent = '⏹ Hentikan GPS';
    this.btnToggle.classList.add('btn-danger');
    this.hintEl.textContent = 'Berjalanlah ke titik yang diinginkan, lalu tekan “Simpan Titik”.';
    this.updateButtonStates();

    // Mulai watchPosition (update realtime)
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.onPositionUpdate(pos),
      err => {
        alert('Gagal mendapatkan GPS: ' + err.message);
        this.stopGPS();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  },

  stopGPS() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.active = false;
    this.currentPos = null;
    this.btnToggle.textContent = '▶ Mulai GPS';
    this.btnToggle.classList.remove('btn-danger');
    this.hintEl.textContent = 'Mode GPS tidak aktif';
    this.updateUI();
    this.updateButtonStates();
  },

  // ========== POSISI BARU DARI GPS ==========
  onPositionUpdate(position) {
    const { latitude, longitude, accuracy } = position.coords;
    this.currentPos = { lat: latitude, lng: longitude, accuracy };
    this.updateUI();
  },

  updateUI() {
    if (this.currentPos) {
      this.latEl.textContent = `Lat: ${this.currentPos.lat.toFixed(6)}`;
      this.lngEl.textContent = `Lng: ${this.currentPos.lng.toFixed(6)}`;
      this.accEl.textContent = `Akurasi: ${Math.round(this.currentPos.accuracy)} m`;
    } else {
      this.latEl.textContent = 'Lat: --';
      this.lngEl.textContent = 'Lng: --';
      this.accEl.textContent = 'Akurasi: --';
    }
    this.updateButtonStates();
  },

  updateButtonStates() {
    const hasPos = this.currentPos !== null;
    const hasPoints = this.tempPoints.length > 0;
    const hasMinPoints = this.tempPoints.length >= 3;
    const nameFilled = this.inputName.value.trim().length > 0;

    this.btnSavePoint.disabled = !(this.active && hasPos);
    this.btnUndo.disabled = !(this.active && hasPoints);
    this.btnReset.disabled = !(this.active && hasPoints);
    this.btnSaveArea.disabled = !(hasMinPoints && nameFilled);
  },

  // ========== TITIK ==========
  savePoint() {
    if (!this.currentPos) return;
    const pt = { lat: this.currentPos.lat, lng: this.currentPos.lng };
    this.tempPoints.push(pt);
    // Tambah marker
    const marker = L.marker([pt.lat, pt.lng], {
      icon: L.divIcon({ className: 'gps-point-marker', html: '📍', iconSize: [20,20] })
    }).addTo(this.tempLayer);
    this.markers.push(marker);

    // Update polyline
    this.redrawPolyline();
    this.updateButtonStates();
    // Beri getaran ringan (opsional, hanya di mobile)
    if (navigator.vibrate) navigator.vibrate(50);
  },

  undoLast() {
    if (this.tempPoints.length === 0) return;
    this.tempPoints.pop();
    // Hapus marker terakhir
    const lastMarker = this.markers.pop();
    if (lastMarker) this.tempLayer.removeLayer(lastMarker);
    this.redrawPolyline();
    this.updateButtonStates();
  },

  resetPolygon() {
    this.tempPoints = [];
    this.markers.forEach(m => this.tempLayer.removeLayer(m));
    this.markers = [];
    if (this.polyline) {
      this.tempLayer.removeLayer(this.polyline);
      this.polyline = null;
    }
    this.updateButtonStates();
  },

  redrawPolyline() {
    if (this.polyline) this.tempLayer.removeLayer(this.polyline);
    if (this.tempPoints.length >= 2) {
      this.polyline = L.polyline(
        this.tempPoints.map(p => [p.lat, p.lng]),
        { color: '#ff9e64', weight: 3, dashArray: '5,5' }
      ).addTo(this.tempLayer);
      // Fit peta ke polyline
      const bounds = this.polyline.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30,30] });
    }
  },

  // ========== SIMPAN WILAYAH ==========
  saveArea() {
    const name = this.inputName.value.trim();
    if (!name) return;
    if (this.tempPoints.length < 3) {
      alert('Minimal 3 titik dibutuhkan untuk membentuk polygon.');
      return;
    }

    // Tutup polygon (tambahkan titik pertama di akhir jika belum)
    const points = [...this.tempPoints];
    // Leaflet tidak memerlukan penutupan eksplisit, tapi untuk data kita simpan titik awal lagi di akhir agar tertutup sempurna saat render polygon
    // Hal ini opsional; jika tidak, fungsi pointInPolygon tetap bekerja karena Leaflet otomatis menutup.
    // Agar konsisten, kita tambahkan titik pertama di akhir.
    if (points.length > 1 &&
        (points[0].lat !== points[points.length-1].lat ||
         points[0].lng !== points[points.length-1].lng)) {
      points.push({ lat: points[0].lat, lng: points[0].lng });
    }

    // Simpan ke locations global (admin.js)
    locations.push({
      name: name,
      points: points
    });

    // Simpan ke storage & perbarui tampilan
    saveToStorage();   // akan memanggil map.js refreshMap()
    render();          // admin.js render ulang daftar

    // Reset mode
    this.resetPolygon();
    this.inputName.value = '';
    this.updateButtonStates();
    alert(`Wilayah "${name}" berhasil disimpan dari GPS lapangan.`);
  }
};

// Mulai setelah DOM siap
document.addEventListener('DOMContentLoaded', () => {
  // Tunggu sebentar agar map.js selesai
  setTimeout(() => GPSField.init(), 400);
});