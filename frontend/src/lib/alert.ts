// A short double beep so a doctor looking elsewhere notices a new alert. Browsers may block it
// until the page has been clicked once, so failures are ignored.
export function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.22].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // audio not available
  }
}
