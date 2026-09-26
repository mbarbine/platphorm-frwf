import records from '../../../public/archive/manifest.json';

/** Historical source material is separate from live match records. */
export function FrwfArchive({ onClose }: { onClose: () => void }) {
  return <div className="world-modal" role="dialog" aria-modal="true" aria-label="FRWF archive"><article style={{ width: 'min(1100px, 94vw)', maxHeight: '88vh', overflowY: 'auto' }}>
    <button className="button button--quiet" onClick={onClose}>RETURN TO SHOWGROUND</button>
    <span>FRONT ROYAL WRESTLING FEDERATION</span><h2>From the backyard.</h2>
    <p>Original photographs, rivalries, posters and tournament records supplied by the FRWF crew. These are historical materials, not current event listings or live match results.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
      {records.map(record => <figure key={record.id} style={{ margin: 0 }}><a href={record.url} target="_blank" rel="noreferrer"><img src={record.url} alt={record.title} loading="lazy" decoding="async" style={{ width: '100%', height: 230, objectFit: 'contain', background: '#090909' }} /></a><figcaption>{record.title} · FRWF archive</figcaption></figure>)}
    </div>
    <p>Beer Bandit Bill and Beer Bandit Ted share a team identity. Their current challenges are singles bouts; coordinated tag-team mechanics remain planned.</p>
  </article></div>;
}
