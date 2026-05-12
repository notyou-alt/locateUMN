/**********************************************
 * LocateUMN - Kompas Arah Realtime
 * Menggunakan DeviceOrientation API
 **********************************************/
const Compass = {
  heading: 0,               // derajat, 0 = utara
  target: null,             // { name, lat, lng }
  userPosition: null,       // { lat, lng }
  supported: false,

  init() {
    // Elemen DOM
    this.needle = document.querySelector('.compass-needle');
    this.headingEl = document.getElementById('compass-heading');
    this.directionEl = document.getElementById('compass-direction');
    this.targetInfoEl = document.getElementById('compass-target-info');
    this.targetIndicator = document.querySelector('.compass-target-indicator');
    this.compassCard = document.getElementById('compass-card');

    // Cek dukungan DeviceOrientation
    if (window.DeviceOrientationEvent) {
      this.supported = true;
      window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
    } else {
      this.showFallback();
    }

    // Ambil elemen fallback jika belum ada
    this.fallbackEl = document.getElementById('compass-fallback');
    if (!this.fallbackEl && !this.supported) {
      const p = document.createElement('p');
      p.id = 'compass-fallback';
      p.textContent = 'Kompas tidak didukung di perangkat ini';
      this.compassCard.appendChild(p);
      this.fallbackEl = p;
    }
  },

  showFallback() {
    if (this.needle) this.needle.style.display = 'none';
    if (this.headingEl) this.headingEl.textContent = '--';
    if (this.directionEl) this.directionEl.textContent = 'Tidak tersedia';
  },

  handleOrientation(event) {
    let rawHeading = null;

    // iOS: webkitCompassHeading sudah magnetik utara (0-360)
    if (event.webkitCompassHeading !== undefined) {
      rawHeading = event.webkitCompassHeading;
    }
    // Android: absolute orientation
    else if (event.absolute === true) {
      // alpha: rotasi sekitar Z (0 = utara, searah jarum? Banyak referensi: heading = (360 - alpha) % 360)
      rawHeading = (360 - event.alpha) % 360;
    }
    // Fallback ke alpha meski tidak absolute (kurang akurat)
    else if (event.alpha !== null) {
      rawHeading = (360 - event.alpha) % 360;
      // Tambahkan indikator tidak terkalibrasi
      if (!this._notifiedAccuracy) {
        this._notifiedAccuracy = true;
        const note = document.createElement('small');
        note.textContent = ' (kalibrasi perangkat)';
        note.style.color = '#ffcc00';
        if (this.directionEl) this.directionEl.appendChild(note);
      }
    }

    if (rawHeading === null || isNaN(rawHeading)) return;

    this.heading = Math.round(rawHeading * 10) / 10; // satu desimal
    this.updateUI();
  },

  updateUI() {
    if (!this.supported) return;

    const heading = this.heading;
    // Rotasi jarum (jarum menunjuk utara, tapi kompas berputar; kita putar compass-needle sebesar heading)
    if (this.needle) {
      this.needle.style.transform = `translateX(-50%) rotate(${heading}deg)`;
    }

    // Heading derajat
    if (this.headingEl) {
      this.headingEl.textContent = `${Math.round(heading)}°`;
    }

    // Arah mata angin
    const direction = this.compassDirection(heading);
    if (this.directionEl) {
      this.directionEl.textContent = direction;
    }

    // Jika ada target dan posisi user, hitung indikator relatif
    if (this.target && this.userPosition) {
      const bearingToTarget = this.calculateBearing(
        this.userPosition.lat, this.userPosition.lng,
        this.target.lat, this.target.lng
      );
      const relativeAngle = ((bearingToTarget - heading + 360) % 360);
      // Konversi ke deskripsi arah relatif
      const desc = this.relativeDirectionDescription(relativeAngle);
      this.targetInfoEl.textContent = `${this.target.name}: ${desc}`;
      this.targetInfoEl.style.display = 'block';

      // Tampilkan indikator di tepi kompas (rotate sesuai relativeAngle)
      if (this.targetIndicator) {
        this.targetIndicator.style.display = 'block';
        this.targetIndicator.style.transform = `translateX(-50%) rotate(${relativeAngle}deg) translateY(-85px)`;
      }
    } else {
      // Sembunyikan info target
      this.targetInfoEl.style.display = 'none';
      if (this.targetIndicator) this.targetIndicator.style.display = 'none';
    }
  },

  compassDirection(deg) {
    const dirs = [
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
    const found = dirs.find(d => deg >= d.min && deg < d.max);
    return found ? found.text : 'Utara';
  },

  calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360;
  },

  relativeDirectionDescription(angle) {
    // angle: 0 = lurus depan, 90 = kanan, 180 = belakang, dst.
    const sectors = [
      [337.5, 360, 'lurus depan'],
      [0, 22.5, 'lurus depan'],
      [22.5, 67.5, 'depan kanan'],
      [67.5, 112.5, 'kanan'],
      [112.5, 157.5, 'belakang kanan'],
      [157.5, 202.5, 'belakang'],
      [202.5, 247.5, 'belakang kiri'],
      [247.5, 292.5, 'kiri'],
      [292.5, 337.5, 'depan kiri']
    ];
    const found = sectors.find(s => angle >= s[0] && angle < s[1]);
    return found ? `di ${found[2]}` : '';
  },

  setTarget(name, lat, lng) {
    this.target = { name, lat, lng };
    this.updateUI();
  },

  clearTarget() {
    this.target = null;
    this.updateUI();
  },

  updateUserPosition(lat, lng) {
    this.userPosition = { lat, lng };
    if (this.target) this.updateUI();
  }
};

// Inisialisasi setelah DOM siap
document.addEventListener('DOMContentLoaded', () => Compass.init());