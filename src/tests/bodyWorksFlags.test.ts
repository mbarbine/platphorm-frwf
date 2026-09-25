import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('BodyWorksFlags and envFlag parsing', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('evaluates all 11 flags to default fallback (true) when env vars are completely undefined or empty strings', async () => {
    vi.stubEnv('VITE_BODYWORKS_ENABLED', '');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_RIG', '');
    vi.stubEnv('VITE_BODYWORKS_LOCOMOTION', '');
    vi.stubEnv('VITE_BODYWORKS_CONTACT_STRIKES', '');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_BLOCK', '');
    vi.stubEnv('VITE_BODYWORKS_GRAPPLES', '');
    vi.stubEnv('VITE_BODYWORKS_RECOVERY', '');
    vi.stubEnv('VITE_BODYWORKS_ROPES', '');
    vi.stubEnv('VITE_BODYWORKS_PROPS', '');
    vi.stubEnv('VITE_BODYWORKS_CINEMATIC_DIRECTOR', '');
    vi.stubEnv('VITE_BODYWORKS_REPLAYS', '');

    const { BODYWORKS_FLAGS, bodyWorksShippingEnabled } = await import('../game/physics/bodyWorksFlags');

    expect(BODYWORKS_FLAGS.enabled).toBe(true);
    expect(BODYWORKS_FLAGS.physicalRig).toBe(true);
    expect(BODYWORKS_FLAGS.locomotion).toBe(true);
    expect(BODYWORKS_FLAGS.contactStrikes).toBe(true);
    expect(BODYWORKS_FLAGS.physicalBlock).toBe(true);
    expect(BODYWORKS_FLAGS.grapples).toBe(true);
    expect(BODYWORKS_FLAGS.recovery).toBe(true);
    expect(BODYWORKS_FLAGS.ropes).toBe(true);
    expect(BODYWORKS_FLAGS.props).toBe(true);
    expect(BODYWORKS_FLAGS.cinematicDirector).toBe(true);
    expect(BODYWORKS_FLAGS.replays).toBe(true);
    expect(bodyWorksShippingEnabled()).toBe(true);
  });

  it('evaluates all 11 flags to false for explicit falsy values ("0", "false", "off")', async () => {
    vi.stubEnv('VITE_BODYWORKS_ENABLED', '0');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_RIG', 'false');
    vi.stubEnv('VITE_BODYWORKS_LOCOMOTION', 'off');
    vi.stubEnv('VITE_BODYWORKS_CONTACT_STRIKES', 'FALSE');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_BLOCK', 'OFF');
    vi.stubEnv('VITE_BODYWORKS_GRAPPLES', '0');
    vi.stubEnv('VITE_BODYWORKS_RECOVERY', 'False');
    vi.stubEnv('VITE_BODYWORKS_ROPES', 'Off');
    vi.stubEnv('VITE_BODYWORKS_PROPS', 'false');
    vi.stubEnv('VITE_BODYWORKS_CINEMATIC_DIRECTOR', '0');
    vi.stubEnv('VITE_BODYWORKS_REPLAYS', 'off');

    const { BODYWORKS_FLAGS, bodyWorksShippingEnabled } = await import('../game/physics/bodyWorksFlags');

    expect(BODYWORKS_FLAGS.enabled).toBe(false);
    expect(BODYWORKS_FLAGS.physicalRig).toBe(false);
    expect(BODYWORKS_FLAGS.locomotion).toBe(false);
    expect(BODYWORKS_FLAGS.contactStrikes).toBe(false);
    expect(BODYWORKS_FLAGS.physicalBlock).toBe(false);
    expect(BODYWORKS_FLAGS.grapples).toBe(false);
    expect(BODYWORKS_FLAGS.recovery).toBe(false);
    expect(BODYWORKS_FLAGS.ropes).toBe(false);
    expect(BODYWORKS_FLAGS.props).toBe(false);
    expect(BODYWORKS_FLAGS.cinematicDirector).toBe(false);
    expect(BODYWORKS_FLAGS.replays).toBe(false);
    expect(bodyWorksShippingEnabled()).toBe(false);
  });

  it('evaluates flags to true for non-falsy values ("1", "true", "on", "yes", "enabled", etc.)', async () => {
    vi.stubEnv('VITE_BODYWORKS_ENABLED', '1');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_RIG', 'true');
    vi.stubEnv('VITE_BODYWORKS_LOCOMOTION', 'ON');
    vi.stubEnv('VITE_BODYWORKS_CONTACT_STRIKES', 'yes');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_BLOCK', 'TRUE');
    vi.stubEnv('VITE_BODYWORKS_GRAPPLES', 'enabled');
    vi.stubEnv('VITE_BODYWORKS_RECOVERY', '1');
    vi.stubEnv('VITE_BODYWORKS_ROPES', 'On');
    vi.stubEnv('VITE_BODYWORKS_PROPS', 'YES');
    vi.stubEnv('VITE_BODYWORKS_CINEMATIC_DIRECTOR', 'true');
    vi.stubEnv('VITE_BODYWORKS_REPLAYS', '1');

    const { BODYWORKS_FLAGS, bodyWorksShippingEnabled } = await import('../game/physics/bodyWorksFlags');

    expect(BODYWORKS_FLAGS.enabled).toBe(true);
    expect(BODYWORKS_FLAGS.physicalRig).toBe(true);
    expect(BODYWORKS_FLAGS.locomotion).toBe(true);
    expect(BODYWORKS_FLAGS.contactStrikes).toBe(true);
    expect(BODYWORKS_FLAGS.physicalBlock).toBe(true);
    expect(BODYWORKS_FLAGS.grapples).toBe(true);
    expect(BODYWORKS_FLAGS.recovery).toBe(true);
    expect(BODYWORKS_FLAGS.ropes).toBe(true);
    expect(BODYWORKS_FLAGS.props).toBe(true);
    expect(BODYWORKS_FLAGS.cinematicDirector).toBe(true);
    expect(BODYWORKS_FLAGS.replays).toBe(true);
    expect(bodyWorksShippingEnabled()).toBe(true);
  });

  it('is a frozen object containing all required BodyWorks flag properties', async () => {
    const { BODYWORKS_FLAGS } = await import('../game/physics/bodyWorksFlags');

    expect(Object.isFrozen(BODYWORKS_FLAGS)).toBe(true);
    expect(Object.keys(BODYWORKS_FLAGS)).toHaveLength(11);
    expect(BODYWORKS_FLAGS).toHaveProperty('enabled');
    expect(BODYWORKS_FLAGS).toHaveProperty('physicalRig');
    expect(BODYWORKS_FLAGS).toHaveProperty('locomotion');
    expect(BODYWORKS_FLAGS).toHaveProperty('contactStrikes');
    expect(BODYWORKS_FLAGS).toHaveProperty('physicalBlock');
    expect(BODYWORKS_FLAGS).toHaveProperty('grapples');
    expect(BODYWORKS_FLAGS).toHaveProperty('recovery');
    expect(BODYWORKS_FLAGS).toHaveProperty('ropes');
    expect(BODYWORKS_FLAGS).toHaveProperty('props');
    expect(BODYWORKS_FLAGS).toHaveProperty('cinematicDirector');
    expect(BODYWORKS_FLAGS).toHaveProperty('replays');
  });

  it('bodyWorksShippingEnabled returns true only if BOTH enabled and physicalRig are true', async () => {
    // Case 1: enabled = true, physicalRig = false => shipping enabled = false
    vi.stubEnv('VITE_BODYWORKS_ENABLED', 'true');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_RIG', 'false');
    let mod = await import('../game/physics/bodyWorksFlags');
    expect(mod.BODYWORKS_FLAGS.enabled).toBe(true);
    expect(mod.BODYWORKS_FLAGS.physicalRig).toBe(false);
    expect(mod.bodyWorksShippingEnabled()).toBe(false);

    // Case 2: enabled = false, physicalRig = true => shipping enabled = false
    vi.resetModules();
    vi.stubEnv('VITE_BODYWORKS_ENABLED', 'false');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_RIG', 'true');
    mod = await import('../game/physics/bodyWorksFlags');
    expect(mod.BODYWORKS_FLAGS.enabled).toBe(false);
    expect(mod.BODYWORKS_FLAGS.physicalRig).toBe(true);
    expect(mod.bodyWorksShippingEnabled()).toBe(false);

    // Case 3: enabled = false, physicalRig = false => shipping enabled = false
    vi.resetModules();
    vi.stubEnv('VITE_BODYWORKS_ENABLED', '0');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_RIG', '0');
    mod = await import('../game/physics/bodyWorksFlags');
    expect(mod.BODYWORKS_FLAGS.enabled).toBe(false);
    expect(mod.BODYWORKS_FLAGS.physicalRig).toBe(false);
    expect(mod.bodyWorksShippingEnabled()).toBe(false);

    // Case 4: enabled = true, physicalRig = true => shipping enabled = true
    vi.resetModules();
    vi.stubEnv('VITE_BODYWORKS_ENABLED', '1');
    vi.stubEnv('VITE_BODYWORKS_PHYSICAL_RIG', '1');
    mod = await import('../game/physics/bodyWorksFlags');
    expect(mod.BODYWORKS_FLAGS.enabled).toBe(true);
    expect(mod.BODYWORKS_FLAGS.physicalRig).toBe(true);
    expect(mod.bodyWorksShippingEnabled()).toBe(true);
  });
});
