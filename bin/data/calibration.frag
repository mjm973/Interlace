#version 410

// Lenticular Glassless Stereoscopic Calibration Shader
// Adapted from MIT Lecture + Code found at:
// http://alumni.media.mit.edu/~mhirsch/byo3d/
// http://alumni.media.mit.edu/~mhirsch/byo3d/tutorial/lenticular.html
//

// Left/Right image textures
uniform sampler2DRect _left;
uniform sampler2DRect _right;

// Aungular and Spatial resolutions
uniform vec2 _resAngSpat;

// Pixel Density
uniform float _screenDPMM;
// Display Resolution
uniform vec2 _res;
// Upsampling factor
uniform int _upscale;

// Lentigular Lens Width and Offset
uniform vec2 _lentWidthOff;

// Raw UV Coordinates
in vec2 texcoord;

// Output Pixel Color
out vec4 color;

// Computes the physical position of a fragment (in mm)
float computePixelPosition() {
  return gl_FragCoord.x / _screenDPMM;
}

// Computes the transformed U coordinate for texture sampling
float computeU(float x) {
  float u = floor((x - _lentWidthOff.x * _lentWidthOff.y)/_lentWidthOff.x) + 1;
  return u;
}

// Computes a fragment's corresponding lightfield index
float computeS(float x, float u) {
  float s = x - _lentWidthOff.x * _lentWidthOff.y;
  s -= _lentWidthOff.x * u;
  s += _lentWidthOff.x * 0.5;
  s *= -_resAngSpat.x/_lentWidthOff.x;
  s += (_resAngSpat.x + 1)*0.5;
  return s;
}

// Computes fragment color for the calibration pattern
vec4 calibColor(int i) {
  float val = i == round((_resAngSpat.x + 1)*0.5) ? 1 : 0;
  return vec4(val, val, val, 1);
}

void main() {
  // Figure out physical position of the pixel
  float x = computePixelPosition();
  // Compute horizontal image sampling point for that pixel
  float u = computeU(x);
  // Compute which slice of the lighfield to render
  float s = computeS(x, u);
  float index = round(s);
  // Update UV sampling coordinates - Y is unaffected
  vec2 uv = vec2(u / _res.x, texcoord.y);
  // Test validity of the pixel
  float valid = u >= 1 && u <= _resAngSpat.y ? 1 : 0;

  // Generate color
  color = calibColor(int(index)) * valid;
}
