// js/audioQueue.js
class AudioPlayerQueue {
  constructor(settings = {}) {
    this.queue = [];
    this.playing = false;
    this.settings = Object.assign({
      playbackRate: 1.0,
      dingFile: "/assets/audio/base/ding.mp3",
      mediaBaseUrl: "/assets/audio/"
    }, settings);
    this.currentAudio = null;
  }

  setSettings(s) { Object.assign(this.settings, s); }

  enqueue(task) {
    this.queue.push(task);
    this.process();
  }

  async process() {
    if (this.playing) return;
    const task = this.queue.shift();
    if (!task) return;
    this.playing = true;
    for (let r = 0; r < (task.repeat || 1); r++) {
      await this.playFile(this.settings.dingFile);
      for (const file of task.files) {
        await this.playFile(file);
      }
    }
    this.playing = false;
    if (task.callback) try { task.callback(); } catch(e){ console.error(e); }
    this.process();
  }

  playFile(src) {
    return new Promise((resolve) => {
      try {
        const a = new Audio(src);
        a.preload = "auto";
        a.playbackRate = this.settings.playbackRate || 1.0;
        this.currentAudio = a;
        a.onended = () => { this.currentAudio = null; resolve(); };
        a.onerror = (e) => { console.error("Audio error", e); this.currentAudio = null; resolve(); };
        a.play().catch((err) => { console.warn("Playback blocked or failed", err); resolve(); });
      } catch (e) {
        console.error("playFile exception", e);
        resolve();
      }
    });
  }

  stop() {
    if (this.currentAudio) {
      try { this.currentAudio.pause(); this.currentAudio.currentTime = 0; } catch(e){}
      this.currentAudio = null;
    }
    this.queue = [];
    this.playing = false;
  }
}
