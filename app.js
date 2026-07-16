(() => {
  'use strict';

  const C = window.EAI_CONFIG;
  const $ = (id) => document.getElementById(id);

  const fieldIds = [
    'reporter','phone','province','district','subdistrict','village',
    'lat','lng','accuracy','cellId','missionType','hazard','flood',
    'damage','need','status','urgency','wasteKg','note'
  ];

  let currentStep = 1;
  let photoData = [];

  function init() {
    if (!C || !C.API_URL) {
      console.error('EAI_CONFIG หรือ API_URL ไม่ถูกต้อง');
      return;
    }

    $('province').value = C.PROVINCE || '';
    $('district').value = C.DISTRICT || '';
    $('subdistrict').value = C.SUBDISTRICT || '';
    $('projectLabel').textContent = `${C.PROJECT_CODE || '-'} • ${C.SUBDISTRICT || '-'}`;

    bindEvents();
    restoreDraft();
    updateNetwork();
    renderQueue();
    showStep(1);

    window.addEventListener('online', () => {
      updateNetwork();
      syncQueue();
    });
    window.addEventListener('offline', updateNetwork);
  }

  function bindEvents() {
    $('gpsBtn').addEventListener('click', getGPS);
    $('photos').addEventListener('change', handlePhotos);
    $('submitBtn').addEventListener('click', submitReport);
    $('saveDraftBtn').addEventListener('click', saveDraft);
    $('clearBtn').addEventListener('click', clearForm);
    $('healthBtn').addEventListener('click', testHealth);
    $('nextBtn').addEventListener('click', nextStep);
    $('prevBtn').addEventListener('click', prevStep);
    $('syncBtn').addEventListener('click', syncQueue);

    document.querySelectorAll('.step').forEach((button) => {
      button.addEventListener('click', () => showStep(Number(button.dataset.step)));
    });

    document.querySelectorAll('.module').forEach((button) => {
      button.addEventListener('click', () => selectModule(button.dataset.module));
    });
  }

  function selectModule(moduleName) {
    document.querySelectorAll('.module').forEach((button) => {
      button.classList.toggle('active', button.dataset.module === moduleName);
    });

    const showQueue = moduleName === 'sync';
    $('incidentPanel').classList.toggle('hidden', showQueue);
    $('queuePanel').classList.toggle('hidden', !showQueue);

    if (moduleName === 'waste') {
      $('missionType').value = 'waste';
      $('hazard').value = 'waste_overflow';
    } else if (moduleName === 'environment') {
      $('missionType').value = 'environment';
      $('hazard').value = 'water_pollution';
    } else if (moduleName === 'incident') {
      $('missionType').value = 'disaster';
      $('hazard').value = 'flood';
    }
  }

  function showStep(step) {
    currentStep = Math.max(1, Math.min(5, step));

    document.querySelectorAll('.step').forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.step) === currentStep);
    });

    document.querySelectorAll('.step-page').forEach((page) => {
      page.classList.toggle('active', Number(page.dataset.page) === currentStep);
    });

    $('prevBtn').disabled = currentStep === 1;
    $('nextBtn').classList.toggle('hidden', currentStep === 5);

    if (currentStep === 5) {
      renderSummary();
    }
  }

  function nextStep() {
    showStep(currentStep + 1);
  }

  function prevStep() {
    showStep(currentStep - 1);
  }

  function updateNetwork() {
    const online = navigator.onLine;
    const badge = $('networkBadge');
    badge.textContent = online ? 'Online' : 'Offline';
    badge.className = `badge ${online ? 'online' : 'offline'}`;
  }

  function getGPS() {
    if (!navigator.geolocation) {
      setResult('อุปกรณ์นี้ไม่รองรับ GPS', false);
      return;
    }

    $('gpsStatus').textContent = 'กำลังอ่านตำแหน่ง...';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        $('lat').value = position.coords.latitude.toFixed(7);
        $('lng').value = position.coords.longitude.toFixed(7);
        $('accuracy').value = `${Math.round(position.coords.accuracy)} เมตร`;
        $('gpsStatus').textContent = `อ่านตำแหน่งสำเร็จ ${new Date().toLocaleTimeString('th-TH')}`;
      },
      (error) => {
        $('gpsStatus').textContent = `อ่าน GPS ไม่สำเร็จ: ${error.message}`;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }

  async function handlePhotos(event) {
    const files = Array.from(event.target.files || []).slice(0, Number(C.MAX_PHOTOS || 4));
    photoData = [];
    $('previewGrid').innerHTML = '';

    for (const file of files) {
      try {
        const dataUrl = await compressImage(
          file,
          Number(C.MAX_IMAGE_WIDTH || 1600),
          Number(C.JPEG_QUALITY || 0.78)
        );

        photoData.push({ dataUrl, name: file.name, mimeType: 'image/jpeg' });

        const item = document.createElement('div');
        item.className = 'preview-item';

        const image = document.createElement('img');
        image.src = dataUrl;
        image.alt = file.name;

        const label = document.createElement('span');
        label.textContent = file.name;

        item.append(image, label);
        $('previewGrid').appendChild(item);
      } catch (error) {
        setResult(`ประมวลผลรูปไม่สำเร็จ: ${file.name}`, false);
      }
    }
  }

  function compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;

      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;

        image.onload = () => {
          const scale = Math.min(1, maxWidth / image.width);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          resolve(canvas.toDataURL('image/jpeg', quality));
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function buildPayload() {
    const noteLines = [
      $('note').value.trim(),
      $('village').value.trim() ? `จุดสังเกต: ${$('village').value.trim()}` : '',
      `mission=${$('missionType').value}`,
      `hazard=${$('hazard').value}`,
      `urgency=${$('urgency').value}`,
      `waste_kg=${$('wasteKg').value || 0}`,
      $('reporter').value.trim() ? `reporter=${$('reporter').value.trim()}` : '',
      $('phone').value.trim() ? `phone=${$('phone').value.trim()}` : ''
    ].filter(Boolean);

    return {
      project_code: C.PROJECT_CODE || '',
      province: $('province').value.trim(),
      district: $('district').value.trim(),
      subdistrict: $('subdistrict').value.trim(),
      cell_id: $('cellId').value.trim(),
      lat: $('lat').value.trim(),
      lng: $('lng').value.trim(),
      flood: $('flood').value,
      damage: $('damage').value,
      need: $('need').value,
      status: $('status').value,
      note: noteLines.join('\\n'),
      device: JSON.stringify({
        app: 'EAIV4-Field-Operations',
        version: C.APP_VERSION || '2.0.0',
        userAgent: navigator.userAgent,
        language: navigator.language
      }),
      photos: photoData
    };
  }

  function validatePayload(payload) {
    if (!payload.project_code) return 'ไม่พบ Project Code';
    if (!payload.province || !payload.district || !payload.subdistrict) {
      return 'กรุณาระบุจังหวัด อำเภอ และตำบล';
    }
    if (!payload.lat || !payload.lng) return 'กรุณาอ่าน GPS หรือกรอกพิกัด';
    if (!payload.note.trim()) return 'กรุณากรอกรายละเอียด';
    return '';
  }

  async function submitReport() {
    const payload = buildPayload();
    const validationError = validatePayload(payload);

    if (validationError) {
      setResult(validationError, false);
      return;
    }

    if (!navigator.onLine) {
      enqueueReport(payload);
      setResult('ไม่มีอินเทอร์เน็ต ระบบเก็บรายงานไว้ในคิวแล้ว', false);
      renderQueue();
      return;
    }

    const button = $('submitBtn');
    button.disabled = true;
    button.textContent = 'กำลังส่ง...';

    try {
      const data = await postPayload(payload);
      localStorage.removeItem('eai_mobile_draft');

      setResult([
        'ส่งรายงานสำเร็จ',
        `แถวที่: ${data.row_number || '-'}`,
        `เวลา: ${data.timestamp || '-'}`,
        `รูป: ${data.photo_count || 0} รูป`
      ].join('\\n'), true);
    } catch (error) {
      enqueueReport(payload);
      setResult(`ส่งไม่สำเร็จ: ${error.message}\\nระบบเก็บไว้ในคิวรอส่ง`, false);
      renderQueue();
    } finally {
      button.disabled = false;
      button.textContent = '📤 ส่งรายงาน';
    }
  }

  async function postPayload(payload) {
    const response = await fetch(C.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`API ตอบกลับไม่ใช่ JSON: ${text.slice(0, 120)}`);
    }

    if (!data.ok) {
      throw new Error(data.message || 'บันทึกไม่สำเร็จ');
    }

    return data;
  }

  function renderSummary() {
    const payload = buildPayload();
    $('summaryBox').textContent = [
      `โครงการ: ${payload.project_code}`,
      `พื้นที่: ${payload.subdistrict} / ${payload.district} / ${payload.province}`,
      `พิกัด: ${payload.lat || '-'}, ${payload.lng || '-'}`,
      `ประเภท: ${$('missionType').value} / ${$('hazard').value}`,
      `สถานะ: ${payload.status}`,
      `รูปภาพ: ${photoData.length} รูป`,
      `รายละเอียด: ${$('note').value.trim() || '-'}`
    ].join('\\n');
  }

  function saveDraft() {
    const draft = {};
    fieldIds.forEach((id) => {
      const element = $(id);
      if (element) draft[id] = element.value;
    });
    draft.savedAt = new Date().toISOString();
    localStorage.setItem('eai_mobile_draft', JSON.stringify(draft));
    setResult('เก็บร่างในมือถือแล้ว', true);
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem('eai_mobile_draft');
      if (!raw) return;

      const draft = JSON.parse(raw);
      fieldIds.forEach((id) => {
        const element = $(id);
        if (element && draft[id] !== undefined) element.value = draft[id];
      });
      setResult('กู้คืนร่างเดิมแล้ว', true);
    } catch (error) {
      console.warn('กู้คืนร่างไม่สำเร็จ', error);
    }
  }

  function clearForm() {
    if (!window.confirm('ล้างข้อมูลทั้งหมดหรือไม่?')) return;

    fieldIds.forEach((id) => {
      const element = $(id);
      if (!element) return;
      if (element.tagName === 'SELECT') element.selectedIndex = 0;
      else element.value = '';
    });

    $('province').value = C.PROVINCE || '';
    $('district').value = C.DISTRICT || '';
    $('subdistrict').value = C.SUBDISTRICT || '';
    $('flood').value = '0';
    $('wasteKg').value = '0';

    photoData = [];
    $('photos').value = '';
    $('previewGrid').innerHTML = '';
    localStorage.removeItem('eai_mobile_draft');
    $('resultBox').className = 'result hidden';
    showStep(1);
  }

  function enqueueReport(payload) {
    const queue = getQueue();
    queue.push({
      id: `EAI-${Date.now()}`,
      createdAt: new Date().toISOString(),
      payload
    });
    localStorage.setItem('eai_mobile_queue', JSON.stringify(queue));
  }

  function getQueue() {
    try {
      return JSON.parse(localStorage.getItem('eai_mobile_queue') || '[]');
    } catch {
      return [];
    }
  }

  function renderQueue() {
    const queue = getQueue();
    $('queueList').innerHTML = '';

    if (!queue.length) {
      $('queueList').innerHTML = '<div class="queue-item">ไม่มีรายการรอส่ง</div>';
      return;
    }

    queue.forEach((item) => {
      const box = document.createElement('div');
      box.className = 'queue-item';
      box.innerHTML = `<strong>${item.id}</strong><span>${new Date(item.createdAt).toLocaleString('th-TH')} • ${item.payload.subdistrict}</span>`;
      $('queueList').appendChild(box);
    });
  }

  async function syncQueue() {
    if (!navigator.onLine) {
      setResult('ยังไม่มีอินเทอร์เน็ต', false);
      return;
    }

    const queue = getQueue();
    if (!queue.length) {
      renderQueue();
      return;
    }

    const remaining = [];

    for (const item of queue) {
      try {
        await postPayload(item.payload);
      } catch {
        remaining.push(item);
      }
    }

    localStorage.setItem('eai_mobile_queue', JSON.stringify(remaining));
    renderQueue();

    if (remaining.length) {
      setResult(`Sync แล้ว แต่ยังเหลือ ${remaining.length} รายการ`, false);
    } else {
      setResult('Sync รายการรอส่งสำเร็จทั้งหมด', true);
    }
  }

  async function testHealth() {
    $('healthOutput').textContent = 'กำลังทดสอบ...';

    try {
      const response = await fetch(`${C.API_URL}?action=health&_=${Date.now()}`, {
        cache: 'no-store'
      });
      const data = await response.json();
      $('healthOutput').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      $('healthOutput').textContent = `ERROR: ${error.message}`;
    }
  }

  function setResult(message, success) {
    const box = $('resultBox');
    box.textContent = message;
    box.className = `result ${success ? 'success' : 'error'}`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
