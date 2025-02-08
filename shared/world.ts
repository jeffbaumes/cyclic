
import { makeNoise3D, makeNoise4D } from 'open-simplex-noise';

export const frac = (a: number) => {
  return a - Math.floor(a);
};

export const mod = (a: number, n: number) => {
  return ((a % n) + n) % n;
};

export const getVoxel = (voxels: Uint8Array | Float32Array, worldSize: number, x: number, y: number, z: number) => {
  return voxels[mod(x, worldSize) + mod(y, worldSize) * worldSize + mod(z, worldSize) * worldSize * worldSize];
};

export const setVoxel = (voxels: Uint8Array | Float32Array, worldSize: number, x: number, y: number, z: number, value: number) => {
  voxels[mod(x, worldSize) + mod(y, worldSize) * worldSize + mod(z, worldSize) * worldSize * worldSize] = value;
};

const generateVoxelData = (worldSize: number, emojiIndex: Record<string, number>) => {
  const noise = makeNoise3D(Date.now());
  const noise4 = makeNoise4D(Date.now());
  const voxelData = new Uint8Array(worldSize * worldSize * worldSize);
  const water = new Float32Array(worldSize * worldSize * worldSize);
  const scale = 0.01 * worldSize;
  const heightScale = 10;
  const worldType: string = 'terrain';

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
          voxelData[index] = value > 0.0 ? emojiIndex['🌳'] : 0;
        } else if (worldType === 'terrain') {
          const height = noise4(xa, xb, za, zb) * heightScale + worldSize / 2;
          let m = 0;
          if (y < height) {
            m = emojiIndex['🌿'];
          }
          if (y < height - 1) {
            m = emojiIndex['🪨'];
          }
          voxelData[index] = m;
        }
      }
    }
  }

  return { voxels: voxelData, water };
};

export const generateWorld = (worldSize: number) => {
  const emoji = ['😊', '🌿', '🌳', '🐄', '🪵', '🪨'];
  const emojiIndex = {} as Record<string, number>;
  emoji.map((emoji, index) => emojiIndex[emoji] = index);

  const { voxels, water } = generateVoxelData(worldSize, emojiIndex);

  return {
    token: Math.random().toString(36).slice(2),
    voxels,
    water,
    users: {},
  }
}

export const stepWater = (world: Uint8Array, water: Float32Array, worldSize: number, newWater: Float32Array) => {
  // Flow parameters:
  const minFlow = 0.01;   // minimum amount of water to move
  const gravity = 2;      // extra multiplier for downward flow
  const maxWater = 1;     // maximum water per cell

  // copy water data into newWater
  newWater.set(water);

  for (let x = 0; x < worldSize; x++) {
    for (let y = 0; y < worldSize; y++) {
      for (let z = 0; z < worldSize; z++) {
        // Only update non-solid (empty) voxels.
        const cell = getVoxel(world, worldSize, x, y, z);
        if (cell !== 0) continue;
        let currentWater = getVoxel(water, worldSize, x, y, z);
        if (currentWater <= 0) continue;

        // 1. **Downward Flow** (simulate gravity)
        let yDown = y - 1; // assume lower y is "down"
        if (getVoxel(world, worldSize, x, yDown, z) === 0) {  // only flow into non-solid blocks
          let available = maxWater - getVoxel(water, worldSize, x, yDown, z);
          if (available > minFlow) {
            // Transfer as much water as possible.
            // Multiply by gravity to bias downward flow.
            let flow = Math.min(currentWater, available) * gravity;
            // (You might want to clamp flow so it doesn't exceed currentWater.)
            flow = Math.min(flow, currentWater);
            setVoxel(newWater, worldSize, x, y, z, getVoxel(water, worldSize, x, y, z) - flow);
            setVoxel(newWater, worldSize, x, yDown, z, getVoxel(water, worldSize, x, yDown, z) + flow);
            currentWater -= flow;
          }
        }
        if (currentWater <= 0) continue;

        // 2. **Horizontal Flow**
        // Consider 4 neighbors (east, west, north, south) on the same y-level.
        const directions = [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 0, 1],
          [0, 0, -1]
        ];
        // Compute the total “difference” so we know how to distribute water.
        let totalDiff = 0;
        const diffs = []; // will hold info about neighbors that can receive water
        for (let d = 0; d < directions.length; d++) {
          let nx = mod(x + directions[d][0], worldSize);
          let ny = y; // same vertical level
          let nz = mod(z + directions[d][2], worldSize);
          if (getVoxel(world, worldSize, nx, ny, nz) !== 0) continue;
          let diff = currentWater - getVoxel(water, worldSize, nx, ny, nz);
          if (diff > minFlow) {
            diffs.push({ nx, ny, nz, diff });
            totalDiff += diff;
          }
        }
        // Distribute water in proportion to the difference.
        for (let i = 0; i < diffs.length; i++) {
          let n = diffs[i];
          let portion = currentWater * (n.diff / totalDiff);
          // Make sure not to remove more water than is available.
          portion = Math.min(portion, currentWater);
          setVoxel(newWater, worldSize, x, y, z, getVoxel(water, worldSize, x, y, z) - portion);
          setVoxel(newWater, worldSize, n.nx, n.ny, n.nz, getVoxel(water, worldSize, n.nx, n.ny, n.nz) + portion);
          currentWater -= portion;
        }
      }
    }
  }

  return newWater;
}
