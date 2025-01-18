#version 300 es
precision highp float;

uniform float u_renderDistance;

in float v_distance;

out vec4 outColor;
void main() {
  outColor = vec4(vec3(min(v_distance / u_renderDistance, 1.0)), 1.0);
}
