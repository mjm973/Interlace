#include "ofMain.h"
#include "ofApp.h"

//========================================================================
int main( ){
	ofGLFWWindowSettings settings = {};
	settings.setGLVersion(4, 1); // macOS only supports up to 4.1, Windows til latest
	settings.setSize(1024, 768);
	std::shared_ptr<ofAppBaseWindow> win = ofCreateWindow(settings);
	//ofSetupOpenGL(1024,768,OF_WINDOW);			// <-------- setup the GL context
	// this kicks off the running of my app
	// can be OF_WINDOW or OF_FULLSCREEN
	// pass in width and height too:
	ofRunApp(new ofApp());
	
}
