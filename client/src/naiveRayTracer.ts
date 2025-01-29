import vertexShaderSource from './shaders/world.vert?raw';
import fragmentShaderSource from './shaders/world.frag?raw';
import { Renderer } from './types';
import { vec3 } from 'gl-matrix';

export const init = (gl: WebGL2RenderingContext, worldSize: number, voxels: Uint8Array): Renderer => {
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

  const eyeUniformLocation = gl.getUniformLocation(program, 'u_eye');
  const lookDirectionUniformLocation = gl.getUniformLocation(program, 'u_lookDirection');
  const renderDistanceUniformLocation = gl.getUniformLocation(program, 'u_renderDistance');
  const rayStepUniformLocation = gl.getUniformLocation(program, 'u_rayStep');
  const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, worldSize, worldSize, worldSize, 0, gl.RED, gl.UNSIGNED_BYTE, voxels);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positions = [
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
  ];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  if (!eyeUniformLocation || !lookDirectionUniformLocation || !renderDistanceUniformLocation || !rayStepUniformLocation || !resolutionUniformLocation) {
    throw new Error('Failed to get uniform location');
  }

  const updateVoxel = (index: number, value: number) => {
    voxels[index] = value;
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.texSubImage3D(gl.TEXTURE_3D, 0, index % worldSize, Math.floor(index / worldSize) % worldSize, Math.floor(index / (worldSize * worldSize)), 1, 1, 1, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([value]));
  };

  const render = (eye: vec3, lookDirection: vec3, renderDistance: number, rayStep: number) => {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(eyeUniformLocation, eye);
    gl.uniform3fv(lookDirectionUniformLocation, lookDirection);
    gl.uniform1f(renderDistanceUniformLocation, renderDistance);
    gl.uniform1f(rayStepUniformLocation, rayStep);
    gl.uniform2f(resolutionUniformLocation, gl.canvas.width, gl.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  return {
    voxels,
    render,
    updateVoxel,
  };
};
