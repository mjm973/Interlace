#version 410

// Raw UV Coordinates
in vec2 texCoord;

// Normalz
in vec3 norm;

// Output Pixel Color
out vec4 color;

void main() {
  // Colorize model based on normals for testing
  color = vec4(norm * 0.5 + vec3(0.5, 0.5, 0.5), 1);
}
