#version 410

// Lenticular Glassless Stereoscopic Calibration Shader
// Adapted from MIT Lecture + Code found at:
// http://alumni.media.mit.edu/~mhirsch/byo3d/
// http://alumni.media.mit.edu/~mhirsch/byo3d/tutorial/lenticular.html
//

#define PI 3.1415926535897932384626433832795

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

// Lenticular Lens Width, Offset, and Thickness (x, y, z)
uniform vec3 _lentWidthOff;

// View Position
uniform vec3 _viewPos;
// Enable positional interlacing
uniform int _positional;
// Debug lens mapping
uniform int _showU;

// Raw UV Coordinates
in vec2 texcoord;

// Output Pixel Color
out vec4 color;

// Computes the physical position of a fragment (in mm)
float computePixelPosition() {
  return gl_FragCoord.x / _screenDPMM;
}

// Computes the corresponding lens for this fragment
// float computeU(float x) {
//   // // Usual approach found online: assume a pixel corresponds always to the lens above it
//   // float u = floor((x - _lentWidthOff.x * _lentWidthOff.y)/_lentWidthOff.x) + 1;
//   //
//   // // Better approach: a pixel falls within a lens if the viewing angle is within bounds!
//   // // We combine pixel position with view position to get a viewing angle
//   // // > "But what about refraction? The lenses will bend that angle!"
//   // // Yes, but it doesn't matter! There will always be rays that go straight through
//   // //     a lens's center and thus won't bend. All other rays will bend but will fall
//   // //     between these "control points"
//   // // First, find the offset between our viewpoint and the pixel
//   // // :: Find center of the screen
//   float center = 0.5 * _res.x / _screenDPMM;
//   // // :: Compute offset - view position is center when viewX is 0
//   float viewX = _viewPos.x * 1000 + center;
//   float dx = x - viewX;
//   // // Second, we use our offset combined with our view distance to get an angle
//   // float theta = atan(dx, _viewPos.z * 1000);
//   // // Third, find the maximum incident angle that will fall within the lens!
//   // // Given that lens radius is much smaller than its thickness, we can approximate
//   // float maxAngle = atan(0.5 * _lentWidthOff.x, _lentWidthOff.z);
//   // // Fourth, adjust!
//   // // :: Are we out of bounds?
//   // bool outOfBounds = theta*theta > maxAngle*maxAngle;
//   // // :: Which side are we on?
//   // bool isRight = theta > 0;
//   // // :: Boom!
//   // float delta = outOfBounds ? (!isRight ? 1 : -1) : 0;
//
//   // Better better approach: discard the naive approach altogether and do the proper math
//   // First, find the lens directly under our viewpoint. The naive approach will work here.
//   float u0 = (viewX - _lentWidthOff.x * _lentWidthOff.y) / _lentWidthOff.x;
//   // Second, find our offset from the view center
//   // Third, use similar triangles to find offset on the lenticular sheet!
//   float dLent = dx * (_viewPos.z * 1000 - _lentWidthOff.z) / (_viewPos.z * 1000);
//   // Fourth, find how many lenses we are off from the center lens
//   float du = dLent / _lentWidthOff.x;
//   // Finally, get our correct lens from u0 and du, adding 1
//   return floor(u0 + du) + 1;
//
//   // return u + delta * _positional;
// }

// Computes center lens and lens offset for the fragment
vec2 computeLens(float x) {
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

float computeLightfield(float x, float u0, float du) {
  // Attempt 4: Just like with u, recalculate from scratch
  // The earlier aproach assumes we will have lightfields 1~N spread across the
  // width of the lens. This is inaccurate, as the lens has a thickness, so the
  // lightfields must be spread across a slighty wider area.
  // First, find the screen middle of the view-axis lens
  // :: Calculate center lens center :: <mm>
  float uCenter0 = _lentWidthOff.x * (floor(u0) + 0.5);
  // :: Calculate center lens center projected on screen
  // :::: As u0 lies directly under the viewpoint, we can assume uCenter0 ~= uScreen0
  float uScreen0 = uCenter0;
  // Second, find the screen center of our current lens
  // :: Calculate screen width covered by lens (should be slightly more than lens width) :: <mm>
  float w = _viewPos.z * 1000 * _lentWidthOff.x / (_viewPos.z * 1000 - _lentWidthOff.z);
  // :: Find our current lens screen center <mm>
  float uScreen = uScreen0 + round(du) * w;
  // NOTE :::::: MAKES SENSE UP TO HERE ::::::
  // Third, compute the lightfield index based on the center and pixel position
  // :: Compute difference between lens screen center and our position :: <mm> {right is positive}
  float ds = x - uScreen;
  // return ds;
  // return ds / w;
  // :: Flip and map to index
  ds *= -_resAngSpat.x / w;
  // :: Push back to lightfield range
  ds += (_resAngSpat.x ) * 0.5;

  // ds = clamp(ds, 0, _resAngSpat.x);

  return ds;
}

// Computes a fragment's corresponding lightfield index
// float computeS(float x, float u) {
//   // // Correct lens offset <mm>
//   // float s = x - _lentWidthOff.x * _lentWidthOff.y;
//   // // Shift out whole lenses <mm>
//   // s -= _lentWidthOff.x * u;
//   // // Add half a lens to center position: value should now be between -lensWidth/2, lensWidth/2 <mm>
//   // s += _lentWidthOff.x * 0.5;
//   // // Flip and convert to index: range between resAng/2 to -resAng/2 < >
//   // s *= -_resAngSpat.x/_lentWidthOff.x;
//   // // Push index back to expected range: resAng to 0
//   // s += (_resAngSpat.x + 1)*0.5;
//   //
//   // return s;
//
//   // float delta;
//   // // // Attempt 1: Linear mapping using viewX to index shift
//   // // // First, compute shift from head-on view using viewX
//   // // // (viewX [-1, 1], x [0, W]) -> dx [-1, 1]
//   // // // - Normalize viewX
//   // // float vx = _viewPos.x * 0.5 + 0.5;
//   // // // - Find view center
//   // // float center = vx * _lentWidthOff.x * _resAngSpat.y;
//   // // // - We want to map based off the side that has more screen on it
//   // // float scale = vx >= 0.5 ? center : _lentWidthOff.x * _resAngSpat.y - center;
//   // // // - Calculate offset from center
//   // // delta = x - center;
//   // // // - Scale to target range
//   // // delta /= scale;
//   // // // Second, use shift to  change the target index
//   // // // shift [-1, 1] -> delta [resAng/2, -resAng/2]
//   // // delta *= -_resAngSpat.x * 0.5;
//   //
//   // // // Attempt 2: Simple factoring in of view angle
//   // // // First, compute incident angle for the fragment
//   // // float theta = atan(_viewPos.x, _viewPos.z);
//   // // // Arbitrarily map from angle to a change in index
//   // // delta = -theta * 4;// / PI;
//   //
//   // // Attempt 3: Okay fudge it we gonna math
//   // // Assumption #1: Lenticle Radius is small compared to center Height
//   // // This means we can approximate the screen offset under that lenticle as
//   // // (x * T) / z
//   // // Step 1: Compute view offset from lenticle center <mm>
//   // // :: center <mm> = lensWidth <mm> * spatialResolution / 2;
//   // float screenCenter = _lentWidthOff.x * _resAngSpat.y / 2;
//   // // :: lensX <mm> = lensWidth <mm> * (lensIndex - 0.5)
//   // float lensX = _lentWidthOff.x * (u - 0.5);
//   // // :: eyeX <mm> = viewXFromCenter <m> * 1000 + center <mm>
//   // float eyeX = 1000 * _viewPos.x + screenCenter;
//   // // :: offset = viewX - lensX
//   // float offX = eyeX - lensX;
//   // // Step 2: Compute screen offset from lenticle center
//   // // offX : distanceFromEyeToLensCenter :: delta : distanceFromScreenToLensCenter
//   // // Given that viewer distance ~= distanceFromEyeToLensCenter...
//   // delta = (offX * _lentWidthOff.z) / (_viewPos.z * 1000);
//   // // Step 3: Use pixel density to determine shift in lightfield index
//   // delta *= _screenDPMM;
//   //
//   // s += delta * _positional;
//
//   // Attempt 4: Just like with u, recalculate from scratch
//   // The earlier aproach assumes we will have lightfields 1~N spread across the
//   // width of the lens. This is inaccurate, as the lens has a thickness, so the
//   // lightfields must be spread across a slighty wider area.
//   // First, find the screen middle of the view-axis lens
//   // // :: Find center of the screen :: <mm>
//   float center = 0.5 * _res.x / _screenDPMM;
//   // // :: Compute offset - view position is center when _viewPos.x <m> is 0 :: <mm>
//   float viewX = _viewPos.x * 1000 + center;
//   float dx = x - viewX;
//   // :: Get center lens :: < >
//   float u0 = (viewX - _lentWidthOff.x * _lentWidthOff.y) / _lentWidthOff.x;
//   // :: Calculate center lens center :: <mm>
//   float uCenter0 = _lentWidthOff.x * (floor(u0) + 0.5);
//   // :: Calculate center lens center projected on screen
//   // :::: As u0 lies directly under the viewpoint, we can assume uCenter0 ~= uScreen0
//   float uScreen0 = uCenter0;
//   // Second, use lens offset to find our correct lightfield index
//   // :: Find distance from pixel to center screen center <mm> {right is positive}
//   float screenDx = x - uScreen0;
//   // :: Get number of lenses off-center :: {right is positive}
//   float dLent = screenDx * (_viewPos.z * 1000 - _lentWidthOff.z) / (_viewPos.z * 1000);
//   dLent /= _lentWidthOff.x;
//   // :: We need an integer so we round (being below half a lens off is still the center lens)
//   // dLent = round(dLent);
//   // :: Calculate screen width covered by lens (should be slightly more than lens width) :: <mm>
//   float w = _viewPos.z * 1000 * _lentWidthOff.x / (_viewPos.z * 1000 - _lentWidthOff.z);
//   // :: Find our current lens screen center
//   float uScreen = uScreen0 + dLent * w;
//   // NOTE :::::: MAKES SENSE UP TO HERE ::::::
//   // :: Compute difference between lens screen center and our posiiton :: <mm> {right is positive}
//   float ds = x - uScreen;
//   return uScreen0;
//   // :: Flip and map to index
//   ds *= _resAngSpat.x / w;
//   // :: Push back to lightfield range
//   ds += (_resAngSpat.x + 1) * 0.5;
//
//   // ds = clamp(ds, 0, _resAngSpat.x);
//
//   return ds;
//
//
//
//
//
//   // // Correct lens offset
//   // s = x - w * _lentWidthOff.y;
//   // // Shift whole widths
//   // s -= w * u;
//   // // Center by adding half a width
//   // s += 0.5 * w;
//   // // Flip and map to index
//   // s *= -_resAngSpat.x / w;
//   // // Push back to lighftield range
//   // s += (_resAngSpat.x + 1) * 0.5;
//   //
//   // return s;
// }

// Computes fragment color for the calibration pattern
vec4 calibColor(int i) {
  float val = i == round((_resAngSpat.x + 1)*0.5) ? 1 : 0;

  return vec4(val, val, val, 1);
}

void main() {
  // Figure out physical position of the pixel
  float x = computePixelPosition();
  // Compute horizontal image sampling point for that pixel
  // float u = computeU(x);
  vec2 u = computeLens(x);
  float u_ = floor(u.x + u.y) + 1;
  // Compute which slice of the lighfield to render
  // float s = computeS(x, u);
  float s = computeLightfield(x, u.x, u.y);
  float index = round(s);
  // Update UV sampling coordinates - Y is unaffected
  vec2 uv = vec2(u_ / _res.x, texcoord.y);
  // Test validity of the pixel
  float valid = u_ >= 1 && u_ <= _resAngSpat.y ? 1 : 0;

  // Generate color
  color = calibColor(int(index)) * valid;

  color = _showU == 0 ? color : int(floor(u_)) % 2 == 0 ? vec4(1, 1, 1, 1) : vec4(0, 0, 0, 0);
  // color = vec4(_viewPos)

  // float val = round(s) == round((_viewPos.y * 0.5 + 0.5)*_resAngSpat.y) ? 1 : 0;//abs(s-x) < 1.5 ? 1 : 0;
  // val *= 0.5;
  // val += round(u) == round((_viewPos.y * 0.5 + 0.5)*_resAngSpat.y) ? 0.5 : 0;
  float val = s;//abs(0.5 + s*0.5);// <= abs(_viewPos.y) ? 1 : 0;
  // val *= 0.07;
  color = vec4(val, val, val, 1);
}
