#version 300 es
precision lowp float;

uniform float aspect;
in vec2 position;

void main(void) {
  gl_Position = vec4(position.x*aspect, position.y, 0.0, 1.0);
}
