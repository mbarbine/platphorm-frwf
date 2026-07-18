import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Settings Store', () => {
  let originalWindow: typeof window | undefined;

  beforeEach(() => {
    vi.resetModules();
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      globalThis.window = originalWindow;
    }
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  const setupTest = async (mockLocalStorageValue: string | null) => {
    globalThis.window = { matchMedia: vi.fn().mockReturnValue({ matches: false }) } as unknown as Window & typeof globalThis;

    globalThis.localStorage = {
      getItem: vi.fn().mockReturnValue(mockLocalStorageValue),
      setItem: vi.fn(),
      clear: vi.fn(),
      removeItem: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    const { useSettings } = await import('../game/state/settings');
    return { useSettings, state: useSettings.getState() };
  };

  it('handles JSON parsing errors by returning DEFAULTS', async () => {
    const { state } = await setupTest('{ invalid json }');
    expect(state.masterVolume).toBe(0.72);
    expect(state.graphicsQuality).toBe('auto');
  });

  it('returns DEFAULTS when window is undefined', async () => {
    Reflect.deleteProperty(globalThis, 'window');
    const { useSettings } = await import('../game/state/settings');
    const state = useSettings.getState();
    expect(state.masterVolume).toBe(0.72);
  });

  it('returns DEFAULTS when parsed data is null', async () => {
    const { state } = await setupTest('null');
    expect(state.masterVolume).toBe(0.72);
  });

  it('returns DEFAULTS when parsed data is not an object', async () => {
    const { state } = await setupTest('"string_value"');
    expect(state.masterVolume).toBe(0.72);
  });

  it('merges valid loaded settings with DEFAULTS for missing properties', async () => {
    const { state } = await setupTest(JSON.stringify({
      masterVolume: 0.5,
      graphicsQuality: 'performance',
      cameraCuts: 'off'
    }));
    expect(state.masterVolume).toBe(0.5);
    expect(state.graphicsQuality).toBe('performance');
    expect(state.cameraCuts).toBe('off');
    expect(state.effectsVolume).toBe(0.86);
  });

  it('clamps numerical values', async () => {
    const { state } = await setupTest(JSON.stringify({
      masterVolume: 1.5,
      uiScale: 0.1
    }));
    expect(state.masterVolume).toBe(1);
    expect(state.uiScale).toBe(0.85);
  });

  it('updates settings and persists them', async () => {
    const { useSettings, state } = await setupTest('{}');
    expect(state.masterVolume).toBe(0.72);

    useSettings.getState().update({ masterVolume: 0.2 });
    expect(useSettings.getState().masterVolume).toBe(0.2);
    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
      'ringfall-settings-v2',
      expect.stringContaining('"masterVolume":0.2')
    );
  });

  it('resets settings to DEFAULTS and persists them', async () => {
    const { useSettings } = await setupTest(JSON.stringify({ masterVolume: 0.1 }));
    expect(useSettings.getState().masterVolume).toBe(0.1);

    useSettings.getState().reset();
    expect(useSettings.getState().masterVolume).toBe(0.72);
    expect(globalThis.localStorage.setItem).toHaveBeenCalledWith(
      'ringfall-settings-v2',
      expect.stringContaining('"masterVolume":0.72')
    );
  });
});
