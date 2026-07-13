import type { ImpactEvent, Vec2 } from '../types/game';
import type { Settings } from '../state/settings';

type SoundName = 'confirm' | 'menu' | 'bell' | 'step' | 'jump' | 'land' | 'impact' | 'heavy' | 'kick' | 'block' | 'grapple' | 'slam' | 'rope' | 'prop' | 'cheer' | 'boo' | 'nearfall' | 'finisher' | 'victory';
interface ListenerPose { position: readonly [number, number, number]; forward: readonly [number, number, number]; up: readonly [number, number, number] }

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private crowd: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

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
      this.noiseBuffer = buffer;
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

  setListener(pose: ListenerPose): void {
    if (!this.context) return;
    const listener = this.context.listener; const now = this.context.currentTime;
    listener.positionX.setTargetAtTime(pose.position[0], now, .02); listener.positionY.setTargetAtTime(pose.position[1], now, .02); listener.positionZ.setTargetAtTime(pose.position[2], now, .02);
    listener.forwardX.setTargetAtTime(pose.forward[0], now, .02); listener.forwardY.setTargetAtTime(pose.forward[1], now, .02); listener.forwardZ.setTargetAtTime(pose.forward[2], now, .02);
    listener.upX.setTargetAtTime(pose.up[0], now, .02); listener.upY.setTargetAtTime(pose.up[1], now, .02); listener.upZ.setTargetAtTime(pose.up[2], now, .02);
  }

  play(name: SoundName, settings: Settings): void { this.playAt(name, settings); }

  playAt(name: SoundName, settings: Settings, position?: Vec2): void {
    if (!this.context || !this.effects || !this.crowd) return;
    this.configure(settings);
    const crowdSound = ['cheer', 'boo', 'nearfall', 'victory'].includes(name);
    const output = crowdSound ? this.crowd : this.effects;
    const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
    const now = this.context.currentTime;
    const frequency: Record<SoundName, number> = { menu: 260, confirm: 520, bell: 890, step: 92, jump: 210, land: 68, impact: 110, heavy: 72, kick: 86, block: 245, grapple: 132, slam: 58, rope: 180, prop: 130, cheer: 390, boo: 105, nearfall: 460, finisher: 62, victory: 660 };
    const duration = crowdSound ? .48 : name === 'bell' ? .7 : name === 'finisher' ? .9 : name === 'step' ? .09 : .16;
    oscillator.type = name === 'bell' || name === 'victory' ? 'sine' : name === 'cheer' ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency[name], now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency[name] * (name === 'cheer' ? 1.35 : .55)), now + duration);
    const peak = name === 'step' ? .065 : crowdSound ? .08 : .18;
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(peak, now + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); this.connectSpatial(gain, output, position); oscillator.start(now); oscillator.stop(now + duration + .03);
  }

  impact(event: ImpactEvent, settings: Settings): void {
    const map: Record<ImpactEvent['kind'], SoundName> = { light: 'impact', heavy: 'heavy', blocked: 'block', counter: 'nearfall', grapple: 'slam', weapon: 'prop', finisher: 'finisher', table: 'slam', nearfall: 'nearfall', ko: 'bell', rope: 'rope' };
    const crowdEvent = ['finisher', 'table', 'nearfall', 'ko'].includes(event.kind);
    if (crowdEvent) this.play(map[event.kind], settings); else this.playAt(map[event.kind], settings, event.position);
    if (['heavy', 'grapple', 'weapon', 'finisher', 'table', 'ko'].includes(event.kind)) this.impactTransient(event.intensity, event.position);
    if (crowdEvent) this.play('cheer', settings);
  }

  private connectSpatial(node: AudioNode, output: AudioNode, position?: Vec2): void {
    if (!this.context || !position) { node.connect(output); return; }
    const panner = this.context.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2.2; panner.maxDistance = 34; panner.rolloffFactor = 1.15;
    panner.positionX.value = position.x; panner.positionY.value = 2.15; panner.positionZ.value = position.z;
    node.connect(panner); panner.connect(output);
  }

  private impactTransient(intensity: number, position: Vec2): void {
    if (!this.context || !this.effects || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const transientBus = this.context.createGain(); this.connectSpatial(transientBus, this.effects, position);
    const noise = this.context.createBufferSource(); const noiseFilter = this.context.createBiquadFilter(); const noiseGain = this.context.createGain();
    noise.buffer = this.noiseBuffer; noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 170 + intensity * 85; noiseFilter.Q.value = .7;
    noiseGain.gain.setValueAtTime(Math.min(.24, .08 + intensity * .055), now); noiseGain.gain.exponentialRampToValueAtTime(.0001, now + .13);
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(transientBus); noise.start(now); noise.stop(now + .15);
    const sub = this.context.createOscillator(); const subGain = this.context.createGain();
    sub.type = 'sine'; sub.frequency.setValueAtTime(78 + intensity * 8, now); sub.frequency.exponentialRampToValueAtTime(34, now + .2);
    subGain.gain.setValueAtTime(Math.min(.3, .1 + intensity * .07), now); subGain.gain.exponentialRampToValueAtTime(.0001, now + .21);
    sub.connect(subGain); subGain.connect(transientBus); sub.start(now); sub.stop(now + .23);
  }
}

export const audioEngine = new AudioEngine();
