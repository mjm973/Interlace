#pragma once

#include "ofMain.h"
#include "ofxGui.h"

class ofApp : public ofBaseApp{
	typedef struct {
		int hRes;
		int vRes;
		float size;
		float width;
		float height;
		float dotsPerInch;
		float dotsPerMM;
		//vector<float> pixelCenters;
		ofVec3f cornerA;
		ofVec3f cornerB;
		ofVec3f cornerC;
	} Screen;

	typedef struct {
		float linesPerInch;
		float linesPerMM;
		float lensWidth;
		float offset;
		float thickness;
	} Lenticular;

	typedef struct {
		int spatialRes;
		int angularRes;
	} Lightfield;

	typedef struct {
		vector<int> u;
		vector<int> uCheck;
		vector<float> s;
	} Map;

	public:
		ofxPanel gui;
		ofxButton fs;
		ofxToggle enableCalibrate;
		ofxToggle enableDisplay;
		ofxToggle testProjection;

		ofxPanel calGui;
		ofxToggle debugCalibrate;
		ofxToggle lockParams;
		ofxSlider<int> upscale;
		ofxSlider<float> screenSize;
		ofxSlider<int> lenticularLPI;
		ofxSlider<float> lenticularOff;
		ofxSlider<float> lenticularThickness;
		ofxToggle spreadX;
		ofxToggle debugU;
		ofxToggle debugPrint;
		ofxToggle debugShowLens;

		ofxPanel displayGui;
		ofxToggle debugShowInterlaced;
		ofxToggle bikeTest;
		ofxToggle resample;
		ofxToggle debugPlacement;
		ofxSlider<float> viewX;
		ofxSlider<float> viewY;
		ofxSlider<float> viewZ;
		ofxSlider<float> nearClip;
		ofxSlider<float> farClip;


		Screen screen;
		Lenticular lenticular;
		Lightfield lf;
		Map map;

		ofMatrix4x4 projectionMatrix;

		ofImage left, right, bikeL, bikeR;
		ofShader interlacer, intResample, calibration, projection;
		ofShader* activeShader;
		ofPlanePrimitive plane;

		void setup();
		void update();
		void draw();

		Screen initScreen();
		Lenticular initLenticular();
		Lightfield initLightfield();
		Map initMap();
		ofMatrix4x4 computeProjectionMatrix();

		void debugLens();
		void printParams();

		void setUniforms(ofShader* shader);
		void renderShader();

		void refreshPlane();
		void toggleFS();

		void keyPressed(int key);
		void keyReleased(int key);
		void mouseMoved(int x, int y );
		void mouseDragged(int x, int y, int button);
		void mousePressed(int x, int y, int button);
		void mouseReleased(int x, int y, int button);
		void mouseEntered(int x, int y);
		void mouseExited(int x, int y);
		void windowResized(int w, int h);
		void dragEvent(ofDragInfo dragInfo);
		void gotMessage(ofMessage msg);
		
};
