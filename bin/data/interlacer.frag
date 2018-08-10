#version 410

// Lenticular Glassless Stereoscopic Interlacer Shader
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
// Frame Resolution
uniform vec2 _frameRes;
// Upsampling factor
uniform int _upscale;

// Lenticular Lens Width, Offset, and Thickness (x, y, z)
uniform vec3 _lentWidthOff;

// Raw UV Coordinates
in vec2 texCoord;

// Output Pixel Color
out vec4 color;

// Computes the physical position of a fragment (in mm)
float computePixelPosition() {
  return gl_FragCoord.x / _screenDPMM;
}

// Computes the corresponding lens for this fragment
float computeU(float x) {
  float u = floor((x - _lentWidthOff.x * _lentWidthOff.y)/_lentWidthOff.x) + 1;
  return u;
}

// Computes a fragment's corresponding lightfield index
float computeS(float x, float u) {
  // Correct lens offset <mm>
  float s = x - _lentWidthOff.x * _lentWidthOff.y;
  // Shift out whole lenses <mm>
  s -= _lentWidthOff.x * u;
  // Add half a lens to center position: value should now be between -lensWidth/2, lensWidth/2 <mm>
  s += _lentWidthOff.x * 0.5;
  // Flip and convert to index: range between resAng/2 to -resAng/2 < >
  s *= -_resAngSpat.x/_lentWidthOff.x;
  // Push index back to expected range: resAng to 0
  s += (_resAngSpat.x + 1)*0.5;
  return s;
}

void main() {
  // Figure out physical position of the pixel
  float x = computePixelPosition();
  // Compute horizontal image sampling point for that pixel
  float u = computeU(x);
  // Compute which slice of the lighfield to render
  float s = computeS(x, u);
  float index = round(s);
  // Update UV sampling coordinates: X (u) is scaled based on angular resolution and screen size; Y is unaffected
  vec2 uv = vec2(u*_resAngSpat.x / _res.x, 1 - texCoord.y) * _frameRes;
  // Test validity of the pixel
  float valid = u >= 1 && u <= _resAngSpat.y ? 1 : 0;

  // Sample L/R frames
  vec4 lCol = texture(_left, uv);
  vec4 rCol = texture(_right, uv);

  color = mix(lCol, rCol, s / _resAngSpat.x) * valid;

  // color = vec4(texCoord , 0, 1);
}
