import { useEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { WORLD_OBSTACLES } from './showground';

export function WorldSign({ text, position, width = 4, color = '#f2deac' }: { text: string; position: [number, number, number]; width?: number; color?: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.fillStyle = '#242c27'; ctx.fillRect(0, 0, 1024, 192); ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 1008, 176); ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 66px sans-serif'; ctx.fillText(text, 512, 100, 960); }
    const result = new CanvasTexture(canvas); result.colorSpace = SRGBColorSpace; return result;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position}><planeGeometry args={[width, width * .1875]} /><meshBasicMaterial map={texture} /></mesh>;
}
function Box({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.88} /></mesh>;
}
export function ShowgroundEnvironment() {
  const grass = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#657844'; ctx.fillRect(0, 0, 128, 128);
      let seed = 741;
      const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 3500; i++) { ctx.fillStyle = i % 2 ? '#788859' : '#526536'; ctx.globalAlpha = .22 + noise() * .2; ctx.fillRect(noise() * 128, noise() * 128, 1, 1 + noise() * 3); }
    }
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(65, 65); return texture;
  }, []);
  useEffect(() => () => grass.dispose(), [grass]);
  return <>
    <color attach="background" args={['#c3c8b4']} /><fog attach="fog" args={['#c3c8b4', 38, 83]} />
    <hemisphereLight args={['#fff2cc', '#657a47', 2]} />
    <directionalLight position={[-15, 26, 12]} color="#ffdb9c" intensity={3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32} shadow-normalBias={.06} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[170, 170]} /><meshStandardMaterial map={grass} roughness={1} /></mesh>
    <Box position={[0, -.012, 0]} size={[5, .05, 54]} color="#a99b77" />
    <Box position={[-7, 0, -3]} size={[14, .035, 4]} color="#a99b77" />
    <Box position={[8, 0, -2.5]} size={[16, .035, 4]} color="#a99b77" />
    <Box position={[-13.5, .015, -14]} size={[15, .05, 14]} color="#7d8278" />
    <Box position={[11, .025, -10]} size={[17, .05, 15]} color="#a59473" />
    {WORLD_OBSTACLES.filter(o => !o.id.startsWith('picnic') && o.id !== 'lockers').map(o => <Box key={o.id} position={[o.x, (o.id.includes('door') ? 1.2 : o.height) / 2, o.z]} size={[o.halfX * 2, o.id.includes('door') ? 1.2 : o.height, o.halfZ * 2]} color={o.color} />)}
    {WORLD_OBSTACLES.filter(o => o.id.startsWith('picnic')).map(o => <group key={o.id} position={[o.x, 0, o.z]}>
      {[-.6, -.3, 0, .3, .6].map(z => <Box key={z} position={[0, .78, z]} size={[3.9, .09, .27]} color="#98714d" />)}
      {[-.85, .85].map(z => <group key={z}><Box position={[0, .42, z]} size={[3.9, .09, .28]} color="#a78058" />{[-1.4, 1.4].map(x => <Box key={x} position={[x, .25, z]} size={[.13, .5, .13]} color="#534d40" />)}</group>)}
      {[-1.4, 1.4].map(x => <Box key={x} position={[x, .4, 0]} size={[.15, .8, 1.6]} color="#605039" />)}
    </group>)}
    <group position={[16.8, 0, 17.5]}>
      <Box position={[-.55, 1.72, 1.61]} size={[3.4, 1.05, .04]} color="#263735" />
      <Box position={[-.55, 1.17, 1.84]} size={[3.65, .09, .55]} color="#c9bf9f" />
      <Box position={[-.55, 2.5, 1.83]} size={[4.15, .12, .65]} color="#e4c697" />
      <Box position={[2.25, 1.9, 1.62]} size={[1.1, .8, .04]} color="#465d5f" />
      {[-2.1, 2.1].flatMap(x => [-1.4, 1.4].map(z => <mesh key={`${x}-${z}`} position={[x, .4, z]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.46, .46, .32, 16]} /><meshStandardMaterial color="#272b2b" roughness={.95} /></mesh>))}
    </group>
    {[-19.8, -18.8, -17.8].map(x => <group key={x} position={[x, 0, -20.3]}><Box position={[0, 1, 0]} size={[.86, 2, .55]} color="#485d65" /><Box position={[.28, 1.05, .3]} size={[.07, .22, .04]} color="#c2bda9" />{[1.5, 1.62, 1.74].map(y => <Box key={y} position={[0, y, .28]} size={[.55, .035, .02]} color="#273b42" />)}</group>)}
    <Box position={[11, 1.23, -10]} size={[11.8, .06, 9.25]} color="#c4c1a9" />
    {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x},${z}`} position={[11 + x * 5.8, 0, -10 + z * 4.5]}>
      <Box position={[0, 1.9, 0]} size={[.18, 3.8, .18]} color="#393b3a" />
      {[1.75, 2.35, 2.95].map(y => <Box key={y} position={[0, y, 0]} size={[.45, .26, .4]} color={x < 0 ? '#a94236' : '#436783'} />)}
    </group>))}
    {[1.75, 2.35, 2.95].flatMap(y => [-1, 1].flatMap(side => [
      <Box key={`${y}-${side}-x`} position={[11, y, -10 + side * 4.5]} size={[11.6, .055, .055]} color="#ddd0ae" />,
      <Box key={`${y}-${side}-z`} position={[11 + side * 5.8, y, -10]} size={[.055, .055, 9]} color="#ddd0ae" />,
    ]))}
    <WorldSign text="FRWF • MAIN EVENT" position={[11, 4.5, -15.4]} width={9} />
    <WorldSign text="BACKSTAGE FIGHT CLUB" position={[-13.5, 3.2, -20.6]} width={8} />
    <WorldSign text="BURGERS / BAD DECISIONS" position={[16.8, 2.95, 19.13]} width={5.8} />
    <WorldSign text="FRWF SHOWGROUND" position={[0, 6.5, 27.5]} width={8} />
    {[-4.5, 4.5].map(x => <Box key={x} position={[x, 3.3, 27.5]} size={[.25, 6.6, .25]} color="#564a36" />)}
    {Array.from({ length: 26 }, (_, i) => {
      const x = i % 2 ? -27 - i % 3 : 27 + i % 4; const z = -29 + Math.floor(i / 2) * 4.7;
      return <group key={i} position={[x, 0, z]}><Box position={[0, 2, 0]} size={[.55, 4, .55]} color="#5b5140" /><mesh position={[0, 5, 0]} castShadow><icosahedronGeometry args={[2.6 + i % 3 * .3, 1]} /><meshStandardMaterial color={i % 2 ? '#425b36' : '#536b3d'} roughness={1} /></mesh></group>;
    })}
    {[-24.5, 24.5].map(x => <group key={x}>{Array.from({ length: 14 }, (_, i) => <Box key={i} position={[x, .75, -25 + i * 4]} size={[.14, 1.5, .14]} color="#6c614b" />)}{[.5, 1.15].map(y => <Box key={y} position={[x, y, 1]} size={[.1, .1, 54]} color="#897759" />)}</group>)}
    {[-25.5, 27.5].map(z => <Box key={z} position={[0, .6, z]} size={[49, 1.2, .12]} color="#897759" />)}
    {[-5, 5].flatMap(x => [4, 16].map(z => <group key={`${x}-${z}`} position={[x, 0, z]}><Box position={[0, 2.7, 0]} size={[.09, 5.4, .09]} color="#524a3c" /><mesh position={[0, 5.25, 0]}><sphereGeometry args={[.12, 8, 6]} /><meshBasicMaterial color="#ffe6a2" /></mesh></group>))}
    {[4, 16].map(z => <Box key={z} position={[0, 5.25, z]} size={[10, .025, .025]} color="#524a3c" />)}
    {[4, 16].flatMap(z => [-4, -2, 0, 2, 4].map(x => <mesh key={`${x}-${z}`} position={[x, 5.15 - (1 - Math.abs(x) / 5) * .28, z]}><sphereGeometry args={[.075, 8, 6]} /><meshBasicMaterial color="#fff0bd" /></mesh>))}
  </>;
}
