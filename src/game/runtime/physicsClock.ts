export const FIXED_STEP = 1 / 60;
export const MAX_FRAME_STEPS = 6;

/** Avoid consuming a complete action between two rendered frames after a stall. */
export function physicsFrameBudget(remainder: number, delta: number, rate = 1) {
  const elapsed = Number.isFinite(delta) ? Math.max(0,delta) : 0;
  const speed = Number.isFinite(rate) ? Math.max(0,Math.min(1,rate)) : 1;
  const accumulated = Math.max(0,Math.min(FIXED_STEP,remainder)) + Math.min(elapsed,FIXED_STEP*MAX_FRAME_STEPS)*speed;
  const steps = Math.min(MAX_FRAME_STEPS,Math.floor((accumulated+1e-10)/FIXED_STEP));
  return {steps,remainder:Math.max(0,accumulated-steps*FIXED_STEP)};
}
