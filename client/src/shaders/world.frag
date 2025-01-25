#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 u_resolution;
uniform highp sampler3D u_voxelData;
uniform vec3 u_eye;
uniform vec3 u_lookDirection;
uniform float u_renderDistance;
uniform float u_rayStep;

void main() {
  vec2 st = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  st.x *= u_resolution.x / u_resolution.y; // Correct aspect ratio
  vec3 rayOrigin = u_eye;
  vec3 forward = normalize(u_lookDirection);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  mat3 lookAt = mat3(right, up, forward);
  vec3 rayDirection = normalize(lookAt * vec3(st, 1.0)); // Rotate st into the direction of lookDirection
  float worldSize = float(textureSize(u_voxelData, 0).x);

  for (float t = u_rayStep; t < u_renderDistance; t *= (1.0 + u_rayStep)) {
    vec3 pos = rayOrigin + t * rayDirection;
    ivec3 texelPos = ivec3(floor(pos));
    ivec3 wrappedTexelPos = ivec3(mod(float(texelPos.x), worldSize),
                                  mod(float(texelPos.y), worldSize),
                                  mod(float(texelPos.z), worldSize));
    if (texelFetch(u_voxelData, wrappedTexelPos, 0).r == 1.0) {
      float c = t / u_renderDistance;
      outColor = vec4(vec3(c), 1.0);
      return;
    }
  }

  outColor = vec4(1.0, 1.0, 1.0, 1.0);
}
