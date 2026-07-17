import type { ImpactEvent, Vec2 } from '../types/game';
import type { Settings } from '../state/settings';

type SoundName = 'confirm' | 'menu' | 'bell' | 'step' | 'jump' | 'land' | 'impact' | 'jab' | 'cross' | 'hook' | 'uppercut' | 'heavy' | 'lowKick' | 'highKick' | 'kick' | 'block' | 'grapple' | 'grip' | 'exertion' | 'slam' | 'suplex' | 'powerbomb' | 'spinebuster' | 'clothesline' | 'spear' | 'rope' | 'prop' | 'chair' | 'trash' | 'table' | 'aerial' | 'kickout' | 'cheer' | 'boo' | 'nearfall' | 'finisher' | 'victory';
interface ListenerPose { position: readonly [number, number, number]; forward: readonly [number, number, number]; up: readonly [number, number, number] }
const MAX_AUDIO_VOICES = 28;

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private crowd: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly activeVoices: OscillatorNode[] = [];

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

  move(moveId: string, settings: Settings, position: Vec2): void {
    const sound: SoundName = moveId === 'jab' ? 'jab' : moveId === 'combo' || moveId === 'high_punch' ? 'cross'
      : moveId === 'heavy' ? 'hook' : moveId === 'uppercut' ? 'uppercut' : moveId === 'headbutt' ? 'heavy'
        : moveId === 'low_kick' ? 'lowKick' : ['front_kick', 'high_kick', 'roundhouse'].includes(moveId) ? 'highKick'
          : moveId === 'slam' || moveId === 'mountain_drop' ? 'slam' : moveId === 'suplex' || moveId === 'skyhook' ? 'suplex'
            : moveId === 'piledriver' ? 'powerbomb' : moveId === 'powerbomb' ? 'powerbomb' : moveId === 'spinebuster' ? 'spinebuster'
              : moveId === 'stiff_arm' || moveId === 'rebound' ? 'clothesline' : moveId === 'spear' ? 'spear'
                : moveId.startsWith('aerial') || moveId === 'aerial' ? 'aerial' : moveId === 'finisher' ? 'finisher'
                  : moveId === 'prop' || moveId === 'prop_throw' ? 'prop' : moveId === 'kick_up' ? 'kickout'
                    : ['takedown', 'whip', 'arm_drag', 'clutch', 'side_toss', 'corner_smash'].includes(moveId) ? 'grapple' : 'impact';
    this.playAt(sound, settings, position);
  }

  playAt(name: SoundName, settings: Settings, position?: Vec2): void {
    if (!this.context || !this.effects || !this.crowd) return;
    this.configure(settings);
    const crowdSound = ['cheer', 'boo', 'nearfall', 'victory'].includes(name);
    const output = crowdSound ? this.crowd : this.effects;
    if (this.activeVoices.length >= MAX_AUDIO_VOICES) {
      const oldest = this.activeVoices.shift();
      try { oldest?.stop(); } catch { /* already completed */ }
    }
    const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
    const now = this.context.currentTime;
    const frequency: Record<SoundName, number> = { menu: 260, confirm: 520, bell: 890, step: 92, jump: 210, land: 68, impact: 110, jab: 176, cross: 142, hook: 96, uppercut: 118, heavy: 72, lowKick: 74, highKick: 104, kick: 86, block: 245, grapple: 132, grip: 155, exertion: 82, slam: 58, suplex: 52, powerbomb: 42, spinebuster: 48, clothesline: 88, spear: 61, rope: 180, prop: 130, chair: 224, trash: 142, table: 46, aerial: 164, kickout: 190, cheer: 390, boo: 105, nearfall: 460, finisher: 62, victory: 660 };
    const duration = crowdSound ? .48 : name === 'bell' ? .7 : name === 'finisher' ? 1.1 : name === 'powerbomb' || name === 'table' ? .42 : name === 'slam' || name === 'suplex' ? .28 : name === 'step' || name === 'jab' ? .09 : .16;
    oscillator.type = name === 'bell' || name === 'victory' ? 'sine' : name === 'cheer' || name === 'chair' ? 'sawtooth' : name === 'grip' || name === 'exertion' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency[name], now);
    const rises = name === 'cheer' || name === 'uppercut' || name === 'aerial' || name === 'jump';
    const falloff = name === 'block' || name === 'chair' ? .82 : name === 'powerbomb' || name === 'slam' || name === 'table' ? .42 : .55;
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency[name] * (rises ? 1.35 : falloff)), now + duration);
    const peak = name === 'step' ? .065 : crowdSound ? .08
      : ['powerbomb', 'table', 'finisher'].includes(name) ? .28
      : ['slam', 'suplex', 'spinebuster', 'spear'].includes(name) ? .23
      : ['hook', 'clothesline', 'highKick', 'uppercut'].includes(name) ? .21
      : .18;
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(peak, now + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); const releaseSpatial = this.connectSpatial(gain, output, position);
    this.activeVoices.push(oscillator);
    oscillator.addEventListener('ended', () => { const index = this.activeVoices.indexOf(oscillator); if (index >= 0) this.activeVoices.splice(index, 1); oscillator.disconnect(); releaseSpatial(); }, { once: true });
    oscillator.start(now); oscillator.stop(now + duration + .03);
  }

  impact(event: ImpactEvent, settings: Settings): void {
    const map: Record<ImpactEvent['kind'], SoundName> = { light: 'impact', heavy: 'heavy', blocked: 'block', counter: 'nearfall', grapple: 'slam', weapon: 'chair', finisher: 'finisher', table: 'table', nearfall: 'nearfall', ko: 'bell', rope: 'rope' };
    const moveImpact: SoundName | null = event.moveId === 'jab' ? 'jab' : event.moveId === 'combo' || event.moveId === 'high_punch' ? 'cross'
      : event.moveId === 'heavy' ? 'hook' : event.moveId === 'uppercut' ? 'uppercut' : event.moveId === 'headbutt' ? 'heavy'
        : event.moveId === 'low_kick' ? 'lowKick' : ['front_kick', 'high_kick', 'roundhouse'].includes(event.moveId ?? '') ? 'highKick'
          : event.moveId === 'suplex' || event.moveId === 'skyhook' ? 'suplex' : event.moveId === 'piledriver' ? 'powerbomb' : event.moveId === 'powerbomb' ? 'powerbomb'
            : event.moveId === 'spinebuster' ? 'spinebuster' : event.moveId === 'stiff_arm' || event.moveId === 'rebound' ? 'clothesline'
              : event.moveId === 'spear' ? 'spear' : event.moveId?.startsWith('aerial') || event.moveId === 'aerial' ? 'aerial'
                : event.moveId === 'slam' || event.moveId === 'mountain_drop' ? 'slam' : null;
    const crowdEvent = ['finisher', 'table', 'nearfall', 'ko'].includes(event.kind);
    const sound = event.kind === 'blocked' ? 'block' : moveImpact ?? map[event.kind];
    if (crowdEvent) this.play(sound, settings); else this.playAt(sound, settings, event.position);
    if (['heavy', 'grapple', 'weapon', 'finisher', 'table', 'ko'].includes(event.kind)) this.impactTransient(event.intensity, event.position);
    if (crowdEvent) this.play('cheer', settings);
  }

  private connectSpatial(node: AudioNode, output: AudioNode, position?: Vec2): () => void {
    if (!this.context || !position) { node.connect(output); return () => node.disconnect(); }
    const panner = this.context.createPanner(); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 2.2; panner.maxDistance = 34; panner.rolloffFactor = 1.15;
    panner.positionX.value = position.x; panner.positionY.value = 2.15; panner.positionZ.value = position.z;
    node.connect(panner); panner.connect(output);
    return () => { node.disconnect(); panner.disconnect(); };
  }

  private impactTransient(intensity: number, position: Vec2): void {
    if (!this.context || !this.effects || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const transientBus = this.context.createGain(); const releaseTransientBus = this.connectSpatial(transientBus, this.effects, position);
    const noise = this.context.createBufferSource(); const noiseFilter = this.context.createBiquadFilter(); const noiseGain = this.context.createGain();
    noise.buffer = this.noiseBuffer; noiseFilter.type = 'bandpass'; noiseFilter.frequency.value = 170 + intensity * 85; noiseFilter.Q.value = .7;
    noiseGain.gain.setValueAtTime(Math.min(.38, .08 + intensity * .088), now); noiseGain.gain.exponentialRampToValueAtTime(.0001, now + .17);
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(transientBus); noise.start(now); noise.stop(now + .15);
    const sub = this.context.createOscillator(); const subGain = this.context.createGain();
    sub.type = 'sine'; sub.frequency.setValueAtTime(78 + intensity * 8, now); sub.frequency.exponentialRampToValueAtTime(34, now + .2);
    subGain.gain.setValueAtTime(Math.min(.3, .1 + intensity * .07), now); subGain.gain.exponentialRampToValueAtTime(.0001, now + .21);
    sub.connect(subGain); subGain.connect(transientBus);
    sub.addEventListener('ended', () => {
      noise.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect(); sub.disconnect(); subGain.disconnect(); releaseTransientBus();
    }, { once: true });
    sub.start(now); sub.stop(now + .23);
  }
}

export const audioEngine = new AudioEngine();
