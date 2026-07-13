import { useEffect, useMemo, useRef, useState } from 'react';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { useMatchStore } from '../state/matchStore';

interface KeyStep { at: number; code: string; down: boolean }
interface LabScenario { id: string; label: string; steps: readonly KeyStep[]; duration: number }

const tap = (code: string, at = 0, duration = 90): readonly KeyStep[] => [{ at, code, down: true }, { at: at + duration, code, down: false }];
const hold = (code: string, at: number, duration: number): readonly KeyStep[] => [{ at, code, down: true }, { at: at + duration, code, down: false }];
const SCENARIOS: readonly LabScenario[] = [
  { id: 'stand', label: 'STANDING STABILITY', steps: [], duration: 3_000 },
  { id: 'walk', label: 'WALK + STOP', steps: hold('KeyW', 0, 1_250), duration: 2_300 },
  { id: 'turn', label: 'RAPID TURN', steps: [...hold('KeyA', 0, 500), ...hold('KeyD', 560, 650)], duration: 1_800 },
  { id: 'ropes', label: 'RUN INTO ROPES', steps: [...hold('KeyD', 0, 2_050), ...hold('ShiftLeft', 0, 2_050)], duration: 2_800 },
  { id: 'jump', label: 'STANDING JUMP', steps: tap('KeyC', 0, 480), duration: 2_000 },
  { id: 'jab', label: 'JAB TO HEAD', steps: tap('KeyJ'), duration: 1_200 },
  { id: 'hook', label: 'TORSO POWER', steps: tap('KeyK'), duration: 1_400 },
  { id: 'guard', label: 'BLOCK WINDOW', steps: hold('KeyI', 0, 1_250), duration: 1_700 },
  { id: 'kick', label: 'PISTON BOOT', steps: [...hold('KeyW', 0, 260), ...tap('KeyK', 70)], duration: 1_500 },
  { id: 'miss', label: 'MISSED KICK', steps: [...hold('KeyS', 0, 650), ...tap('KeyK', 430)], duration: 1_600 },
  { id: 'lock', label: 'GRAPPLE ACQUIRE', steps: tap('KeyL'), duration: 2_200 },
  { id: 'slam', label: 'BODY SLAM', steps: [...tap('KeyL'), ...tap('KeyK', 260)], duration: 3_000 },
  { id: 'suplex', label: 'ARC SUPLEX', steps: [...tap('KeyL'), ...tap('KeyL', 260)], duration: 3_100 },
  { id: 'powerbomb', label: 'DOME POWERBOMB', steps: [...tap('KeyL'), ...hold('KeyW', 180, 240), ...tap('KeyL', 230)], duration: 3_300 },
  { id: 'clothesline', label: 'ROPE STIFF-ARM', steps: [...hold('KeyW', 0, 850), ...hold('ShiftLeft', 0, 850), ...tap('KeyK', 620)], duration: 2_000 },
  { id: 'spear', label: 'BREAKER SPEAR', steps: [...hold('KeyW', 0, 850), ...hold('ShiftLeft', 0, 850), ...tap('KeyL', 620)], duration: 2_100 },
  { id: 'climb', label: 'CLIMB + TAUNT', steps: [...tap('KeyF', 80), ...tap('KeyF', 580), ...tap('KeyF', 1_080), ...tap('KeyQ', 1_580)], duration: 3_400 },
  { id: 'dive', label: 'TOP-ROPE DIVE', steps: [...tap('KeyF', 80), ...tap('KeyF', 580), ...tap('KeyF', 1_080), ...tap('KeyF', 1_580)], duration: 3_800 },
] as const;

const dispatchKey = (code: string, down: boolean): void => {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
};

export function physicsLabEnabled(): boolean { return new URLSearchParams(window.location.search).get('physicsLab') === '1'; }

export function PhysicsLab() {
  const model = useMatchStore((state) => state.model); const revision = useMatchStore((state) => state.revision);
  const [active, setActive] = useState<string | null>(null); const [fps, setFps] = useState(0); const timers = useRef<number[]>([]);
  const frames = useRef(0); const lastFpsAt = useRef(performance.now());
  useEffect(() => {
    let frame = 0; const tick = (): void => { frames.current += 1; frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick);
    const interval = window.setInterval(() => { const now = performance.now(); setFps(Math.round(frames.current * 1_000 / Math.max(1, now - lastFpsAt.current))); frames.current = 0; lastFpsAt.current = now; }, 500);
    return () => { cancelAnimationFrame(frame); window.clearInterval(interval); for (const timer of timers.current) window.clearTimeout(timer); timers.current = []; };
  }, []);
  const run = (scenario: LabScenario): void => {
    for (const timer of timers.current) window.clearTimeout(timer); timers.current = []; setActive(scenario.id);
    const closeRange = ['jab', 'hook', 'guard', 'kick', 'lock', 'slam', 'suplex', 'powerbomb', 'clothesline', 'spear'].includes(scenario.id);
    const corner = scenario.id === 'climb' || scenario.id === 'dive';
    if (corner) useMatchStore.getState().prepareLabScenario({ x: -4.52, z: -3.08 }, { x: -.6, z: -.2 });
    else if (closeRange) useMatchStore.getState().prepareLabScenario({ x: 0, z: -.68 }, { x: 0, z: .68 });
    else if (scenario.id === 'miss') useMatchStore.getState().prepareLabScenario({ x: 0, z: -2.6 }, { x: 0, z: 2.6 });
    for (const step of scenario.steps) timers.current.push(window.setTimeout(() => dispatchKey(step.code, step.down), step.at));
    timers.current.push(window.setTimeout(() => { for (const step of scenario.steps) if (step.down) dispatchKey(step.code, false); setActive(null); }, scenario.duration));
  };
  const player = bodyWorksRuntime.fighterSnapshot('player'); const opponent = bodyWorksRuntime.fighterSnapshot('opponent'); const metrics = bodyWorksRuntime.metrics;
  const diagnostics = useMemo(() => [
    ['FPS', fps], ['STEP', `${metrics.lastStepMs.toFixed(2)} ms`], ['MAX STEP', `${metrics.maximumStepMs.toFixed(2)} ms`],
    ['BODIES', `${metrics.bodyCount} / WORLD ${metrics.worldBodyCount}`], ['JOINTS', `${metrics.jointCount} / WORLD ${metrics.worldJointCount}`], ['GRIPS', `${metrics.gripCount} · MADE ${metrics.gripCreateCount}`],
    ['PLAYER COM', `${model.player.position.x.toFixed(2)}, ${player.pelvisY.toFixed(2)}, ${model.player.position.z.toFixed(2)}`], ['PLAYER SUPPORT', `${player.supportFeet} FEET · UP ${player.upright.toFixed(2)}`], ['PLAYER SPEED', player.speed.toFixed(2)],
    ['OPPONENT COM', `${model.opponent.position.x.toFixed(2)}, ${opponent.pelvisY.toFixed(2)}, ${model.opponent.position.z.toFixed(2)}`], ['BALANCE', `${model.player.body.balance.toFixed(0)} / ${model.opponent.body.balance.toFixed(0)}`],
    ['TASK', `${model.player.state} · ${model.player.moveId ?? 'none'}`], ['PHASE', `${model.player.attackPhase ?? 'none'} · ${model.grapple?.phase ?? 'free'}`], ['WINDOW', model.player.counterWindow > 0 ? 'COUNTER OPEN' : 'closed'],
    ['CONTACTS', metrics.contactCount], ['FORCE / LOAD', `${model.lastImpact?.force?.toFixed(1) ?? '0'} / ${metrics.maximumGripLoad.toFixed(1)}`], ['RESETS', metrics.emergencyResetCount], ['REPLAY', bodyWorksRuntime.replay.size],
  ] as const, [fps, metrics.bodyCount, metrics.contactCount, metrics.emergencyResetCount, metrics.gripCount, metrics.gripCreateCount, metrics.jointCount, metrics.lastStepMs, metrics.maximumGripLoad, metrics.maximumStepMs, metrics.worldBodyCount, metrics.worldJointCount, model, opponent.pelvisY, player.pelvisY, player.speed, player.supportFeet, player.upright, revision]);
  return <aside className="physics-lab" data-testid="physics-lab">
    <header><span>RINGFALL BODYWORKS</span><b>PHYSICS LAB</b><small>REAL INPUT · REAL RAPIER · FIXED 60 HZ</small></header>
    <div className="physics-lab__diagnostics">{diagnostics.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
    <div className="physics-lab__scenarios">{SCENARIOS.map((scenario) => <button key={scenario.id} disabled={active !== null} className={active === scenario.id ? 'active' : ''} onClick={() => run(scenario)}>{active === scenario.id ? 'RUNNING · ' : ''}{scenario.label}</button>)}</div>
    <footer>SUPPORT · COM · MOTORS · CONSTRAINTS · ATTACK WINDOWS LIVE</footer>
  </aside>;
}
