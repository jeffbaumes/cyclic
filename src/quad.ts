export const addQuad = (vertices: number[], infos: number[], v1: number[], v2: number[], v3: number[], v4: number[], t: number, n: number) => {
  vertices.push(...v1, ...v2, ...v3, ...v3, ...v4, ...v1);

  const texCoordsX = [0, 1, 1, 1, 0, 0];
  const texCoordsY = [0, 0, 1, 1, 1, 0];
  const lights = [15, 15, 15, 15, 15, 15];
  const sunlights = [15, 15, 15, 15, 15, 15];
  const occlusions = [3, 3, 3, 3, 3, 3];

  for (let i = 0; i < 6; i++) {
    let info = t;
    info = (info << 4) | lights[i];
    info = (info << 4) | sunlights[i];
    info = (info << 3) | n;
    info = (info << 5) | texCoordsX[i];
    info = (info << 5) | texCoordsY[i];
    info = (info << 2) | occlusions[i];
    infos.push(info);
  }
};
