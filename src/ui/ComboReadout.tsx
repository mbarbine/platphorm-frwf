import type { FighterRuntime } from '../game/types/game';
import { comboStrike, COMBO_MAX_HITS } from '../game/systems/hitCombos';
import { getMove } from '../game/data/moves';
import './comboReadout.css';

export function ComboReadout({ actor, punch, kick }: { actor: FighterRuntime; punch: string; kick: string }) {
  const comboLabel = actor.comboName ?? (actor.comboStep === 1 ? 'hit' : 'hits');
  return <div className="hit-combo" role="status" aria-live="polite" aria-label={`Combo: ${actor.comboStep} ${comboLabel}`} data-testid="hit-combo" data-hits={actor.comboStep} data-chain={actor.comboInputs.join(',')} data-combo-name={actor.comboName ?? ''} hidden={actor.comboStep < 1}>
    <div className="hit-combo__score"><strong>{actor.comboStep}</strong><span>{actor.comboName ?? (actor.comboStep === 1 ? 'HIT' : 'HIT COMBO')}</span></div>
    <div className="hit-combo__pips" aria-hidden="true">{Array.from({ length: COMBO_MAX_HITS }, (_, index) => <i key={index} className={index < actor.comboStep ? 'lit' : ''} />)}</div>
    {!actor.comboName && <small><kbd>{punch}</kbd> {getMove(comboStrike(actor, 'quick') ?? 'jab').displayName} <b> / </b><kbd>{kick}</kbd> {getMove(comboStrike(actor, 'heavy') ?? 'front_kick').displayName}</small>}
  </div>;
}
