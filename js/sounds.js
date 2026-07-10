/**
 * Plays doorbell tones with the Web Audio API.
 * Front has a ding-dong; Rear/Side share a single lower tone.
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
   * Plays the Front doorbell sound (two-tone ding-dong).
   */
  function playFront() {
    playTone(880, 0.22, 0, "sine");
    playTone(659, 0.35, 0.2, "sine");
  }

  /**
   * Plays the Rear/Side doorbell sound (lower single buzz).
   */
  function playRear() {
    playTone(392, 0.45, 0, "triangle");
  }

  /**
   * Plays the sound for a chime path.
   * @param {"front" | "rear"} key - Which chime path sounded.
   */
  function playChime(key) {
    if (key === "front") {
      playFront();
      return;
    }
    if (key === "rear") {
      playRear();
    }
  }

  return {
    playFront: playFront,
    playRear: playRear,
    playChime: playChime,
  };
}
