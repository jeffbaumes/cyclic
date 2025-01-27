import vertexShaderSource from './shaders/mesh.vert?raw';
import fragmentShaderSource from './shaders/mesh.frag?raw';
import { Renderer } from './types';
import { mat4, vec3 } from 'gl-matrix';
import { addQuad } from './quad';

const createMesh = (voxelData: Uint8Array, worldSize: number): {
  position: Float32Array,
  info: Uint32Array,
} => {
  const vertices: number[] = [];
  const infos: number[] = [];

  const getVoxel = (x: number, y: number, z: number) => {
    const wrappedX = (x + worldSize) % worldSize;
    const wrappedY = (y + worldSize) % worldSize;
    const wrappedZ = (z + worldSize) % worldSize;
    return voxelData[wrappedX + wrappedY * worldSize + wrappedZ * worldSize * worldSize];
  };

  // Marching cubes algorithm to generate mesh
  for (let z = 0; z < worldSize; z++) {
    for (let y = 0; y < worldSize; y++) {
      for (let x = 0; x < worldSize; x++) {
        const voxel = getVoxel(x, y, z);
        if (voxel > 0) {
          if (getVoxel(x - 1, y, z) === 0) {
            addQuad(
              vertices,
              infos,
              [x, y + 1, z],
              [x, y + 1, z + 1],
              [x, y, z + 1],
              [x, y, z],
              voxel,
              1 | 4,
            );
          }
          if (getVoxel(x + 1, y, z) === 0) {
            addQuad(
              vertices,
              infos,
              [x + 1, y + 1, z],
              [x + 1, y + 1, z + 1],
              [x + 1, y, z + 1],
              [x + 1, y, z],
              voxel,
              1,
            );
          }
          if (getVoxel(x, y - 1, z) === 0) {
            addQuad(
              vertices,
              infos,
              [x, y, z],
              [x + 1, y, z],
              [x + 1, y, z + 1],
              [x, y, z + 1],
              voxel,
              2 | 4,
            );
          }
          if (getVoxel(x, y + 1, z) === 0) {
            addQuad(
              vertices,
              infos,
              [x, y + 1, z],
              [x, y + 1, z + 1],
              [x + 1, y + 1, z + 1],
              [x + 1, y + 1, z],
              voxel,
              2,
            );
          }
          if (getVoxel(x, y, z - 1) === 0) {
            addQuad(
              vertices,
              infos,
              [x, y + 1, z],
              [x + 1, y + 1, z],
              [x + 1, y, z],
              [x, y, z],
              voxel,
              3 | 4,
            );
          }
          if (getVoxel(x, y, z + 1) === 0) {
            addQuad(
              vertices,
              infos,
              [x, y + 1, z + 1],
              [x + 1, y + 1, z + 1],
              [x + 1, y, z + 1],
              [x, y, z + 1],
              voxel,
              3,
            );
          }
        }
      }
    }
  }

  return {
    position: new Float32Array(vertices),
    info: new Uint32Array(infos),
  };
};

export const createMeshRenderer = async (gl: WebGL2RenderingContext, worldSize: number, voxelData: Uint8Array, emojiTexture: WebGLTexture): Promise<Renderer> => {
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
  const textureLocation = gl.getUniformLocation(program, 'u_texture');
  if (textureLocation === null) {
    throw new Error('Failed to get uniform location');
  }

  let { position, info } = createMesh(voxelData, worldSize);

  let positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, position, gl.STATIC_DRAW);

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

  let infoBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, infoBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, info, gl.STATIC_DRAW);

  const infoAttributeLocation = gl.getAttribLocation(program, 'a_info');
  gl.enableVertexAttribArray(infoAttributeLocation);
  gl.vertexAttribIPointer(infoAttributeLocation, 1, gl.UNSIGNED_INT, 0, 0);

  const updateVoxel = (index: number, value: number) => {
    voxelData[index] = value;
    const { position: newPosition, info: newInfo } = createMesh(voxelData, worldSize);

    gl.deleteBuffer(positionBuffer);
    const newPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, newPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, newPosition, gl.STATIC_DRAW);
    positionBuffer = newPositionBuffer;
    position = newPosition;

    gl.deleteBuffer(infoBuffer);
    const newInfoBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, newInfoBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, newInfo, gl.STATIC_DRAW);
    infoBuffer = newInfoBuffer;
    info = newInfo;
  };

  const render = (eye: vec3, lookDirection: vec3, renderDistance: number, _rayStep: number) => {
    gl.clearColor(0.5, 0.6, 0.7, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.BLEND);
    // gl.depthFunc(gl.LEQUAL);
    // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ZERO);

    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, infoBuffer);
    gl.enableVertexAttribArray(infoAttributeLocation);
    gl.vertexAttribIPointer(infoAttributeLocation, 1, gl.UNSIGNED_INT, 0, 0);

    const aspect = gl.canvas.width / gl.canvas.height;
    const projectionMatrix = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, renderDistance);
    const viewMatrix = mat4.lookAt(mat4.create(), eye, vec3.add(vec3.create(), eye, lookDirection), [0, 1, 0]);
    const modelViewProjectionMatrix = mat4.multiply(mat4.create(), projectionMatrix, viewMatrix);

    gl.uniformMatrix4fv(modelViewProjectionMatrixLocation, false, modelViewProjectionMatrix);
    gl.uniform1f(renderDistanceLocation, renderDistance);
    gl.uniform3fv(eyeLocation, eye);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, emojiTexture);
    gl.uniform1i(textureLocation, 0);

    for (let xOffset = Math.floor((eye[0] - renderDistance) / worldSize) * worldSize; xOffset < eye[0] + renderDistance; xOffset += worldSize) {
      for (let yOffset = Math.floor((eye[1] - renderDistance) / worldSize) * worldSize; yOffset < eye[1] + renderDistance; yOffset += worldSize) {
        for (let zOffset = Math.floor((eye[2] - renderDistance) / worldSize) * worldSize; zOffset < eye[2] + renderDistance; zOffset += worldSize) {
          gl.uniform3fv(offsetLocation, [xOffset, yOffset, zOffset]);
          gl.drawArrays(gl.TRIANGLES, 0, position.length / 3);
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
