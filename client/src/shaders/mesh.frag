#version 300 es
precision highp float;

uniform float u_renderDistance;
uniform sampler2D u_texture;

in float v_distance;
in vec2 v_texCoord;
in float v_lightLevel;

out vec4 outColor;

void main() {
  float dist = max(0.0, min(1.0, 4.0 * v_distance / u_renderDistance - 3.0));
  vec4 textureColor = texture(u_texture, v_texCoord);
  if (textureColor.a < 0.5) {
    discard;
  }
  vec3 sky = vec3(0.5, 0.6, 0.7);
  outColor = dist * vec4(sky, 1.0) + (1.0 - dist) * vec4(textureColor.rgb * v_lightLevel, textureColor.a);
}
