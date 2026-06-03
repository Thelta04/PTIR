let audioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }

  return audioContext;
}

function playToneSequence(context) {
  const playTone = (frequency, delay) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
    gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.22);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + 0.24);
  };

  playTone(880, 0);
  playTone(1175, 0.26);
}

export function playNotificationSound() {
  try {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === 'suspended') {
      context.resume()
        .then(() => playToneSequence(context))
        .catch(() => {});
      return;
    }

    playToneSequence(context);
  } catch (err) {
    console.error('Error playing notification sound:', err);
  }
}
