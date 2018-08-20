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

// View Position
uniform vec3 _viewPos;

// Raw UV Coordinates
in vec2 texCoord;

// Output Pixel Color
out vec4 color;

// Computes the physical position of a fragment (in mm)
float computePixelPosition(int pixelOff) {
  return (gl_FragCoord.x + pixelOff) / _screenDPMM;
}

// Computes a magic number to evade anti-sweet spots [not yet implemented]
float computeStereoOffset() {
  return _lentWidthOff.y;
}

// Computes center lens and lens offset for the fragment
vec2 computeLens(float x, float stereo) {
  // Better better approach: discard the naive approach altogether and do the proper math

  // First, find our offset from the view center
  // :: Find center of the screen
  float center = 0.5 * _res.x / _screenDPMM;
  // :: Compute offset - view position is center when viewX is 0
  float viewX = _viewPos.x * 1000 + center;
  float dx = x - viewX;
  // Second, find the lens directly under our viewpoint. The naive approach will work here.
  float u0 = (viewX - _lentWidthOff.x * _lentWidthOff.y) / _lentWidthOff.x;
  // Third, use similar triangles to find offset on the lenticular sheet!
  float dLent = dx * (_viewPos.z * 1000 - _lentWidthOff.z) / (_viewPos.z * 1000);
  // Fourth, find how many lenses we are off from the center lens
  float du = dLent / _lentWidthOff.x;
  // Finally, return u0 and du
  return vec2(u0, du);
}

float computeLightfield(float x, vec2 u, float stereo) {
  // Attempt 4: Just like with u, recalculate from scratch
  // The earlier aproach assumes we will have lightfields 1~N spread across the
  // width of the lens. This is inaccurate, as the lens has a thickness, so the
  // lightfields must be spread across a slighty wider area.
  // First, find the screen middle of the view-axis lens
  // :: Calculate center lens center :: <mm>
  // :: Don't forget to account for lens offset
  float u0 = u.x;
  float du = u.y;
  float uCenter0 = _lentWidthOff.x * (floor(u0) + 0.5 + _lentWidthOff.y);
  // :: Calculate center lens center projected on screen
  // :::: As u0 lies directly under the viewpoint, we can assume uCenter0 ~= uScreen0
  float uScreen0 = uCenter0;
  float center = 0.5 * _res.x / _screenDPMM;
  // :: Compute offset - view position is center when viewX is 0
  float viewX = _viewPos.x * 1000 + center;
  float dLens = uCenter0 - viewX;
  float dScreen = dLens * _viewPos.z * 1000 / (_viewPos.z * 1000 - _lentWidthOff.z);
  uScreen0 = viewX + dScreen;
  // Second, find the screen center of our current lens
  // :: Calculate screen width covered by lens (should be slightly more than lens width) :: <mm>
  float w = _viewPos.z * 1000 * _lentWidthOff.x / (_viewPos.z * 1000 - _lentWidthOff.z);
  // :: Find our current lens screen center <mm>
  float uScreen = uScreen0 + round(du) * w;
  // return abs(uScreen0 - x) < _viewPos.y || abs(uScreen - x) < _viewPos.y ? 1.0 : 0;
  // Third, compute the lightfield index based on the center and pixel position
  // :: Compute difference between lens screen center and our position :: <mm> {right is positive}
  float dcenter = viewX - uScreen0;
  float ds = x - uScreen - dcenter;
  // :: At this point, ds falls between [-w/2, w/2]
  // :: Flip and map to index
  // :: ds should fall between [resAng/2, -resAng/2]
  ds *= -_resAngSpat.x / w;
  // :: Push back to lightfield range
  // :: ds should finally fall between [resAng, 0]
  ds += (_resAngSpat.x) * 0.5;

  return ds;
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

// Determines whether our viewpoint requires L/R to be flipped to retain stereo
// Possibly unused
float getStereoFlip() {
  // Split X range [-1, 1] by lightfield index
  float dx = 2 / _resAngSpat.x;
  // Determine which "index boundary" we are closest to
  int boundary = int(floor(_viewPos.x / (dx)));
  // Flippy result
  return 1.0;
  return boundary % 2 == 0 ? 1.0 : -1.0;
}

// Determines whether a particular lightfield index should be viewable from our current position
float getViewable(float i) {
  // Ver 1. :: Blacking out invisible lightfields
  // // Find closest lightfield index based on horizontal position
  // float rightIndex = round(mix(0, _resAngSpat.x, _viewPos.x * 0.5 + 0.5));
  // // Find difference between fragment index and ideal index
  // float delta = rightIndex - i;
  // // Flip return value when needed to preserve proper L/R stereo
  // float val = delta * getStereoFlip();
  // // Return proper value if viewable, 999 otherwise
  // //return abs(delta) < 2.5 ? val : val; //999;

  // Ver 2. :: Uniform for all angles
  // return float(sign(_resAngSpat.x*0.5 - i)*getStereoFlip());

  // Ver 3. :: Uniform and weighted
  return float((_resAngSpat.x * 0.5 - i) * getStereoFlip() / (_resAngSpat.x * 0.5));
}

vec4 mixFrames(vec2 uv, float view) {
  // Sample L/R frames
  vec4 lCol = downsampleTexture(_left, uv);
  vec4 rCol = downsampleTexture(_right, uv);

  // === Get color for the fragment ===
  // == 1. Binary left/right
  // return view < 0 ? lCol : rCol;

  // == 2. Smoothstep to aid transitions
  return mix(lCol, rCol, smoothstep(0, 1, view * 0.5 + 0.5));
}

void main() {
  // Using our view position and calibration lens offset, compute a virtual offset
  // This will allow us to stop the image from flipping when moving between sweet spots
  float offset = computeStereoOffset();//_lentWidthOff.y + _viewPos.x * 0.5;

  // Anti-aliasing requires sampling different points
  // Start at nothing
  color = vec4(0, 0, 0, 0);

  // We sample one time per upscaling level.
  for (int i = 0; i < _upscale; ++i) {
    // Figure out physical position of the pixel
    float x = computePixelPosition(i);
    // Compute horizontal image sampling point for that pixel
    vec2 u = computeLens(x, offset);
    float uf = floor(u.x + u.y) + 1;
    // Compute which slice of the lighfield to render
    float s = computeLightfield(x, u, offset);
    float index = round(s);

    float viewable = getViewable(index);
    if (viewable == 999) {
      break;
    }
    // Update UV sampling coordinates - Y is unaffected
    vec2 uv = vec2(uf * _resAngSpat.x / _res.x, 1 - texCoord.y) * _frameRes;
    // Test validity of the pixel
    float valid = 1;//u >= 1 && u <= _resAngSpat.y ? 1 : 0;

    vec4 c = mixFrames(uv, viewable);

    // Add that to our running count
    color += c;
  }

  // Divide by upscale factor
  color /= _upscale;
}
