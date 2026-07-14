import { useEffect, useMemo, useRef, useState } from 'react';
import { FIGHTERS } from '../data/fighters';
import { bodyWorksRuntime } from '../physics/physicsRuntime';
import { useMatchStore } from '../state/matchStore';
import { usePhysicsLabStore } from '../state/physicsLabStore';
import type { LabPlaybackRate } from '../state/physicsLabStore';
import type { FighterId, RecoveryOrientation } from '../types/game';
import { RELEASE_IDENTITY } from '../release/releaseIdentity';
import { renderDiagnostics } from '../runtime/renderDiagnostics';

interface KeyStep { at: number; code: string; down: boolean }
interface LabScenario { id: string; label: string; steps: readonly KeyStep[]; duration: number; stressGripAt?: number }

const tap = (code: string, at = 0, duration = 90): readonly KeyStep[] => [{ at, code, down: true }, { at: at + duration, code, down: false }];
const hold = (code: string, at: number, duration: number): readonly KeyStep[] => [{ at, code, down: true }, { at: at + duration, code, down: false }];
const SCENARIOS: readonly LabScenario[] = [
  { id: 'stand', label: 'STANDING STABILITY', steps: [], duration: 3_000 },
  { id: 'walk', label: 'WALK + STOP', steps: hold('KeyW', 0, 2_000), duration: 3_000 },
  { id: 'run', label: 'RUN + MOMENTUM', steps: [...hold('KeyW', 0, 1_800), ...hold('ShiftLeft', 0, 1_800)], duration: 2_600 },
  { id: 'brake', label: 'RUN + BRAKE', steps: [...hold('KeyW', 0, 1_150), ...hold('ShiftLeft', 0, 1_150)], duration: 2_600 },
  { id: 'turn', label: 'RAPID TURN', steps: [...hold('KeyA', 0, 500), ...hold('KeyD', 560, 650)], duration: 1_800 },
  { id: 'ropes', label: 'RUN INTO ROPES', steps: [...hold('KeyD', 0, 2_050), ...hold('ShiftLeft', 0, 2_050)], duration: 2_800 },
  { id: 'ropeStrike', label: 'ROPE LOAD + STIFF-ARM', steps: [...hold('KeyD', 0, 2_200), ...hold('ShiftLeft', 0, 2_200)], duration: 3_400 },
  { id: 'apronReturn', label: 'APRON RETURN', steps: tap('KeyF', 900, 180), duration: 3_400 },
  { id: 'jump', label: 'STANDING JUMP', steps: tap('KeyC', 220, 480), duration: 2_200 },
  { id: 'landing', label: 'JUMP + LANDING', steps: tap('KeyC', 220, 480), duration: 2_600 },
  { id: 'kickup', label: 'KICK-UP RECOVERY', steps: tap('Space', 620, 180), duration: 2_100 },
  { id: 'recoveryBack', label: 'BACK GET-UP', steps: [], duration: 2_100 },
  { id: 'recoveryFront', label: 'FRONT GET-UP', steps: [], duration: 2_100 },
  { id: 'recoverySide', label: 'SIDE GET-UP', steps: [], duration: 2_100 },
  { id: 'jab', label: 'JAB TO HEAD', steps: tap('KeyJ'), duration: 1_200 },
  { id: 'jabWhiff', label: 'JAB WHIFF', steps: tap('KeyJ'), duration: 1_200 },
  { id: 'blockedJab', label: 'JAB INTO GUARD', steps: hold('KeyI', 0, 1_250), duration: 1_700 },
  { id: 'hook', label: 'TORSO POWER', steps: tap('KeyK'), duration: 1_400 },
  { id: 'frontKick', label: 'FRONT KICK', steps: [...hold('KeyS', 0, 620), ...tap('KeyK', 0, 360)], duration: 1_700 },
  { id: 'guard', label: 'BLOCK WINDOW', steps: hold('KeyI', 0, 1_250), duration: 1_700 },
  { id: 'kick', label: 'DIRECTIONAL KICK', steps: [...hold('KeyS', 0, 1_250), ...tap('KeyK', 0, 420)], duration: 1_700 },
  { id: 'miss', label: 'MISSED KICK', steps: [...hold('KeyS', 0, 650), ...tap('KeyK', 430)], duration: 1_600 },
  { id: 'lock', label: 'GRAPPLE ACQUIRE', steps: tap('KeyL'), duration: 2_200 },
  { id: 'slam', label: 'BODY SLAM', steps: [...tap('KeyL'), ...tap('KeyK', 260)], duration: 3_000 },
  { id: 'failedLift', label: 'FATIGUED HEAVY LIFT', steps: [...tap('KeyL'), ...hold('KeyW', 180, 240), ...tap('KeyL', 230)], duration: 3_400, stressGripAt: 1_180 },
  { id: 'gripBreak', label: 'PHYSICAL GRIP BREAK', steps: tap('KeyL'), duration: 3_100, stressGripAt: 1_180 },
  { id: 'suplex', label: 'ARC SUPLEX', steps: [...tap('KeyL'), ...tap('KeyL', 260)], duration: 3_100 },
  { id: 'german', label: 'GERMAN / ARC SUPLEX', steps: [...tap('KeyL'), ...hold('KeyD', 180, 360), ...tap('KeyL', 260)], duration: 3_200 },
  { id: 'powerbomb', label: 'DOME POWERBOMB', steps: [...tap('KeyL'), ...hold('KeyW', 180, 240), ...tap('KeyL', 230)], duration: 3_300 },
  { id: 'cornerSmash', label: 'TURNBUCKLE RAIL SHOT', steps: [...tap('KeyL', 80), ...tap('KeyF', 420)], duration: 3_300 },
  { id: 'clothesline', label: 'ROPE STIFF-ARM', steps: [...hold('KeyW', 0, 850), ...hold('ShiftLeft', 0, 850), ...tap('KeyK', 620)], duration: 2_000 },
  { id: 'spear', label: 'BREAKER SPEAR', steps: [...hold('KeyW', 0, 850), ...hold('ShiftLeft', 0, 850), ...tap('KeyL', 620)], duration: 2_100 },
  { id: 'climb', label: 'CLIMB + TAUNT', steps: [...tap('KeyF', 80), ...tap('KeyF', 580), ...tap('KeyF', 1_080), ...tap('KeyQ', 1_580)], duration: 3_400 },
  { id: 'dive', label: 'TOP-ROPE DIVE', steps: [...tap('KeyF', 80), ...tap('KeyF', 580), ...tap('KeyF', 1_080), ...tap('KeyF', 1_580)], duration: 3_800 },
  { id: 'tableCollapse', label: 'TABLE COLLAPSE', steps: [...tap('KeyL', 600), ...tap('KeyK', 900)], duration: 4_200 },
  { id: 'soakRound', label: 'LAB KNOCKOUT', steps: tap('KeyK', 450, 180), duration: 3_000 },
  { id: 'reset', label: 'COMPLETE RUNTIME RESET', steps: [], duration: 1_200 },
] as const;

const dispatchKey = (code: string, down: boolean): void => { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true })); };
export function PhysicsLab() {
  const model = useMatchStore((state) => state.model); const revision = useMatchStore((state) => state.revision);
  const rate = usePhysicsLabStore((state) => state.rate); const debug = usePhysicsLabStore((state) => state.debug);
  const [active, setActive] = useState<string | null>(null); const [fps, setFps] = useState(0); const timers = useRef<number[]>([]); const lastScenario = useRef<LabScenario | null>(null);
  const [playerId, setPlayerId] = useState<FighterId>(model.player.definitionId); const [opponentId, setOpponentId] = useState<FighterId>(model.opponent.definitionId);
  const [seed, setSeed] = useState(model.seed); const [playerStamina, setPlayerStamina] = useState(100); const [opponentStamina, setOpponentStamina] = useState(100);
  const [playerMass, setPlayerMass] = useState(0); const [opponentMass, setOpponentMass] = useState(0);
  const frames = useRef(0); const lastFpsAt = useRef(performance.now());
  const clearTimers = (): void => { for (const timer of timers.current) { window.clearTimeout(timer); window.clearInterval(timer); } timers.current = []; };
  useEffect(() => {
    let frame = 0; const tick = (): void => { frames.current += 1; frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick);
    const interval = window.setInterval(() => { const now = performance.now(); setFps(Math.round(frames.current * 1_000 / Math.max(1, now - lastFpsAt.current))); frames.current = 0; lastFpsAt.current = now; }, 500);
    return () => { cancelAnimationFrame(frame); window.clearInterval(interval); clearTimers(); useMatchStore.getState().pause(false); };
  }, []);

  const run = (scenario: LabScenario): void => {
    clearTimers(); useMatchStore.getState().pause(false); setActive(scenario.id); lastScenario.current = scenario;
    if (scenario.id === 'reset') {
      useMatchStore.getState().configureLab(playerId, opponentId, seed, playerStamina, opponentStamina, playerMass, opponentMass);
      timers.current.push(window.setTimeout(() => setActive(null), scenario.duration));
      return;
    }
    const closeRange = ['jab', 'blockedJab', 'hook', 'frontKick', 'guard', 'kick', 'lock', 'slam', 'failedLift', 'gripBreak', 'suplex', 'german', 'powerbomb', 'clothesline', 'spear', 'soakRound'].includes(scenario.id);
    const recoveryOrientation: RecoveryOrientation | null = scenario.id === 'recoveryFront' ? 'front' : scenario.id === 'recoverySide' ? 'left' : scenario.id === 'recoveryBack' ? 'back' : null;
    if (scenario.id === 'climb' || scenario.id === 'dive') useMatchStore.getState().prepareLabScenario({ x: -4.52, z: -3.08 }, { x: -1.6, z: -.8 });
    else if (scenario.id === 'cornerSmash') useMatchStore.getState().prepareLabScenario({ x: 3.72, z: 2.45 }, { x: 4.45, z: 3.02 });
    else if (scenario.id === 'apronReturn') useMatchStore.getState().prepareLabScenario({ x: 6.52, z: 0 }, { x: 0, z: 2.4 });
    else if (scenario.id === 'tableCollapse') useMatchStore.getState().prepareLabScenario({ x: 0, z: -5.15 }, { x: 0, z: -6.15 });
    else if (recoveryOrientation) useMatchStore.getState().prepareLabScenario({ x: 0, z: -.7 }, { x: 0, z: 3.4 }, 'downed', 100, recoveryOrientation, .38);
    else if (scenario.id === 'kickup') useMatchStore.getState().prepareLabScenario({ x: 0, z: -.7 }, { x: 0, z: 3.4 }, 'downed');
    else if (scenario.id === 'ropeStrike') useMatchStore.getState().prepareLabScenario({ x: 4.92, z: .08 }, { x: 3.82, z: -.04 });
    else if (closeRange) useMatchStore.getState().prepareLabScenario({ x: 0, z: -.68 }, { x: 0, z: .68 }, 'idle', scenario.id === 'soakRound' ? 1 : 100, 'back', 5, scenario.id === 'failedLift' ? 34 : undefined);
    else if (scenario.id === 'miss' || scenario.id === 'jabWhiff') useMatchStore.getState().prepareLabScenario({ x: 0, z: -2.6 }, { x: 0, z: 2.6 });
    else useMatchStore.getState().prepareLabScenario({ x: -1.4, z: 0 }, { x: 2.2, z: 0 });
    document.documentElement.dataset.labResetPelvisY = bodyWorksRuntime.fighterSnapshot('player').pelvisY.toFixed(3);
    for (const step of scenario.steps) timers.current.push(window.setTimeout(() => dispatchKey(step.code, step.down), step.at));
    if (scenario.id === 'blockedJab') timers.current.push(window.setTimeout(() => useMatchStore.getState().requestLabCommand('opponent', 'quick'), 220));
    if (scenario.stressGripAt !== undefined) {
      timers.current.push(window.setTimeout(() => {
        const stress = window.setInterval(() => { if (bodyWorksRuntime.stressTestGrip('player')) window.clearInterval(stress); }, 40);
        timers.current.push(stress);
      }, scenario.stressGripAt));
    }
    let reboundWatcher: number | null = null;
    if (scenario.id === 'ropeStrike') {
      reboundWatcher = window.setInterval(() => {
        const player = useMatchStore.getState().model.player; if (player.ropeRebound <= 0) return;
        const opponent = useMatchStore.getState().model.opponent;
        if (Math.hypot(player.position.x - opponent.position.x, player.position.z - opponent.position.z) > 1.45) return;
        if (reboundWatcher !== null) window.clearInterval(reboundWatcher); reboundWatcher = null;
        dispatchKey('KeyK', true); timers.current.push(window.setTimeout(() => dispatchKey('KeyK', false), 180));
      }, 8); timers.current.push(reboundWatcher);
    }
    timers.current.push(window.setTimeout(() => {
      if (reboundWatcher !== null) window.clearInterval(reboundWatcher);
      for (const step of scenario.steps) if (step.down) dispatchKey(step.code, false);
      setActive(null);
    }, scenario.duration));
  };

  const applyPair = (): void => { clearTimers(); setActive(null); useMatchStore.getState().configureLab(playerId, opponentId, seed, playerStamina, opponentStamina, playerMass, opponentMass); };
  const stepOnce = (): void => {
    useMatchStore.getState().pause(false);
    requestAnimationFrame(() => requestAnimationFrame(() => useMatchStore.getState().pause(true)));
  };
  const player = bodyWorksRuntime.fighterSnapshot('player'); const opponent = bodyWorksRuntime.fighterSnapshot('opponent'); const metrics = bodyWorksRuntime.metrics; const alignment = bodyWorksRuntime.presentationAlignmentSnapshot();
  const diagnostics = useMemo(() => [
    ['FPS', fps], ['STEP AVG / P95', `${metrics.averageStepMs.toFixed(2)} / ${metrics.p95StepMs.toFixed(2)} ms`], ['MAX STEP', `${metrics.maximumStepMs.toFixed(2)} ms`],
    ['BODIES', `${metrics.bodyCount} / WORLD ${metrics.worldBodyCount}`], ['JOINTS', `${metrics.jointCount} / WORLD ${metrics.worldJointCount}`], ['GRIPS', `${metrics.gripCount} · MADE ${metrics.gripCreateCount}`],
    ['PLAYER COM', `${model.player.position.x.toFixed(2)}, ${player.pelvisY.toFixed(2)}, ${model.player.position.z.toFixed(2)}`], ['PLAYER SUPPORT', `${player.supportFeet} FEET · UP ${player.upright.toFixed(2)}`], ['PLAYER SPEED', player.speed.toFixed(2)],
    ['OPPONENT COM', `${model.opponent.position.x.toFixed(2)}, ${opponent.pelvisY.toFixed(2)}, ${model.opponent.position.z.toFixed(2)}`], ['BALANCE', `${model.player.body.balance.toFixed(0)} / ${model.opponent.body.balance.toFixed(0)}`],
    ['TASK', `${model.player.state} · ${model.player.moveId ?? 'none'} · ${metrics.taskCount}`], ['PHASE', `${model.player.attackPhase ?? 'none'} · ${model.grapple?.phase ?? 'free'}`], ['TASK TIMEOUTS', metrics.taskTimeoutCount], ['WINDOW', model.player.counterWindow > 0 ? 'COUNTER OPEN' : 'closed'],
    ['CONTACTS', metrics.contactCount], ['FORCE / LOAD', `${model.lastImpact?.force?.toFixed(1) ?? '0'} / ${metrics.maximumGripLoad.toFixed(1)}`], ['JOINT NOW / MAX', `${metrics.currentJointSeparation.toFixed(3)} / ${metrics.maximumJointSeparation.toFixed(3)} M`], ['MOTOR LIMIT', `${metrics.currentMotorSaturations} NOW · ${metrics.motorSaturationCount} TOTAL`], ['SUPPORT / FAULT', `${metrics.supportScore.toFixed(2)} / ${metrics.lastNumericalFault}`], ['ALIGN AVG / MAX', `${alignment.averageError.toFixed(2)} / ${alignment.maximumError.toFixed(2)} M · ${alignment.maximumSegment ?? 'physical'}`], ['DRAWS / TRIS', `${renderDiagnostics.drawCalls} / ${Math.round(renderDiagnostics.triangles / 1_000)}K`], ['GEO / TEX / SHADER', `${renderDiagnostics.geometries} / ${renderDiagnostics.textures} / ${renderDiagnostics.shaderPrograms}`], ['FRAME P95 / P99', `${renderDiagnostics.frameP95Ms.toFixed(1)} / ${renderDiagnostics.frameP99Ms.toFixed(1)} ms`], ['RESETS / BOUNDS', `${metrics.emergencyResetCount} / ${metrics.containmentCount}`], ['REPLAY', `${bodyWorksRuntime.replay.size} · ${(metrics.replayEstimatedBytes / 1024).toFixed(0)} KB`],
  ] as const, [alignment.averageError, alignment.maximumError, alignment.maximumSegment, fps, metrics.averageStepMs, metrics.bodyCount, metrics.contactCount, metrics.containmentCount, metrics.currentJointSeparation, metrics.currentMotorSaturations, metrics.emergencyResetCount, metrics.gripCount, metrics.gripCreateCount, metrics.jointCount, metrics.lastNumericalFault, metrics.maximumGripLoad, metrics.maximumJointSeparation, metrics.maximumStepMs, metrics.motorSaturationCount, metrics.p95StepMs, metrics.replayEstimatedBytes, metrics.supportScore, metrics.taskCount, metrics.taskTimeoutCount, metrics.worldBodyCount, metrics.worldJointCount, model, opponent.pelvisY, player.pelvisY, player.speed, player.supportFeet, player.upright, revision]);
  return <aside className="physics-lab" data-testid="physics-lab" data-lab-scenario={active ?? 'idle'} data-lab-fps={fps} data-lab-step-ms={metrics.lastStepMs.toFixed(3)} data-lab-avg-step-ms={metrics.averageStepMs.toFixed(3)} data-lab-p95-step-ms={metrics.p95StepMs.toFixed(3)} data-lab-max-step-ms={metrics.maximumStepMs.toFixed(3)} data-lab-replay-kb={(metrics.replayEstimatedBytes / 1024).toFixed(1)} data-lab-current-joint-separation={metrics.currentJointSeparation.toFixed(3)} data-lab-joint-separation={metrics.maximumJointSeparation.toFixed(3)} data-lab-numerical-faults={metrics.numericalFaultCount} data-lab-support-score={metrics.supportScore.toFixed(3)} data-lab-rate={rate} data-lab-debug={debug ? 'true' : 'false'}>
    <header><span>RINGFALL BODYWORKS</span><b>PHYSICS LAB</b><small>REAL INPUT · REAL RAPIER · FIXED 60 HZ AUTHORITY</small><small data-testid="release-diagnostic">v{RELEASE_IDENTITY.applicationVersion} · {RELEASE_IDENTITY.shortGitSha} · F{RELEASE_IDENTITY.fighterCount} M{RELEASE_IDENTITY.moveCount} · {RELEASE_IDENTITY.deploymentEnvironment}</small></header>
    <div className="physics-lab__toolbar"><button onClick={() => useMatchStore.getState().pause(!model.paused)}>{model.paused ? 'PLAY' : 'PAUSE'}</button><button onClick={stepOnce}>STEP</button>{([.25, .5, 1] as LabPlaybackRate[]).map((value) => <button className={rate === value ? 'active' : ''} key={value} onClick={() => usePhysicsLabStore.getState().setRate(value)}>{value}×</button>)}<button className={debug ? 'active' : ''} onClick={() => usePhysicsLabStore.getState().setDebug(!debug)}>DEBUG RIG</button><button disabled={!lastScenario.current || active !== null} onClick={() => lastScenario.current && run(lastScenario.current)}>REPEAT</button><button disabled={!lastScenario.current} onClick={() => lastScenario.current && run(lastScenario.current)}>RESET</button></div>
    <details className="physics-lab__setup"><summary>PAIR / SEED / STAMINA / MASS</summary><div><label>PLAYER<select value={playerId} onChange={(event) => setPlayerId(event.target.value as FighterId)}>{FIGHTERS.map((fighter) => <option key={fighter.id} value={fighter.id}>{fighter.name}</option>)}</select></label><label>OPPONENT<select value={opponentId} onChange={(event) => setOpponentId(event.target.value as FighterId)}>{FIGHTERS.map((fighter) => <option key={fighter.id} value={fighter.id}>{fighter.name}</option>)}</select></label><label>SEED<input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 1)} /></label><label>P1 GAS {playerStamina}%<input type="range" min="10" max="100" step="5" value={playerStamina} onChange={(event) => setPlayerStamina(Number(event.target.value))} /></label><label>CPU GAS {opponentStamina}%<input type="range" min="10" max="100" step="5" value={opponentStamina} onChange={(event) => setOpponentStamina(Number(event.target.value))} /></label><label>P1 MASS +{playerMass} KG<input type="range" min="0" max="80" step="5" value={playerMass} onChange={(event) => setPlayerMass(Number(event.target.value))} /></label><label>CPU MASS +{opponentMass} KG<input type="range" min="0" max="80" step="5" value={opponentMass} onChange={(event) => setOpponentMass(Number(event.target.value))} /></label><button onClick={applyPair}>LOAD PAIR</button></div></details>
    <div className="physics-lab__diagnostics">{diagnostics.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
    <div className="physics-lab__scenarios">{SCENARIOS.map((scenario) => <button key={scenario.id} disabled={active !== null} className={active === scenario.id ? 'active' : ''} onClick={() => run(scenario)}>{active === scenario.id ? 'RUNNING · ' : ''}{scenario.label}</button>)}</div>
    <footer>SUPPORT · COM · MOTORS · CONSTRAINTS · ATTACK WINDOWS LIVE</footer>
  </aside>;
}
