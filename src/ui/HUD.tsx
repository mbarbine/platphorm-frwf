import { fighterById } from '../game/data/fighters';
import { getMove } from '../game/data/moves';
import { bodyWorksRuntime } from '../game/physics/physicsRuntime';
import { useMatchStore } from '../game/state/matchStore';
import type { ControlDevice } from '../game/types/game';
import { mobileInput } from '../game/input/mobileInput';
import { buildControlReadout, ControlDeck } from './ControlDeck';
import { announcementTier } from './announcementTier';
import { isRingside } from '../game/physics/ringDynamics';

const Meter = ({ label, value, kind, max = 100 }: { label: string; value: number; kind: string; max?: number }) => <div className={`meter meter--${kind}`}><div className="meter__label"><span>{label}</span><b>{Math.round(value)}{max !== 100 ? ` / ${Math.round(max)}` : ''}</b></div><div className="meter__track"><i style={{ width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} /></div></div>;

const GRAPPLE_GUIDE = [
  { direction: '↑', moves: ['arm_drag', 'skyhook', 'powerbomb'] },
  { direction: '←', moves: ['clutch', 'spinebuster', 'whip'] },
  { direction: '●', moves: ['takedown', 'slam', 'slam'] },
  { direction: '→', moves: ['side_toss', 'slam', 'suplex'] },
  { direction: '↓', moves: ['takedown', 'spinebuster', 'mountain_drop'] },
] as const;

export function HUD({ device, paused }: { device: ControlDevice; paused: boolean }) {
  const model = useMatchStore((state) => state.model); const player = fighterById(model.player.definitionId); const opponent = fighterById(model.opponent.definitionId);
  const physics = bodyWorksRuntime.metrics;
  const playerPhysics = bodyWorksRuntime.fighterSnapshot('player'); const opponentPhysics = bodyWorksRuntime.fighterSnapshot('opponent');
  const playerIntent = bodyWorksRuntime.intentSnapshot('player');
  const distance = Math.hypot(model.player.position.x - model.opponent.position.x, model.player.position.z - model.opponent.position.z);
  const touch = device === 'touch' || mobileInput.isActive();
  const controlReadout = buildControlReadout(model.player, model.opponent, playerPhysics.speed, distance, paused, touch ? 'touch' : device, playerIntent.move, playerIntent.run);
  const hint = controlReadout.callout;
  const announcementClass = model.announcement ? announcementTier(model.announcement, [player.signature, opponent.signature]) : null;
  return <div className="hud" aria-live="polite" data-runtime-id={model.runtimeId} data-match-seconds={model.elapsed.toFixed(1)} data-player-state={model.player.state} data-opponent-state={model.opponent.state} data-player-ringside={isRingside(model.player.position) ? 'true' : 'false'} data-player-move={model.player.moveId ?? ''} data-opponent-move={model.opponent.moveId ?? ''} data-player-phase={model.player.attackPhase ?? ''} data-opponent-phase={model.opponent.attackPhase ?? ''} data-player-health={model.player.health.toFixed(1)} data-opponent-health={model.opponent.health.toFixed(1)} data-player-stamina={model.player.stamina.toFixed(1)} data-player-balance={model.player.body.balance.toFixed(1)} data-opponent-balance={model.opponent.body.balance.toFixed(1)} data-player-mass={model.player.body.mass.toFixed(1)} data-player-x={model.player.position.x.toFixed(3)} data-player-z={model.player.position.z.toFixed(3)} data-opponent-x={model.opponent.position.x.toFixed(3)} data-opponent-z={model.opponent.position.z.toFixed(3)} data-player-vertical={model.player.body.verticalOffset.toFixed(3)} data-opponent-vertical={model.opponent.body.verticalOffset.toFixed(3)} data-player-pelvis-y={playerPhysics.pelvisY.toFixed(3)} data-player-head-y={playerPhysics.headY.toFixed(3)} data-player-foot-y={playerPhysics.footY.toFixed(3)} data-player-upright={playerPhysics.upright.toFixed(3)} data-player-support-feet={playerPhysics.supportFeet} data-opponent-pelvis-y={opponentPhysics.pelvisY.toFixed(3)} data-opponent-head-y={opponentPhysics.headY.toFixed(3)} data-opponent-foot-y={opponentPhysics.footY.toFixed(3)} data-opponent-upright={opponentPhysics.upright.toFixed(3)} data-opponent-support-feet={opponentPhysics.supportFeet} data-physics-authority={model.physicsAuthority ? 'true' : 'false'} data-physics-bodies={physics.bodyCount} data-world-bodies={physics.worldBodyCount} data-invalid-bodies={physics.invalidRegisteredBodyCount} data-physics-joints={physics.jointCount} data-world-joints={physics.worldJointCount} data-world-joint-removals={physics.worldRemoveCount} data-physics-grips={physics.gripCount} data-grip-creates={physics.gripCreateCount} data-grip-invalid={physics.gripInvalidCount} data-physics-contacts={physics.contactCount} data-nearest-grip-distance={physics.nearestGripDistance.toFixed(3)} data-max-grip-error={physics.maximumGripError.toFixed(3)} data-max-grip-load={physics.maximumGripLoad.toFixed(3)} data-last-grip-break={physics.lastGripBreakReason} data-physics-emergency-resets={physics.emergencyResetCount} data-grapple-position={model.grapple?.position ?? ''} data-grapple-phase={model.grapple?.phase ?? ''} data-grapple-grips={model.grapple?.gripCount ?? 0} data-grapple-tension={model.grapple?.tension.toFixed(2) ?? '0'} data-replay-frames={model.replayFrames.length} data-player-grapples={model.playerStats.grapples} data-total-grapples={model.playerStats.grapples + model.opponentStats.grapples}>
    <span hidden data-replay-active={useMatchStore.getState().replayActive ? 'true' : 'false'} data-physics-replay-frames={bodyWorksRuntime.replay.size} data-player-momentum={model.player.momentum.toFixed(1)} data-player-held-prop={model.player.heldPropId ?? ''} data-opponent-held-prop={model.opponent.heldPropId ?? ''} data-prop-bodies={physics.propBodyCount} data-prop-grips={physics.propGripCount} data-total-prop-impacts={model.playerStats.propImpacts + model.opponentStats.propImpacts} data-table-stage={model.props.find((prop) => prop.kind === 'table')?.failureStage ?? 'missing'} />
    <span hidden data-player-climb-stage={model.player.climbStage} data-player-physics-speed={playerPhysics.speed.toFixed(3)} data-player-intent-x={playerIntent.move.x.toFixed(3)} data-player-intent-z={playerIntent.move.z.toFixed(3)} data-player-run-held={playerIntent.run ? 'true' : 'false'} data-buffered-actions={bodyWorksRuntime.pendingCommandCount()} />
    <div className="hud__fighters">
      <div className="fighter-hud"><div className="fighter-hud__name"><span>YOU</span><b>{player.name}</b></div><Meter label="HEALTH" value={model.player.health} kind="health" /><Meter label={`STAMINA · ${model.player.beersDrunk} BEER`} value={model.player.stamina} max={model.player.staminaCap} kind="stamina" /><Meter label="BALANCE" value={model.player.body.balance} kind="balance" /><Meter label="MOMENTUM" value={model.player.momentum} kind="momentum" /></div>
      <div className="hype"><span>CROWD HYPE</span><b>{Math.round(model.hype)}</b><div><i style={{ width: `${model.hype}%` }} /></div><small>{model.ruleset === 'chaos' ? 'CHAOS CIRCUIT' : 'STANDARD'}</small></div>
      <div className="fighter-hud fighter-hud--right"><div className="fighter-hud__name"><span>{model.difficulty.toUpperCase()} AI</span><b>{opponent.name}</b></div><Meter label="HEALTH" value={model.opponent.health} kind="health" /><Meter label="STAMINA" value={model.opponent.stamina} max={model.opponent.staminaCap} kind="stamina" /><Meter label="BALANCE" value={model.opponent.body.balance} kind="balance" /><Meter label="MOMENTUM" value={model.opponent.momentum} kind="momentum" /></div>
    </div>
    {model.announcement && <div className={`announcement announcement--${announcementClass}`} key={model.announcement}>{model.announcement}</div>}
    {model.chaosEvent && <div className="event-banner"><span>LIVE CIRCUIT EVENT</span><b>{model.chaosEvent.type}</b><small>{Math.ceil(model.chaosEvent.remaining)}s</small></div>}
    {model.player.state === 'grappling' && <div className="grapple-guide" data-testid="grapple-guide">
      <header><span>COLLAR &amp; ELBOW CONTROL</span><b>{model.player.moveId ? getMove(model.player.moveId).displayName : 'CHOOSE THE FINISH'}</b></header>
      {GRAPPLE_GUIDE.map((row) => <div key={row.direction}><strong>{row.direction}</strong>{row.moves.map((moveId, index) => <span className={model.player.moveId === moveId ? 'active' : ''} key={`${row.direction}-${moveId}-${index}`}><kbd>{['J', 'K', 'L'][index]}</kbd>{getMove(moveId).displayName}</span>)}</div>)}
    </div>}
    <ControlDeck device={device} player={model.player} opponent={model.opponent} speed={playerPhysics.speed} distance={distance} paused={paused} direction={playerIntent.move} runHeld={playerIntent.run} />
    <div className="context-hint"><span className="device-dot" />{hint}<small>{touch ? 'TOUCH ACTIVE' : device === 'gamepad' ? 'GAMEPAD ACTIVE' : 'KEYBOARD ACTIVE'}</small></div>
    {paused && <div className="pause-chip">SIMULATION PAUSED</div>}
  </div>;
}
