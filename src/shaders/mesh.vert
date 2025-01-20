#version 300 es
in vec3 a_position;
in uint a_info;
uniform mat4 u_modelViewProjectionMatrix;
uniform vec3 u_eye;
uniform vec3 u_offset;
uniform sampler2D u_texture;

out float v_distance;
out float v_lightLevel;
out vec2 v_texCoord;

void main() {
  // 2 bits occlusion
  // 5 bits multipleY
  // 5 bits multipleX
  // 3 bits normal
  // 4 bits sunlight
  // 4 bits light
  // 9 bits material
  uint info = a_info;
  uint occlusion = info % (1u << 2u);
  info = info >> 2u;
  uint multipleY = info % (1u << 5u);
  info = info >> 5u;
  uint multipleX = info % (1u << 5u);
  info = info >> 5u;
  vec2 texCoord = vec2(float(multipleX), float(multipleY));
  vec3 normal = vec3(0.);
  int normalIndex = int(info % (1u << 3u));
  if (normalIndex >= 4) {
    normal[normalIndex - 4 - 1] = -1.;
  } else {
    normal[normalIndex - 1] = 1.;
  }
  info = info >> 3u;
  uint sunlight = info % (1u << 4u);
  info = info >> 4u;
  uint light = info % (1u << 4u);
  info = info >> 4u;
  uint texIndex = info;

  vec3 pos = a_position + u_offset;
  gl_Position = u_modelViewProjectionMatrix * vec4(pos, 1.0);
  v_distance = length(pos - u_eye);
  vec2 texSize = floor(vec2(textureSize(u_texture, 0)) / 64.0);
  vec2 texOffset = vec2(mod(float(texIndex), texSize.x), floor(float(texIndex) / texSize.x));
  float inset = 1.0 / 64.0;
  vec2 texInset = -(texCoord * 2.0 - 1.0) * inset;
  v_texCoord = (texOffset + texCoord + texInset) / texSize;
  // float sun = (sin(radians(360.0 * (time - 6.0) / 24.0)) + 1.0) / 2.0;
  float sun = 1.0;
  v_lightLevel = max(
    (float(light) + 5.0) / 20.0,
    (sun * float(sunlight) + 5.0) / 20.0
  ) * (0.5 + 0.5 * (float(occlusion) / 3.0) * (0.5 * (dot(normal, normalize(vec3(1., 1.5, 0.5))) + 1.0)));
}
