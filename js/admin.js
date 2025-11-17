// js/admin.js
(async function(){
  if (!window.auth || !window.db || !window.storage) {
    console.error("Firebase لم يتم تهيئته بشكل كامل. تحقّق من js/firebase-config.js");
    return;
  }

  // عناصر الواجهة
  const authBlock = document.getElementById('authBlock');
  const adminUI = document.getElementById('adminUI');
  const signInBtn = document.getElementById('signInBtn');
  const createAdminBtn = document.getElementById('createAdminBtn');
  const adminEmail = document.getElementById('adminEmail');
  const adminPassword = document.getElementById('adminPassword');
  const authMsg = document.getElementById('authMsg');
  const signOutBtn = document.getElementById('signOutBtn');

  const settingsRef = db.ref('settings');
  const clinicsRef = db.ref('clinics');

  // UI elements (settings)
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
  const bulkUploadPrompts = document.getElementById('bulkUploadPrompts');
  const bulkFiles = document.getElementById('bulkFiles');

  const testNumber = document.getElementById('testNumber');
  const testClinic = document.getElementById('testClinic');
  const testRepeat = document.getElementById('testRepeat');
  const playTest = document.getElementById('playTest');
  const playTTS = document.getElementById('playTTS');

  const startRec = document.getElementById('startRec');
  const stopRec = document.getElementById('stopRec');
  const saveRec = document.getElementById('saveRec');
  const recPreview = document.getElementById('recPreview');
  const recName = document.getElementById('recName');

  // player for admin tests
  const player = new AudioPlayerQueue();

  // Authentication handlers
  signInBtn.addEventListener('click', async () => {
    authMsg.textContent = '';
    try {
      await auth.signInWithEmailAndPassword(adminEmail.value.trim(), adminPassword.value);
      authMsg.textContent = '';
    } catch (e) {
      console.error(e);
      authMsg.textContent = e.message || 'فشل تسجيل الدخول';
    }
  });

  createAdminBtn.addEventListener('click', async () => {
    if (!confirm('إنشاء مستخدم ادمن جديد. تابع؟')) return;
    try {
      await auth.createUserWithEmailAndPassword(adminEmail.value.trim(), adminPassword.value);
      alert('تم إنشاء المستخدم بنجاح. يمكنك الآن تسجيل الدخول.');
    } catch (e) {
      console.error(e);
      alert('خطأ إنشاء المستخدم: ' + (e.message || e));
    }
  });

  signOutBtn.addEventListener('click', async ()=> {
    await auth.signOut();
  });

  // Auth state observer
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      authBlock.classList.add('hidden');
      adminUI.classList.remove('hidden');
      signOutBtn.classList.remove('hidden');
      await loadSettings();
      await loadClinics();
    } else {
      authBlock.classList.remove('hidden');
      adminUI.classList.add('hidden');
      signOutBtn.classList.add('hidden');
    }
  });

  // load settings & clinics
  async function loadSettings() {
    const snap = await settingsRef.once('value');
    const s = snap.val() || {};
    centerName.value = s.centerName || '';
    audioMode.value = s.audioMode || 'mp3';
    playbackRate.value = s.playbackRate || 1.0;
    flashDuration.value = (s.flashDurationMs ? s.flashDurationMs/1000 : 5);
    callRepeat.value = s.callRepeatCount || 1;
    mediaBaseUrl.value = s.mediaBaseUrl || '/assets/audio/';
  }

  async function loadClinics() {
    clinicsList.innerHTML = '';
    testClinic.innerHTML = '<option value="">اختر عيادة</option>';
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
      testClinic.appendChild(opt);
    }
  }

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

  addClinic.addEventListener('click', async () => {
    const cname = newClinicName.value.trim();
    const cpass = newClinicPass.value || '';
    if (!cname) return alert('أدخل اسم العيادة');
    const snap = await clinicsRef.once('value');
    const count = snap.exists() ? Object.keys(snap.val()).length : 0;
    if (count >= 10) return alert('لا يمكن إضافة أكثر من 10 عيادات');
    const id = 'clinic_' + Date.now();
    // hash كلمة السر مخزنة كـ simple hash client-side (improve later if needed)
    const ph = await sha256Hex(cpass || Math.random().toString(36).slice(2,8));
    const obj = { name: cname, passwordHash: ph, currentNumber: 0, lastCallAt: 0, audioPromptFile: null, useCustomPrompt: false };
    await clinicsRef.child(id).set(obj);
    newClinicName.value = '';
    newClinicPass.value = '';
    await loadClinics();
  });

  clinicsList.addEventListener('click', async (e) => {
    const del = e.target.closest('.deleteClinic');
    const edit = e.target.closest('.editClinic');
    if (del) {
      const id = del.dataset.id;
      if (!confirm('حذف العيادة؟')) return;
      await clinicsRef.child(id).remove();
      await loadClinics();
    } else if (edit) {
      const id = edit.dataset.id;
      const snap = await clinicsRef.child(id).once('value');
      const c = snap.val() || {};
      const newName = prompt('اسم العيادة:', c.name || '');
      if (newName === null) return;
      await clinicsRef.child(id).update({ name: newName });
      const newPass = prompt('كلمة سر جديدة (اتركها فارغة إن لم ترغب بتغييرها):', '');
      if (newPass) {
        const ph = await sha256Hex(newPass);
        await clinicsRef.child(id).update({ passwordHash: ph });
      }
      await loadClinics();
    }
  });

  bulkUploadPrompts.addEventListener('click', ()=> bulkFiles.click());
  bulkFiles.addEventListener('change', async (e)=> {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // expects files named like clinic_<id>_prompt.mp3 or <clinicId>.mp3 — here we try clinic_<id> pattern
    for (const f of files) {
      // try to parse clinic id from file name
      const name = f.name;
      // e.g., clinic_clinic_163..._prompt.mp3 or clinic_163_prompt.mp3
      const match = name.match(/clinic[_-]?(clinic_\\d+|\\d+|[a-zA-Z0-9_-]+)/i);
      let cid = null;
      if (match && match[1]) cid = match[1];
      // fallback: user provides mapping later
      if (!cid) continue;
      const ref = storage.ref().child(`audio/clinics/${cid}_prompt.mp3`);
      try {
        await ref.put(f);
        const url = await ref.getDownloadURL();
        await clinicsRef.child(cid).update({ audioPromptFile: url, useCustomPrompt: true });
      } catch(e) {
        console.error('upload fail', e);
      }
    }
    alert('انتهى رفع الملفات (إن تطابقت الأسماء مع IDs الموجودة)');
    await loadClinics();
  });

  // player test
  playTest.addEventListener('click', async ()=> {
    const n = Number(testNumber.value) || 1;
    const cId = testClinic.value;
    const rep = Number(testRepeat.value) || 1;
    const sSnap = await settingsRef.once('value');
    const s = sSnap.val() || {};
    const base = s.mediaBaseUrl || '/assets/audio/';
    const seq = buildAudioSequenceForNumber(n, base);
    seq.push(base + 'base/go_to_clinic.mp3');
    if (cId) {
      const cSnap = await clinicsRef.child(cId).once('value');
      const c = cSnap.val() || {};
      if (c.audioPromptFile && c.useCustomPrompt) seq.push(c.audioPromptFile);
      else seq.push(base + `clinics/${cId}_prompt.mp3`);
    }
    player.setSettings({ playbackRate: s.playbackRate || 1.0, dingFile: base + 'base/ding.mp3' });
    player.enqueue({ files: seq, repeat: rep });
  });

  playTTS.addEventListener('click', ()=> {
    const n = Number(testNumber.value) || 1;
    if (!window.speechSynthesis) return alert('TTS غير مدعوم');
    const s1 = new SpeechSynthesisUtterance(`على العميل رقم ${n}`);
    s1.lang='ar-SA';
    s1.rate = Number(playbackRate.value) || 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(s1);
  });

  // recording (5s)
  let mediaRecorder, recordedChunks = [];
  startRec.addEventListener('click', async ()=> {
    if (!navigator.mediaDevices) return alert('التسجيل غير مدعوم');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      recPreview.src = URL.createObjectURL(blob);
      recPreview.classList.remove('hidden');
      window._lastRecordedBlob = blob;
    };
    mediaRecorder.start();
    setTimeout(()=> { if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); }, 5000);
  });

  stopRec.addEventListener('click', ()=> { if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); });

  saveRec.addEventListener('click', async ()=> {
    const b = window._lastRecordedBlob;
    const cname = recName.value.trim();
    if (!b || !cname) return alert('أدخل اسم العميل أو سجل صوتًا أولا');
    // save to storage as a unique file and optionally map to clinic later
    const stamp = Date.now();
    const ref = storage.ref().child(`audio/recordings/${stamp}.webm`);
    const up = ref.put(b);
    up.on('state_changed', null, e => { console.error(e); alert('فشل رفع'); }, async ()=> {
      const url = await ref.getDownloadURL();
      alert('تم رفع التسجيل');
    });
  });

  // helper: sha256
  async function sha256Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
  }
})();
