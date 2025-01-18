import { useEffect, useRef } from 'react';
import { init, NaiveRayTracer } from './naiveRayTracer';

function App() {
  const worldSize = 16;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rayTracerRef = useRef<NaiveRayTracer | null>(null);
  const lastTimeRef = useRef<number>(0);
  const eyeRef = useRef([0.5, 0.5, -1.0]);
  const azimuthRef = useRef(0.0);
  const elevationRef = useRef(0.0);
  const velocityRef = useRef([0.0, 0.0, 0.0]);
  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false, ' ': false });

  const resizeCanvas = (canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) => {
    const pixelSize = 4;
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
        azimuthRef.current = azimuthRef.current + event.movementX * 0.01;
        elevationRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, elevationRef.current - event.movementY * 0.01));
      };

      const handleClick = (event: MouseEvent) => {
        if (document.pointerLockElement === canvas) {
          const renderer = rayTracerRef.current;
          const voxelData = rayTracerRef.current?.voxelData;
          if (renderer && voxelData) {
            let prevIndex: number | null = null;
            const lookDirection = [
              Math.cos(elevationRef.current) * Math.sin(azimuthRef.current),
              Math.sin(elevationRef.current),
              Math.cos(elevationRef.current) * Math.cos(azimuthRef.current)
            ];
            const step = 0.01;
            const reach = 20.0;
            for (let t = 0.0; t < reach; t += step) {
              const pos = [
                eyeRef.current[0] + t * lookDirection[0],
                eyeRef.current[1] + t * lookDirection[1],
                eyeRef.current[2] + t * lookDirection[2]
              ];
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

      const voxelData = new Uint8Array(worldSize * worldSize * worldSize);
      for (let i = 0; i < voxelData.length; i++) {
        voxelData[i] = Math.random() < 0.01 ? 255 : 0;
      }

      const rayTracer = init(gl, worldSize, voxelData);
      rayTracerRef.current = rayTracer;

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

      let newVelocity = [...velocityRef.current];
      const acceleration = 10;
      const deceleration = 5;
      if (keysRef.current.w) newVelocity[2] += acceleration * deltaTime;
      if (keysRef.current.s) newVelocity[2] -= acceleration * deltaTime;
      if (keysRef.current.a) newVelocity[0] += acceleration * deltaTime;
      if (keysRef.current.d) newVelocity[0] -= acceleration * deltaTime;
      if (keysRef.current[' ']) newVelocity[1] += acceleration * deltaTime;
      if (keysRef.current.shift) newVelocity[1] -= acceleration * deltaTime;

      newVelocity[0] *= 1 - deceleration * deltaTime;
      newVelocity[1] *= 1 - deceleration * deltaTime;
      newVelocity[2] *= 1 - deceleration * deltaTime;

      velocityRef.current = newVelocity;

      const lookDirection = [
        Math.cos(elevationRef.current) * Math.sin(azimuthRef.current),
        Math.sin(elevationRef.current),
        Math.cos(elevationRef.current) * Math.cos(azimuthRef.current),
      ];
      const forwardDirection = [
        Math.sin(azimuthRef.current),
        0,
        Math.cos(azimuthRef.current),
      ];
      const rightDirection = [
        Math.sin(azimuthRef.current - Math.PI / 2),
        0,
        Math.cos(azimuthRef.current - Math.PI / 2),
      ];

      const newEye = [
        eyeRef.current[0] + (forwardDirection[0] * newVelocity[2] + rightDirection[0] * newVelocity[0]) * deltaTime,
        eyeRef.current[1] + newVelocity[1] * deltaTime,
        eyeRef.current[2] + (forwardDirection[2] * newVelocity[2] + rightDirection[2] * newVelocity[0]) * deltaTime,
      ];
      eyeRef.current = newEye;

      if (rayTracerRef.current) {
        rayTracerRef.current.render(newEye, lookDirection, 100.0, 0.01);
      }

      requestAnimationFrame(update);
    };

    requestAnimationFrame(update);
  }, []);

  return (
    <div className="w-screen h-screen flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full"></canvas>
    </div>
  );
}

export default App;
