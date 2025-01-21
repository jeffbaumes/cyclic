import { useEffect, useRef } from 'react';
import { vec3 } from 'gl-matrix';
import { createMeshRenderer } from './meshRenderer';
import { Renderer } from './types';
import { createCrosshair } from './crosshair';
import { createEntity, Entity } from './entity';
import { createEmojiTexture } from './emojiImage';
import { generateVoxelData } from './worldGenerator';

enum PlayMode {
  Normal,
  Fly,
}

const frac = (a: number) => {
  return a - Math.floor(a);
};
const mod = (a: number, n: number) => {
  return ((a % n) + n) % n;
};

function App() {
  const worldSize = 64;
  const playerHeight = 1.75;
  const playerEyeHeight = 1.6;
  const playerCorner = 0.1;
  const nudgeDistance = 0.01;
  const playerWidth = 0.5;
  const playerSpeed = 5.0;
  const fallSpeed = 20.0;
  const turnSpeed = 0.002;
  const playerAcceleration = 30.0;
  const jumpVelocity = 8.0;
  const gravity = -25.0;
  const up = vec3.fromValues(0, 1, 0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const entityRef = useRef<Entity | null>(null);
  const crosshairRef = useRef<Renderer | null>(null);
  const lastTimeRef = useRef<number>(0);
  const eyeRef = useRef(vec3.fromValues(0, 0.75 * worldSize, 0));
  const azimuthRef = useRef(0.0);
  const elevationRef = useRef(0.0);
  const velocityRef = useRef(vec3.create());
  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false, ' ': false });
  const forwardVelocityRef = useRef(0.0);
  const rightVelocityRef = useRef(0.0);
  const upVelocityRef = useRef(0.0);
  const onGroundRef = useRef(false);
  const playModeRef = useRef(PlayMode.Normal);

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
        azimuthRef.current -= event.movementX * turnSpeed;
        elevationRef.current = Math.max(-(Math.PI / 2 - 0.001), Math.min(Math.PI / 2 - 0.001, elevationRef.current - event.movementY * turnSpeed));
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
              const wrappedPos = pos.map(p => mod(Math.floor(p), worldSize));
              const index = wrappedPos[0] + wrappedPos[1] * worldSize + wrappedPos[2] * worldSize * worldSize;
              if (voxelData[index] > 0) {
                if (event.button === 0) {
                  renderer.updateVoxel(index, 0);
                } else if (event.button === 2 && prevIndex !== null) {
                  renderer.updateVoxel(prevIndex, 4);
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

      const contextMenuCallback = (ev: MouseEvent) => {
        ev.preventDefault();
        return false;
      };

      canvas.addEventListener('contextmenu', contextMenuCallback);
      canvas.addEventListener('mousedown', handleClick);
      document.addEventListener('mousemove', handleMouseMove);

      return () => {
        canvas.removeEventListener('contextmenu', contextMenuCallback);
        canvas.removeEventListener('mousedown', handleClick);
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const gl = canvas.getContext('webgl2');
        if (!gl) {
          console.error('WebGL2 is not available in your browser.');
          return;
        }

        const emoji = ['😊', '🌿', '🌳', '🐄', '🪵', '🪨'];
        const emojiTexture = await createEmojiTexture(gl, emoji, 4, 64);
        const emojiIndex = {} as Record<string, number>;
        emoji.map((emoji, index) => emojiIndex[emoji] = index);

        const voxelData = generateVoxelData(worldSize, emojiIndex);

        createMeshRenderer(gl, worldSize, voxelData, emojiTexture).then((renderer) => {
          rendererRef.current = renderer;
        });

        entityRef.current = createEntity(gl, worldSize, emojiTexture, 0);

        const crosshair = createCrosshair(gl);
        crosshairRef.current = crosshair;

        resizeCanvas(canvas, gl);

        const handleResize = () => resizeCanvas(canvas, gl);
        window.addEventListener('resize', handleResize);
        return () => {
          window.removeEventListener('resize', handleResize);
        };
      }
    };
    init();
  }, []);

  useEffect(() => {
    const collideRoundedBox = (position: vec3, size: vec3, corner: number) => {
      const point = vec3.create();
      const delta = vec3.create();
      for (let ax0 = 0; ax0 < 3; ax0 += 1) {
        const ax1 = (ax0 + 1)%3;
        const ax2 = (ax0 + 2)%3;
        for (let side = 0; side <= 1; side += 1) {
          const samples1 = Math.ceil(size[ax1] - 2*corner) + 1;
          const samples2 = Math.ceil(size[ax2] - 2*corner) + 1;
          const delta1 = (size[ax1] - 2*corner)/(samples1 - 1);
          const delta2 = (size[ax2] - 2*corner)/(samples2 - 1);
          for (let s1 = 0; s1 < samples1; s1 += 1) {
            point[ax1] = position[ax1] + corner + s1*delta1;
            for (let s2 = 0; s2 < samples2; s2 += 1) {
              point[ax0] = position[ax0] + side*size[ax0];
              point[ax2] = position[ax2] + corner + s2*delta2;
              // const type = this.world.getBlock(point);
              const voxelData = rendererRef.current?.voxelData;
              const index = Math.floor(mod(point[0], worldSize)) + Math.floor(mod(point[1], worldSize)) * worldSize + Math.floor(mod(point[2], worldSize)) * worldSize * worldSize;
              const type = voxelData ? voxelData[index] : 0;
              if (type !== 0 && type !== null) {
                let change = 0.0;
                if (side === 1) {
                  change = -(frac(point[ax0]) + nudgeDistance);
                } else {
                  change = (1.0 - frac(point[ax0])) + nudgeDistance;
                }
                position[ax0] += change;
                delta[ax0] += change;
              }
            }
          }
        }
      }
      return delta;
    };

    const movePlayer = (dt: number) => {
      const dv = dt * playerAcceleration;
      const rv = rightVelocityRef.current;
      const { w, a, s, d, shift, ' ': space } = keysRef.current;
      if (d) {
        rightVelocityRef.current = Math.min(rv + dv, playerSpeed);
      }
      if (a) {
        rightVelocityRef.current = Math.max(rv - dv, -playerSpeed);
      }
      if (!d && !a) {
        rightVelocityRef.current = Math.sign(rv)*Math.max(Math.abs(rv) - dv, 0.0);
      }

      const fv = forwardVelocityRef.current;
      if (w) {
        forwardVelocityRef.current = Math.min(fv + dv, playerSpeed);
      }
      if (s) {
        forwardVelocityRef.current = Math.max(fv - dv, -playerSpeed);
      }
      if (!w && !s) {
        forwardVelocityRef.current = Math.sign(fv)*Math.max(Math.abs(fv) - dv, 0.0);
      }

      const uv = upVelocityRef.current;
      if (playModeRef.current === PlayMode.Fly) {
        if (space) {
          upVelocityRef.current = Math.min(uv + dv, playerSpeed);
        }
        if (shift) {
          upVelocityRef.current = Math.max(uv - dv, -playerSpeed);
        }
        if (!space && !shift) {
          upVelocityRef.current = Math.sign(uv)*Math.max(Math.abs(uv) - dv, 0.0);
        }
      } else if (playModeRef.current === PlayMode.Normal) {
        if (!onGroundRef.current) {
          upVelocityRef.current = Math.max(uv + dt * gravity, -fallSpeed);
        }
        if (space) {
          if (onGroundRef.current) {
            upVelocityRef.current = jumpVelocity;
            onGroundRef.current = false;
          }
        }
      }

      const distanceEstimate = dt*Math.max(Math.abs(rightVelocityRef.current), Math.abs(forwardVelocityRef.current), Math.abs(upVelocityRef.current));
      const steps = Math.floor(distanceEstimate / (0.5*playerCorner)) + 1;
      const ddt = dt / steps;

      const forward = vec3.fromValues(
        Math.sin(azimuthRef.current),
        0,
        Math.cos(azimuthRef.current)
      );
      const right = vec3.fromValues(
        Math.sin(azimuthRef.current - Math.PI / 2),
        0,
        Math.cos(azimuthRef.current - Math.PI / 2)
      );

      for (let step = 0; step < steps; step += 1) {
        const rightMovement = vec3.clone(right);
        vec3.scale(rightMovement, rightMovement, ddt*rightVelocityRef.current);

        const forwardMovement = vec3.clone(forward);
        vec3.scale(forwardMovement, forwardMovement, ddt*forwardVelocityRef.current);

        const upMovement = vec3.clone(up);
        vec3.scale(upMovement, upMovement, ddt*upVelocityRef.current);

        vec3.zero(velocityRef.current);
        vec3.add(velocityRef.current, velocityRef.current, rightMovement);
        vec3.add(velocityRef.current, velocityRef.current, forwardMovement);
        vec3.add(velocityRef.current, velocityRef.current, upMovement);
        vec3.add(eyeRef.current, eyeRef.current, velocityRef.current);

        const foot = vec3.clone(eyeRef.current);
        foot[0] -= playerWidth / 2;
        foot[1] -= playerEyeHeight;
        foot[2] -= playerWidth / 2;
        const size = vec3.fromValues(playerWidth, playerHeight, playerWidth);

        const collisionDelta = collideRoundedBox(foot, size, playerCorner);
        vec3.add(eyeRef.current, eyeRef.current, collisionDelta);
        if (collisionDelta[1] > 0.0) {
          onGroundRef.current = true;
          if (playModeRef.current === PlayMode.Normal) {
            // This is needed to "keep you on the ground" and make sure
            // you keep getting pushed up to indicate you are on the ground
            upVelocityRef.current = -2.0;
          }
        } else {
          onGroundRef.current = false;
        }
        if (collisionDelta[1] < 0.0) {
          upVelocityRef.current = 0.0;
        }
      }
    }

    const update = (time: number) => {
      let deltaTime = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      while (deltaTime > 1.1/60.0) {
        movePlayer(1.1/60.0);
        deltaTime -= 1.1/60.0;
      }
      movePlayer(deltaTime);

      const lookDirection = vec3.fromValues(
        Math.cos(elevationRef.current) * Math.sin(azimuthRef.current),
        Math.sin(elevationRef.current),
        Math.cos(elevationRef.current) * Math.cos(azimuthRef.current)
      );

      if (rendererRef.current) {
        rendererRef.current.render(eyeRef.current, lookDirection, 150, 0.01);
      }
      if (entityRef.current) {
        entityRef.current.updatePosition(eyeRef.current);
        entityRef.current.render(eyeRef.current, lookDirection, 150, 0.01);
      }
      if (crosshairRef.current) {
        crosshairRef.current.render(eyeRef.current, lookDirection, 150, 0.01);
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
