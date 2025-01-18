
export type Renderer = {
  voxelData: Uint8Array;
  render: (eye: number[], lookDirection: number[], renderDistance: number, rayStep: number) => void;
  updateVoxel: (index: number, value: number) => void;
};
