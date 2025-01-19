import vsSource from './shaders/cross.vert?raw';
import fsSource from './shaders/cross.frag?raw';
import { Renderer } from './types';

const loadShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw 'Could not create shader!';
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = "An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw message;
  }

  return shader;
};

const initShaderProgram = (gl: WebGL2RenderingContext, vsSource: string, fsSource: string) => {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  if (!shaderProgram) {
    throw 'Could not create shader!';
  }
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(shaderProgram);
  }

  return shaderProgram;
};

export const createCrosshair = (gl: WebGL2RenderingContext): Renderer => {
  const program = initShaderProgram(gl, vsSource, fsSource);

  const buffers = { position: gl.createBuffer() };
  const screenFraction = 0.05;

  const initBuffers = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    const positions = [
      -screenFraction, 0.0, screenFraction, 0.0,
      0.0, -screenFraction, 0.0, screenFraction,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  };

  const render = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.BLEND);
    // gl.blendFunc(gl.ONE_MINUS_SRC_COLOR, gl.ZERO);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(attributes.position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attributes.position);
    gl.useProgram(program);
    const aspect = gl.canvas.height / gl.canvas.width;
    gl.uniform1f(uniforms.aspect, aspect);
    gl.drawArrays(gl.LINES, 0, 4);
    gl.disable(gl.BLEND);
  };

  const attributes = {
    position: gl.getAttribLocation(program, 'position'),
  };

  const uniforms = {
    aspect: gl.getUniformLocation(program, 'aspect'),
  };

  initBuffers();

  return {
    voxelData: new Uint8Array(),
    render,
    updateVoxel: () => {},
  };
};
