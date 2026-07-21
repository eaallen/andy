/**
 * Plays lab feedback tones with the Web Audio API.
 * Profiles come from lab config (`feedback.profile`), not load ids.
 */
export function createSoundPlayer() {
  let audioCtx = null;

  /**
   * Lazily creates or resumes the shared AudioContext.
   */
  function ensureContext() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }
    if (!audioCtx) {
      audioCtx = new AudioContextCtor();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * Plays a short tone at the given frequency.
   * @param {number} frequency - Tone frequency in Hz.
   * @param {number} durationSec - How long the tone lasts.
   * @param {number} [startOffsetSec] - Delay before the tone starts.
   * @param {string} [type] - Oscillator wave type.
   */
  function playTone(frequency, durationSec, startOffsetSec, type) {
    const ctx = ensureContext();
    if (!ctx) {
      return;
    }

    const startAt = ctx.currentTime + (startOffsetSec || 0);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type || "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + durationSec + 0.02);
  }

  /**
   * Plays the ding-dong two-tone chime profile.
   */
  function playDingDong() {
    playTone(880, 0.22, 0, "sine");
    playTone(659, 0.35, 0.2, "sine");
  }

  /**
   * Plays the single lower buzz profile.
   */
  function playBuzz() {
    playTone(392, 0.45, 0, "triangle");
  }

  /**
   * Plays a named sound profile from lab config feedback.
   * @param {string} profile - Profile id (e.g. "dingDong", "buzz").
   */
  function playProfile(profile) {
    if (profile === "dingDong") {
      playDingDong();
      return;
    }
    if (profile === "buzz") {
      playBuzz();
    }
  }

  return {
    playProfile: playProfile,
    playDingDong: playDingDong,
    playBuzz: playBuzz,
  };
}
