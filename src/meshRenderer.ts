import vertexShaderSource from './shaders/mesh.vert?raw';
import fragmentShaderSource from './shaders/mesh.frag?raw';
import { Renderer } from './types';
import { mat4, vec3 } from 'gl-matrix';

const createMesh = (voxelData: Uint8Array, worldSize: number): Float32Array => {
  const vertices: number[] = [];
  const getVoxel = (x: number, y: number, z: number) => {
    const wrappedX = (x + worldSize) % worldSize;
    const wrappedY = (y + worldSize) % worldSize;
    const wrappedZ = (z + worldSize) % worldSize;
    return voxelData[wrappedX + wrappedY * worldSize + wrappedZ * worldSize * worldSize];
  };

  const addQuad = (v1: number[], v2: number[], v3: number[], v4: number[]) => {
    vertices.push(...v1, ...v2, ...v3, ...v3, ...v4, ...v1);
  };

  // Marching cubes algorithm to generate mesh
  for (let z = 0; z < worldSize; z++) {
    for (let y = 0; y < worldSize; y++) {
      for (let x = 0; x < worldSize; x++) {
        const voxel = getVoxel(x, y, z);
        if (voxel > 0) {
          const size = 1.0;
          const baseX = x * size;
          const baseY = y * size;
          const baseZ = z * size;

          // Check each face of the voxel
          if (getVoxel(x - 1, y, z) === 0) {
            addQuad(
              [baseX, baseY, baseZ],
              [baseX, baseY + size, baseZ],
              [baseX, baseY + size, baseZ + size],
              [baseX, baseY, baseZ + size]
            );
          }
          if (getVoxel(x + 1, y, z) === 0) {
            addQuad(
              [baseX + size, baseY, baseZ],
              [baseX + size, baseY, baseZ + size],
              [baseX + size, baseY + size, baseZ + size],
              [baseX + size, baseY + size, baseZ]
            );
          }
          if (getVoxel(x, y - 1, z) === 0) {
            addQuad(
              [baseX, baseY, baseZ],
              [baseX + size, baseY, baseZ],
              [baseX + size, baseY, baseZ + size],
              [baseX, baseY, baseZ + size]
            );
          }
          if (getVoxel(x, y + 1, z) === 0) {
            addQuad(
              [baseX, baseY + size, baseZ],
              [baseX, baseY + size, baseZ + size],
              [baseX + size, baseY + size, baseZ + size],
              [baseX + size, baseY + size, baseZ]
            );
          }
          if (getVoxel(x, y, z - 1) === 0) {
            addQuad(
              [baseX, baseY, baseZ],
              [baseX, baseY + size, baseZ],
              [baseX + size, baseY + size, baseZ],
              [baseX + size, baseY, baseZ]
            );
          }
          if (getVoxel(x, y, z + 1) === 0) {
            addQuad(
              [baseX, baseY, baseZ + size],
              [baseX + size, baseY, baseZ + size],
              [baseX + size, baseY + size, baseZ + size],
              [baseX, baseY + size, baseZ + size]
            );
          }
        }
      }
    }
  }

  return new Float32Array(vertices);
};

export const init = (gl: WebGL2RenderingContext, worldSize: number, voxelData: Uint8Array): Renderer => {
  const createShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) {
      console.error('Failed to create shader');
      return null;
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const createProgram = (gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
    const program = gl.createProgram();
    if (!program) {
      console.error('Failed to create program');
      return null;
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  };

  gl.enable(gl.DEPTH_TEST);

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  if (!vertexShader) {
    throw new Error('Failed to create vertex shader');
  }
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!fragmentShader) {
    throw new Error('Failed to create fragment shader');
  }
  const program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) {
    throw new Error('Failed to create program');
  }

  const modelViewProjectionMatrixLocation = gl.getUniformLocation(program, 'u_modelViewProjectionMatrix');
  if (modelViewProjectionMatrixLocation === null) {
    throw new Error('Failed to get uniform location');
  }
  const renderDistanceLocation = gl.getUniformLocation(program, 'u_renderDistance');
  if (renderDistanceLocation === null) {
    throw new Error('Failed to get uniform location');
  }
  const eyeLocation = gl.getUniformLocation(program, 'u_eye');
  if (eyeLocation === null) {
    throw new Error('Failed to get uniform location');
  }
  const offsetLocation = gl.getUniformLocation(program, 'u_offset');
  if (offsetLocation === null) {
    throw new Error('Failed to get uniform location');
  }

  let mesh = createMesh(voxelData, worldSize);
  let meshBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

  const updateVoxel = (index: number, value: number) => {
    voxelData[index] = value;
    const updatedMesh = createMesh(voxelData, worldSize);
    gl.deleteBuffer(meshBuffer);
    const newMeshBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, newMeshBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, updatedMesh, gl.STATIC_DRAW);
    meshBuffer = newMeshBuffer;
    mesh = updatedMesh;
  };

  const render = (eye: vec3, lookDirection: vec3, renderDistance: number, _rayStep: number) => {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    const aspect = gl.canvas.width / gl.canvas.height;
    const projectionMatrix = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, renderDistance);
    const viewMatrix = mat4.lookAt(mat4.create(), eye, vec3.add(vec3.create(), eye, lookDirection), [0, 1, 0]);
    const modelViewProjectionMatrix = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);

    gl.uniformMatrix4fv(modelViewProjectionMatrixLocation, false, modelViewProjectionMatrix);
    gl.uniform1f(renderDistanceLocation, renderDistance);
    gl.uniform3fv(eyeLocation, eye);

    for (let xOffset = Math.floor((eye[0] - renderDistance) / worldSize) * worldSize; xOffset < eye[0] + renderDistance; xOffset += worldSize) {
      for (let yOffset = Math.floor((eye[1] - renderDistance) / worldSize) * worldSize; yOffset < eye[1] + renderDistance; yOffset += worldSize) {
        for (let zOffset = Math.floor((eye[2] - renderDistance) / worldSize) * worldSize; zOffset < eye[2] + renderDistance; zOffset += worldSize) {
          gl.uniform3fv(offsetLocation, [xOffset, yOffset, zOffset]);
          gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 3);
        }
      }
    }
  };

  return {
    voxelData,
    render,
    updateVoxel,
  };
};
