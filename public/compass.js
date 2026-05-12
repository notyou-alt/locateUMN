/**********************************************
 * LocateUMN - Kompas Arah Realtime (v2)
 * Mendukung: iOS (dengan izin), Android (absolute),
 *             fallback untuk perangkat tanpa magnetometer
 **********************************************/
const Compass = {
  heading: 0,
  target: null,
  userPosition: null,
  supported: false,
  absoluteMode: false,   // apakah heading terhadap utara magnetik

  init() {
    this.needle = document.querySelector('.compass-needle');
    this.headingEl = document.getElementById('compass-heading');
    this.directionEl = document.getElementById('compass-direction');
    this.targetInfoEl = document.getElementById('compass-target-info');
    this.targetIndicator = document.querySelector('.compass-target-indicator');
    this.compassCard = document.getElementById('compass-card');

    // Cek tipe event yang didukung
    if (typeof DeviceOrientationEvent !== 'undefined') {
      // iOS 13+ butuh requestPermission
      if (DeviceOrientationEvent.requestPermission) {
        this.showPermissionButton();
      } else {
        // Android / desktop / iOS lama: langsung pasang listener
        this.startListening();
      }
    } else {
      this.showFallback('Kompas tidak didukung di perangkat ini.');
    }
  },

  // ========== TAMPILKAN TOMBOL MINTA IZIN (iOS) ==========
  showPermissionButton() {
    const btn = document.createElement('button');
    btn.className = 'btn btn-small btn-primary';
    btn.textContent = '🧭 Aktifkan Kompas';
    btn.style.margin = '8px auto';
    btn.addEventListener('click', async () => {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission === 'granted') {
          btn.remove();
          this.startListening();
        } else {
          this.showFallback('Izin kompas ditolak.');
        }
      } catch (err) {
        this.showFallback('Gagal meminta izin kompas.');
      }
    });
    this.compassCard.appendChild(btn);
  },

  // ========== MULAI MENDENGARKAN EVENT ==========
  startListening() {
    // Prioritaskan event absolute (tersedia di Chrome Android 78+)
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', (e) => this.handleOrientation(e, true), true);
      // juga dengarkan event biasa sebagai fallback
      window.addEventListener('deviceorientation', (e) => this.handleOrientation(e, false), true);
    } else {
      window.addEventListener('deviceorientation', (e) => this.handleOrientation(e, null), true);
    }
    // Anggap sementara supported = true, akan di-update di handler
    this.supported = true;
    // Hapus fallback sebelumnya jika ada
    const fb = document.getElementById('compass-fallback');
    if (fb) fb.remove();
  },

  // ========== HANDLER ORIENTASI ==========
  handleOrientation(event, isAbsolute) {
    // Jika ini event biasa dan kita sudah menerima event absolute, abaikan
    if (this.absoluteMode && isAbsolute === false) return;

    let rawHeading = null;

    // 1. iOS: webkitCompassHeading (sudah magnetik utara, 0-360)
    if (event.webkitCompassHeading !== undefined) {
      rawHeading = event.webkitCompassHeading;
      this.absoluteMode = true;
    }
    // 2. Event absolute (deviceorientationabsolute) atau deviceorientation dengan absolute=true
    else if (isAbsolute === true || event.absolute === true) {
      // alpha: 0 = utara (seharusnya), tapi di Android alpha biasanya 0 di utara, tapi rotasi searah jarum?
      // Standar: alpha adalah rotasi perangkat di sekitar sumbu Z, 0 = arah utara, 90 = timur, dll.
      // Jadi heading = alpha (0-360)
      rawHeading = event.alpha || 0;
      this.absoluteMode = true;
    }
    // 3. Fallback: event biasa tanpa absolute (misal desktop atau mobile lama)
    else if (event.alpha !== null && !this.absoluteMode) {
      // Gunakan alpha sebagai indikasi, tapi ini relatif terhadap orientasi awal
      rawHeading = event.alpha;
      // Beri tahu pengguna bahwa kompas tidak terkalibrasi
      if (!this._notifiedNonAbsolute) {
        this._notifiedNonAbsolute = true;
        const note = document.createElement('small');
        note.textContent = ' (butuh kalibrasi)';
        note.style.color = '#ffcc00';
        if (this.directionEl) this.directionEl.appendChild(note);
      }
    }

    if (rawHeading === null || isNaN(rawHeading)) return;

    this.heading = Math.round(rawHeading * 10) / 10;
    this.updateUI();

    // Jika ini pertama kali mendapatkan heading valid, ubah status supported
    if (!this._firstHeading) {
      this._firstHeading = true;
      this.supported = true;
      const fb = document.getElementById('compass-fallback');
      if (fb) fb.remove();
      if (this.needle) this.needle.style.display = '';
    }
  },

  // ========== UPDATE UI ==========
  updateUI() {
    if (!this.supported) return;

    const heading = this.heading;
    if (this.needle) {
      this.needle.style.transform = `translateX(-50%) rotate(${heading}deg)`;
    }

    if (this.headingEl) {
      this.headingEl.textContent = `${Math.round(heading)}° ${this.absoluteMode ? '' : '~'}`;
    }

    const direction = this.compassDirection(heading);
    if (this.directionEl) {
      this.directionEl.textContent = direction;
    }

    // Target info
    if (this.target && this.userPosition) {
      const bearingToTarget = this.calculateBearing(
        this.userPosition.lat, this.userPosition.lng,
        this.target.lat, this.target.lng
      );
      const relativeAngle = ((bearingToTarget - heading + 360) % 360);
      const desc = this.relativeDirectionDescription(relativeAngle);
      this.targetInfoEl.textContent = `${this.target.name}: ${desc}`;
      this.targetInfoEl.style.display = 'block';

      if (this.targetIndicator) {
        this.targetIndicator.style.display = 'block';
        this.targetIndicator.style.transform = `translateX(-50%) rotate(${relativeAngle}deg) translateY(-85px)`;
      }
    } else {
      this.targetInfoEl.style.display = 'none';
      if (this.targetIndicator) this.targetIndicator.style.display = 'none';
    }
  },

  // ========== FALLBACK ==========
  showFallback(msg) {
    this.supported = false;
    let fb = document.getElementById('compass-fallback');
    if (!fb) {
      fb = document.createElement('p');
      fb.id = 'compass-fallback';
      fb.style.color = 'var(--danger)';
      fb.style.fontWeight = '500';
      this.compassCard.appendChild(fb);
    }
    fb.textContent = msg;
    if (this.needle) this.needle.style.display = 'none';
    if (this.headingEl) this.headingEl.textContent = '--';
    if (this.directionEl) this.directionEl.textContent = 'Tidak tersedia';
  },

  // ========== UTILITY ==========
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