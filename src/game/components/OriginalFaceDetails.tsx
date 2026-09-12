import { useEffect, useMemo } from 'react';
import { CanvasTexture, DoubleSide, Path, SRGBColorSpace, Shape, ShapeGeometry } from 'three';
import type { FighterId } from '../types/game';
import assets from '../../../public/characters/manifest.json';

function Glasses({ dark = false, alien = false }: { dark?: boolean; alien?: boolean }) {
  const color = alien ? '#8eaf38' : '#45423c';
  return <group>
    {[-1, 1].map(side => <group key={side} position={[side * .036, 0, .012]} rotation={[0, side * -.1, alien ? side * .25 : 0]}>
      <mesh scale={[1.2, alien ? 1 : .76, 1]}><torusGeometry args={[.029, .002, 6, 24]} /><meshStandardMaterial color={color} metalness={.55} roughness={.35} /></mesh>
      {(dark || alien) && <mesh scale={[1.2, alien ? 1 : .76, .13]}><sphereGeometry args={[.028, 20, 12]} /><meshStandardMaterial color="#121919" metalness={.4} roughness={.22} /></mesh>}
      <mesh position={[side * .035, 0, -.035]}><boxGeometry args={[.0025, .003, .075]} /><meshStandardMaterial color={color} /></mesh>
    </group>)}
    <mesh position={[0, .004, .012]}><boxGeometry args={[.018, .003, .003]} /><meshStandardMaterial color={color} /></mesh>
  </group>;
}

function Beard({ blonde = false, full = false }: { blonde?: boolean; full?: boolean }) {
  const color = blonde ? '#a78b50' : '#35241d';
  return <group>
    <mesh position={[0, -.083, .028]} scale={[full ? .82 : .4, full ? .9 : .38, .25]}><sphereGeometry args={[.073, 24, 16]} /><meshStandardMaterial color={color} roughness={1} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * .026, -.04, .035]} rotation={[0, 0, side * -.17]} scale={[1, .29, .22]}><sphereGeometry args={[.033, 16, 8]} /><meshStandardMaterial color={color} roughness={1} /></mesh>)}
  </group>;
}

function Cap({ camouflage = false }: { camouflage?: boolean }) {
  return <group position={[0, .064, -.058]} rotation={[0, camouflage ? -.17 : -.1, 0]}>
    <mesh scale={[1, .8, 1.08]}><sphereGeometry args={[.105, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={camouflage ? '#696447' : '#686967'} roughness={.95} /></mesh>
    {camouflage && [-1, 1].map(side => <mesh key={side} position={[side * .052, .054, .035]} rotation={[0, side * .6, 0]} scale={[1, .6, .08]}><sphereGeometry args={[.041, 12, 8]} /><meshStandardMaterial color="#343d2b" roughness={1} /></mesh>)}
    <mesh position={[0, .006, .115]} scale={[1, .045, .7]} rotation={[.08, 0, 0]}><sphereGeometry args={[.1, 24, 12]} /><meshStandardMaterial color={camouflage ? '#51533b' : '#414441'} roughness={.95} /></mesh>
  </group>;
}

function ChefHat() {
  return <group position={[0, .08, -.06]}>
    <mesh><cylinderGeometry args={[.098, .094, .085, 24]} /><meshStandardMaterial color="#e9e5d5" roughness={1} /></mesh>
    <mesh position={[0, .103, 0]} scale={[1.25, .85, 1.15]}><sphereGeometry args={[.115, 24, 16]} /><meshStandardMaterial color="#f2eee0" roughness={1} /></mesh>
    {Array.from({ length: 7 }, (_, i) => <mesh key={i} position={[Math.sin(i / 7 * Math.PI * 2) * .088, .105, Math.cos(i / 7 * Math.PI * 2) * .088]} scale={[.7, 1, .7]}><sphereGeometry args={[.057, 12, 8]} /><meshStandardMaterial color="#ede9dd" roughness={1} /></mesh>)}
  </group>;
}

function FaceCloth({ mask = false }: { mask?: boolean }) {
  const geometry = useMemo(() => {
    const s = new Shape();
    if (mask) {
      s.absellipse(0, -.023, .085, .113, 0, Math.PI * 2, false, 0);
      for (const [x, y, rx, ry] of [[-.035, 0, .027, .021], [.035, 0, .027, .021], [0, -.071, .03, .022]] as const) {
        const hole = new Path(); hole.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, 0); s.holes.push(hole);
      }
    } else {
      s.moveTo(-.085, -.021); s.quadraticCurveTo(0, -.003, .085, -.021); s.lineTo(.045, -.076); s.lineTo(0, -.16); s.lineTo(-.045, -.076); s.closePath();
    }
    const g = new ShapeGeometry(s, 24); const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + .09) / .18, (uv.getY(i) + .17) / .28);
    return g;
  }, [mask]);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const c = canvas.getContext('2d'); if (c) {
      c.fillStyle = mask ? '#175c3e' : '#e5e1d2'; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = mask ? '#d8b15b' : '#34332e'; c.lineWidth = mask ? 8 : 3;
      if (mask) { c.strokeRect(8, 8, 240, 240); c.beginPath(); c.moveTo(128, 0); c.lineTo(128, 145); c.stroke(); }
      else for (let y = 20; y < 256; y += 40) for (let x = 20; x < 256; x += 40) {
        c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.moveTo(x, y - 7); c.lineTo(x, y + 7); c.stroke();
      }
    }
    const t = new CanvasTexture(canvas); t.colorSpace = SRGBColorSpace; return t;
  }, [mask]);
  useEffect(() => () => { geometry.dispose(); texture.dispose(); }, [geometry, texture]);
  return <mesh position={[0, 0, .024]} geometry={geometry}><meshStandardMaterial map={texture} side={DoubleSide} roughness={1} /></mesh>;
}

/** Identity cues use the exported eye landmark and inherit the solved head pose. */
export function OriginalFaceDetails({ fighterId }: { fighterId: FighterId }) {
  const asset = assets.fighters.find(f => f.id === fighterId); if (!asset) return null;
  const eye = asset.faceOffset;
  return <group position={[0, eye[1] ?? 0, eye[2] ?? 0]}>
    {(['steve', 'wrecking_ball', 'justin'] as FighterId[]).includes(fighterId) && <Glasses />}
    {fighterId === 'john' && <Glasses alien />}
    {fighterId === 'dale' && <><Glasses dark /><Cap /></>}
    {fighterId === 'gil' && <Cap camouflage />}
    {fighterId === 'justin' && <ChefHat />}
    {fighterId === 'sonny' && <FaceCloth />}
    {fighterId === 'mondo' && <><FaceCloth mask /><group position={[0, .081, -.056]}>
      {['#eeded1', '#d7b746', '#60a778', '#e48c83'].map((color, i) => <mesh key={color} position={[0, i * .016, 0]} rotation={[0, 0, -.13]} scale={[1, .19, 1]}><sphereGeometry args={[.11 - i * .007, 24, 12]} /><meshStandardMaterial color={color} roughness={1} /></mesh>)}
    </group></>}
    {(['thomas', 'dale', 'chad', 'john', 'justin'] as FighterId[]).includes(fighterId) && <Beard blonde={fighterId === 'thomas'} full={fighterId === 'thomas' || fighterId === 'dale'} />}
  </group>;
}
