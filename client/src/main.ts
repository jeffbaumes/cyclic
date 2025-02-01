import { vec3 } from 'gl-matrix';
import { createMeshRenderer } from './meshRenderer';
import { createCrosshair } from './crosshair';
import { createEntity } from './entity';
import { createEmojiTexture } from './emojiImage';
import { Message, MessageType } from '../../shared/messages';
import { createLocalServerConnection, createWebSocketServerConnection, ServerConnection, User } from '../../shared/serverConnection';
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

let viewAngle = +(localStorage.getItem('viewAngle') || 90);
let conn = null as ServerConnection | null;
let username = '';
let world = null as string | null;
let renderer = null as Awaited<ReturnType<typeof createMeshRenderer>> | null;
let entities: { [token: string]: ReturnType<typeof createEntity> } = {};
let crosshair = null as ReturnType<typeof createCrosshair> | null;
let lastTime = 0;
let lastMoveUpdateTime = 0;
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
  if (document.pointerLockElement !== canvas) {
    return;
  }
  keys[event.key.toLowerCase()] = true;
};

const handleKeyUp = (event: KeyboardEvent) => {
  if (document.pointerLockElement !== canvas) {
    return;
  }
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
  if (!conn) {
    console.log('Connection is null');
    return;
  }
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
    const voxels = renderer?.voxels;
    if (renderer && voxels) {
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
        if (voxels[index] > 0) {
          if (event.button === 0) {
            conn.send({ type: MessageType.UpdateVoxel, index, value: 0 });
            renderer.updateVoxel(index, 0);
          } else if (event.button === 2 && prevIndex !== null && prevPos !== null) {
            const foot = vec3.clone(eye);
            foot[0] -= playerWidth / 2;
            foot[1] -= playerEyeHeight;
            foot[2] -= playerWidth / 2;
            const size = vec3.fromValues(playerWidth, playerHeight, playerWidth);
            if (!intersectAABB(foot, size, prevPos, vec3.fromValues(1, 1, 1))) {
              conn.send({ type: MessageType.UpdateVoxel, index: prevIndex, value: 4 });
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

  const worldDialog = document.getElementById('worldDialog') as HTMLDialogElement;
  const worldSelect = document.getElementById('worldSelect') as HTMLSelectElement;
  const joinWorldButton = document.getElementById('joinWorldButton') as HTMLButtonElement;
  const newWorldButton = document.getElementById('newWorldButton') as HTMLButtonElement;

  joinWorldButton.addEventListener('click', () => {
    const selectedWorld = worldSelect.value;
    if (selectedWorld && conn) {
      conn.send({ type: MessageType.JoinWorld, token: selectedWorld });
      worldDialog.close();
    }
  });

  newWorldButton.addEventListener('click', () => {
    if (conn) {
      conn.send({ type: MessageType.NewWorld });
      worldDialog.close();
    }
  });

  const serverDialog = document.getElementById('serverDialog') as HTMLDialogElement;
  const serverList = document.getElementById('serverList') as HTMLUListElement;
  const addServerButton = document.getElementById('addServerButton') as HTMLButtonElement;
  const joinServerButton = document.getElementById('joinServerButton') as HTMLButtonElement;
  const deleteServerButton = document.getElementById('deleteServerButton') as HTMLButtonElement;
  const playLocallyButton = document.getElementById('playLocallyButton') as HTMLButtonElement;
  const addServerDialog = document.getElementById('addServerDialog') as HTMLDialogElement;
  const serverNameInput = document.getElementById('serverNameInput') as HTMLInputElement;
  const saveServerButton = document.getElementById('saveServerButton') as HTMLButtonElement;

  const servers: {url: string, users: User[]}[] = JSON.parse(localStorage.getItem('servers') || '[]');
  const localUsers: User[] = JSON.parse(localStorage.getItem('localUsers') || '[]');
  let selectedServerIndex: number | null = null;

  const updateServerList = () => {
    serverList.innerHTML = '';
    servers.forEach((server, index) => {
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center p-2 bg-gray-600 rounded cursor-pointer';
      li.innerHTML = `<span>${server.url}</span>`;
      li.dataset.index = index.toString();
      li.addEventListener('click', () => {
        selectedServerIndex = index;
        document.querySelectorAll('#serverList li').forEach(li => li.classList.remove('bg-gray-500'));
        li.classList.add('bg-gray-500');
        joinServerButton.disabled = false;
        deleteServerButton.disabled = false;
      });
      serverList.appendChild(li);
    });
  };

  addServerButton.addEventListener('click', () => {
    addServerDialog.showModal();
  });

  saveServerButton.addEventListener('click', () => {
    const serverName = serverNameInput.value.trim();
    if (serverName) {
      servers.push({ url: serverName, users: [] });
      localStorage.setItem('servers', JSON.stringify(servers));
      updateServerList();
      addServerDialog.close();
      serverDialog.showModal();
    }
  });

  joinServerButton.addEventListener('click', async () => {
    if (selectedServerIndex !== null) {
      const server = servers[selectedServerIndex];
      conn = await createWebSocketServerConnection(server.url, onMessage);
      console.log(`Joining server: ${server.url}`);
      serverDialog.close();
      users = servers[selectedServerIndex].users;
      updateUserList();
      userDialog.showModal();
    }
  });

  deleteServerButton.addEventListener('click', () => {
    if (selectedServerIndex !== null) {
      servers.splice(selectedServerIndex, 1);
      localStorage.setItem('servers', JSON.stringify(servers));
      updateServerList();
      joinServerButton.disabled = true;
      deleteServerButton.disabled = true;
    }
  });

  playLocallyButton.addEventListener('click', () => {
    const worldStorage = createIndexedDBBlobStorage('worlds');
    const userStorage = createIndexedDBBlobStorage('users');
    conn = createLocalServerConnection(onMessage, (_world, m) => onMessage(m), worldStorage, userStorage);
    console.log('Playing locally');
    serverDialog.close();
    users = localUsers;
    updateUserList();
    userDialog.showModal();
  });


  const userDialog = document.getElementById('userDialog') as HTMLDialogElement;
  const userList = document.getElementById('userList') as HTMLUListElement;
  const addUserButton = document.getElementById('addUserButton') as HTMLButtonElement;
  const selectUserButton = document.getElementById('selectUserButton') as HTMLButtonElement;
  const deleteUserButton = document.getElementById('deleteUserButton') as HTMLButtonElement;
  const registerDialog = document.getElementById('registerDialog') as HTMLDialogElement;
  const usernameInput = document.getElementById('usernameInput') as HTMLInputElement;
  const registerButton = document.getElementById('registerButton') as HTMLButtonElement;

  let selectedUserIndex: number | null = null;
  let users: User[] = [];

  const updateUserList = () => {
    userList.innerHTML = '';
    users.forEach((user, index) => {
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center p-2 bg-gray-600 rounded cursor-pointer';
      li.innerHTML = `<span>${user.username}</span>`;
      li.dataset.index = index.toString();
      li.addEventListener('click', () => {
        selectedUserIndex = index;
        document.querySelectorAll('#userList li').forEach(li => li.classList.remove('bg-gray-500'));
        li.classList.add('bg-gray-500');
        selectUserButton.disabled = false;
        deleteUserButton.disabled = false;
      });
      userList.appendChild(li);
    });
  };

  addUserButton.addEventListener('click', () => {
    registerDialog.showModal();
  });

  registerButton.addEventListener('click', () => {
    if (conn) {
      registerDialog.close();
      conn.send({ type: MessageType.Register, username: usernameInput.value });
    }
  });

  selectUserButton.addEventListener('click', () => {
    if (selectedUserIndex !== null && conn !== null) {
      const token = users[selectedUserIndex].token;
      console.log(`Selected user: ${username}`);
      userDialog.close();
      conn.send({ type: MessageType.Login, token });
    }
  });

  deleteUserButton.addEventListener('click', () => {
    if (selectedUserIndex !== null) {
      users.splice(selectedUserIndex, 1);
      localStorage.setItem('servers', JSON.stringify(servers));
      localStorage.setItem('localUsers', JSON.stringify(localUsers));
      updateUserList();
      selectUserButton.disabled = true;
      deleteUserButton.disabled = true;
    }
  });


  const pauseDialog = document.getElementById('pauseDialog') as HTMLDialogElement;
  const viewAngleInput = document.getElementById('viewAngle') as HTMLInputElement;
  const resumeButton = document.getElementById('resumeButton') as HTMLButtonElement;
  const leaveWorldButton = document.getElementById('leaveWorldButton') as HTMLButtonElement;

  resumeButton.addEventListener('click', () => {
    pauseDialog.close();
    canvas.requestPointerLock();
  });

  leaveWorldButton.addEventListener('click', () => {
    pauseDialog.close();
    if (conn) {
      conn.send({ type: MessageType.LeaveWorld });
      world = null;
      renderer = null;
      entities = {};
      worldDialog.showModal();
    }
  });

  viewAngleInput.value = viewAngle.toString();
  viewAngleInput.addEventListener('input', () => {
    viewAngle = +viewAngleInput.value;
    localStorage.setItem('viewAngle', viewAngle.toString());
  });

  document.addEventListener('pointerlockchange', () => {
    console.log(document.pointerLockElement);
    if (document.pointerLockElement === canvas) {
      canvas.focus();
    } else {
      for (const key in keys) {
        keys[key] = false;
        pauseDialog.showModal();
      }
    }
  });

  updateServerList();
  serverDialog.showModal();

  const onMessage = async (m: Message) => {
    if (conn === null) {
      console.error('Connection is null');
      return;
    }
    switch (m.type) {
      case MessageType.LoginStatus:
        if (m.status === 'success') {
          if (users.find(u => u.username === m.username) === undefined) {
            users.push({ username: m.username, token: m.token });
            localStorage.setItem('servers', JSON.stringify(servers));
            localStorage.setItem('localUsers', JSON.stringify(localUsers));
            registerDialog.close();
            updateUserList();
            userDialog.showModal();
          } else {
            userDialog.close();
            username = m.username;
            conn.send({ type: MessageType.ListWorlds });
          }
        } else {
          console.log('Login failed');
        }
        break;
      case MessageType.WorldList:
        worldSelect.innerHTML = '';
        m.worlds.forEach(world => {
          const option = document.createElement('option');
          option.value = world;
          option.textContent = world;
          worldSelect.appendChild(option);
        });
        worldDialog.showModal();
        break;
      case MessageType.WorldData:
        if (m.world === null) {
          console.log('Could not load world');
          return;
        }
        world = m.world.token;
        renderer = await createMeshRenderer(gl, worldSize, m.world.voxels, emojiTexture);
        entities[username] = createEntity(gl, worldSize, emojiTexture, 0);
        break;
      case MessageType.UserJoined:
        if (!entities[m.username]) {
          entities[m.username] = createEntity(gl, worldSize, emojiTexture, 0);
        }
        console.log('User joined:', m.username);
        break;
      case MessageType.UserLeft:
        if (entities[m.username]) {
          delete entities[m.username];
        }
        console.log('User left:', m.username);
        break;
      case MessageType.UpdateVoxel:
        if (renderer) {
          renderer.updateVoxel(m.index, m.value);
        }
        break;
      case MessageType.UserMove:
        if (!entities[m.username]) {
          entities[m.username] = createEntity(gl, worldSize, emojiTexture, 0);
        }
        entities[m.username].updatePosition(vec3.fromValues(m.pos[0], m.pos[1], m.pos[2]));
        entities[m.username].updateLook(m.azimuth, m.elevation);
        break;
      default:
        console.log('Unhandled message:', m);
        break;
    }
  };

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
          const voxels = renderer?.voxels;
          const index = Math.floor(mod(point[0], worldSize)) + Math.floor(mod(point[1], worldSize)) * worldSize + Math.floor(mod(point[2], worldSize)) * worldSize * worldSize;
          const type = voxels ? voxels[index] : 0;
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

  if (!world) {
    requestAnimationFrame(update);
    return;
  }

  while (deltaTime > 1.1/60.0) {
    movePlayer(1.1/60.0);
    deltaTime -= 1.1/60.0;
  }
  movePlayer(deltaTime);

  let deltaMoveUpdateTime = time - lastMoveUpdateTime;
  if (deltaMoveUpdateTime > 1.0/10.0) {
    lastMoveUpdateTime = time;
    if (conn) {
      conn.send({
        type: MessageType.UserMove,
        username,
        pos: [eye[0], eye[1], eye[2]],
        azimuth,
        elevation,
        vel: [velocity[0], velocity[1], velocity[2]],
      });
    }
  }

  const lookDirection = vec3.fromValues(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth)
  );

  if (renderer) {
    renderer.render(eye, lookDirection, 150, viewAngle);
  }
  for (const name in entities) {
    if (name !== username) {
      const entity = entities[name];
      entity.render(eye, lookDirection, 150, viewAngle);
    }
  }
  if (crosshair) {
    crosshair.render();
  }

  requestAnimationFrame(update);
};

requestAnimationFrame(update);
