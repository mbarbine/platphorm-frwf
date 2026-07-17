import { useEffect, useState } from 'react';
import { useSettings } from '../game/state/settings';

export function SettingsPanel({ onBack }: { onBack: () => void }) {
  const settings = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!confirmReset) return;
    const timer = setTimeout(() => setConfirmReset(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmReset]);

  const handleReset = () => {
    if (confirmReset) {
      settings.reset();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
    }
  };

  const range = (
    label: string,
    value: number,
    key: 'masterVolume' | 'effectsVolume' | 'crowdVolume' | 'shake' | 'uiScale',
    min = 0,
    max = 1,
    step = 0.05
  ) => {
    const id = `setting-range-${key}`;
    return (
      <label className="setting-row" htmlFor={id}>
        <span>{label}<b>{Math.round(value * 100)}%</b></span>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => settings.update({ [key]: Number(event.target.value) })}
        />
      </label>
    );
  };

  return <section className="panel panel--settings"><div className="section-heading"><span>ACCESSIBILITY + AUDIO</span><h2>SETTINGS</h2></div>
    <div className="settings-grid">
      {range('Master volume', settings.masterVolume, 'masterVolume')}
      {range('Effects volume', settings.effectsVolume, 'effectsVolume')}
      {range('Crowd volume', settings.crowdVolume, 'crowdVolume')}
      {range('Screen shake', settings.shake, 'shake')}
      {range('UI scale', settings.uiScale, 'uiScale', .85, 1.25, .05)}
      <label className="setting-row setting-row--select" htmlFor="setting-select-graphicsQuality">
        <span>Graphics quality<b>{settings.graphicsQuality.toUpperCase()}</b></span>
        <select id="setting-select-graphicsQuality" aria-label="Graphics quality" value={settings.graphicsQuality} onChange={(event) => settings.update({ graphicsQuality: event.target.value as typeof settings.graphicsQuality })}>
          <option value="auto">Auto · device tuned</option>
          <option value="performance">Performance · steadier frames</option>
          <option value="quality">Quality · richer arena</option>
        </select>
      </label>
      <label className="setting-row setting-row--select" htmlFor="setting-select-controlDeckMode">
        <span>Control deck<b>{settings.controlDeckMode.toUpperCase()}</b></span>
        <select id="setting-select-controlDeckMode" aria-label="Control deck" value={settings.controlDeckMode} onChange={(event) => settings.update({ controlDeckMode: event.target.value as typeof settings.controlDeckMode })}>
          <option value="full">Full · every control</option>
          <option value="compact">Compact · five primary actions</option>
          <option value="prompts">Prompts only · contextual feedback</option>
          <option value="hidden">Hidden · no coaching overlay</option>
        </select>
      </label>
      <label className="setting-row setting-row--select" htmlFor="setting-select-grappleGuide">
        <span>Grapple guide<b>{settings.grappleGuide.toUpperCase()}</b></span>
        <select id="setting-select-grappleGuide" aria-label="Grapple guide" value={settings.grappleGuide} onChange={(event) => settings.update({ grappleGuide: event.target.value as typeof settings.grappleGuide })}>
          <option value="full">Full · five directions</option>
          <option value="minimal">Minimal · current direction</option>
          <option value="off">Off · expert play</option>
        </select>
      </label>
      <label className="setting-row setting-row--select" htmlFor="setting-select-cameraCuts">
        <span>Camera cuts<b>{settings.cameraCuts.toUpperCase()}</b></span>
        <select id="setting-select-cameraCuts" aria-label="Camera cuts" value={settings.cameraCuts} onChange={(event) => settings.update({ cameraCuts: event.target.value as typeof settings.cameraCuts })}>
          <option value="full">Full · broadcast direction</option>
          <option value="reduced">Reduced · fewer cuts</option>
          <option value="off">Off · steady broadcast</option>
        </select>
      </label>
      <label className="toggle-row" htmlFor="setting-toggle-reducedMotion">
        <span><b>Reduced motion</b><small>Smoother camera, restrained effects</small></span>
        <input id="setting-toggle-reducedMotion" type="checkbox" checked={settings.reducedMotion} onChange={(event) => settings.update({ reducedMotion: event.target.checked })} />
      </label>
      <label className="toggle-row" htmlFor="setting-toggle-lowFlash">
        <span><b>Low flash</b><small>Fewer, dimmer impact strobes while keeping hit silhouettes</small></span>
        <input id="setting-toggle-lowFlash" type="checkbox" checked={settings.lowFlash} onChange={(event) => settings.update({ lowFlash: event.target.checked })} />
      </label>
      <label className="toggle-row" htmlFor="setting-toggle-highContrast">
        <span><b>High contrast</b><small>Brighter prompts, meter labels, and focus outlines</small></span>
        <input id="setting-toggle-highContrast" type="checkbox" checked={settings.highContrast} onChange={(event) => settings.update({ highContrast: event.target.checked })} />
      </label>
    </div>
    <div className="control-card"><b>CONTROL REFERENCE</b><span>WASD/D-pad move · Shift/RT sprint · C/L3 jump · J/X Circuit Jab (forward uppercut, back headbutt) · K/Y Piston Boot (directional kicks) · L/B Collar Lock (Voltage Slam default, direction for depth) · I/LT guard (hold) · Space/A dodge or counter · E/LB visible prop pickup/drop/swing/throw · F/R3 visible pin/climb/rope exit/return · Q/RB signature taunt · Esc pause</span></div>
    <div className="button-row">
      <button
        className={`button button--quiet ${confirmReset ? 'button--confirm-active' : ''}`}
        onClick={handleReset}
        aria-label={confirmReset ? 'Confirm reset of all settings to defaults' : 'Reset all saved settings to defaults'}
      >
        {confirmReset ? 'CONFIRM RESET?' : 'RESET SAVED SETTINGS'}
      </button>
      <button className="button" onClick={onBack}>DONE</button>
    </div>
  </section>;
}
