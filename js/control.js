// js/control.js
(async function(){
  if (!window.db) { console.error("Firebase غير مهيأ"); return; }

  const clinicSelect = document.getElementById('clinicSelect');
  const clinicPass = document.getElementById('clinicPass');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const callSpecificBtn = document.getElementById('callSpecificBtn');
  const specificNumber = document.getElementById('specificNumber');
  const resetQueue = document.getElementById('resetQueue');
  const enableAudio = document.getElementById('enableAudio');
  const status = document.getElementById('status');
  const lastCallDiv = document.getElementById('lastCall');

  const clinicsRef = db.ref('clinics');

  let clinics = {};

  // load clinics
  async function loadClinics() {
    const snap = await clinicsRef.once('value');
    clinics = snap.val() || {};
    clinicSelect.innerHTML = '';
    for (const id of Object.keys(clinics)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = clinics[id].name || id;
      clinicSelect.appendChild(opt);
    }
  }

  // sha256 helper
  async function sha256Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
  }

  async function authorize(clinicId, pass) {
    const snap = await clinicsRef.child(clinicId + '/passwordHash').once('value');
    const ph = snap.val();
    if (!ph) return false;
    const h = await sha256Hex(pass || '');
    return h === ph;
  }

  async function changeNumber(clinicId, delta) {
    if (!clinicId) return;
    await clinicsRef.child(clinicId + '/currentNumber').transaction(curr => {
      if (curr === null) return (0 + delta);
      return curr + delta;
    });
    const snap = await clinicsRef.child(clinicId).once('value');
    const c = snap.val() || {};
    const lastCall = { clinicId, number: c.currentNumber || 0, timestamp: Date.now() };
    await db.ref('lastCall').set(lastCall);
    status.textContent = `تم التحديث إلى ${lastCall.number}`;
  }

  async function setSpecificNumber(clinicId, num) {
    await clinicsRef.child(clinicId + '/currentNumber').set(num);
    const lastCall = { clinicId, number: num, timestamp: Date.now() };
    await db.ref('lastCall').set(lastCall);
    status.textContent = `تم ضبط الرقم إلى ${num}`;
  }

  async function resetClinic(clinicId) {
    await clinicsRef.child(clinicId + '/currentNumber').set(0);
    await db.ref('lastCall').set({ clinicId, number: 0, timestamp: Date.now(), reset: true });
    status.textContent = `تم إعادة التعيين`;
  }

  nextBtn.addEventListener('click', async ()=> {
    const cid = clinicSelect.value;
    const pass = clinicPass.value;
    if (!await authorize(cid, pass)) return alert('كلمة السر خاطئة');
    await changeNumber(cid, 1);
  });

  prevBtn.addEventListener('click', async ()=> {
    const cid = clinicSelect.value;
    const pass = clinicPass.value;
    if (!await authorize(cid, pass)) return alert('كلمة السر خاطئة');
    await changeNumber(cid, -1);
  });

  repeatBtn.addEventListener('click', async ()=> {
    const cid = clinicSelect.value;
    const pass = clinicPass.value;
    if (!await authorize(cid, pass)) return alert('كلمة السر خاطئة');
    const snap = await clinicsRef.child(cid).once('value');
    const c = snap.val() || {};
    const n = c.currentNumber || 0;
    await db.ref('lastCall').set({ clinicId: cid, number: n, timestamp: Date.now(), repeat: true });
    status.textContent = `تم تكرار النداء للرقم ${n}`;
  });

  callSpecificBtn.addEventListener('click', async ()=> {
    const cid = clinicSelect.value;
    const pass = clinicPass.value;
    const n = Number(specificNumber.value);
    if (!await authorize(cid, pass)) return alert('كلمة السر خاطئة');
    if (!n) return alert('أدخل رقم صحيح');
    await setSpecificNumber(cid, n);
  });

  resetQueue.addEventListener('click', async ()=> {
    const cid = clinicSelect.value;
    const pass = clinicPass.value;
    if (!await authorize(cid, pass)) return alert('كلمة السر خاطئة');
    if (!confirm('إعادة التعيين للعيادة؟')) return;
    await resetClinic(cid);
  });

  enableAudio.addEventListener('click', async ()=> {
    try {
      const a = new Audio('/assets/audio/base/ding.mp3');
      await a.play();
      a.pause();
      a.currentTime = 0;
      alert('تم تمكين الصوت في هذا المتصفح');
    } catch(e) {
      alert('فشل تمكين الصوت — حاول تفاعل المستخدم يدوياً');
    }
  });

  db.ref('lastCall').on('value', snap => {
    const v = snap.val();
    if (!v) return;
    const d = new Date(v.timestamp || Date.now());
    lastCallDiv.textContent = `العيادة: ${v.clinicId} - رقم: ${v.number} - ${d.toLocaleString()}`;
  });

  await loadClinics();
})();
