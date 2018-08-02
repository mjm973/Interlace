#pragma once

#include "ofMain.h"
#include "ofxGui.h"

class ofApp : public ofBaseApp{
	typedef struct {
		int hRes;
		int vRes;
		float size;
		float width;
		float dotsPerInch;
		float dotsPerMM;
		vector<float> pixelCenters;
	} Screen;

	typedef struct {
		float linesPerInch;
		float linesPerMM;
		float lensWidth;
		float offset;
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
		ofxToggle debugCalibrate;
		ofxToggle debugShowInterlaced;
		ofxToggle bikeTest;

		ofxPanel calGui;
		ofxToggle lockParams;
		ofxSlider<int> upscale;
		ofxSlider<float> screenSize;
		ofxSlider<int> lenticularLPI;
		ofxSlider<float> lenticularOff;
		ofxToggle debugPrint;
		ofxToggle debugShowLens;

		ofxPanel displayGui;
		ofxToggle resample;
		ofxToggle debugPlacement;
		ofxSlider<float> viewX;
		ofxSlider<float> viewDistance;


		Screen screen;
		Lenticular lenticular;
		Lightfield lf;
		Map map;

		ofImage left, right, bikeL, bikeR;
		ofShader interlacer, intResample, calibration;
		ofShader* activeShader;
		ofPlanePrimitive plane;

		void setup();
		void update();
		void draw();

		Screen initScreen();
		Lenticular initLenticular();
		Lightfield initLightfield();
		Map initMap();

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
