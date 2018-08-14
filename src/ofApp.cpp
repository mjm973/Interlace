#include "ofApp.h"


float inOverMM = (1.0 / 25.4);

//--------------------------------------------------------------
void ofApp::setup() {
	// Setup GUI
	// Base GUI
	gui.setup("Mode");
	gui.add(fs.setup("Toggle Fullscreen"));
	fs.addListener(this, &ofApp::toggleFS);
	gui.add(enableCalibrate.setup("Calib. GUI", true));
	gui.add(enableDisplay.setup("Disp. GUI", true));
	gui.add(testProjection.setup("Test Projection", false));

	// Calibration GUI
	calGui.setup("Calibration");
	calGui.setPosition(gui.getPosition() + ofVec2f(0, gui.getHeight() + 20));
	calGui.add(lockParams.setup("Lock Calib.", false));
	calGui.add(debugCalibrate.setup("Calibrate", false));

	calGui.add(upscale.setup("Upscaling", 1, 1, 10));
	calGui.add(screenSize.setup("Scr. Size", 15.4, 12, 50));
	calGui.add(lenticularLPI.setup("Lent. LPI", 30, 10, 60));
	calGui.add(lenticularOff.setup("Lent. Offset", 0.5, 0, 1));	
	calGui.add(lenticularThickness.setup("Lent. Thickness", 5, 0.5, 20));
	calGui.add(spreadX.setup("Spread X", false));

	calGui.add(debugPrint.setup("Debug Print", false));
	calGui.add(debugShowLens.setup("Debug Lenticular", false));

	// Positioning GUI
	displayGui.setup("View Params");
	displayGui.setPosition(gui.getPosition() + ofVec2f(0, gui.getHeight() + 20));
	displayGui.add(debugShowInterlaced.setup("Debug Interlaced", false));
	displayGui.add(bikeTest.setup("BIKE", false));

	displayGui.add(resample.setup("Resample", true));
	displayGui.add(debugPlacement.setup("Fake Placement", false));
	displayGui.add(viewX.setup("View X", 0, -1, 1));
	displayGui.add(viewY.setup("View Y", 0, -1, 1));
	displayGui.add(viewZ.setup("View Distance", 1.5, -10, 10));
	displayGui.add(nearClip.setup("Near Clipping", 2, 0, 10));
	displayGui.add(farClip.setup("Far Clipping", 10, 0, 20));

	// Initialize Screen, Lenticular, and Lightfield parameters
	screen = initScreen();
	lenticular = initLenticular();
	lf = initLightfield();
	map = initMap();


	bool abort = false;

	// Load test images
	try {
		left.load("left.jpg");
		right.load("right.jpg");
		bikeL.load("nemo_l.jpg");
		bikeR.load("nemo_r.jpg");
	}
	catch (exception e) {
		abort = true;
		ofLogError("Image data failed to load");
	}

	// Load shaders
	try {
		interlacer.load("interlacer");
		intResample.load("interlacerResample");
		calibration.load("calibration");
		projection.load("projection");
	}
	catch (exception e) {
		abort = true;
		ofLogError("Shader failed to load");
	}

	if (abort) {
		ofExit(1);
	}

	activeShader = &interlacer;

	refreshPlane();

	printParams();
}

//--------------------------------------------------------------
void ofApp::update() {
	// Lock parameters to stop constant recalculation
	if (!lockParams) {
		screen = initScreen();
		lenticular = initLenticular();
		lf = initLightfield();
		map = initMap();

		if (debugPrint) {
			printParams();
		}
	}

	if (testProjection) {
		projectionMatrix = computeProjectionMatrix();
	}
}

//--------------------------------------------------------------
void ofApp::draw() {
	ofBackground(0);

	// Shows a representation of the lenticular sheet
	if (debugShowLens) {
		debugLens();
	}
	// Does the actual rendering magic
	else if (debugShowInterlaced || debugCalibrate || bikeTest || testProjection) {
		renderShader();
	}

	// Draw relevant GUI
	gui.draw();

	if (enableCalibrate) {
		calGui.draw();

		displayGui.setPosition(calGui.getPosition() + ofVec2f(0, calGui.getHeight() + 20));
	}
	else {
		displayGui.setPosition(gui.getPosition() + ofVec2f(0, gui.getHeight() + 20));

	}
	if (enableDisplay) {
		displayGui.draw();
	}
}

// Initializes/updates Screen PArameters
ofApp::Screen ofApp::initScreen() {
	Screen s = {};

	// Screen Resolution - obtained from the OF App
	s.hRes = (int)ofGetWidth();
	s.vRes = (int)ofGetHeight();
	// Screen Diagonal Size - in inches
	s.size = screenSize;
	// Screen Width - in inches
	s.width = s.size*cosf(atan2f(ofGetHeight(), ofGetWidth()));
	s.height = s.size*sinf(atan2f(ofGetHeight(), ofGetWidth()));
	// Screen Pizel density (DPI and DPMM)
	s.dotsPerInch = ofGetWidth() / s.width;
	s.dotsPerMM = inOverMM*s.dotsPerInch;

	//vector<float> pix;
	//for (float i = 0; i < upscale*s.hRes - 1; ++i) {
	//	float x = (1 / ((float)upscale*screen.dotsPerMM))*i + 0.5;

	//	pix.push_back(x);
	//}

	//s.pixelCenters = pix;

	float halfW = s.width * 0.5 / (inOverMM * 1000);
	float halfH = s.height * 0.5 / (inOverMM * 1000);

	s.cornerA = ofVec3f(-halfW, -halfH, 0);
	s.cornerB = ofVec3f( halfW, -halfH, 0);
	s.cornerC = ofVec3f(-halfW,  halfH, 0);

	return s;
}

// Initializes Lenticular Parameters
ofApp::Lenticular ofApp::initLenticular() {
	Lenticular l = {};

	// Lenticular Density (LPI and LPMM)
	l.linesPerInch = lenticularLPI;
	l.linesPerMM = inOverMM*l.linesPerInch;
	// Individual Lens Width - in mm
	l.lensWidth = 1 / l.linesPerMM;
	// Number of lenticles offset from the edge of the screen (0 - 1)
	l.offset = lenticularOff;
	// Thickness of lenticular sheet - in mm
	l.thickness = lenticularThickness;

	return l;
}

// Initializes Lightfield Parameters
ofApp::Lightfield ofApp::initLightfield() {
	Lightfield l = {};

	// Spatial Resolution AKA Number of Lenses
	l.spatialRes = floorf(screen.width / (inOverMM * lenticular.lensWidth));
	// Angular Resolution AKA Pixel Columns Per Lens
	l.angularRes = roundf(screen.dotsPerMM*lenticular.lensWidth);

	return l;
}

// Compute off-axis projection matrix
ofMatrix4x4 ofApp::computeProjectionMatrix() {
	// Orthonormal screen basis
	ofVec3f vr, vu, vn;
	// Screen coordinates in orthonormal coordinates
	ofVec3f va, vb, vc;
	// Perpendicular frustum parameters (left, right, bottom, top, near plane, far plane, distance)
	float l, r, b, t, n, f, dist;
	// Our matrix!
	ofMatrix4x4 mat;
	// Our view position
	ofVec3f viewPos = ofVec3f(viewX, viewY, viewZ);

	// Compute basis - r (right), u (up), n (normal)
	vr = screen.cornerB - screen.cornerA;
	vr.normalize();
	vu = screen.cornerC - screen.cornerA;
	vu.normalize();
	vn = vr.getCrossed(vu);
	vn.normalize();

	// Compute viewpoint to corner vectors
	va = screen.cornerA - viewPos;
	vb = screen.cornerB - viewPos;
	vc = screen.cornerC - viewPos;

	// Find distance from viewpoint to screen
	dist = -va.dot(vn);

	// Compute parameters for perpendicular projection
	n = nearClip;
	f = farClip;

	l = vr.dot(va) * n / dist;
	r = vr.dot(vb) * n / dist;
	b = vu.dot(va) * n / dist;
	t = vu.dot(vc) * n / dist;

	// Generate perpendicular projection 
	mat = ofMatrix4x4(2*n/(r-l)    , 0.0      ,  (r+l)/(r-l),  0.0        ,
					  0.0          , 2*n/(t-b),  (t+b)/(t-b),  0.0        ,
					  0.0          , 0.0      , -(f+n)/(f-n), -2*f*n/(f-n),
					  0.0          , 0.0      , -1          ,  0.0        );

	// test override
	mat = ofGetCurrentMatrix(ofMatrixMode::OF_MATRIX_PROJECTION);

	// Generate rotation matrix to orient the projection plane
	ofMatrix4x4 rot = ofMatrix4x4(vr.x, vr.y, vr.z, 0.0,
								  vu.x, vu.y, vu.z, 0.0,
								  vn.x, vn.y, vn.z, 0.0,
								  0.0 , 0.0 , 0.0 , 1.0);

	// Generate translation matrix
	ofMatrix4x4 trans = ofMatrix4x4(1.0, 0.0, 0.0, -viewPos.x,
									0.0, 1.0, 0.0, -viewPos.y,
									0.0, 0.0, 1.0, viewPos.z,
									0.0, 0.0, 0.0,  1.0      );

	// Multiply and we done!
	//return mat;
	//return mat * rot;
	return mat * rot * trans;
	//return trans * rot * mat;

	return ofGetCurrentMatrix(ofMatrixMode::OF_MATRIX_PROJECTION);
}

ofApp::Map ofApp::initMap() {
	Map m = {};

	vector<int> uMap;
	vector<int> checkMap;
	vector<float> sMap;
	//for (int i = 0; i < screen.pixelCenters.size(); ++i) {
	//	float u = 1 + (screen.pixelCenters[i] - lenticular.lensWidth * lenticular.offset) / lenticular.lensWidth;
	//	u = floorf(u);
	//	uMap.push_back((int)floorf(u));

	//	float s = -lf.angularRes / lenticular.lensWidth;
	//	float s1 = screen.pixelCenters[i] - lenticular.lensWidth*lenticular.offset;
	//	s1 -= lenticular.lensWidth * (float)u;
	//	s1 += lenticular.lensWidth / 2;
	//	s *= s1;
	//	s += (lf.angularRes + 1) / 2;

	//	sMap.push_back((int)s);

	//	checkMap.push_back(u >= 1 && u <= lf.spatialRes ? 1 : 0);
	//}

	m.u = uMap;
	m.uCheck = checkMap;
	m.s = sMap;

	return m;
}

// Displays a simple pattern representing the size of the lenticles
void ofApp::debugLens() {
	float nLines = screen.width * lenticular.linesPerInch;
	float lineWidth = lenticular.lensWidth / inOverMM;
	lineWidth *= (float)screen.hRes / screen.width;
	for (float i = lenticular.offset*lineWidth; i < ofGetWidth(); i += lineWidth * 2) {
		ofSetColor(255);
		ofDrawRectangle(i, 0, lineWidth, ofGetHeight());
	}
}

// Prints Screen/Lenticular/Lightfield Parameters for Debug/Sanity Check
void ofApp::printParams() {
	// screen
	ofLogNotice("/// SCREEN ///");
	ofLogNotice("Resolution (W, H): " + ofToString(screen.hRes) + ", " + ofToString(screen.vRes));
	ofLogNotice("Size, Width (in): " + ofToString(screen.size) + ", " + ofToString(screen.width));
	ofLogNotice("DPI, DPMM: " + ofToString(screen.dotsPerInch) + ", " + ofToString(screen.dotsPerMM));

	// lenticular
	ofLogNotice("/// LENTICULAR ///");
	ofLogNotice("LPI, LPMM: " + ofToString(lenticular.linesPerInch) + ", " + ofToString(lenticular.linesPerMM));
	ofLogNotice("Lens Width (mm): " + ofToString(lenticular.lensWidth));
	ofLogNotice("Lens Offset: " + ofToString(lenticular.offset));

	// lighfield
	ofLogNotice("/// LIGHTFIELD ///");
	ofLogNotice("Spatial Resolution: " + ofToString(lf.spatialRes));
	ofLogNotice("Angular Resolution: " + ofToString(lf.angularRes));
}

// Passes on parameters to the shaders as Uniform variables
void ofApp::setUniforms(ofShader* shader) {
	ofImage* l = bikeTest ? &bikeL : &left;
	ofImage* r = bikeTest ? &bikeR : &right;

	// Projection
	float mvRaw[16];
	glGetFloatv(GL_MODELVIEW_MATRIX, mvRaw);
	//ofMatrix4x4 mv = ofMatrix4x4(mvRaw);
	ofMatrix4x4 mv = ofGetCurrentMatrix(ofMatrixMode::OF_MATRIX_MODELVIEW);

	shader->setUniformMatrix4f("_modelViewProjection", mv * projectionMatrix);

	// Viewpoints
	shader->setUniformTexture("_left", l->getTextureReference(), 0);
	shader->setUniformTexture("_right", r->getTextureReference(), 1);

	// Angular and Spatial Resolution
	shader->setUniform2f("_resAngSpat", ofVec2f(lf.angularRes, lf.spatialRes));
	
	// Pixel Density
	shader->setUniform1f("_screenDPMM", screen.dotsPerMM);
	// Screen Resolution
	shader->setUniform2f("_res", ofVec2f(ofGetWidth(), ofGetHeight()));
	// Frame resolution
	shader->setUniform2f("_frameRes", ofVec2f(l->getWidth(), l->getHeight()));
	// Upsampling Factor
	shader->setUniform1i("_upscale", upscale);
	
	// Lenticular Lens Width and Offset
	shader->setUniform3f("_lentWidthOff", ofVec3f(lenticular.lensWidth, lenticular.offset, lenticular.thickness));

	// Viewer Position
	ofVec3f placement = ofVec3f(0, 0, 1.5);
	if (debugPlacement) {
		placement.x = viewX;
		placement.y = viewY;
		placement.z = viewZ;
	}
	shader->setUniform3f("_viewPos", placement);
	// Enable Position-Based Interlacing
	int p = spreadX ? 1 : 0;
	shader->setUniform1i("_positional", p);
}

// Renders the currently selected shader
void ofApp::renderShader() {
	ofSetColor(255);

	//if (bikeTest) {
	//	ofBackground(255);
	//	return;
	//}

	if (debugCalibrate) {
		activeShader = &calibration;
	}
	else if (debugShowInterlaced || bikeTest) {
		if (resample) {
			activeShader = &intResample;
		}
		else {
			activeShader = &interlacer;
		}
	}
	else if (testProjection) {
		activeShader = &projection;

		activeShader->begin();
		

		ofPushMatrix();
		ofTranslate(ofGetWidth()*0.5, ofGetHeight()*0.5);
		
		//// uniforms must be set AFTER beginning the shader
		setUniforms(activeShader);
		
		of3dPrimitive thing = of3dPrimitive(ofMesh::cone(100, 200));
		thing.setPosition(0, 0, 1);
		thing.draw();
		thing.setPosition(0, 0, -1);
		thing.draw();
		thing.setPosition(0, 1, 0);
		thing.draw();
		thing.setPosition(0, -1, 0);
		thing.draw();
		thing.setPosition(1, 0, 0);
		thing.draw();
		thing.setPosition(-1, 0, 0);
		thing.draw();
		//ofDrawRectangle(0, 0, ofGetWidth(), ofGetHeight());
		ofPopMatrix();
		activeShader->end();

		return;
	}

	activeShader->begin();
	// uniforms must be set AFTER beginning the shader
	setUniforms(activeShader);

	ofPushMatrix();
	ofTranslate(ofGetWidth()*0.5, ofGetHeight()*0.5);
	plane.draw();
	//ofDrawRectangle(0, 0, ofGetWidth(), ofGetHeight());
	ofPopMatrix();
	activeShader->end();

}

void ofApp::toggleFS() {
	ofToggleFullscreen();
	refreshPlane();
}

void ofApp::refreshPlane() {
	plane.set(
		ofGetWidth(),
		ofGetHeight(),
		2,
		2,
		OF_PRIMITIVE_TRIANGLES);
	plane.mapTexCoords(0, 0, 1, 1);
}

//--------------------------------------------------------------
void ofApp::keyPressed(int key){

}

//--------------------------------------------------------------
void ofApp::keyReleased(int key){

}

//--------------------------------------------------------------
void ofApp::mouseMoved(int x, int y ){

}

//--------------------------------------------------------------
void ofApp::mouseDragged(int x, int y, int button){

}

//--------------------------------------------------------------
void ofApp::mousePressed(int x, int y, int button){

}

//--------------------------------------------------------------
void ofApp::mouseReleased(int x, int y, int button){

}

//--------------------------------------------------------------
void ofApp::mouseEntered(int x, int y){

}

//--------------------------------------------------------------
void ofApp::mouseExited(int x, int y){

}

//--------------------------------------------------------------
void ofApp::windowResized(int w, int h){

}

//--------------------------------------------------------------
void ofApp::gotMessage(ofMessage msg){

}

//--------------------------------------------------------------
void ofApp::dragEvent(ofDragInfo dragInfo){ 

}
