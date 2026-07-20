(() => {
  'use strict';

  const C = window.EAIV4_DASHBOARD_CONFIG;
  const map = L.map('map').setView(C.MAP_CENTER, C.MAP_ZOOM);
  const markerLayer = L.layerGroup().addTo(map);
  let records = [];

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const $ = id => document.getElementById(id);

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function parsePhotos(record) {
    // 1) ใช้ photos_json เป็นหลัก
    const rawJson = record && record.photos_json;

    if (rawJson) {
      try {
        const parsed = typeof rawJson === 'string'
          ? JSON.parse(rawJson)
          : rawJson;

        if (Array.isArray(parsed)) {
          return parsed
            .map((photo, index) => ({
              index: Number(photo.index || index + 1),
              name: String(photo.name || `photo_${index + 1}.jpg`),
              id: String(photo.id || ''),
              url: String(photo.url || ''),
              thumbnail: String(
                photo.thumbnail ||
                photo.thumb ||
                photo.thumbnail_url ||
                ''
              )
            }))
            .filter(photo =>
              photo.id || photo.url || photo.thumbnail
            );
        }
      } catch (error) {
        console.warn('Invalid photos_json, falling back to legacy columns:', error);
      }
    }

    // 2) Fallback รองรับข้อมูล V2.1 เดิม
    const names = splitLines(record && record.photo_name);
    const ids = splitLines(record && record.photo_ids);
    const urls = splitLines(record && record.photo_url);
    const thumbnails = splitLines(record && record.thumbnail_url);

    const count = Math.max(
      names.length,
      ids.length,
      urls.length,
      thumbnails.length
    );

    return Array.from({ length: count }, (_, index) => {
      const id =
        ids[index] ||
        driveId(urls[index]) ||
        driveId(thumbnails[index]) ||
        '';

      const url =
        urls[index] ||
        (id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view` : '');

      const thumbnail =
        thumbnails[index] ||
        (id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600` : '');

      return {
        index: index + 1,
        name: names[index] || `photo_${index + 1}.jpg`,
        id,
        url,
        thumbnail
      };
    }).filter(photo =>
      photo.id || photo.url || photo.thumbnail
    );
  }

  function splitLines(value) {
    return String(value || '')
      .split(/\r?\n|,\s*(?=https?:\/\/)/)
      .map(value => value.trim())
      .filter(Boolean);
  }

  function driveId(url) {
    const patterns = [
      /\/d\/([^/]+)/,
      /[?&]id=([^&]+)/,
      /\/file\/d\/([^/]+)/
    ];
    for (const p of patterns) {
      const m = String(url).match(p);
      if (m) return m[1];
    }
    return '';
  }

  function thumbnailUrl(url) {
    const id = driveId(url);
    return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600` : '';
  }

  function formatTime(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value || '-') :
      d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  }

  async function loadData() {
    setApiStatus('กำลังโหลด', 'waiting');
    try {
      const url = `${C.API_URL}?action=list&limit=${C.LIST_LIMIT}&_=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message || 'API error');
      records = Array.isArray(data.records) ? data.records : [];
      populateFilters();
      render();
      $('lastUpdated').textContent = `อัปเดต ${new Date().toLocaleTimeString('th-TH')}`;
      setApiStatus('เชื่อมต่อแล้ว', 'ok');
    } catch (error) {
      console.error(error);
      setApiStatus(`ผิดพลาด: ${error.message}`, 'error');
    }
  }

  function setApiStatus(text, state) {
    $('apiStatus').textContent = text;
    $('apiStatus').className = `badge ${state}`;
  }

  function populateFilters() {
    fillSelect('statusFilter', [...new Set(records.map(r => r.status).filter(Boolean))]);
    fillSelect('needFilter', [...new Set(records.map(r => r.need).filter(Boolean))]);
  }

  function fillSelect(id, values) {
    const select = $(id);
    const current = select.value;
    while (select.options.length > 1) select.remove(1);
    values.sort().forEach(value => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    });
    select.value = current;
  }

  function filteredRecords() {
    const q = $('searchInput').value.trim().toLowerCase();
    const status = $('statusFilter').value;
    const need = $('needFilter').value;
    return records.filter(r => {
      const haystack = [
        r.project_code,r.province,r.district,r.subdistrict,
        r.damage,r.need,r.status,r.note
      ].join(' ').toLowerCase();
      return (!q || haystack.includes(q)) &&
             (!status || r.status === status) &&
             (!need || r.need === need);
    });
  }

  function render() {
    const list = filteredRecords();
    renderCards(list);
    renderTable(list);
    renderMarkers(list);
  }

  function renderCards(list) {
    $('totalCount').textContent = list.length;
    $('helpCount').textContent = list.filter(r => String(r.need || '').toLowerCase() !== 'none' && r.need).length;
    $('criticalCount').textContent = list.filter(r => String(r.status || '').toLowerCase() === 'critical').length;
    $('photoCount').textContent = list.filter(r => parsePhotos(r).length > 0).length;
  }

  function renderTable(list) {
    const tbody = $('reportRows');
    tbody.innerHTML = '';
    list.forEach((r, index) => {
      const urls = parsePhotos(r);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(formatTime(r.timestamp))}</td>
        <td>${esc([r.subdistrict,r.district,r.province].filter(Boolean).join(' / '))}</td>
        <td>${esc(r.lat)}, ${esc(r.lng)}</td>
        <td>${esc(r.damage)}</td>
        <td>${esc(r.need)}</td>
        <td>${esc(r.status)}</td>
        <td>${urls.length ? `${urls.length} รูป` : '-'}</td>`;
      tr.addEventListener('click', () => showDetail(r));
      tbody.appendChild(tr);
    });
  }

  function renderMarkers(list) {
    markerLayer.clearLayers();
    const bounds = [];
    list.forEach(r => {
      const lat = Number(r.lat), lng = Number(r.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = L.marker([lat,lng]).addTo(markerLayer);
      marker.bindPopup(`
        <strong>${esc(r.subdistrict || r.project_code || 'EAIV4')}</strong><br>
        ${esc(r.damage || '')} • ${esc(r.status || '')}<br>
        ${parsePhotos(r).length} รูป`);
      marker.on('click', () => showDetail(r));
      bounds.push([lat,lng]);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [30,30], maxZoom: 15 });
  }

  function showDetail(r) {
    const urls = parsePhotos(r);
    const photos = urls.length
      ? `<div class="photos">${urls.map((photo, i) => {
          const thumb = photo.thumbnail || thumbnailUrl(photo.url);
          const openUrl = photo.url || (photo.id
            ? `https://drive.google.com/file/d/${encodeURIComponent(photo.id)}/view`
            : thumb);

          return `<div class="photo-card">
            ${thumb ? `<img src="${esc(thumb)}" alt="${esc(photo.name || `รูปที่ ${i+1}`)}" loading="lazy" onerror="this.style.display='none'">` : ''}
            <a href="${esc(openUrl)}" target="_blank" rel="noopener">${esc(photo.name || `เปิดรูปที่ ${i+1}`)}</a>
          </div>`;
        }).join('')}</div>`
      : '<p class="muted">รายงานนี้ไม่มีรูป</p>';

    $('detailPanel').innerHTML = `
      <h2>${esc(r.project_code || 'รายงาน EAIV4')}</h2>
      <dl class="detail-grid">
        <dt>เวลา</dt><dd>${esc(formatTime(r.timestamp))}</dd>
        <dt>พื้นที่</dt><dd>${esc([r.subdistrict,r.district,r.province].filter(Boolean).join(' / '))}</dd>
        <dt>พิกัด</dt><dd>${esc(r.lat)}, ${esc(r.lng)}</dd>
        <dt>Cell ID</dt><dd>${esc(r.cell_id || '-')}</dd>
        <dt>ระดับน้ำ</dt><dd>${esc(r.flood || 0)}</dd>
        <dt>ความเสียหาย</dt><dd>${esc(r.damage || '-')}</dd>
        <dt>ความต้องการ</dt><dd>${esc(r.need || '-')}</dd>
        <dt>สถานะ</dt><dd>${esc(r.status || '-')}</dd>
        <dt>รายละเอียด</dt><dd>${esc(r.note || '-').replaceAll('\\n','<br>')}</dd>
      </dl>
      <h3>รูปภาพ (${urls.length})</h3>
      ${photos}`;
  }

  $('refreshBtn').addEventListener('click', loadData);
  $('searchInput').addEventListener('input', render);
  $('statusFilter').addEventListener('change', render);
  $('needFilter').addEventListener('change', render);

  loadData();
  setInterval(loadData, Math.max(15, Number(C.REFRESH_SECONDS || 60)) * 1000);
})();
