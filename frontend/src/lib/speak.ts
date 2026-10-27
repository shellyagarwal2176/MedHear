// Reads text aloud so a deaf patient can "speak" to hearing staff. Returns false if unsupported.
export function speak(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find((v) => v.lang === "en-IN") ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
  return true;
}
