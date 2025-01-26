import { vec3 } from 'gl-matrix';
import { createMeshRenderer } from './meshRenderer';
import { Renderer } from './types';
import { createCrosshair } from './crosshair';
import { createEntity, Entity } from './entity';
import { createEmojiTexture } from './emojiImage';
import { Message, MessageType } from '../../shared/messages';
import { createLocalServerConnection, createWebSocketServerConnection } from '../../shared/serverConnection';
import { createIndexedDBBlobStorage } from './storage';
import './index.css';


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
const vec3mod = (out: vec3, a: vec3, n: number) => {
  out[0] = mod(a[0], n);
  out[1] = mod(a[1], n);
  out[2] = mod(a[2], n);
  return out;
}

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

const canvas = document.getElementById('canvas') as HTMLCanvasElement;

let renderer = null as Renderer | null;
let entity = null as Entity | null;
let crosshair = null as Renderer | null;
let lastTime = 0;
let eye = vec3.fromValues(0, 0.75 * worldSize, 0);
let azimuth = 0.0;
let elevation = 0.0;
let velocity = vec3.create();
const keys: { [key: string]: boolean } = {};
let forwardVelocity = 0.0;
let rightVelocity = 0.0;
let upVelocity = 0.0;
let onGround = false;
let playMode = PlayMode.Normal as PlayMode;

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

const handleKeyDown = (event: KeyboardEvent) => {
  keys[event.key.toLowerCase()] = true;
};

const handleKeyUp = (event: KeyboardEvent) => {
  keys[event.key.toLowerCase()] = false;
};

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

const handleMouseMove = (event: MouseEvent) => {
  if (document.pointerLockElement !== canvas) {
    return;
  }
  azimuth -= event.movementX * turnSpeed;
  elevation = Math.max(-(Math.PI / 2 - 0.001), Math.min(Math.PI / 2 - 0.001, elevation - event.movementY * turnSpeed));
};

const handleClick = (event: MouseEvent) => {
  const intersectAABB = (position: vec3, size: vec3, otherPosition: vec3, otherSize: vec3) => {
    const closestOtherPosition = vec3.clone(otherPosition);
    for (let ax = 0; ax < 3; ax += 1) {
      const diff = position[ax] - otherPosition[ax];
      if (Math.abs(diff) > worldSize / 2) {
        closestOtherPosition[ax] += Math.sign(diff) * worldSize;
      }
    }
    for (let ax = 0; ax < 3; ax += 1) {
      const a0 = position[ax];
      const a1 = a0 + size[ax];
      const b0 = closestOtherPosition[ax];
      const b1 = b0 + otherSize[ax];
      if (a0 > b1 || a1 < b0) {
        return false;
      }
    }
    return true;
  };

  if (document.pointerLockElement === canvas) {
    const voxelData = renderer?.voxelData;
    if (renderer && voxelData) {
      let prevIndex: number | null = null;
      let prevPos: vec3 | null = null;
      const lookDirection = vec3.fromValues(
        Math.cos(elevation) * Math.sin(azimuth),
        Math.sin(elevation),
        Math.cos(elevation) * Math.cos(azimuth)
      );
      const step = 0.01;
      const reach = 20.0;
      for (let t = 0.0; t < reach; t += step) {
        const pos = vec3.scaleAndAdd(vec3.create(), eye, lookDirection, t);
        const wrappedPos = vec3mod(vec3.create(), vec3.floor(vec3.create(), pos), worldSize);
        const index = wrappedPos[0] + wrappedPos[1] * worldSize + wrappedPos[2] * worldSize * worldSize;
        if (voxelData[index] > 0) {
          if (event.button === 0) {
            renderer.updateVoxel(index, 0);
          } else if (event.button === 2 && prevIndex !== null && prevPos !== null) {
            const foot = vec3.clone(eye);
            foot[0] -= playerWidth / 2;
            foot[1] -= playerEyeHeight;
            foot[2] -= playerWidth / 2;
            const size = vec3.fromValues(playerWidth, playerHeight, playerWidth);
            if (!intersectAABB(foot, size, prevPos, vec3.fromValues(1, 1, 1))) {
              renderer.updateVoxel(prevIndex, 4);
            }
          }
          break;
        }
        prevPos = vec3.clone(wrappedPos);
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

const init = async () => {
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    console.error('WebGL2 is not available in your browser.');
    return;
  }

  const emoji = ['😊', '🌿', '🌳', '🐄', '🪵', '🪨'];
  const emojiTexture = await createEmojiTexture(gl, emoji, 4, 64);
  const emojiIndex = {} as Record<string, number>;
  emoji.map((emoji, index) => emojiIndex[emoji] = index);

  const onMessage = (m: Message) => {
    console.log(m);
    if (m.type !== MessageType.WorldData) {
      console.error('Unexpected message type:', m.type);
      return;
    }
    createMeshRenderer(gl, worldSize, m.world.voxelData, emojiTexture).then((r) => {
      renderer = r;
    });
  };

  let conn = null;
  try {
    conn = await createWebSocketServerConnection('ws://localhost:8080', onMessage);
    conn.send({ type: MessageType.NewWorld });
    console.log('Connected to server');
  } catch (e) {
    const worlds = createIndexedDBBlobStorage('worlds');
    const users = createIndexedDBBlobStorage('users');
    conn = createLocalServerConnection(onMessage, worlds, users);
    conn.send({ type: MessageType.NewWorld });
    console.log('Connected to local server');
  }

  entity = createEntity(gl, worldSize, emojiTexture, 0);

  crosshair = createCrosshair(gl);

  resizeCanvas(canvas, gl);

  const handleResize = () => resizeCanvas(canvas, gl);
  window.addEventListener('resize', handleResize);
};

init();

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
          const voxelData = renderer?.voxelData;
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
  const rv = rightVelocity;
  const { w, a, s, d, shift, ' ': space } = keys;
  if (d) {
    rightVelocity = Math.min(rv + dv, playerSpeed);
  }
  if (a) {
    rightVelocity = Math.max(rv - dv, -playerSpeed);
  }
  if (!d && !a) {
    rightVelocity = Math.sign(rv)*Math.max(Math.abs(rv) - dv, 0.0);
  }

  const fv = forwardVelocity;
  if (w) {
    forwardVelocity = Math.min(fv + dv, playerSpeed);
  }
  if (s) {
    forwardVelocity = Math.max(fv - dv, -playerSpeed);
  }
  if (!w && !s) {
    forwardVelocity = Math.sign(fv)*Math.max(Math.abs(fv) - dv, 0.0);
  }

  const uv = upVelocity;
  if (playMode === PlayMode.Fly) {
    if (space) {
      upVelocity = Math.min(uv + dv, playerSpeed);
    }
    if (shift) {
      upVelocity = Math.max(uv - dv, -playerSpeed);
    }
    if (!space && !shift) {
      upVelocity = Math.sign(uv)*Math.max(Math.abs(uv) - dv, 0.0);
    }
  } else if (playMode === PlayMode.Normal) {
    if (!onGround) {
      upVelocity = Math.max(uv + dt * gravity, -fallSpeed);
    }
    if (space) {
      if (onGround) {
        upVelocity = jumpVelocity;
        onGround = false;
      }
    }
  }

  const distanceEstimate = dt*Math.max(Math.abs(rightVelocity), Math.abs(forwardVelocity), Math.abs(upVelocity));
  const steps = Math.floor(distanceEstimate / (0.5*playerCorner)) + 1;
  const ddt = dt / steps;

  const forward = vec3.fromValues(
    Math.sin(azimuth),
    0,
    Math.cos(azimuth)
  );
  const right = vec3.fromValues(
    Math.sin(azimuth - Math.PI / 2),
    0,
    Math.cos(azimuth - Math.PI / 2)
  );

  for (let step = 0; step < steps; step += 1) {
    const rightMovement = vec3.clone(right);
    vec3.scale(rightMovement, rightMovement, ddt*rightVelocity);

    const forwardMovement = vec3.clone(forward);
    vec3.scale(forwardMovement, forwardMovement, ddt*forwardVelocity);

    const upMovement = vec3.clone(up);
    vec3.scale(upMovement, upMovement, ddt*upVelocity);

    vec3.zero(velocity);
    vec3.add(velocity, velocity, rightMovement);
    vec3.add(velocity, velocity, forwardMovement);
    vec3.add(velocity, velocity, upMovement);
    vec3.add(eye, eye, velocity);
    vec3mod(eye, eye, worldSize);

    const foot = vec3.clone(eye);
    foot[0] -= playerWidth / 2;
    foot[1] -= playerEyeHeight;
    foot[2] -= playerWidth / 2;
    const size = vec3.fromValues(playerWidth, playerHeight, playerWidth);

    const collisionDelta = collideRoundedBox(foot, size, playerCorner);
    vec3.add(eye, eye, collisionDelta);
    if (collisionDelta[1] > 0.0) {
      onGround = true;
      if (playMode === PlayMode.Normal) {
        upVelocity = -2.0;
      }
    } else {
      onGround = false;
    }
    if (collisionDelta[1] < 0.0) {
      upVelocity = 0.0;
    }
  }
}

const update = (time: number) => {
  let deltaTime = (time - lastTime) / 1000;
  lastTime = time;

  while (deltaTime > 1.1/60.0) {
    movePlayer(1.1/60.0);
    deltaTime -= 1.1/60.0;
  }
  movePlayer(deltaTime);

  const lookDirection = vec3.fromValues(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth)
  );

  if (renderer) {
    renderer.render(eye, lookDirection, 150, 0.01);
  }
  if (entity) {
    entity.updatePosition(eye);
    entity.render(eye, lookDirection, 150, 0.01);
  }
  if (crosshair) {
    crosshair.render(eye, lookDirection, 150, 0.01);
  }

  requestAnimationFrame(update);
};

requestAnimationFrame(update);
