import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { audioEngine } from '../game/audio/audioEngine';
import type { Settings } from '../game/state/settings';

describe('audioEngine', () => {
  beforeEach(() => {
    // Reset singleton state via reflection
    // @ts-expect-error Resetting private property for tests
    audioEngine.context = null;
    // @ts-expect-error Resetting private property for tests
    audioEngine.activeVoices.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('safely handles errors when oldest voice throws on stop', () => {
    const mockAudioContext = {
      createGain: vi.fn().mockReturnValue({
        gain: { setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn()
      }),
      createOscillator: vi.fn().mockImplementation(() => {
        return {
          type: 'sine',
          frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          addEventListener: vi.fn(),
        };
      }),
      createBuffer: vi.fn().mockReturnValue({ getChannelData: vi.fn().mockReturnValue(new Float32Array(100)) }),
      createBufferSource: vi.fn().mockReturnValue({ buffer: null, loop: false, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), addEventListener: vi.fn(), disconnect: vi.fn() }),
      createBiquadFilter: vi.fn().mockReturnValue({ type: '', frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, Q: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }),
      createPanner: vi.fn().mockReturnValue({ panningModel: '', distanceModel: '', refDistance: 0, maxDistance: 0, rolloffFactor: 0, positionX: { value: 0 }, positionY: { value: 0 }, positionZ: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }),
      currentTime: 100,
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
      sampleRate: 44100,
    };

    // @ts-expect-error Mocking global window property for test
    window.AudioContext = function() { return mockAudioContext; };

    const settings = { masterVolume: 1, effectsVolume: 1, crowdVolume: 1 } as Settings;

    // unlock engine
    audioEngine.unlock(settings); // plays 'confirm', which is activeVoice #0

    // Max voices is 28. Let's fill the active voices to trigger eviction
    const MAX_AUDIO_VOICES = 28;
    for (let i = 0; i < MAX_AUDIO_VOICES - 1; i++) {
        audioEngine.play('step', settings);
    }

    // Check if the engine added the oscillators
    // @ts-expect-error Testing private property
    expect(audioEngine.activeVoices.length).toBe(MAX_AUDIO_VOICES);

    // Make the oldest voice (which should be at index 0 now) have a throwing stop method
    // @ts-expect-error Testing private property
    const oldest = audioEngine.activeVoices[0];

    const targetStopMock = vi.fn().mockImplementation(() => {
      throw new Error('Already completed error');
    });
    oldest.stop = targetStopMock;

    // We shouldn't throw when another play is called, causing the oldest to be stopped during shift()
    expect(() => {
        audioEngine.play('step', settings);
    }).not.toThrow();

    // Verify stop was called and the array length is correct
    expect(targetStopMock).toHaveBeenCalled();
    // @ts-expect-error Testing private property
    expect(audioEngine.activeVoices.length).toBe(MAX_AUDIO_VOICES);
  });
});
