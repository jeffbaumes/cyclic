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

  for (float t = 0.0; t < 5.0; t += 0.01) {
    vec3 pos = rayOrigin + t * rayDirection;
    vec3 wrappedPos = fract(pos);
    if (texture(u_voxelData, wrappedPos).r > 0.0) {
      float c = 1.0 - t / 5.0;
      outColor = vec4(vec3(c), 1.0);
      return;
    }
  }

  outColor = vec4(1.0, 1.0, 1.0, 1.0);
}
