import { Suspense, type CSSProperties } from 'react';
import { FIGHTERS, fighterById } from '../game/data/fighters';
import { FIGHTER_PORTRAITS } from '../game/data/fighterPortraits';
import type { FighterId } from '../game/types/game';
import { FighterPreview } from './FighterPreview';

interface Props {
  selected: FighterId;
  onSelect: (id: FighterId) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export function FighterSelection({ selected, onSelect, onBack, onConfirm }: Props) {
  const fighter = fighterById(selected); const portrait = FIGHTER_PORTRAITS[selected];
  return <section className="selection-arena" style={{ '--fighter-accent': fighter.palette.primary } as CSSProperties} aria-label="Choose your wrestler">
    <header className="selection-header"><div><span>FRWF / ORIGINALS</span><h2>FIGHTER SELECT</h2></div><p>{FIGHTERS.length} WRESTLERS <span>•</span> YOUR CORNER. YOUR RULES.</p></header>
    <div className="selection-stage">
      <div className="selection-photo" key={selected}>
        {portrait ? <img src={portrait.url} alt={`${fighter.name}, original FRWF photograph`} style={{ objectPosition: portrait.position }} /> : <div className="selection-monogram" aria-hidden="true">FRWF</div>}
        <span className="selection-photo-label">{portrait ? 'THE ORIGINAL' : 'FRWF ROSTER'}</span>
        <div className="selection-name"><span>{fighter.nickname}</span><h3>{fighter.name}</h3><p>{fighter.archetype}</p></div>
      </div>
      <div className="selection-model"><span className="selection-model-label">IN THE RING</span><Suspense fallback={<div className="preview-loading">ASSEMBLING FIGHTER…</div>}><FighterPreview fighterId={selected} /></Suspense></div>
      <article className="selection-profile"><span className="selection-eyebrow">SCOUTING REPORT</span><p>{fighter.bio}</p><div className="selection-stats">{Object.entries(fighter.stats).map(([label, value]) => <div key={label}><span>{label}</span><meter min={0} max={100} value={value} aria-label={label} /><b>{value}</b></div>)}</div><div className="selection-signature"><span>SIGNATURE FINISHER</span><strong>{fighter.signature}</strong></div></article>
    </div>
    <div className="selection-bottom"><div className="selection-roster" role="list" aria-label="Wrestler roster">
      {FIGHTERS.map(candidate => { const photo = FIGHTER_PORTRAITS[candidate.id]; return <button key={candidate.id} data-fighter-select-id={candidate.id} className={`selection-tile roster-card${candidate.id === selected ? ' roster-card--active' : ''}`} aria-pressed={candidate.id === selected} aria-label={candidate.name} onClick={() => onSelect(candidate.id)}>
        {photo ? <img src={photo.url} alt="" loading="lazy" style={{ objectPosition: photo.position, transformOrigin: photo.position }} /> : <span className="selection-tile-initials" style={{ color: candidate.palette.primary }}>{candidate.name.replace(/[“”]/g, '').split(' ').map(word => word[0]).slice(0, 2).join('')}</span>}
        <b>{candidate.name}</b>{candidate.id === selected && <small>SELECTED</small>}
      </button>; })}
    </div><footer className="selection-actions"><button className="button button--quiet" onClick={onBack}>BACK</button><span aria-live="polite">Selected fighter: {fighter.name}, {fighter.archetype}</span><button className="button button--hero" onClick={onConfirm}>LOCK IN {fighter.name} <span aria-hidden="true">↗</span></button></footer></div>
  </section>;
}
