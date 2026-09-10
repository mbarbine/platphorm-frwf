import { describe, it, expect, vi, afterEach } from 'vitest';
import { CrowdReaction } from '../game/audio/CrowdReaction';

afterEach(() => vi.unstubAllGlobals());
const fixture = () => {
  const voices: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended?: () => void }[] = [];
  const context = { state: 'running', currentTime: 1, decodeAudioData: vi.fn(async () => ({})), createBufferSource: () => {
    const voice = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: undefined };
    voices.push(voice); return voice;
  } };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(42_771) })));
  return { context, voices, reaction: new CrowdReaction(context as unknown as AudioContext, {} as AudioNode) };
};
describe('real crowd reactions', () => {
  it('loads once, prevents overlapping reactions, and spaces them seven seconds apart', async () => {
    const { reaction, context, voices } = fixture();
    expect(reaction.play()).toBe(false);
    await Promise.all([reaction.load(), reaction.load()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(reaction.play()).toBe(true);
    context.currentTime = 10;
    expect(reaction.play()).toBe(false);
    voices[0]?.onended?.();
    expect(reaction.play()).toBe(true);
    voices[1]?.onended?.();
    context.currentTime = 11;
    expect(reaction.play()).toBe(false);
    context.currentTime = 17;
    expect(reaction.play()).toBe(true);
    reaction.stop();
    expect(voices[2]?.stop).toHaveBeenCalledOnce();
  });
  it('does not break gameplay when fetching or decoding fails', async () => {
    const { reaction } = fixture();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(reaction.load()).resolves.toBeUndefined();
    expect(reaction.play()).toBe(false);
  });
});
