import { useSettings } from '../game/state/settings';

export function SettingsPanel({ onBack }: { onBack: () => void }) {
  const settings = useSettings();
  const range = (label: string, value: number, key: 'masterVolume' | 'effectsVolume' | 'crowdVolume' | 'shake' | 'uiScale', min = 0, max = 1, step = .05) => <label className="setting-row">
    <span>{label}<b>{Math.round(value * 100)}%</b></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => settings.update({ [key]: Number(event.target.value) })} />
  </label>;
  return <section className="panel panel--settings"><div className="section-heading"><span>ACCESSIBILITY + AUDIO</span><h2>SETTINGS</h2></div>
    <div className="settings-grid">
      {range('Master volume', settings.masterVolume, 'masterVolume')}
      {range('Effects volume', settings.effectsVolume, 'effectsVolume')}
      {range('Crowd volume', settings.crowdVolume, 'crowdVolume')}
      {range('Screen shake', settings.shake, 'shake')}
      {range('UI scale', settings.uiScale, 'uiScale', .85, 1.25, .05)}
      <label className="toggle-row"><span><b>Reduced motion</b><small>Smoother camera, restrained effects</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => settings.update({ reducedMotion: event.target.checked })} /></label>
    </div>
    <div className="control-card"><b>CONTROL REFERENCE</b><span>WASD move · Shift run · J quick · K heavy · L grapple · Space dodge/counter · E prop · F pin/finisher · Q taunt · Esc pause</span></div>
    <div className="button-row"><button className="button button--quiet" onClick={settings.reset}>RESET SAVED SETTINGS</button><button className="button" onClick={onBack}>DONE</button></div>
  </section>;
}
