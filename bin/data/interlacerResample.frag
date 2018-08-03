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

// Lenticular Lens Width and Offset
uniform vec2 _lentWidthOff;

// View Position
uniform vec3 _viewPos;

// Raw UV Coordinates
in vec2 texCoord;

// Output Pixel Color
out vec4 color;

// Computes the physical position of a fragment (in mm)
float computePixelPosition(int offset) {
  return (gl_FragCoord.x + offset) / _screenDPMM;
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


// Cubic coefficient function
// https://stackoverflow.com/questions/13501081/efficient-bicubic-filtering-code-in-glsl
vec4 cubic(float v) {
    vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
    vec4 s = n * n * n;
    float x = s.x;
    float y = s.y - 4.0 * s.x;
    float z = s.z - 4.0 * s.y + 6.0 * s.x;
    float w = 6.0 - x - y - z;
    return vec4(x, y, z, w);
}

// Bicubic interpolator
// https://groups.google.com/forum/#!topic/comp.graphics.api.opengl/kqrujgJfTxo
vec4 bicubic(sampler2DRect tex, vec2 texcoord, vec2 texscale) {
    float fx = fract(texcoord.x);
    float fy = fract(texcoord.y);
    texcoord.x -= fx;
    texcoord.y -= fy;

    vec4 xcubic = cubic(fx);
    vec4 ycubic = cubic(fy);

    vec4 c = vec4(texcoord.x - 0.5, texcoord.x + 1.5, texcoord.y - 0.5, texcoord.y + 1.5);
    vec4 s = vec4(xcubic.x + xcubic.y, xcubic.z + xcubic.w, ycubic.x + ycubic.y, ycubic.z + ycubic.w);
    vec4 offset = c + vec4(xcubic.y, xcubic.w, ycubic.y, ycubic.w) / s;

    vec4 sample0 = texture(tex, vec2(offset.x, offset.z) * texscale);
    vec4 sample1 = texture(tex, vec2(offset.y, offset.z) * texscale);
    vec4 sample2 = texture(tex, vec2(offset.x, offset.w) * texscale);
    vec4 sample3 = texture(tex, vec2(offset.y, offset.w) * texscale);

    float sx = s.x / (s.x + s.y);
    float sy = s.z / (s.z + s.w);

    return mix(
        mix(sample3, sample2, sx),
        mix(sample1, sample0, sx), sy);
}

// Downsamples textures to match lenticular resolution using bicubic interpolation
vec4 downsampleTexture(sampler2DRect tex, vec2 uv) {
  vec2 coords = uv;// * _res;
  // coords.x *= 2;

  return bicubic(tex, coords, vec2(1, 1));
}

int getViewable(float i) {
  float rightIndex = round(mix(0, _resAngSpat.x, _viewPos.x * 0.5 + 0.5));
  return abs(rightIndex - i) < 1.5 ? 1 : 0;
}

void main() {
  // Anti-aliasing requires sampling different points
  // Start at nothing
  color = vec4(0, 0, 0, 0);


  // We sample one time per upscaling level.
  for (int i = 0; i < _upscale; ++i) {
    // Figure out physical position of the pixel
    float x = computePixelPosition(i);
    // Compute horizontal image sampling point for that pixel
    float u = computeU(x);
    // Compute which slice of the lighfield to render
    float s = computeS(x, u);
    float index = round(s);

    int viewable = getViewable(index);
    if (viewable == 0) {
      break;
    }
    // Update UV sampling coordinates - Y is unaffected
    vec2 uv = vec2(u * _resAngSpat.x / _res.x, 1 - texCoord.y) * _frameRes;
    // Test validity of the pixel
    float valid = u >= 1 && u <= _resAngSpat.y ? 1 : 0;

    // Sample L/R frames
    vec4 lCol = downsampleTexture(_left, uv);
    vec4 rCol = downsampleTexture(_right, uv);

    // Get color for the fragment
    vec4 c = mix(lCol, rCol, s / _resAngSpat.x) * valid;

    // Add that to our running count
    color += c;
  }

  // Divide by upscale factor
  color /= _upscale;
}
