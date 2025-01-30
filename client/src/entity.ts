import vertexShaderSource from './shaders/mesh.vert?raw';
import fragmentShaderSource from './shaders/mesh.frag?raw';
import { Renderer } from './types';
import { mat4, vec3 } from 'gl-matrix';
import { addQuad } from './quad';

const createMesh = (texture: number): {
  position: Float32Array,
  info: Uint32Array,
} => {
  const vertices: number[] = [];
  const infos: number[] = [];

  const size = 1.0;
  const baseX = -0.5;
  const baseY = -0.5;
  const baseZ = -0.5;

  addQuad(
    vertices,
    infos,
    [baseX, baseY + size, baseZ],
    [baseX, baseY + size, baseZ + size],
    [baseX, baseY, baseZ + size],
    [baseX, baseY, baseZ],
    texture,
    1 | 4,
  );
  addQuad(
    vertices,
    infos,
    [baseX + size, baseY + size, baseZ],
    [baseX + size, baseY + size, baseZ + size],
    [baseX + size, baseY, baseZ + size],
    [baseX + size, baseY, baseZ],
    texture,
    1,
  );
  addQuad(
    vertices,
    infos,
    [baseX, baseY, baseZ],
    [baseX + size, baseY, baseZ],
    [baseX + size, baseY, baseZ + size],
    [baseX, baseY, baseZ + size],
    texture,
    2 | 4,
  );
  addQuad(
    vertices,
    infos,
    [baseX, baseY + size, baseZ],
    [baseX, baseY + size, baseZ + size],
    [baseX + size, baseY + size, baseZ + size],
    [baseX + size, baseY + size, baseZ],
    texture,
    2,
  );
  addQuad(
    vertices,
    infos,
    [baseX, baseY + size, baseZ],
    [baseX + size, baseY + size, baseZ],
    [baseX + size, baseY, baseZ],
    [baseX, baseY, baseZ],
    texture,
    3 | 4,
  );
  addQuad(
    vertices,
    infos,
    [baseX, baseY + size, baseZ + size],
    [baseX + size, baseY + size, baseZ + size],
    [baseX + size, baseY, baseZ + size],
    [baseX, baseY, baseZ + size],
    texture,
    3,
  );

  return {
    position: new Float32Array(vertices),
    info: new Uint32Array(infos),
  };
};

export type Entity = Renderer & {
  updatePosition: (position: vec3) => void;
  updateLook: (azimuth: number, altitude: number) => void;
};

export const createEntity = (gl: WebGL2RenderingContext, worldSize: number, emojiTexture: WebGLTexture, texture: number): Entity => {
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
  const rotationLocation = gl.getUniformLocation(program, 'u_rotation');
  if (rotationLocation === null) {
    throw new Error('Failed to get uniform location');
  }
  const textureLocation = gl.getUniformLocation(program, 'u_texture');
  if (textureLocation === null) {
    throw new Error('Failed to get uniform location');
  }

  let entityPosition = vec3.create();
  let entityRotation = mat4.identity(mat4.create());

  let { position, info } = createMesh(texture);

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

  const canonicalPos = (pos: vec3, worldSize: number): vec3 => {
    return pos.map(p => ((p % worldSize) + worldSize) % worldSize) as vec3;
  }

  const updatePosition = (pos: vec3) => {
    entityPosition = canonicalPos(pos, worldSize);
  };

  const updateLook = (azimuth: number, elevation: number) => {
    entityRotation = mat4.rotateY(mat4.create(), mat4.create(), azimuth);
    entityRotation = mat4.rotateX(entityRotation, entityRotation, -elevation);
  };

  const render = (eye: vec3, lookDirection: vec3, renderDistance: number, _rayStep: number) => {
    eye = canonicalPos(eye, worldSize);

    gl.enable(gl.BLEND);

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

    gl.uniformMatrix4fv(rotationLocation, false, entityRotation);

    for (let xOffset = Math.floor((eye[0] - renderDistance) / worldSize) * worldSize; xOffset < eye[0] + renderDistance; xOffset += worldSize) {
      for (let yOffset = Math.floor((eye[1] - renderDistance) / worldSize) * worldSize; yOffset < eye[1] + renderDistance; yOffset += worldSize) {
        for (let zOffset = Math.floor((eye[2] - renderDistance) / worldSize) * worldSize; zOffset < eye[2] + renderDistance; zOffset += worldSize) {
          gl.uniform3fv(offsetLocation, [
            xOffset + entityPosition[0],
            yOffset + entityPosition[1],
            zOffset + entityPosition[2],
          ]);
          gl.drawArrays(gl.TRIANGLES, 0, position.length / 3);
        }
      }
    }
  };

  return {
    voxels: new Uint8Array(),
    updateVoxel: () => {},
    render,
    updatePosition,
    updateLook,
  };
};
