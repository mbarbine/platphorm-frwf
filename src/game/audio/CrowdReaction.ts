/** One real ringside reaction at a time, reserved for decisive impacts. */
export class CrowdReaction {
  private buffer: AudioBuffer | null = null;
  private voice: AudioBufferSourceNode | null = null;
  private lastPlayed = -Infinity;
  private loading: Promise<void> | null = null;

  constructor(private context: AudioContext, private output: AudioNode) {}

  load(): Promise<void> {
    return this.loading ??= (async () => {
      try {
        const response = await fetch('/audio/frwf-crowd.ef8d497c5c43.mp3');
        if (!response.ok) return;
        const data = await response.arrayBuffer();
        if (data.byteLength > 256_000) return;
        this.buffer = await this.context.decodeAudioData(data);
      } catch { /* A missing recording must never interrupt combat or synthetic effects. */ }
    })();
  }

  play(): boolean {
    if (!this.buffer || this.voice || this.context.state !== 'running' || this.context.currentTime - this.lastPlayed < 7) return false;
    const voice = this.context.createBufferSource();
    voice.buffer = this.buffer; voice.connect(this.output);
    this.voice = voice; this.lastPlayed = this.context.currentTime;
    voice.onended = () => { voice.disconnect(); if (this.voice === voice) this.voice = null; };
    voice.start();
    return true;
  }

  stop(): void {
    const voice = this.voice; this.voice = null;
    if (voice) { voice.stop(); voice.disconnect(); }
  }
}
