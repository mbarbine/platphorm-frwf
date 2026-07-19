export interface BodyWorksFlags {
  enabled: boolean;
  physicalRig: boolean;
  locomotion: boolean;
  contactStrikes: boolean;
  physicalBlock: boolean;
  grapples: boolean;
  recovery: boolean;
  ropes: boolean;
  props: boolean;
  cinematicDirector: boolean;
  replays: boolean;
}

const envFlag = (name: string, fallback: boolean): boolean => {
  const value = import.meta.env[name];
  if (value === undefined || value === '') return fallback;
  return value !== '0' && value.toLowerCase() !== 'false' && value.toLowerCase() !== 'off';
};

/**
 * BodyWorks is the shipping engine. VITE_BODYWORKS_ENABLED is the single
 * release-scoped rollback control; the subsystem switches exist for local
 * diagnosis and Physics Lab isolation only.
 */
export const BODYWORKS_FLAGS: Readonly<BodyWorksFlags> = Object.freeze({
  enabled: envFlag('VITE_BODYWORKS_ENABLED', true),
  physicalRig: envFlag('VITE_BODYWORKS_PHYSICAL_RIG', true),
  locomotion: envFlag('VITE_BODYWORKS_LOCOMOTION', true),
  contactStrikes: envFlag('VITE_BODYWORKS_CONTACT_STRIKES', true),
  physicalBlock: envFlag('VITE_BODYWORKS_PHYSICAL_BLOCK', true),
  grapples: envFlag('VITE_BODYWORKS_GRAPPLES', true),
  recovery: envFlag('VITE_BODYWORKS_RECOVERY', true),
  ropes: envFlag('VITE_BODYWORKS_ROPES', true),
  props: envFlag('VITE_BODYWORKS_PROPS', true),
  cinematicDirector: envFlag('VITE_BODYWORKS_CINEMATIC_DIRECTOR', true),
  replays: envFlag('VITE_BODYWORKS_REPLAYS', true),
});

export const bodyWorksShippingEnabled = (): boolean => BODYWORKS_FLAGS.enabled && BODYWORKS_FLAGS.physicalRig;
