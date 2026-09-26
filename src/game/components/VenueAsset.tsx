import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { useLoader } from '@react-three/fiber';
import { Mesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import completion from '../../../public/venue/completion/manifest.json';

export type VenueAssetKind = keyof typeof completion.assets;
export const venueAssets = completion.assets;
const tuple = (value: number[]): [number, number, number] => [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];

class AssetFallback extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function LoadedAsset({ kind }: { kind: VenueAssetKind }) {
  const asset = venueAssets[kind];
  const gltf = useLoader(GLTFLoader, asset.url);
  const scene = useMemo(() => {
    const instance = gltf.scene.clone(true);
    instance.traverse(node => { if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    return instance;
  }, [gltf]);
  // Instances own transforms; the loader cache owns shared materials and geometry.
  return <primitive object={scene} position={tuple(asset.position)} scale={tuple(asset.scale)} dispose={null} />;
}

export function VenueAsset({ kind, fallback = null }: { kind: VenueAssetKind; fallback?: ReactNode }) {
  return <AssetFallback key={kind} fallback={fallback}><Suspense fallback={fallback}><LoadedAsset kind={kind} /></Suspense></AssetFallback>;
}
