export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`logo ${compact ? 'logo--compact' : ''}`} aria-label="Ringfall Chaos Circuit">
    <span className="logo__eyebrow">VOLT DOME PRESENTS</span>
    <strong>RINGFALL</strong>
    <span className="logo__subtitle">CHAOS CIRCUIT</span>
  </div>;
}
