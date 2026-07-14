export type GraphicsQuality = 'auto' | 'performance' | 'quality';
export type ResolvedGraphicsTier = 'performance' | 'balanced' | 'quality';

export interface RuntimeQualityInput {
  preference: GraphicsQuality;
  width: number;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  deviceMemoryGb?: number;
  reducedMotion: boolean;
  physicsLab: boolean;
}

export interface RuntimeQualityProfile {
  tier: ResolvedGraphicsTier;
  dpr: number | [number, number];
  crowdCount: number;
  antialias: boolean;
  shadows: boolean;
  bakeShadows: boolean;
}

export const resolveRuntimeQuality = (input: RuntimeQualityInput): RuntimeQualityProfile => {
  const mobile = input.width < 900;
  const constrained = input.physicsLab
    || input.hardwareConcurrency <= 4
    || (input.deviceMemoryGb !== undefined && input.deviceMemoryGb <= 4)
    || input.devicePixelRatio >= 2.75 && mobile;
  const tier: ResolvedGraphicsTier = input.physicsLab || input.preference === 'performance'
    ? 'performance'
    : input.preference === 'quality'
      ? 'quality'
      : constrained ? 'performance' : 'balanced';

  if (tier === 'performance') return {
    tier,
    dpr: input.physicsLab ? .5 : [.6, 1],
    crowdCount: input.physicsLab ? 0 : mobile ? 60 : 96,
    antialias: false,
    shadows: false,
    bakeShadows: false,
  };
  if (tier === 'quality') return {
    tier,
    dpr: mobile ? [.8, 1.3] : [.9, 1.65],
    crowdCount: mobile ? 120 : 216,
    antialias: true,
    shadows: true,
    bakeShadows: true,
  };
  return {
    tier,
    dpr: mobile ? [.7, 1.15] : [.75, 1.4],
    crowdCount: mobile ? 90 : 156,
    antialias: true,
    shadows: true,
    bakeShadows: !input.reducedMotion,
  };
};

export const browserRuntimeQuality = (preference: GraphicsQuality, reducedMotion: boolean, physicsLab: boolean): RuntimeQualityProfile => {
  const memoryNavigator = navigator as Navigator & { deviceMemory?: number };
  return resolveRuntimeQuality({
    preference,
    width: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemoryGb: memoryNavigator.deviceMemory,
    reducedMotion,
    physicsLab,
  });
};
