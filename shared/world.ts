
import { makeNoise3D, makeNoise4D } from 'open-simplex-noise';

const generateVoxelData = (worldSize: number, emojiIndex: Record<string, number>): Uint8Array => {
  const noise = makeNoise3D(Date.now());
  const noise4 = makeNoise4D(Date.now());
  const voxelData = new Uint8Array(worldSize * worldSize * worldSize);
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

  return voxelData;
};

export const generateWorld = (worldSize: number) => {
  const emoji = ['😊', '🌿', '🌳', '🐄', '🪵', '🪨'];
  const emojiIndex = {} as Record<string, number>;
  emoji.map((emoji, index) => emojiIndex[emoji] = index);

  const voxels = generateVoxelData(worldSize, emojiIndex);

  return {
    token: Math.random().toString(36).slice(2),
    voxels,
    users: {},
  }
}
