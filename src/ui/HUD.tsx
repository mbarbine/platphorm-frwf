import { useEffect, useRef, useState } from 'react';
import { fighterById } from '../game/data/fighters';
import { getMove } from '../game/data/moves';
import { bodyWorksRuntime } from '../game/physics/physicsRuntime';
import { useMatchStore } from '../game/state/matchStore';
import type { ControlDevice } from '../game/types/game';
import { mobileInput } from '../game/input/mobileInput';
import { buildControlReadout, controlPrompt, ControlDeck } from './ControlDeck';
import { announcementTier } from './announcementTier';
import { isRingside } from '../game/physics/ringDynamics';
import { FIGHTER_SLOTS } from '../game/types/game';
import { useSettings } from '../game/state/settings';
import { combatDirection } from '../game/systems/combat';
import type { GameAction } from '../game/input/actionLayer';
import { resolveContextAction, resolvePropAction } from '../game/systems/contextResolver';

const ACTION_LABELS: Readonly<Record<GameAction, string>> = {
  move: 'MOVE', run: 'RUN', quickStrike: 'PUNCH', heavyStrike: 'KICK', grapple: 'GRAPPLE', guard: 'GUARD', dodgeCounter: 'DODGE / COUNTER', jump: 'JUMP', propAction: 'PROP ACTION', contextAction: 'CONTEXT ACTION', taunt: 'TAUNT', pause: 'PAUSE',
};

const Meter = ({ label, value, kind, max = 100 }: { label: string; value: number; kind: string; max?: number }) => {
  const [ghost, setGhost] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    // Only health needs the delayed damage trail. Balance, stamina, and
    // momentum change nearly every physics publish; reflecting those values
    // through effect-driven local state can create a render feedback loop on
    // slow GPUs while adding no useful visual information.
    if (kind !== 'health') { prev.current = value; return; }
    const dropped = value < prev.current;
    prev.current = value;
    if (!dropped) { setGhost(value); return; }
    const timer = window.setTimeout(() => setGhost(value), 580);
    return () => window.clearTimeout(timer);
  }, [kind, value]);
  const pct = Math.max(0, Math.min(100, value / max * 100));
  const ghostPct = kind === 'health' ? Math.max(0, Math.min(100, ghost / max * 100)) : pct;
  return <div className={`meter meter--${kind}`}><div className="meter__label"><span>{label}</span><b>{Math.round(value)}{max !== 100 ? ` / ${Math.round(max)}` : ''}</b></div><div className="meter__track"><b className="meter__ghost" style={{ width: `${ghostPct}%` }} /><i style={{ width: `${pct}%` }} /></div></div>;
};

const GRAPPLE_GUIDE = [
  { id: 'up', direction: '↑', moves: ['arm_drag', 'skyhook', 'powerbomb'] },
  { id: 'left', direction: '←', moves: ['clutch', 'spinebuster', 'whip'] },
  { id: 'neutral', direction: '●', moves: ['takedown', 'slam', 'piledriver'] },
  { id: 'right', direction: '→', moves: ['side_toss', 'slam', 'suplex'] },
  { id: 'down', direction: '↓', moves: ['takedown', 'spinebuster', 'mountain_drop'] },
] as const;

export function HUD({ device, paused }: { device: ControlDevice; paused: boolean }) {
  const model = useMatchStore((state) => state.model); const targetSlot = model.targets.player; const target = model[targetSlot]; const player = fighterById(model.player.definitionId); const opponent = fighterById(target.definitionId);
  const physics = bodyWorksRuntime.metrics;
  const playerPhysics = bodyWorksRuntime.fighterSnapshot('player'); const opponentPhysics = bodyWorksRuntime.fighterSnapshot(targetSlot);
  const playerIntent = bodyWorksRuntime.intentSnapshot('player');
  const playerLeftHand = bodyWorksRuntime.segmentSnapshot('player', 'leftHand')?.position; const playerRightHand = bodyWorksRuntime.segmentSnapshot('player', 'rightHand')?.position;
  const playerRightForearm = bodyWorksRuntime.segmentSnapshot('player', 'rightForearm')?.position; const opponentChest = bodyWorksRuntime.segmentSnapshot(targetSlot, 'chest')?.position;
  const opponentLeftHand = bodyWorksRuntime.segmentSnapshot(targetSlot, 'leftHand')?.position; const opponentRightHand = bodyWorksRuntime.segmentSnapshot(targetSlot, 'rightHand')?.position;
  const distance = Math.hypot(model.player.position.x - target.position.x, model.player.position.z - target.position.z);
  const touch = device === 'touch' || mobileInput.isActive();
  const activeDevice = touch ? 'touch' : device; const grappleGuide = useSettings((state) => state.grappleGuide);
  const controlReadout = buildControlReadout(model.player, target, playerPhysics.speed, distance, paused, activeDevice, playerIntent.move, playerIntent.run);
  const hint = controlReadout.callout;
  const announcementClass = model.announcement ? announcementTier(model.announcement, [player.signature, opponent.signature]) : null;
  const grappleDirection = combatDirection(playerIntent.move); const currentGrappleMove = model.player.moveId ? getMove(model.player.moveId) : null;
  const guideRows = grappleGuide === 'full' ? GRAPPLE_GUIDE : grappleGuide === 'minimal' ? GRAPPLE_GUIDE.filter((row) => row.id === grappleDirection) : [];
  const grapplePrompts = [controlPrompt(activeDevice, 'quick'), controlPrompt(activeDevice, 'heavy'), controlPrompt(activeDevice, 'grapple')];
  const actionFeedback = bodyWorksRuntime.actionFeedback();
  const recentActionFeedback = actionFeedback && model.elapsed - actionFeedback.updatedAt <= 1.35 ? actionFeedback : null;
  const contextPreview = resolveContextAction(model, 'player', playerIntent.move);
  const propPreview = resolvePropAction(model, 'player', playerIntent.move);
  return <div className="hud" aria-live="polite" data-runtime-id={model.runtimeId} data-match-mode={model.matchMode} data-player-target={targetSlot} data-elimination-count={model.eliminations.length} data-total-damage={FIGHTER_SLOTS.reduce((total, slot) => total + model.fighterStats[slot].damageDealt, 0).toFixed(1)} data-player-momentum-full={model.player.momentum >= 100 ? 'true' : 'false'} data-player-health-critical={model.player.health < 30 ? 'true' : 'false'} data-pin-count={model.player.state === 'pinning' ? model.player.pinCount : target.state === 'pinning' ? target.pinCount : 0} data-match-seconds={model.elapsed.toFixed(1)} data-player-state={model.player.state} data-opponent-state={target.state} data-player-ringside={isRingside(model.player.position) ? 'true' : 'false'} data-player-move={model.player.moveId ?? ''} data-opponent-move={target.moveId ?? ''} data-player-phase={model.player.attackPhase ?? ''} data-opponent-phase={target.attackPhase ?? ''} data-player-health={model.player.health.toFixed(1)} data-opponent-health={target.health.toFixed(1)} data-player-stamina={model.player.stamina.toFixed(1)} data-player-balance={model.player.body.balance.toFixed(1)} data-opponent-balance={target.body.balance.toFixed(1)} data-player-mass={model.player.body.mass.toFixed(1)} data-player-x={model.player.position.x.toFixed(3)} data-player-z={model.player.position.z.toFixed(3)} data-opponent-x={target.position.x.toFixed(3)} data-opponent-z={target.position.z.toFixed(3)} data-player-vertical={model.player.body.verticalOffset.toFixed(3)} data-opponent-vertical={target.body.verticalOffset.toFixed(3)} data-player-pelvis-y={playerPhysics.pelvisY.toFixed(3)} data-player-head-y={playerPhysics.headY.toFixed(3)} data-player-foot-y={playerPhysics.footY.toFixed(3)} data-player-upright={playerPhysics.upright.toFixed(3)} data-player-support-feet={playerPhysics.supportFeet} data-opponent-pelvis-y={opponentPhysics.pelvisY.toFixed(3)} data-opponent-head-y={opponentPhysics.headY.toFixed(3)} data-opponent-foot-y={opponentPhysics.footY.toFixed(3)} data-opponent-upright={opponentPhysics.upright.toFixed(3)} data-opponent-support-feet={opponentPhysics.supportFeet} data-physics-authority={model.physicsAuthority ? 'true' : 'false'} data-physics-bodies={physics.bodyCount} data-world-bodies={physics.worldBodyCount} data-invalid-bodies={physics.invalidRegisteredBodyCount} data-physics-joints={physics.jointCount} data-world-joints={physics.worldJointCount} data-world-joint-removals={physics.worldRemoveCount} data-physics-grips={physics.gripCount} data-grip-creates={physics.gripCreateCount} data-grip-invalid={physics.gripInvalidCount} data-physics-contacts={physics.contactCount} data-nearest-grip-distance={physics.nearestGripDistance.toFixed(3)} data-max-grip-error={physics.maximumGripError.toFixed(3)} data-max-grip-load={physics.maximumGripLoad.toFixed(3)} data-last-grip-break={physics.lastGripBreakReason} data-physics-emergency-resets={physics.emergencyResetCount} data-physics-containments={physics.containmentCount} data-grapple-position={model.grapple?.position ?? ''} data-grapple-phase={model.grapple?.phase ?? ''} data-grapple-grips={model.grapple?.gripCount ?? 0} data-grapple-tension={model.grapple?.tension.toFixed(2) ?? '0'} data-replay-frames={model.replayFrames.length} data-player-grapples={model.playerStats.grapples} data-total-grapples={FIGHTER_SLOTS.reduce((total, slot) => total + model.fighterStats[slot].grapples, 0)}>
    <span hidden data-replay-active={useMatchStore.getState().replayActive ? 'true' : 'false'} data-physics-replay-frames={bodyWorksRuntime.replay.size} data-player-momentum={model.player.momentum.toFixed(1)} data-player-rope-rebound={model.player.ropeRebound.toFixed(2)} data-player-held-prop={model.player.heldPropId ?? ''} data-opponent-held-prop={target.heldPropId ?? ''} data-prop-bodies={physics.propBodyCount} data-prop-grips={physics.propGripCount} data-total-prop-impacts={FIGHTER_SLOTS.reduce((total, slot) => total + model.fighterStats[slot].propImpacts, 0)} data-table-stage={model.props.find((prop) => prop.kind === 'table')?.failureStage ?? 'missing'} data-current-joint-separation={physics.currentJointSeparation.toFixed(3)} data-max-joint-separation={physics.maximumJointSeparation.toFixed(3)} data-motor-saturations={physics.motorSaturationCount} data-current-motor-saturations={physics.currentMotorSaturations} data-physics-last-contact={physics.lastContactPair} data-last-strike-distance={physics.lastStrikeDistance.toFixed(3)} data-min-strike-distance={physics.minimumStrikeDistance.toFixed(3)} data-min-strike-planar-distance={physics.minimumStrikePlanarDistance.toFixed(3)} data-min-strike-vertical-distance={physics.minimumStrikeVerticalDistance.toFixed(3)} data-numerical-faults={physics.numericalFaultCount} data-last-numerical-fault={physics.lastNumericalFault} data-support-score={physics.supportScore.toFixed(3)} data-motion-tasks={physics.taskCount} data-task-timeouts={physics.taskTimeoutCount} data-last-task-phase={physics.lastTaskPhase} data-pending-landings={bodyWorksRuntime.pendingLandingCount()} data-landing-surfaces={bodyWorksRuntime.registeredLandingSurfaceCount()} data-player-left-hand={playerLeftHand ? `${playerLeftHand.x.toFixed(3)},${playerLeftHand.y.toFixed(3)},${playerLeftHand.z.toFixed(3)}` : ''} data-player-right-hand={playerRightHand ? `${playerRightHand.x.toFixed(3)},${playerRightHand.y.toFixed(3)},${playerRightHand.z.toFixed(3)}` : ''} data-player-right-forearm={playerRightForearm ? `${playerRightForearm.x.toFixed(3)},${playerRightForearm.y.toFixed(3)},${playerRightForearm.z.toFixed(3)}` : ''} data-opponent-chest={opponentChest ? `${opponentChest.x.toFixed(3)},${opponentChest.y.toFixed(3)},${opponentChest.z.toFixed(3)}` : ''} data-opponent-left-hand={opponentLeftHand ? `${opponentLeftHand.x.toFixed(3)},${opponentLeftHand.y.toFixed(3)},${opponentLeftHand.z.toFixed(3)}` : ''} data-opponent-right-hand={opponentRightHand ? `${opponentRightHand.x.toFixed(3)},${opponentRightHand.y.toFixed(3)},${opponentRightHand.z.toFixed(3)}` : ''} />
    <span hidden data-player-climb-stage={model.player.climbStage} data-player-recovery-orientation={model.player.recoveryOrientation} data-player-physics-speed={playerPhysics.speed.toFixed(3)} data-player-intent-x={playerIntent.move.x.toFixed(3)} data-player-intent-z={playerIntent.move.z.toFixed(3)} data-player-run-held={playerIntent.run ? 'true' : 'false'} data-buffered-actions={bodyWorksRuntime.pendingCommandCount()} data-action-buffered={physics.actionBuffered} data-action-executed={physics.actionExecuted} data-action-expired={physics.actionExpired} data-action-rejected={physics.actionRejected} data-action-duplicate={physics.actionDuplicate} data-action-average-wait-ms={physics.actionAverageWaitMs.toFixed(2)} data-action-maximum-wait-ms={physics.actionMaximumWaitMs.toFixed(2)} />
    <span hidden data-player-target-lock={model.playerTargetLock.toFixed(2)} data-last-action={actionFeedback?.event.action ?? ''} data-last-action-status={actionFeedback?.status ?? ''} data-last-action-sequence={actionFeedback?.event.sequence ?? 0} data-last-action-source={actionFeedback?.event.source ?? ''} />
    <div className="hud__fighters">
      <div className="fighter-hud"><div className="fighter-hud__name"><span>YOU</span><b>{player.name}</b></div><Meter label="HEALTH" value={model.player.health} kind="health" /><Meter label={`STAMINA · ${model.player.beersDrunk} BEER`} value={model.player.stamina} max={model.player.staminaCap} kind="stamina" /><Meter label="BALANCE" value={model.player.body.balance} kind="balance" /><Meter label="MOMENTUM" value={model.player.momentum} kind="momentum" /></div>
      <div className="hype"><span>CROWD HYPE</span><b>{Math.round(model.hype)}</b><div><i style={{ width: `${model.hype}%` }} /></div><code className="match-timer">{`${Math.floor(model.elapsed / 60).toString().padStart(2, '0')}:${(Math.floor(model.elapsed) % 60).toString().padStart(2, '0')}`}</code><small>{model.ruleset === 'chaos' ? 'CHAOS CIRCUIT' : 'STANDARD'}</small></div>
      <div className="fighter-hud fighter-hud--right"><div className="fighter-hud__name"><span>{model.matchMode === 'battle_royale' ? 'CURRENT TARGET' : `${model.difficulty.toUpperCase()} AI`}</span><b>{opponent.name}</b></div><Meter label="HEALTH" value={target.health} kind="health" /><Meter label="STAMINA" value={target.stamina} max={target.staminaCap} kind="stamina" /><Meter label="BALANCE" value={target.body.balance} kind="balance" /><Meter label="MOMENTUM" value={target.momentum} kind="momentum" /></div>
    </div>
    {model.announcement && <div className={`announcement announcement--${announcementClass}`} key={model.announcement}>{model.announcement}</div>}
    {model.chaosEvent && <div className="event-banner"><span>LIVE CIRCUIT EVENT</span><b>{model.chaosEvent.type}</b><small>{Math.ceil(model.chaosEvent.remaining)}s</small></div>}
    {model.player.state === 'grappling' && grappleGuide !== 'off' && <div className={`grapple-guide grapple-guide--${grappleGuide}`} data-testid="grapple-guide" data-guide-mode={grappleGuide}>
      <header><span>{model.grapple?.position?.replace(/([A-Z])/g, ' $1').toUpperCase() ?? 'COLLAR & ELBOW'} · {grappleDirection.toUpperCase()}</span><b>{currentGrappleMove?.displayName ?? 'CHOOSE THE FINISH'}</b></header>
      {guideRows.map((row) => <div className={row.id === grappleDirection ? 'selected-direction' : ''} key={row.direction}><strong>{row.direction}</strong>{row.moves.map((moveId, index) => {
        const move = getMove(moveId); const extraCost = Math.max(0, move.staminaCost - (currentGrappleMove?.staminaCost ?? 0)); const legal = model.player.stamina >= extraCost;
        return <span className={`${model.player.moveId === moveId ? 'active' : ''}${legal ? '' : ' unavailable'}`} key={`${row.direction}-${moveId}-${index}`}><kbd>{grapplePrompts[index]}</kbd>{move.displayName}</span>;
      })}</div>)}
    </div>}
    {model.matchMode === 'battle_royale' && <div className="battle-royale-roster" data-testid="battle-royale-roster" data-remaining={FIGHTER_SLOTS.filter((slot) => model[slot].state !== 'defeated').length}>{FIGHTER_SLOTS.map((slot) => { const runtime = model[slot]; const definition = fighterById(runtime.definitionId); return <div key={slot} className={`${slot === 'player' ? 'is-player' : ''}${slot === targetSlot ? ' is-target' : ''}${runtime.state === 'defeated' ? ' is-eliminated' : ''}`} data-fighter-slot={slot} data-fighter-state={runtime.state}><span style={{ background: definition.palette.primary }} /><b>{definition.name}</b><i style={{ width: `${runtime.health}%` }} /><small>{runtime.state === 'defeated' ? 'OUT' : `${Math.ceil(runtime.health)} HP`}</small></div>; })}</div>}
    {model.matchMode === 'battle_royale' && <button type="button" className="target-switch" data-testid="target-switch" disabled={model.player.state === 'defeated' || model.resolved} onClick={() => useMatchStore.getState().cyclePlayerTarget()}>SWITCH TARGET <kbd>TAB</kbd><small>GAMEPAD VIEW</small></button>}
    {recentActionFeedback && <div className={`action-strip action-strip--${recentActionFeedback.status}`} data-testid="action-strip" data-action={recentActionFeedback.event.action} data-status={recentActionFeedback.status}><span>INPUT</span><b>{ACTION_LABELS[recentActionFeedback.event.action]}</b><small>{recentActionFeedback.status.toUpperCase()}</small></div>}
    <ControlDeck device={device} player={model.player} opponent={target} speed={playerPhysics.speed} distance={distance} paused={paused} direction={playerIntent.move} runHeld={playerIntent.run} contextPreview={contextPreview.displayName} propPreview={propPreview.displayName} />
    <div className="context-hint"><span className="device-dot" />{hint}<small>{touch ? 'TOUCH ACTIVE' : device === 'gamepad' ? 'GAMEPAD ACTIVE' : 'KEYBOARD ACTIVE'}</small></div>
    {paused && <div className="pause-chip">SIMULATION PAUSED</div>}
  </div>;
}
