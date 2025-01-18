import { vec3 } from 'gl-matrix';

export type Renderer = {
  voxelData: Uint8Array;
  render: (eye: vec3, lookDirection: vec3, renderDistance: number, rayStep: number) => void;
  updateVoxel: (index: number, value: number) => void;
};
