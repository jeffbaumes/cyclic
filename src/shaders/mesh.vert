#version 300 es
in vec3 a_position;
in vec2 a_texCoord;
uniform mat4 u_modelViewProjectionMatrix;
uniform vec3 u_eye;
uniform vec3 u_offset;

out float v_distance;
out vec2 v_texCoord;

void main() {
  vec3 pos = a_position + u_offset;
  gl_Position = u_modelViewProjectionMatrix * vec4(pos, 1.0);
  v_distance = length(pos - u_eye);
  v_texCoord = vec2(a_texCoord.x / 5.0 + 0.0 / 5.0, a_texCoord.y);
}
