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
      <label className="setting-row setting-row--select"><span>Graphics quality<b>{settings.graphicsQuality.toUpperCase()}</b></span><select aria-label="Graphics quality" value={settings.graphicsQuality} onChange={(event) => settings.update({ graphicsQuality: event.target.value as typeof settings.graphicsQuality })}><option value="auto">Auto · device tuned</option><option value="performance">Performance · steadier frames</option><option value="quality">Quality · richer arena</option></select></label>
      <label className="setting-row setting-row--select"><span>Grapple guide<b>{settings.grappleGuide.toUpperCase()}</b></span><select aria-label="Grapple guide" value={settings.grappleGuide} onChange={(event) => settings.update({ grappleGuide: event.target.value as typeof settings.grappleGuide })}><option value="full">Full · five directions</option><option value="minimal">Minimal · current direction</option><option value="off">Off · expert play</option></select></label>
      <label className="setting-row setting-row--select"><span>Camera cuts<b>{settings.cameraCuts.toUpperCase()}</b></span><select aria-label="Camera cuts" value={settings.cameraCuts} onChange={(event) => settings.update({ cameraCuts: event.target.value as typeof settings.cameraCuts })}><option value="full">Full · broadcast direction</option><option value="reduced">Reduced · fewer cuts</option><option value="off">Off · steady broadcast</option></select></label>
      <label className="toggle-row"><span><b>Reduced motion</b><small>Smoother camera, restrained effects</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => settings.update({ reducedMotion: event.target.checked })} /></label>
      <label className="toggle-row"><span><b>Low flash</b><small>Fewer, dimmer impact strobes while keeping hit silhouettes</small></span><input type="checkbox" checked={settings.lowFlash} onChange={(event) => settings.update({ lowFlash: event.target.checked })} /></label>
      <label className="toggle-row"><span><b>High contrast</b><small>Brighter prompts, meter labels, and focus outlines</small></span><input type="checkbox" checked={settings.highContrast} onChange={(event) => settings.update({ highContrast: event.target.checked })} /></label>
    </div>
    <div className="control-card"><b>CONTROL REFERENCE</b><span>WASD/D-pad move · Shift/RT sprint · C/L3 jump · J/X punch · K/Y kick · L/B body slam (+ direction for chain) · I/LT guard (hold) · Space/A dodge or counter · E/LB prop · F/R3 pin/finisher/climb · Q/RB taunt · Esc pause</span></div>
    <div className="button-row"><button className="button button--quiet" onClick={settings.reset}>RESET SAVED SETTINGS</button><button className="button" onClick={onBack}>DONE</button></div>
  </section>;
}
