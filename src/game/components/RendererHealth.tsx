import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

/** Surface a GPU interruption instead of leaving a blank, interactive fight. */
export function RendererHealth({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onLost(); };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, onLost, onRestored]);
  return null;
}
