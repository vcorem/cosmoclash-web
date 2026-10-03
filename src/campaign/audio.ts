export class CampaignAudio {
  private context: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  enabled = false;
  toggle(): boolean {
    if (this.enabled) {
      this.context?.suspend();
      this.enabled = false;
      return false;
    }
    try {
      if (!this.context) {
        this.context = new AudioContext();
        const gain = this.context.createGain();
        gain.gain.value = 0.035;
        gain.connect(this.context.destination);
        this.nodes.push(gain);
        [55, 82.41, 110, 164.81].forEach((freq, i) => {
          const o = this.context!.createOscillator();
          o.type = "sine";
          o.frequency.value = freq;
          o.detune.value = i % 2 ? 4 : -4;
          o.connect(gain);
          o.start();
          this.nodes.push(o);
        });
      }
      void this.context.resume();
      this.enabled = true;
    } catch {
      this.enabled = false;
    }
    return this.enabled;
  }
  ping(): void {
    if (!this.enabled || !this.context) return;
    const t = this.context.currentTime,
      o = this.context.createOscillator(),
      g = this.context.createGain();
    o.frequency.setValueAtTime(640, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.16);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g);
    g.connect(this.context.destination);
    o.start();
    o.stop(t + 0.23);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
}
