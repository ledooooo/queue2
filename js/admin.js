/* js/admin.js
   إدارة لوحة الادمن:
   - تسجيل دخول / إنشاء ادمن (Firebase Auth)
   - إظهار واجهة الادمن بعد الدخول
   - تحميل وحفظ الإعدادات من/إلى Realtime DB
   - تحميل قائمة العيادات
   - إضافة عيادة (مع حفظ passwordHash عبر SHA-256)
   - حذف عيادة
*/

// ======= Helper: SHA-256 hash (hex) =======
async function sha256Hex(text) {
  if (!text) return "";
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ======= Short references to DOM elements (IDs موجودة في HTML) =======
const authBlock = document.getElementById('authBlock');
const adminUI = document.getElementById('adminUI');
const signInBtn = document.getElementById('signInBtn');
const createAdminBtn = document.getElementById('createAdminBtn');
const adminEmail = document.getElementById('adminEmail');
const adminPassword = document.getElementById('adminPassword');
const authMsg = document.getElementById('authMsg');
const signOutBtn = document.getElementById('signOutBtn');

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
const addClinicBtn = document.getElementById('addClinic');

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


// ======= Ensure firebase is loaded =======
if (typeof firebase === 'undefined') {
  console.error("Firebase SDK غير محمّل - تأكد من استدعاء js/firebase-config.js و سكربت Firebase في HTML.");
  if (authMsg) authMsg.innerText = "خطأ: Firebase غير محمّل.";
}

// Realtime DB & Auth refs (v8)
const db = firebase.database();
const auth = firebase.auth();
const storage = firebase.storage ? firebase.storage() : null;

// ======= Auth state handling =======
auth.onAuthStateChanged(user => {
  if (user) {
    // مُسجّل دخول
    if (authBlock) authBlock.classList.add('hidden');
    if (adminUI) adminUI.classList.remove('hidden');
    if (signOutBtn) signOutBtn.classList.remove('hidden');
    // load data
    loadSettings();
    loadClinics();
  } else {
    // not signed in
    if (authBlock) authBlock.classList.remove('hidden');
    if (adminUI) adminUI.classList.add('hidden');
    if (signOutBtn) signOutBtn.classList.add('hidden');
  }
});

// ======= Sign in / Create admin handlers =======
if (signInBtn) {
  signInBtn.addEventListener('click', async () => {
    if (!adminEmail || !adminPassword) return;
    const email = adminEmail.value.trim();
    const pass = adminPassword.value.trim();
    authMsg.textContent = '';
    if (!email || !pass) { authMsg.textContent = 'أدخل البريد وكلمة المرور'; return; }
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      authMsg.textContent = '';
    } catch (e) {
      console.error("signIn error", e);
      authMsg.textContent = e.message || 'فشل تسجيل الدخول';
    }
  });
}

if (createAdminBtn) {
  createAdminBtn.addEventListener('click', async () => {
    if (!adminEmail || !adminPassword) return;
    const email = adminEmail.value.trim();
    const pass = adminPassword.value.trim();
    authMsg.textContent = '';
    if (!email || !pass) { authMsg.textContent = 'أدخل البريد وكلمة المرور لإنشاء حساب'; return; }
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
      alert('تم إنشاء مستخدم الادمن بنجاح. يمكنك الآن تسجيل الدخول.');
    } catch (e) {
      console.error("createAdmin error", e);
      authMsg.textContent = e.message || 'فشل إنشاء الحساب';
    }
  });
}

if (signOutBtn) {
  signOutBtn.addEventListener('click', async () => {
    try {
      await auth.signOut();
      // optional: refresh to reset UI
      // location.reload();
    } catch (e) {
      console.error("signOut error", e);
    }
  });
}


// ======= Load & Save Settings =======

// Function to check for missing audio files
function checkAudioAssets(mediaBaseUrlValue) {
  const audioErrorDiv = document.getElementById('audioError');
  
  // A simple check: if the user is on the default GitHub Pages URL and hasn't changed the mediaBaseUrl, the files are likely missing.
  // We will check if the value is the default scaffold value.
  if (mediaBaseUrlValue === '/assets/audio/') {
    audioErrorDiv.classList.remove('hidden');
  } else {
    audioErrorDiv.classList.add('hidden');
  }
}
async function loadSettings() {
  try {
    const snap = await db.ref('settings').once('value');
    const s = snap.val() || {};
    if (centerName) centerName.value = s.centerName || '';
    if (audioMode) audioMode.value = s.audioMode || 'mp3';
    if (playbackRate) playbackRate.value = s.playbackRate || 1;
    if (flashDuration) flashDuration.value = (s.flashDurationMs ? s.flashDurationMs/1000 : 5);
    if (callRepeat) callRepeat.value = s.callRepeatCount || 1;
    if (mediaBaseUrl) mediaBaseUrl.value = s.mediaBaseUrl || '/assets/audio/';
    // also populate testClinic after clinics load (loadClinics sets options)
    checkAudioAssets(s.mediaBaseUrl || '/assets/audio/'); // Check after loading
  } catch (e) {
    console.error("loadSettings error", e);
  }
}

if (saveSettings) {
  saveSettings.addEventListener('click', async () => {
    try {
      const s = {
        centerName: centerName ? centerName.value : '',
        audioMode: audioMode ? audioMode.value : 'mp3',
        playbackRate: Number(playbackRate ? playbackRate.value : 1),
        flashDurationMs: Number(flashDuration ? flashDuration.value : 5) * 1000,
        callRepeatCount: Number(callRepeat ? callRepeat.value : 1),
        mediaBaseUrl: mediaBaseUrl ? mediaBaseUrl.value : '/assets/audio/'
      };
      await db.ref('settings').set(s);
      alert('تم حفظ الإعدادات');
      checkAudioAssets(s.mediaBaseUrl); // Re-check after saving
    } catch (e) {
      console.error("saveSettings error", e);
      alert('فشل حفظ الإعدادات');
    }
  });
}


// ======= Load Clinics & UI rendering =======
async function loadClinics() {
  try {
    const snap = await db.ref('clinics').once('value');
    const clinics = snap.val() || {};
    // render list
    if (clinicsList) clinicsList.innerHTML = '';
    // clear testClinic select
    if (testClinic) {
      testClinic.innerHTML = '<option value="">اختر عيادة</option>';
    }
    // iterate keys
    Object.keys(clinics).forEach(key => {
      const c = clinics[key];
      // create card
      if (clinicsList) {
        const div = document.createElement('div');
        div.className = 'p-2 border rounded flex justify-between items-center';
        div.innerHTML = `
          <div>
            <b>${c.name || ''}</b>
            <div class="text-xs text-gray-600">الرقم الحالي: ${c.currentNumber || 0}</div>
          </div>
          <div class="flex items-center gap-2">
            <button class="px-2 py-1 bg-red-500 text-white rounded" data-id="${key}">حذف</button>
          </div>
        `;
        // delete handler
        const btn = div.querySelector('button');
        btn.addEventListener('click', async () => {
          if (!confirm('هل تريد حذف العيادة؟')) return;
          await db.ref('clinics/' + key).remove();
        });
        clinicsList.appendChild(div);
      }
      // add to test select
      if (testClinic) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = c.name || key;
        testClinic.appendChild(opt);
      }
    });
  } catch (e) {
    console.error("loadClinics error", e);
  }
}

// Also keep real-time updates: when clinics change, re-render
db.ref('clinics').on('value', snapshot => {
  // re-render using loadClinics for consistency
  loadClinics();
});


// ======= Add Clinic (with password hashing and max 10 limit) =======
if (addClinicBtn) {
  addClinicBtn.addEventListener('click', async () => {
    try {
      const name = newClinicName ? newClinicName.value.trim() : '';
      const pass = newClinicPass ? newClinicPass.value : '';
      if (!name || !pass) {
        alert('من فضلك أدخل اسم العيادة وكلمة السر');
        return;
      }

      // check limit
      const snap = await db.ref('clinics').once('value');
      const count = snap.exists() ? Object.keys(snap.val()).length : 0;
      if (count >= 10) {
        alert('الحد الأقصى للعيادات هو 10');
        return;
      }

      // hash password
      const ph = await sha256Hex(pass);

      // push clinic
      const newRef = db.ref('clinics').push();
      const obj = {
        id: newRef.key,
        name: name,
        passwordHash: ph,
        currentNumber: 0,
        lastCallAt: 0,
        audioPromptFile: null,
        useCustomPrompt: false
      };
      await newRef.set(obj);

      // clear inputs
      newClinicName.value = '';
      newClinicPass.value = '';

      alert('تم إضافة العيادة بنجاح');
      // refresh list (listener will handle)
    } catch (e) {
      console.error("addClinic error", e);
      alert('فشل إضافة العيادة');
    }
  });
}


// ======= Test playback / TTS (basic) =======
if (playTest) {
  playTest.addEventListener('click', async () => {
    try {
      const n = Number(testNumber ? testNumber.value : 1) || 1;
      const cId = testClinic ? testClinic.value : null;
      const sSnap = await db.ref('settings').once('value');
      const s = sSnap.val() || {};
      const base = s.mediaBaseUrl || '/assets/audio/';
      // build sequence using audioBuilder if loaded
      let seq = [];
      if (typeof buildAudioSequenceForNumber === 'function') seq = buildAudioSequenceForNumber(n, base);
      seq.push(base + 'base/go_to_clinic.mp3');
      if (cId) {
        const cSnap = await db.ref('clinics/' + cId).once('value');
        const c = cSnap.val() || {};
        if (c.audioPromptFile && c.useCustomPrompt) seq.push(c.audioPromptFile);
        else seq.push(base + 'clinics/' + cId + '_prompt.mp3');
      }
      // use AudioPlayerQueue if available
      if (typeof AudioPlayerQueue === 'function') {
        const player = new AudioPlayerQueue();
        player.setSettings({ playbackRate: s.playbackRate || 1.0, dingFile: base + 'base/ding.mp3' });
        player.enqueue({ files: seq, repeat: Number(testRepeat ? testRepeat.value : 1) || 1 });
      } else {
        // fallback simple alert
        alert('تشغيل اختبار: ' + seq.join(','));
      }
    } catch (e) {
      console.error("playTest error", e);
    }
  });
}

if (playTTS) {
  playTTS.addEventListener('click', () => {
    const n = Number(testNumber ? testNumber.value : 1) || 1;
    if (!window.speechSynthesis) return alert('TTS غير مدعوم في هذا المتصفح');
    const s1 = new SpeechSynthesisUtterance(`على العميل رقم ${n}`);
    s1.lang = 'ar-SA';
    const sSnap = {}; // we don't need settings here
    s1.rate = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(s1);
  });
}


// ======= Recorder (admin) - simple 5s recorder to preview and save to Storage =======
let mediaRecorder = null;
let recordedChunks = [];

if (startRec) {
  startRec.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return alert('التسجيل غير مدعوم في هذا المتصفح');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      recordedChunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        if (recPreview) {
          recPreview.src = URL.createObjectURL(blob);
          recPreview.classList.remove('hidden');
        }
        // store temporarily
        window._lastRecordedBlob = blob;
      };
      mediaRecorder.start();
      // auto-stop after 5s
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
      }, 5000);
    } catch (e) {
      console.error("rec start error", e);
      alert('فشل البدء بالتسجيل');
    }
  });
}

if (stopRec) {
  stopRec.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  });
}

if (saveRec) {
  saveRec.addEventListener('click', async () => {
    const blob = window._lastRecordedBlob;
    if (!blob) return alert('لا يوجد تسجيل محفوظ');
    if (!storage) return alert('Firebase Storage غير مفعّل أو غير مُدمج');
    try {
      const stamp = Date.now();
      const ref = storage.ref().child(`audio/recordings/${stamp}.webm`);
      const up = await ref.put(blob);
      const url = await ref.getDownloadURL();
      alert('تم رفع التسجيل، رابط الملف: (تم الحفظ في Storage)');
      console.log('uploaded url:', url);
    } catch (e) {
      console.error("saveRec error", e);
      alert('فشل رفع التسجيل');
    }
  });
}
