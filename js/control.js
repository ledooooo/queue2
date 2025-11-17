// js/control.js
(async function(){
  if (!window.db) { console.error("Firebase DB غير مهيأ."); return; }

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
  const lastCalls = document.getElementById('lastCalls');

  const clinicsRef = db.ref('clinics');
  const settingsRef = db.ref('settings');
  let clinics = {};

  // audio player local
  const player = new AudioPlayerQueue();
  let localMediaBase = '/assets/audio/';

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

  async function loadSettings() {
    const sSnap = await settingsRef.once('value');
    const s = sSnap.val() || {};
    localMediaBase = s.mediaBaseUrl || '/assets/audio/';
    player.setSettings({ playbackRate: s.playbackRate || 1.0, dingFile: (s.mediaBaseUrl || '/assets/audio/') + 'base/ding.mp3' });
  }

  // check password: client-side hash compare
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

  // perform transaction increase/decrease
  async function changeNumber(clinicId, delta) {
    if (!clinicId) return;
    const cRef = clinicsRef.child(clinicId + '/currentNumber');
    await cRef.transaction(current => {
      if (current === null) return 0 + delta;
      return current + delta;
    });
    // fetch updated number and write lastCall entry
    const updatedSnap = await clinicsRef.child(clinicId).once('value');
    const clinicData = updatedSnap.val();
    // write a global lastCall entry (so displays can listen)
    const lastCall = {
      clinicId,
      number: clinicData.currentNumber || 0,
      timestamp: Date.now()
    };
    await db.ref('lastCall').set(lastCall);
    status.textContent = `تم تحديث الرقم إلى ${lastCall.number}`;
  }

  // call specific number (set number to input and notify)
  async function setSpecificNumber(clinicId, num) {
    await clinicsRef.child(clinicId + '/currentNumber').set(num);
    const lastCall = { clinicId, number: num, timestamp: Date.now() };
    await db.ref('lastCall').set(lastCall);
  }

  // reset queue
  async function resetClinic(clinicId) {
    await clinicsRef.child(clinicId + '/currentNumber').set(0);
    await db.ref('lastCall').set({ clinicId, number: 0, timestamp: Date.now(), reset: true });
  }

  // UI events
  nextBtn.addEventListener('click', async () => {
    const clinicId = clinicSelect.value;
    const pass = clinicPass.value;
    if (!(await authorize(clinicId, pass))) return alert('كلمة السر غير صحيحة');
    await changeNumber(clinicId, 1);
  });

  prevBtn.addEventListener('click', async () => {
    const clinicId = clinicSelect.value;
    const pass = clinicPass.value;
    if (!(await authorize(clinicId, pass))) return alert('كلمة السر غير صحيحة');
    await changeNumber(clinicId, -1);
  });

  repeatBtn.addEventListener('click', async () => {
    const clinicId = clinicSelect.value;
    const pass = clinicPass.value;
    if (!(await authorize(clinicId, pass))) return alert('كلمة السر غير صحيحة');
    // do not change number, just push lastCall with same number
    const snap = await clinicsRef.child(clinicId).once('value');
    const c = snap.val() || {};
    const n = c.currentNumber || 0;
    await db.ref('lastCall').set({ clinicId, number: n, timestamp: Date.now(), repeat: true });
    status.textContent = `تم تكرار نداء الرقم ${n}`;
  });

  callSpecificBtn.addEventListener('click', async () => {
    const clinicId = clinicSelect.value;
    const pass = clinicPass.value;
    const num = Number(specificNumber.value);
    if (!(await authorize(clinicId, pass))) return alert('كلمة السر غير صحيحة');
    if (!num || num < 0) return alert('أدخل رقم صحيح');
    await setSpecificNumber(clinicId, num);
  });

  resetQueue.addEventListener('click', async () => {
    const clinicId = clinicSelect.value;
    const pass = clinicPass.value;
    if (!(await authorize(clinicId, pass))) return alert('كلمة السر غير صحيحة');
    if (!confirm('هل تريد إعادة تعيين الطابور لهذه العيادة؟')) return;
    await resetClinic(clinicId);
  });

  // enable audio (user action to allow autoplay on some devices)
  enableAudio.addEventListener('click', async () => {
    // try to play a short silent audio or ding to "unlock"
    const silent = new Audio(player.settings.dingFile);
    try {
      await silent.play();
      silent.pause();
      silent.currentTime = 0;
      alert('تم تمكين الصوت محليًا على هذا الجهاز');
    } catch (e) {
      alert('فشل في تمكين الصوت تلقائيًا. تأكد من إعطاء إذن الصوت.');
    }
  });

  // listen to settings changes
  settingsRef.on('value', snap => {
    const s = snap.val() || {};
    player.setSettings({ playbackRate: s.playbackRate || 1.0, dingFile: (s.mediaBaseUrl || '/assets/audio/') + 'base/ding.mp3' });
  });

  // show last calls
  db.ref('lastCall').on('value', snap => {
    const v = snap.val();
    if (!v) return;
    const d = new Date(v.timestamp || Date.now());
    lastCalls.innerHTML = `العيادة: ${v.clinicId} - رقم: ${v.number} - ${d.toLocaleString()}`;
    // local audible feedback (optional): control does not need to play; display will play
  });

  // init
  await loadClinics();
  await loadSettings();
})();
