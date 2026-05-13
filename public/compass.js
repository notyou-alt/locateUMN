/**********************************************
 * LocateUMN - Kompas Simpel & Stabil
 * Panah selalu menunjuk ke lokasi tujuan
 **********************************************/
const Compass = {
  heading: 0,               // arah hadap perangkat (derajat magnetik)
  smoothHeading: 0,
  target: null,
  userPosition: null,
  bearing: 0,
  smoothBearing: 0,
  active: false,
  permissionRequested: false,

  init() {
    this.rose = document.getElementById('compass-rose');
    this.arrow = document.getElementById('compass-arrow');
    this.headingEl = document.getElementById('compass-heading');
    this.latEl = document.getElementById('compass-lat');
    this.lngEl = document.getElementById('compass-lng');
    this.card = document.getElementById('compass-card');

    // Cek dukungan
    if (typeof DeviceOrientationEvent === 'undefined') {
      this.showFallback('Sensor tidak tersedia');
      return;
    }

    // iOS 13+ perlu izin
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      this.showPermissionButton();
      return;
    }

    // Langsung mulai
    this.startListening();
  },

  // ========== TOMBOL IZIN iOS ==========
  showPermissionButton() {
    const btn = document.createElement('button');
    btn.className = 'btn btn-small btn-primary';
    btn.textContent = '🧭 Aktifkan Kompas';
    btn.style.marginTop = '12px';
    btn.addEventListener('click', async () => {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm === 'granted') {
          btn.remove();
          this.startListening();
        } else {
          this.showFallback('Izin ditolak');
        }
      } catch {
        this.showFallback('Gagal meminta izin');
      }
    });
    this.card.appendChild(btn);
  },

  // ========== MULAI LISTENER ==========
  startListening() {
    // Prioritaskan event absolut (Android Chrome 78+)
    window.addEventListener('deviceorientationabsolute', e => this.handleOrientation(e, true), true);
    window.addEventListener('deviceorientation', e => this.handleOrientation(e, false), true);
    this.active = true;
  },

  // ========== HANDLER ORIENTASI ==========
  handleOrientation(event, isAbsolute) {
    let raw = null;

    // iOS: webkitCompassHeading
    if (event.webkitCompassHeading !== undefined) {
      raw = event.webkitCompassHeading;
    }
    // Absolute event atau absolute properti
    else if (isAbsolute || event.absolute === true) {
      raw = event.alpha; // alpha = rotasi sumbu Z, 0 = utara
    }
    // Fallback (relatif, kurang akurat)
    else if (event.alpha !== null) {
      raw = event.alpha;
    }

    if (raw === null || isNaN(raw)) return;

    // Normalisasi 0-360
    let heading = raw % 360;
    if (heading < 0) heading += 360;

    // Low-pass filter untuk smoothing
    const alpha = 0.25; // faktor smoothing
    if (this._firstReading) {
      this.smoothHeading = this.smoothHeading + alpha * (heading - this.smoothHeading);
    } else {
      this.smoothHeading = heading;
      this._firstReading = true;
    }

    this.heading = heading;
    this.updateUI();
  },

  // ========== UPDATE UI ==========
  updateUI() {
    // Putar rose sesuai arah hadap (sehingga U selalu ke utara)
    if (this.rose) {
      this.rose.style.transform = `rotate(${this.smoothHeading}deg)`;
    }

    // Hitung rotasi panah jika ada target dan posisi
    if (this.target && this.userPosition) {
      this.bearing = this.calcBearing(
        this.userPosition.lat, this.userPosition.lng,
        this.target.lat, this.target.lng
      );
      // Smoothing bearing
      if (this._firstBearing !== false) {
        this.smoothBearing = this.smoothBearing + 0.3 * (this.bearing - this.smoothBearing);
      } else {
        this.smoothBearing = this.bearing;
        this._firstBearing = false;
      }
      // Rotasi panah: bearing - heading (relatif terhadap hadap)
      const targetAngle = this.smoothBearing - this.smoothHeading;
      if (this.arrow) {
        this.arrow.style.transform = `rotate(${targetAngle}deg) translateY(-8px)`;
        this.arrow.style.display = 'block';
      }
    } else {
      if (this.arrow) this.arrow.style.display = 'none';
    }

    // Perbarui teks
    if (this.headingEl) {
      this.headingEl.textContent = `${Math.round(this.smoothHeading)}°`;
    }
    if (this.userPosition) {
      if (this.latEl) this.latEl.textContent = this.userPosition.lat.toFixed(5);
      if (this.lngEl) this.lngEl.textContent = this.userPosition.lng.toFixed(5);
    }
  },

  // ========== HELPER ==========
  calcBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360;
  },

  showFallback(msg) {
    const fb = document.createElement('p');
    fb.textContent = msg;
    fb.style.color = 'var(--danger)';
    fb.style.textAlign = 'center';
    this.card.appendChild(fb);
  },

  // API untuk app.js
  setTarget(name, lat, lng) {
    this.target = { name, lat, lng };
    this._firstBearing = true; // reset smoothing
    this.updateUI();
  },
  clearTarget() {
    this.target = null;
    this.smoothBearing = 0;
    this.updateUI();
  },
  updateUserPosition(lat, lng) {
    this.userPosition = { lat, lng };
    this.updateUI();
    if (this.target) this.updateUI();
  }
};

// Start saat DOM siap
document.addEventListener('DOMContentLoaded', () => Compass.init());