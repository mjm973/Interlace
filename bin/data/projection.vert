#version 410

uniform mat4 _modelViewProjection;
uniform mat4 modelViewProjectionMatrix;
in vec4 position;
in vec3 normal;
in vec2 texcoord;

out vec2 texCoord;
out vec3 norm;

void main() {
  // Compute screen-space position using our modified MVP Matrix
  gl_Position = _modelViewProjection * position;

  // Using the built in MVP Matrix
  // gl_Position = modelViewProjectionMatrix * position;

  // Pass UVs and normals to fragment shader
  texCoord = texcoord;
  norm = normal;
}
