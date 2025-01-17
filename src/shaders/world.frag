#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 u_resolution;
uniform highp sampler3D u_voxelData;
uniform vec3 u_eye;
uniform vec3 u_lookDirection;

void main() {
  vec2 st = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
  st.x *= u_resolution.x / u_resolution.y; // Correct aspect ratio
  vec3 rayOrigin = u_eye;
  vec3 forward = normalize(u_lookDirection);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  mat3 lookAt = mat3(right, up, forward);
  vec3 rayDirection = normalize(lookAt * vec3(st, 1.0)); // Rotate st into the direction of lookDirection

  for (float t = 0.0; t < 5.0; t += 0.005) {
    vec3 pos = rayOrigin + t * rayDirection;
    ivec3 texelPos = ivec3(floor(pos * vec3(textureSize(u_voxelData, 0))));
    ivec3 wrappedTexelPos = ivec3(mod(float(texelPos.x), float(textureSize(u_voxelData, 0).x)),
                                  mod(float(texelPos.y), float(textureSize(u_voxelData, 0).y)),
                                  mod(float(texelPos.z), float(textureSize(u_voxelData, 0).z)));
    if (texelFetch(u_voxelData, wrappedTexelPos, 0).r == 1.0) {
      float c = t / 5.0;
      outColor = vec4(vec3(c), 1.0);
      return;
    }
  }

  outColor = vec4(1.0, 1.0, 1.0, 1.0);
}
