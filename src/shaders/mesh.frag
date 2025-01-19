#version 300 es
precision highp float;

uniform float u_renderDistance;
uniform sampler2D u_texture;

in float v_distance;
in vec2 v_texCoord;

out vec4 outColor;

void main() {
  float dist = max(0.0, min(1.0, 4.0 * v_distance / u_renderDistance - 3.0));
  vec4 textureColor = texture(u_texture, v_texCoord);
  // outColor = (0.001 * textureColor) + vec4(vec3(min(v_distance / u_renderDistance, 1.0)), 1.0);
  // outColor = textureColor * vec4(vec3(min(v_distance / u_renderDistance, 1.0)), 1.0);
  outColor = dist * vec4(vec3(1.0), 0.0) + (1.0 - dist) * textureColor;
}
