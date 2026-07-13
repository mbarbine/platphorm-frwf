import type { ImpactEvent } from '../types/game';
import type { Settings } from '../state/settings';

type SoundName = 'confirm' | 'menu' | 'bell' | 'impact' | 'heavy' | 'slam' | 'rope' | 'prop' | 'cheer' | 'boo' | 'nearfall' | 'finisher' | 'victory';

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private crowd: GainNode | null = null;

  unlock(settings: Settings): void {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.effects = this.context.createGain(); this.crowd = this.context.createGain();
      this.effects.connect(this.master); this.crowd.connect(this.master); this.master.connect(this.context.destination);
      const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
      const data = buffer.getChannelData(0); let seed = 29;
      for (let index = 0; index < data.length; index += 1) { seed = Math.imul(seed, 48271) % 2147483647; data[index] = ((seed / 2147483647) * 2 - 1) * (.35 + Math.sin(index / 1800) * .08); }
      const source = this.context.createBufferSource(); const filter = this.context.createBiquadFilter(); const bed = this.context.createGain();
      source.buffer = buffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = 520; bed.gain.value = .055;
      source.connect(filter); filter.connect(bed); bed.connect(this.crowd); source.start();
    }
    void this.context.resume(); this.configure(settings); this.play('confirm', settings);
  }

  configure(settings: Settings): void {
    if (!this.context || !this.master || !this.effects || !this.crowd) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.masterVolume, now, .03);
    this.effects.gain.setTargetAtTime(settings.effectsVolume, now, .03);
    this.crowd.gain.setTargetAtTime(settings.crowdVolume, now, .03);
  }

  play(name: SoundName, settings: Settings): void {
    if (!this.context || !this.effects || !this.crowd) return;
    this.configure(settings);
    const crowdSound = ['cheer', 'boo', 'nearfall', 'victory'].includes(name);
    const output = crowdSound ? this.crowd : this.effects;
    const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
    const now = this.context.currentTime;
    const frequency: Record<SoundName, number> = { menu: 260, confirm: 520, bell: 890, impact: 110, heavy: 72, slam: 58, rope: 180, prop: 130, cheer: 390, boo: 105, nearfall: 460, finisher: 62, victory: 660 };
    const duration = crowdSound ? .48 : name === 'bell' ? .7 : name === 'finisher' ? .9 : .16;
    oscillator.type = name === 'bell' || name === 'victory' ? 'sine' : name === 'cheer' ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency[name], now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency[name] * (name === 'cheer' ? 1.35 : .55)), now + duration);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(crowdSound ? .08 : .18, now + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); gain.connect(output); oscillator.start(now); oscillator.stop(now + duration + .03);
  }

  impact(event: ImpactEvent, settings: Settings): void {
    const map: Record<ImpactEvent['kind'], SoundName> = { light: 'impact', heavy: 'heavy', counter: 'nearfall', grapple: 'slam', weapon: 'prop', finisher: 'finisher', table: 'slam', nearfall: 'nearfall', ko: 'bell', rope: 'rope' };
    this.play(map[event.kind], settings);
  }
}

export const audioEngine = new AudioEngine();
