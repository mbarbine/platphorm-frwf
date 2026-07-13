import { fighterById } from '../game/data/fighters';
import { getMove } from '../game/data/moves';
import { useMatchStore } from '../game/state/matchStore';
import type { ControlDevice } from '../game/types/game';

const Meter = ({ label, value, kind, max = 100 }: { label: string; value: number; kind: string; max?: number }) => <div className={`meter meter--${kind}`}><div className="meter__label"><span>{label}</span><b>{Math.round(value)}{max !== 100 ? ` / ${Math.round(max)}` : ''}</b></div><div className="meter__track"><i style={{ width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} /></div></div>;

const GRAPPLE_GUIDE = [
  { direction: '↑', moves: ['arm_drag', 'skyhook', 'powerbomb'] },
  { direction: '←', moves: ['clutch', 'spinebuster', 'whip'] },
  { direction: '●', moves: ['takedown', 'slam', 'suplex'] },
  { direction: '→', moves: ['side_toss', 'slam', 'suplex'] },
  { direction: '↓', moves: ['takedown', 'spinebuster', 'mountain_drop'] },
] as const;

export function HUD({ device, paused }: { device: ControlDevice; paused: boolean }) {
  const model = useMatchStore((state) => state.model); const player = fighterById(model.player.definitionId); const opponent = fighterById(model.opponent.definitionId);
  const distance = Math.hypot(model.player.position.x - model.opponent.position.x, model.player.position.z - model.opponent.position.z);
  const playerRingside = Math.abs(model.player.position.x) > 5.8 || Math.abs(model.player.position.z) > 4.3;
  const hint = model.player.momentum >= 100 && ['staggered', 'downed'].includes(model.opponent.state) && distance < 2.2 ? 'F  SIGNATURE FINISHER'
    : model.player.state === 'climbing' ? (['downed', 'staggered'].includes(model.opponent.state) ? 'F  DOMEFALL DIVE' : 'SPACE  DROP SAFELY')
    : model.player.state === 'grappling' ? 'GRAPPLE LOCK · HOLD DIRECTION + J / K / L FOR A DIFFERENT MOVE'
    : model.opponent.state === 'downed' && distance < 1.7 ? 'F  PIN  ·  J  GROUND STRIKE'
    : model.player.counterWindow > 0 ? 'SPACE  COUNTER NOW'
    : distance < 1.8 && ['idle', 'locomotion', 'blocking', 'staggered'].includes(model.opponent.state) ? 'L  LOCK UP  ·  I  HOLD GUARD'
    : playerRingside ? (model.ruleset === 'chaos' ? 'F AT APRON  RE-ENTER · E  GRAB RINGSIDE PROP' : 'F AT APRON  RE-ENTER THE RING')
    : model.player.heldPropId ? 'K / E  SWING PROP' : model.ruleset === 'chaos' ? 'F AT ROPES  GO RINGSIDE · E  PICK UP PROP' : 'F AT ROPES  GO RINGSIDE · I GUARD';
  return <div className="hud" aria-live="polite" data-match-seconds={model.elapsed.toFixed(1)} data-player-state={model.player.state} data-opponent-state={model.opponent.state} data-player-move={model.player.moveId ?? ''} data-opponent-move={model.opponent.moveId ?? ''} data-player-phase={model.player.attackPhase ?? ''} data-opponent-phase={model.opponent.attackPhase ?? ''} data-player-health={model.player.health.toFixed(1)} data-opponent-health={model.opponent.health.toFixed(1)} data-player-stamina={model.player.stamina.toFixed(1)} data-player-balance={model.player.body.balance.toFixed(1)} data-opponent-balance={model.opponent.body.balance.toFixed(1)} data-player-mass={model.player.body.mass.toFixed(1)} data-grapple-position={model.grapple?.position ?? ''} data-grapple-tension={model.grapple?.tension.toFixed(2) ?? '0'} data-replay-frames={model.replayFrames.length} data-player-grapples={model.playerStats.grapples}>
    <div className="hud__fighters">
      <div className="fighter-hud"><div className="fighter-hud__name"><span>YOU</span><b>{player.name}</b></div><Meter label="HEALTH" value={model.player.health} kind="health" /><Meter label={`STAMINA · ${model.player.beersDrunk} BEER`} value={model.player.stamina} max={model.player.staminaCap} kind="stamina" /><Meter label="BALANCE" value={model.player.body.balance} kind="balance" /><Meter label="MOMENTUM" value={model.player.momentum} kind="momentum" /></div>
      <div className="hype"><span>CROWD HYPE</span><b>{Math.round(model.hype)}</b><div><i style={{ width: `${model.hype}%` }} /></div><small>{model.ruleset === 'chaos' ? 'CHAOS CIRCUIT' : 'STANDARD'}</small></div>
      <div className="fighter-hud fighter-hud--right"><div className="fighter-hud__name"><span>{model.difficulty.toUpperCase()} AI</span><b>{opponent.name}</b></div><Meter label="HEALTH" value={model.opponent.health} kind="health" /><Meter label="STAMINA" value={model.opponent.stamina} max={model.opponent.staminaCap} kind="stamina" /><Meter label="BALANCE" value={model.opponent.body.balance} kind="balance" /><Meter label="MOMENTUM" value={model.opponent.momentum} kind="momentum" /></div>
    </div>
    {model.announcement && <div className="announcement" key={model.announcement}>{model.announcement}</div>}
    {model.chaosEvent && <div className="event-banner"><span>LIVE CIRCUIT EVENT</span><b>{model.chaosEvent.type}</b><small>{Math.ceil(model.chaosEvent.remaining)}s</small></div>}
    {model.player.state === 'grappling' && <div className="grapple-guide" data-testid="grapple-guide">
      <header><span>COLLAR &amp; ELBOW CONTROL</span><b>{model.player.moveId ? getMove(model.player.moveId).displayName : 'CHOOSE THE FINISH'}</b></header>
      {GRAPPLE_GUIDE.map((row) => <div key={row.direction}><strong>{row.direction}</strong>{row.moves.map((moveId, index) => <span className={model.player.moveId === moveId ? 'active' : ''} key={`${row.direction}-${moveId}-${index}`}><kbd>{['J', 'K', 'L'][index]}</kbd>{getMove(moveId).displayName}</span>)}</div>)}
    </div>}
    <div className="context-hint"><span className="device-dot" />{hint}<small>{device === 'gamepad' ? 'GAMEPAD ACTIVE' : 'KEYBOARD ACTIVE'}</small></div>
    {paused && <div className="pause-chip">SIMULATION PAUSED</div>}
  </div>;
}
