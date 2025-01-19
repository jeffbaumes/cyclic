import { useEffect, useRef } from 'react';
import { vec3 } from 'gl-matrix';
import { init } from './meshRenderer';
import { Renderer } from './types';
import { makeNoise3D, makeNoise4D } from 'open-simplex-noise';
import { createCrosshair } from './crosshair';

function App() {
  const worldSize = 64;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const crosshairRef = useRef<Renderer | null>(null);
  const lastTimeRef = useRef<number>(0);
  const eyeRef = useRef(vec3.fromValues(0.5, 0.5, -1.0));
  const azimuthRef = useRef(0.0);
  const elevationRef = useRef(0.0);
  const velocityRef = useRef(vec3.create());
  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false, ' ': false });

  const resizeCanvas = (canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) => {
    const pixelSize = 1;
    const displayWidth = canvas.clientWidth / pixelSize;
    const displayHeight = canvas.clientHeight / pixelSize;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      keysRef.current = { ...keysRef.current, [event.key.toLowerCase()]: true };
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current = { ...keysRef.current, [event.key.toLowerCase()]: false };
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const handleMouseMove = (event: MouseEvent) => {
        if (document.pointerLockElement !== canvas) {
          return;
        }
        azimuthRef.current -= event.movementX * 0.002;
        elevationRef.current = Math.max(-(Math.PI / 2 - 0.001), Math.min(Math.PI / 2 - 0.001, elevationRef.current - event.movementY * 0.005));
      };

      const handleClick = (event: MouseEvent) => {
        if (document.pointerLockElement === canvas) {
          const renderer = rendererRef.current;
          const voxelData = rendererRef.current?.voxelData;
          if (renderer && voxelData) {
            let prevIndex: number | null = null;
            const lookDirection = vec3.fromValues(
              Math.cos(elevationRef.current) * Math.sin(azimuthRef.current),
              Math.sin(elevationRef.current),
              Math.cos(elevationRef.current) * Math.cos(azimuthRef.current)
            );
            const step = 0.01;
            const reach = 20.0;
            for (let t = 0.0; t < reach; t += step) {
              const pos = vec3.scaleAndAdd(vec3.create(), eyeRef.current, lookDirection, t);
              const wrappedPos = pos.map(p => ((Math.floor(p) % worldSize) + worldSize) % worldSize); // Ensure positive values
              const index = wrappedPos[0] + wrappedPos[1] * worldSize + wrappedPos[2] * worldSize * worldSize;
              if (voxelData[index] > 0) {
                if (event.button === 0) {
                  renderer.updateVoxel(index, 0);
                } else if (event.button === 2 && prevIndex !== null) {
                  renderer.updateVoxel(prevIndex, 255);
                }
                break;
              }
              prevIndex = index;
            }
          }
        } else {
          canvas.requestPointerLock();
        }
      };

      canvas.addEventListener('click', handleClick);
      document.addEventListener('mousemove', handleMouseMove);

      return () => {
        canvas.removeEventListener('click', handleClick);
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const gl = canvas.getContext('webgl2');
      if (!gl) {
        console.error('WebGL2 is not available in your browser.');
        return;
      }

      const noise = makeNoise3D(Date.now());
      const noise4 = makeNoise4D(Date.now());
      const voxelData = new Uint8Array(worldSize * worldSize * worldSize);
      const scale = 0.001 * worldSize;
      let worldType: string = 'terrain';
      const heightScale = 10;
      for (let x = 0; x < worldSize; x++) {
        for (let y = 0; y < worldSize; y++) {
          for (let z = 0; z < worldSize; z++) {
            const xa = scale * Math.cos(x / worldSize * Math.PI * 2);
            const ya = scale * Math.cos(y / worldSize * Math.PI * 2);
            const za = scale * Math.cos(z / worldSize * Math.PI * 2);
            const xb = scale * Math.sin(x / worldSize * Math.PI * 2);
            const yb = scale * Math.sin(y / worldSize * Math.PI * 2);
            const zb = scale * Math.sin(z / worldSize * Math.PI * 2);
            const index = x + y * worldSize + z * worldSize * worldSize;
            if (worldType === 'blob') {
              let nx = 0;
              let ny = 0;
              let nz = 0;
              nx += xa;
              ny += xb / Math.SQRT2;
              nz += xb / Math.SQRT2;
              ny += ya;
              nx += yb / Math.SQRT2;
              nz += yb / Math.SQRT2;
              nz += za;
              nx += zb / Math.SQRT2;
              ny += zb / Math.SQRT2;
              const value = noise(nx, ny, nz);
              voxelData[index] = value > 0.0 ? 255 : 0;
            } else if (worldType === 'terrain') {
              const height = noise4(xa, xb, za, zb) * heightScale + worldSize / 2;
              voxelData[index] = y < height ? 255 : 0;
            }
          }
        }
      }

      init(gl, worldSize, voxelData).then((renderer) => {
        rendererRef.current = renderer;
      });

      const crosshair = createCrosshair(gl);
      crosshairRef.current = crosshair;

      resizeCanvas(canvas, gl);

      const handleResize = () => resizeCanvas(canvas, gl);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  useEffect(() => {
    const update = (time: number) => {
      const deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      const newVelocity = vec3.clone(velocityRef.current);
      const acceleration = 40;
      const deceleration = 5;
      if (keysRef.current.w) newVelocity[2] += acceleration * deltaTime;
      if (keysRef.current.s) newVelocity[2] -= acceleration * deltaTime;
      if (keysRef.current.a) newVelocity[0] += acceleration * deltaTime;
      if (keysRef.current.d) newVelocity[0] -= acceleration * deltaTime;
      if (keysRef.current[' ']) newVelocity[1] += acceleration * deltaTime;
      if (keysRef.current.shift) newVelocity[1] -= acceleration * deltaTime;

      vec3.scale(newVelocity, newVelocity, 1 - deceleration * deltaTime);
      velocityRef.current = newVelocity;

      const lookDirection = vec3.fromValues(
        Math.cos(elevationRef.current) * Math.sin(azimuthRef.current),
        Math.sin(elevationRef.current),
        Math.cos(elevationRef.current) * Math.cos(azimuthRef.current)
      );
      const forwardDirection = vec3.fromValues(
        Math.sin(azimuthRef.current),
        0,
        Math.cos(azimuthRef.current)
      );
      const rightDirection = vec3.fromValues(
        Math.sin(azimuthRef.current + Math.PI / 2),
        0,
        Math.cos(azimuthRef.current + Math.PI / 2)
      );

      const newEye = vec3.clone(eyeRef.current);
      vec3.scaleAndAdd(newEye, newEye, forwardDirection, newVelocity[2] * deltaTime);
      vec3.scaleAndAdd(newEye, newEye, rightDirection, newVelocity[0] * deltaTime);
      vec3.scaleAndAdd(newEye, newEye, [0, 1, 0], newVelocity[1] * deltaTime);
      eyeRef.current = newEye;

      if (rendererRef.current) {
        rendererRef.current.render(newEye, lookDirection, 150, 0.01);
      }
      if (crosshairRef.current) {
        crosshairRef.current.render(newEye, lookDirection, 150, 0.01);
      }

      requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  }, []);

  return (
    <div className="w-screen h-screen flex items-center justify-center absolute top-0 left-0">
      <canvas ref={canvasRef} className="w-full h-full"></canvas>
    </div>
  );
}

export default App;
