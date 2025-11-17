// js/admin.js
// Admin UI logic
(async function(){
  if (!window.db) {
    console.error("Firebase DB غير مهيأ. تأكد من تكوين js/firebase-config.js");
    return;
  }

  // helper: SHA-256 hash for password storage (returns hex)
  async function sha256Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // UI elements
  const adminSection = document.getElementById('admin-ui');
  const authSection = document.getElementById('auth-section');
  const adminLogin = document.getElementById('adminLogin');
  const adminPass = document.getElementById('adminPass');
  const authMsg = document.getElementById('authMsg');
  const logoutBtn = document.getElementById('logoutBtn');

  const centerName = document.getElementById('centerName');
  const audioMode = document.getElementById('audioMode');
  const playbackRate = document.getElementById('playbackRate');
  const flashDuration = document.getElementById('flashDuration');
  const callRepeat = document.getElementById('callRepeat');
  const mediaBaseUrl = document.getElementById('mediaBaseUrl');
  const saveSettings = document.getElementById('saveSettings');

  const clinicsList = document.getElementById('clinicsList');
  const newClinicName = document.getElementById('newClinicName');
  const newClinicPass = document.getElementById('newClinicPass');
  const addClinic = document.getElementById('addClinic');
  const uploadClinicPrompt = document.getElementById('uploadClinicPrompt');
  const clinicPromptFile = document.getElementById('clinicPromptFile');

  const testNumber = document.getElementById('testNumber');
  const testClinicSelect = document.getElementById('testClinicSelect');
  const testRepeat = document.getElementById('testRepeat');
  const playTest = document.getElementById('playTest');
  const playTTS = document.getElementById('playTTS');

  const startRec = document.getElementById('startRec');
  const stopRec = document.getElementById('stopRec');
  const saveRec = document.getElementById('saveRec');
  const recClientName = document.getElementById('recClientName');
  const recPreview = document.getElementById('recPreview');

  // local admin session
  let adminAuthenticated = false;
  let adminHashInFirebase = null;

  // audio queue for testing within admin (local)
  const player = new AudioPlayerQueue();

  // fetch admin hash from db
  const settingsRef = db.ref('settings');
  const clinicsRef = db.ref('clinics');

  async function loadSettings() {
    const snap = await settingsRef.once('value');
    const settings = snap.val() || {};
    centerName.value = settings.centerName || '';
    audioMode.value = settings.audioMode || 'mp3';
    playbackRate.value = settings.playbackRate || 1.0;
    flashDuration.value = (settings.flashDurationMs ? settings.flashDurationMs/1000 : 5);
    callRepeat.value = settings.callRepeatCount || 1;
    mediaBaseUrl.value = settings.mediaBaseUrl || '/assets/audio/';
  }

  async function loadClinics() {
    clinicsList.innerHTML = '';
    testClinicSelect.innerHTML = '<option value="">اختر عيادة</option>';
    const snap = await clinicsRef.once('value');
    const clinics = snap.val() || {};
    const entries = Object.entries(clinics);
    entries.sort((a,b)=> a[0].localeCompare(b[0]));
    for (const [id, c] of entries) {
      const div = document.createElement('div');
      div.className = 'p-2 border rounded flex items-center justify-between';
      div.innerHTML = `
        <div>
          <div class="font-semibold">${c.name || id}</div>
          <div class="text-xs text-gray-600">الرقم الحالي: ${c.currentNumber || 0}</div>
        </div>
        <div class="flex items-center gap-2">
          <button data-id="${id}" class="editClinic px-2 py-1 bg-yellow-400 rounded">تعديل</button>
          <button data-id="${id}" class="deleteClinic px-2 py-1 bg-red-500 text-white rounded">حذف</button>
        </div>
      `;
      clinicsList.appendChild(div);
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = c.name || id;
      testClinicSelect.appendChild(opt);
    }
  }

  // admin authentication (simple hash compare)
  async function fetchAdminHash() {
    const snap = await db.ref('admin/passwordHash').once('value');
    adminHashInFirebase = snap.val() || null;
  }

  adminLogin.addEventListener('click', async () => {
    authMsg.textContent = '';
    await fetchAdminHash();
    if (!adminHashInFirebase) {
      authMsg.textContent = 'لا يوجد كلمة مرور مدرجة في النظام. الرجاء إعداد كلمة مرور من قاعدة البيانات.';
      return;
    }
    const h = await sha256Hex(adminPass.value || '');
    if (h === adminHashInFirebase) {
      adminAuthenticated = true;
      authSection.classList.add('hidden');
      adminSection.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
      await loadSettings();
      await loadClinics();
    } else {
      authMsg.textContent = 'كلمة المرور غير صحيحة.';
    }
  });

  logoutBtn.addEventListener('click', () => {
    adminAuthenticated = false;
    adminSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
  });

  // save settings
  saveSettings.addEventListener('click', async () => {
    const s = {
      centerName: centerName.value || '',
      audioMode: audioMode.value,
      playbackRate: Number(playbackRate.value) || 1.0,
      flashDurationMs: (Number(flashDuration.value) || 5) * 1000,
      callRepeatCount: Number(callRepeat.value) || 1,
      mediaBaseUrl: mediaBaseUrl.value || '/assets/audio/'
    };
    await settingsRef.set(s);
    alert('تم حفظ الإعدادات');
  });

  // add clinic
  addClinic.addEventListener('click', async () => {
    const cname = newClinicName.value.trim();
    const cpass = newClinicPass.value || '';
    if (!cname) return alert('أدخل اسم العيادة');
    // limit clinics to 10
    const snap = await clinicsRef.once('value');
    const count = snap.exists() ? Object.keys(snap.val()).length : 0;
    if (count >= 10) return alert('الحد الأقصى للعيادات هو 10');
    const newId = 'clinic_' + Date.now();
    const passHash = await sha256Hex(cpass || Math.random().toString(36).slice(2,8));
    const obj = {
      name: cname,
      passwordHash: passHash,
      currentNumber: 0,
      lastCallAt: 0,
      audioPromptFile: null,
      useCustomPrompt: false
    };
    await clinicsRef.child(newId).set(obj);
    newClinicName.value = '';
    newClinicPass.value = '';
    await loadClinics();
  });

  // delete/edit clinic (simple)
  clinicsList.addEventListener('click', async (e) => {
    const del = e.target.closest('.deleteClinic');
    const edit = e.target.closest('.editClinic');
    if (del) {
      const id = del.dataset.id;
      if (!confirm('هل تريد حذف العيادة؟')) return;
      await clinicsRef.child(id).remove();
      await loadClinics();
    } else if (edit) {
      const id = edit.dataset.id;
      const snap = await clinicsRef.child(id).once('value');
      const c = snap.val();
      const newName = prompt('اسم العيادة:', c.name || '');
      if (newName === null) return;
      await clinicsRef.child(id).update({ name: newName });
      // تغيير كلمة السر
      const newPass = prompt('كلمة سر جديدة (اتركها فارغة إن لم ترغب بتغييرها):', '');
      if (newPass) {
        const ph = await sha256Hex(newPass);
        await clinicsRef.child(id).update({ passwordHash: ph });
      }
      await loadClinics();
    }
  });

  // upload clinic prompt (record or choose file)
  uploadClinicPrompt.addEventListener('click', () => {
    clinicPromptFile.click();
  });

  clinicPromptFile.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    // require clinic selection to save file to a clinic
    const clinicId = prompt('أدخل ID العيادة لحفظ هذا الملف (مثال: clinic_...):');
    if (!clinicId) return alert('مطلوب ID العيادة');
    // upload to storage under audio/clinics/{clinicId}.mp3
    const storageRef = storage.ref().child(`audio/clinics/${clinicId}_prompt.mp3`);
    const up = storageRef.put(f);
    up.on('state_changed', null, (err) => {
      console.error(err);
      alert('فشل رفع الملف');
    }, async () => {
      const url = await storageRef.getDownloadURL();
      await clinicsRef.child(clinicId).update({ audioPromptFile: url, useCustomPrompt: true });
      alert('تم رفع وحفظ ملف النداء للعيادة');
      await loadClinics();
    });
  });

  // Test playback
  playTest.addEventListener('click', async () => {
    const num = Number(testNumber.value) || 1;
    const clinicId = testClinicSelect.value;
    const rep = Number(testRepeat.value) || 1;
    const sSnap = await settingsRef.once('value');
    const s = sSnap.val() || {};
    const mediaBase = s.mediaBaseUrl || '/assets/audio/';
    const seq = buildAudioSequenceForNumber(num, mediaBase);
    seq.push(mediaBase + 'base/go_to_clinic.mp3');
    if (clinicId) {
      const cSnap = await clinicsRef.child(clinicId).once('value');
      const c = cSnap.val() || {};
      if (c.audioPromptFile && c.useCustomPrompt) seq.push(c.audioPromptFile);
      else seq.push(mediaBase + 'clinics/' + clinicId + '_prompt.mp3');
    }
    player.setSettings({ playbackRate: s.playbackRate || 1.0, dingFile: (s.mediaBaseUrl || '/assets/audio/') + 'base/ding.mp3' });
    player.enqueue({ files: seq, repeat: rep });
  });

  // TTS test (Web Speech)
  playTTS.addEventListener('click', () => {
    const num = Number(testNumber.value) || 1;
    const clinicId = testClinicSelect.value;
    const sSynth = window.speechSynthesis;
    if (!sSynth) return alert('Web Speech TTS غير مدعوم في هذا المتصفح');
    const sUt = new SpeechSynthesisUtterance(`على العميل رقم ${num}`);
    sUt.lang = 'ar-SA';
    sUt.rate = Number(playbackRate.value) || 1.0;
    sSynth.speak(sUt);
    if (clinicId) {
      setTimeout(()=> {
        const sUt2 = new SpeechSynthesisUtterance(`التوجه الى ${document.querySelector('#testClinicSelect option:checked').textContent}`);
        sUt2.lang='ar-SA';
        sUt2.rate = Number(playbackRate.value) || 1.0;
        sSynth.speak(sUt2);
      }, 700);
    }
  });

  // Simple recorder for client name (5s)
  let mediaRecorder, recordedChunks = [];
  startRec.addEventListener('click', async () => {
    if (!navigator.mediaDevices) return alert('المتصفح لا يدعم التسجيل');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      recPreview.src = URL.createObjectURL(blob);
      recPreview.classList.remove('hidden');
      recPreview.controls = true;
      recPreview.play();
      // store temporarily
      window._lastRecordedBlob = blob;
    };
    mediaRecorder.start();
    setTimeout(()=> {
      if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    }, 5000); // auto stop after 5s
  });

  stopRec.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  });

  // Save recorded audio to storage and assign to a clinic prompt
  saveRec.addEventListener('click', async () => {
    const blob = window._lastRecordedBlob;
    if (!blob) return alert('لا يوجد تسجيل محفوظ');
    const clinicId = prompt('أدخل ID العيادة لحفظ التسجيل عليها (مثال: clinic_...):');
    if (!clinicId) return;
    const storageRef = storage.ref().child(`audio/clinics/${clinicId}_prompt.webm`);
    const up = storageRef.put(blob);
    up.on('state_changed', null, (err) => {
      console.error(err);
      alert('فشل رفع الملف');
    }, async () => {
      const url = await storageRef.getDownloadURL();
      await clinicsRef.child(clinicId).update({ audioPromptFile: url, useCustomPrompt: true });
      alert('تم حفظ التسجيل للعيادة');
      await loadClinics();
    });
  });

  // initial fetch (adminHash may be null - instruct user to set via console if not set)
  await fetchAdminHash();
  // load settings and clinics only after auth - done in login
})();
