import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, PlaneGeometry, SRGBColorSpace } from 'three';
import { useMatchStore } from '../state/matchStore';
import { useSettings } from '../state/settings';

/** One continuous canvas: impacts flex the cloth without opening gaps between tiles. */
export function WrestlingMat() {
  const geometry = useMemo(() => new PlaneGeometry(11.3, 8.3, 36, 28), []);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 768;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#afb4b5'; ctx.fillRect(0, 0, 1024, 768);
      let seed = 1948; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 26000; i++) { ctx.fillStyle = i % 2 ? '#ece8da' : '#67737b'; ctx.globalAlpha = .08 + random() * .12; ctx.fillRect(random() * 1024, random() * 768, 1 + random() * 2, 1); }
      ctx.globalAlpha = .18; ctx.strokeStyle = '#5d666a'; ctx.lineWidth = 1;
      for (let x = 3; x < 1024; x += 5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 768); ctx.stroke(); }
      ctx.globalAlpha = .55; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.strokeRect(24, 24, 976, 720); ctx.setLineDash([]);
      ctx.globalAlpha = .78; ctx.strokeStyle = '#38454b'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(512, 384, 186, 173, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#39464b'; ctx.font = '900 italic 104px sans-serif'; ctx.fillText('FRWF', 508, 374);
      ctx.font = 'bold 17px sans-serif'; ctx.fillText('ORIGINALS  •  EST. IN THE BACKYARD', 512, 445);
      ctx.font = 'bold 21px sans-serif'; ctx.fillText('VOLT DOME', 512, 69);
      ctx.save(); ctx.translate(512, 699); ctx.rotate(Math.PI); ctx.fillText('CHAOS CIRCUIT', 0, 0); ctx.restore();
      for (let i = 0; i < 140; i++) { ctx.globalAlpha = .025 + random() * .045; ctx.strokeStyle = '#3b4142'; ctx.lineWidth = 1 + random() * 2; const x = random() * 1024; const y = random() * 768; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 42 - 21, y + random() * 16); ctx.stroke(); }
    }
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; map.anisotropy = 4; return map;
  }, []);
  useEffect(() => () => { geometry.dispose(); texture.dispose(); }, [geometry, texture]);
  const last = useRef(0); const age = useRef(10); const center = useRef({ x: 0, z: 0 }); const strength = useRef(0);
  useFrame((_, dt) => {
    const model = useMatchStore.getState().model; if (model.paused) return;
    const impact = model.lastImpact;
    if (impact && impact.id !== last.current) {
      last.current = impact.id;
      const contactY = impact.contactPoint?.[1];
      const onMat = contactY !== undefined && contactY < 2.15 && contactY > 1.6;
      if (onMat && Math.abs(impact.position.x) < 5.65 && Math.abs(impact.position.z) < 4.15) {
        age.current = 0; center.current = impact.position;
        strength.current = useSettings.getState().reducedMotion ? 0 : Math.min(.035, impact.intensity * .018);
      }
    }
    if (age.current > 1.5) return;
    age.current += Math.min(dt, .05);
    const positions = geometry.getAttribute('position'); const decay = Math.exp(-age.current * 6);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i); const z = -positions.getY(i);
      const distance = Math.hypot(x - center.current.x, z - center.current.z);
      const edge = Math.min(1, (5.65 - Math.abs(x)) * 3, (4.15 - Math.abs(z)) * 3);
      positions.setZ(i, -strength.current * Math.cos(distance * 4 - age.current * 22) * Math.exp(-distance * 1.2) * decay * Math.max(0, edge));
    }
    positions.needsUpdate = true;
  });
  return <mesh geometry={geometry} position={[0, 1.85, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <meshStandardMaterial map={texture} roughness={.96} metalness={0} />
  </mesh>;
}
