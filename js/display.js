// js/display.js
(async function(){
  if (!window.db) { console.error("Firebase DB غير مهيأ."); return; }

  const clinicsCards = document.getElementById('clinicsCards');
  const announcementText = document.getElementById('announcementText');
  const announcementMeta = document.getElementById('announcementMeta');
  const clock = document.getElementById('clock');
  const mediaVideo = document.getElementById('mediaVideo');
  const mediaImage = document.getElementById('mediaImage');
  const tickerContent = document.getElementById('tickerContent');

  const clinicsRef = db.ref('clinics');
  const settingsRef = db.ref('settings');

  let clinics = {};
  let settings = {};
  const player = new AudioPlayerQueue();

  function updateClock(){
    const d = new Date();
    clock.textContent = d.toLocaleString();
  }
  setInterval(updateClock, 1000);
  updateClock();

  // load clinics and display cards
  async function loadClinics() {
    const snap = await clinicsRef.once('value');
    clinics = snap.val() || {};
    clinicsCards.innerHTML = '';
    for (const id of Object.keys(clinics)) {
      const c = clinics[id];
      const card = document.createElement('div');
      card.className = 'p-3 bg-gray-800 border rounded flex items-center justify-between';
      card.id = 'card_' + id;
      card.innerHTML = `<div>
          <div class="font-semibold">${c.name || id}</div>
          <div class="text-xl mt-1" id="cardnum_${id}">${c.currentNumber || 0}</div>
        </div>`;
      clinicsCards.appendChild(card);
    }
  }

  // monitor settings
  settingsRef.on('value', snap => {
    settings = snap.val() || {};
    // ticker
    if (settings.tickerText) tickerContent.textContent = settings.tickerText;
    // audio settings
    player.setSettings({ playbackRate: settings.playbackRate || 1.0, dingFile: (settings.mediaBaseUrl || '/assets/audio/') + 'base/ding.mp3', mediaBaseUrl: settings.mediaBaseUrl || '/assets/audio/'});
  });

  // when clinics update (e.g., numbers change), update card numbers
  clinicsRef.on('value', snap => {
    clinics = snap.val() || {};
    for (const id of Object.keys(clinics)) {
      const el = document.getElementById('cardnum_' + id);
      if (el) el.textContent = clinics[id].currentNumber || 0;
    }
  });

  // helper: flash card
  function flashCard(clinicId, flashMs) {
    const el = document.getElementById('card_' + clinicId);
    if (!el) return;
    el.classList.add('ring-4','ring-yellow-400');
    setTimeout(()=> {
      el.classList.remove('ring-4','ring-yellow-400');
    }, flashMs || 5000);
  }

  // when lastCall changes -> display + play
  db.ref('lastCall').on('value', async snap => {
    const v = snap.val();
    if (!v) return;
    const clinicId = v.clinicId;
    const number = v.number;
    const timestamp = v.timestamp || Date.now();
    const d = new Date(timestamp);
    // update announcement text on top
    const clinicName = (clinics[clinicId] && clinics[clinicId].name) ? clinics[clinicId].name : clinicId;
    announcementText.textContent = `على العميل رقم ${number} التوجه إلى ${clinicName}`;
    announcementMeta.textContent = `${d.toLocaleString()}`;

    // flash the card
    const flashMs = (settings.flashDurationMs) || 5000;
    flashCard(clinicId, flashMs);

    // build audio sequence depending on settings.audioMode
    const mode = settings.audioMode || 'mp3';
    if (mode === 'tts') {
      // use Web Speech API
      if (window.speechSynthesis) {
        const s1 = new SpeechSynthesisUtterance(`على العميل رقم ${number}`);
        s1.lang = 'ar-SA';
        s1.rate = settings.playbackRate || 1.0;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(s1);
        setTimeout(()=>{
          const s2 = new SpeechSynthesisUtterance(`التوجه إلى ${clinicName}`);
          s2.lang='ar-SA';
          s2.rate = settings.playbackRate || 1.0;
          window.speechSynthesis.speak(s2);
        }, 700);
      } else {
        console.warn("TTS غير متاح على هذا المتصفح.");
      }
    } else {
      // mp3 mode: build sequence from mediaBase and play via player
      const base = settings.mediaBaseUrl || '/assets/audio/';
      const seq = buildAudioSequenceForNumber(number, base);
      seq.push(base + 'base/go_to_clinic.mp3');
      const clinic = clinics[clinicId] || {};
      if (clinic.audioPromptFile && clinic.useCustomPrompt) {
        seq.push(clinic.audioPromptFile);
      } else {
        // expect file under mediaBase/clinics/{clinicId}_prompt.mp3
        seq.push(base + `clinics/${clinicId}_prompt.mp3`);
      }
      // enqueue
      player.setSettings({ playbackRate: settings.playbackRate || 1.0, dingFile: base + 'base/ding.mp3' });
      player.enqueue({ files: seq, repeat: settings.callRepeatCount || 1 });
    }
  });

  // init
  await loadClinics();
})();
