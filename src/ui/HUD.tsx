import { fighterById } from '../game/data/fighters';
import { useMatchStore } from '../game/state/matchStore';
import type { ControlDevice } from '../game/types/game';

const Meter = ({ label, value, kind }: { label: string; value: number; kind: string }) => <div className={`meter meter--${kind}`}><div className="meter__label"><span>{label}</span><b>{Math.round(value)}</b></div><div className="meter__track"><i style={{ width: `${Math.max(0, value)}%` }} /></div></div>;

export function HUD({ device, paused }: { device: ControlDevice; paused: boolean }) {
  const model = useMatchStore((state) => state.model); const player = fighterById(model.player.definitionId); const opponent = fighterById(model.opponent.definitionId);
  const distance = Math.hypot(model.player.position.x - model.opponent.position.x, model.player.position.z - model.opponent.position.z);
  const hint = model.player.momentum >= 100 && ['staggered', 'downed'].includes(model.opponent.state) && distance < 2.2 ? 'F  SIGNATURE FINISHER'
    : model.opponent.state === 'downed' && distance < 1.7 ? 'F  PIN  ·  J  GROUND STRIKE'
    : model.player.counterWindow > 0 ? 'SPACE  COUNTER NOW'
    : distance < 1.8 && ['idle', 'locomotion', 'staggered'].includes(model.opponent.state) ? 'L  GRAPPLE  ·  CYCLES SLAM / SUPLEX / TAKEDOWN / WHIP'
    : model.player.heldPropId ? 'K / E  SWING PROP' : model.ruleset === 'chaos' ? 'E  PICK UP NEARBY PROP' : 'VARY MOVES TO BUILD MOMENTUM';
  return <div className="hud" aria-live="polite">
    <div className="hud__fighters">
      <div className="fighter-hud"><div className="fighter-hud__name"><span>YOU</span><b>{player.name}</b></div><Meter label="HEALTH" value={model.player.health} kind="health" /><Meter label="STAMINA" value={model.player.stamina} kind="stamina" /><Meter label="MOMENTUM" value={model.player.momentum} kind="momentum" /></div>
      <div className="hype"><span>CROWD HYPE</span><b>{Math.round(model.hype)}</b><div><i style={{ width: `${model.hype}%` }} /></div><small>{model.ruleset === 'chaos' ? 'CHAOS CIRCUIT' : 'STANDARD'}</small></div>
      <div className="fighter-hud fighter-hud--right"><div className="fighter-hud__name"><span>{model.difficulty.toUpperCase()} AI</span><b>{opponent.name}</b></div><Meter label="HEALTH" value={model.opponent.health} kind="health" /><Meter label="STAMINA" value={model.opponent.stamina} kind="stamina" /><Meter label="MOMENTUM" value={model.opponent.momentum} kind="momentum" /></div>
    </div>
    {model.announcement && <div className="announcement" key={model.announcement}>{model.announcement}</div>}
    {model.chaosEvent && <div className="event-banner"><span>LIVE CIRCUIT EVENT</span><b>{model.chaosEvent.type}</b><small>{Math.ceil(model.chaosEvent.remaining)}s</small></div>}
    <div className="context-hint"><span className="device-dot" />{hint}<small>{device === 'gamepad' ? 'GAMEPAD ACTIVE' : 'KEYBOARD ACTIVE'}</small></div>
    {paused && <div className="pause-chip">SIMULATION PAUSED</div>}
  </div>;
}
