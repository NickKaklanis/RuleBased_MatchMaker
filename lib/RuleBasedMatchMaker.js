/*!
GPII Rule Based Matchmaker

Copyright 2013 OCAD University

Licensed under the New BSD license. You may not use this file except in
compliance with this License.

You may obtain a copy of the License at
https://github.com/gpii/universal/LICENSE.txt
*/

var RULES_RESULT;

var client = require('./RBMM_JavaRpcClient');

var instance = new client();

instance.on('message', function(msg){
    "use strict";

    fluid.log('Received a message...');
    fluid.log(msg);
    fluid.log("");
});

instance.on('sent', function(msg){
    "use strict";

    fluid.log('Sent a message...');
    fluid.log(msg);
    fluid.log("");
});

instance.on('Error', function(msg){
    "use strict";

    fluid.log("An error was received!");
    fluid.log(msg.errorMessage);
    fluid.log(msg.stackTrace);
    fluid.log('');

    instance.sendGoodbye();
});

instance.on('Info', function(msg){
    "use strict";

    RULES_RESULT = msg.message;
    fluid.log(msg.message);
    fluid.log("");
});


var fluid = fluid || require("universal");

var matchMaker = fluid.registerNamespace("gpii.matchMaker");
var ruleBased = fluid.registerNamespace("gpii.matchMaker.ruleBased");

fluid.require("./Log.js", require);

var path = require("path");
var when = require("when");
var fs = require('fs');
var $ = fluid.registerNamespace("jQuery");
var gpii = fluid.registerNamespace("gpii");

ruleBased.disposeStrategy = function (leaves, solrecs) {

	fluid.log("LEAVES: ", leaves);		//debug
	fluid.log("SOLRECS: ", solrecs);	//debug

	//FROM FLAT MATCHMAKER
	fluid.each(solrecs, function(solrec) {
        var accepted = fluid.find(leaves, function (leaf) {
            return fluid.get(solrec.skeleton, leaf, fluid.model.escapedGetConfig);
        });
        solrec.disposition = accepted? "accept" : "reject";
    });
    return solrecs;
	//-FROM FLAT MATCHMAKER
/*
	//FROM SAMPLE MATCHMAKER
    // TODO: Match solution records to user preferences.
    return fluid.transform(solrecs, function (solrec) {
        // This strategy accepts all solution records.
        solrec.disposition = "accept";
        return solrec;
    });
	//-FROM SAMPLE MATCHMAKER
*/
};


ruleBased.match = function (callbackWrapper, preferences, solutions, originalModel, strategy) {
    "use strict";

    fluid.log("RULE BASED MATCH MAKER MATCH IS USED");						//debug
    //fluid.log("Device information is available: ", originalModel.device);	//debug
	console.log("preferences: %j", preferences);							//debug
	console.log("solutions: %j", solutions);								//debug
	console.log("originalModel.device: %j", originalModel.device);			//debug
	console.log("strategy: %j", strategy);									//debug

	fluid.log("1");		//debug
	// Logging
	//gpii.matchMaker.log.inAutoFile(preferences, "RuleMM_ante");
	fluid.log("2");		//debug
    var inverseTransformations = JSON.parse(fs.readFileSync(path.resolve(__dirname, "inverseRules.json"), "utf8"));
        fluid.each(preferences.applications, function (val, id) {
	var trans = inverseTransformations[id];
            if (trans !== undefined) {
                var new_pref = fluid.model.transformWithRules(val.parameters, trans);
                console.log(JSON.stringify(new_pref));
                $.extend(true, preferences, new_pref);
            }
        });
	fluid.log("3");		//debug


	return when(CALL_RB_MM(preferences, originalModel.device, callbackWrapper.wrap), function () {
		fluid.log("4");		//debug
		// Logging
		gpii.matchMaker.log.inAutoFile(preferences, "RuleMM_intermediate");
		fluid.log("5");		//debug
        return when(gpii.matchMaker.disposeSolutions(preferences, solutions, strategy), function (disposed) {
            var togo = [];
			fluid.log("6");	//debug
            fluid.each(disposed, function(solrec) {
			fluid.log("7");	//debug
                if (solrec.disposition === "accept") {
                    togo.push(solrec.solution);
                }
            });
			fluid.log("8");	//debug
            return togo;
        });
    });
};

function CALL_RB_MM (preferences, device, wrap) {
	fluid.log("1_0");	//debug
	"use strict";

	var deferred = when.defer(),
        resolver = deferred.resolver,
        promise = deferred.promise;
	fluid.log("1_1");		//debug
	// Start communication with Java (the RB-MM)
	// As a first step, Java sends a "hello" message to Node.js
	instance.run();
	fluid.log("1_2");		//debug
	//Receive acknowledgement of hello
	instance.once('Info', wrap(function()
	{
		fluid.log("1_3");	//debug
		//Node.js send user prefs to Java
		instance.sendUserProfile(preferences);
		fluid.log("1_4");	//debug
		//Node.js gets confirmation message from Java for getting user prefs
		instance.once('Info', wrap(function()
		{
			fluid.log("1_5");		//debug
			//Node.js send device reporter payload to Java
			instance.sendDeviceReporterPayload(device);
			fluid.log("1_6");		//debug
			//Node.js receives confirmation from Java that device reporter payload has been received
			instance.once('Info', wrap(function()
			{
				fluid.log("1_7");	//debug
				//Node.js tells java to run the rules
				instance.sendRunRules("ready for calculations...");
				fluid.log("1_8");	//debug
        resolver.resolve();
				//Node.js receives the final output of the RB-MM
				// instance.once('Info', wrap(function()
				// {
				// 	fluid.log("1_9");	//debug
				// 	//Close connection between Node.js and Java
				// 	instance.sendGoodbye();

				// 	var newPrefsWords=RULES_RESULT.split(" ");
				// 	var i=0;
				// 	for(i=0; i<newPrefsWords.length;i++)
				// 	{
				// 		if(newPrefsWords[i] === "ENABLE_DEFAULT_THEME")
				// 		{
				// 			if(preferences != null && preferences.display != null && preferences.display.screenEnhancement != null)
				// 			{
				// 				preferences.display.screenEnhancement.highContrast = false;
				// 				preferences.display.screenEnhancement["-provisional-magnifierPosition"] = "FullScreen";
				// 			}
				// 			//remove application-unique settings - Windows
				// 			//if(preferences != null && preferences.applications != null && preferences.applications["com.microsoft.windows.highContrast"] != null)
				// 			//{
				// 			//	delete preferences.applications["com.microsoft.windows.highContrast"];
				// 			//}
				// 			//remove application-unique settings - Linux
				// 			//if(preferences != null && preferences.applications != null && preferences.applications["org.gnome.desktop.interface"] != null && preferences.applications["org.gnome.desktop.interface"].parameters != null && preferences.applications["org.gnome.desktop.interface"].parameters["gtk-theme"] != null && preferences.applications["org.gnome.desktop.interface"].parameters["gtk-theme"] == "HighContrast")
				// 			//{
				// 			//	delete preferences.applications["org.gnome.desktop.interface"].parameters["gtk-theme"];
				// 			//}
				// 		}
				// 		else if(newPrefsWords[i] === "ENABLE_MAGNIFIER_WITH_INVERSE_COLOURS")
				// 		{
				// 			if(preferences != null && preferences.display != null && preferences.display.screenEnhancement != null)
				// 			{
				// 				preferences.display.screenEnhancement.invertImages = true;
				// 				if(preferences.display.screenEnhancement.magnification == null)
				// 					preferences.display.screenEnhancement.magnification = 1.0;
				// 			}
				// 			//remove application-unique settings - Windows
				// 			//if(preferences != null && preferences.applications != null && preferences.applications["com.microsoft.windows.magnifier"] != null && preferences.applications["com.microsoft.windows.magnifier"].parameters != null && preferences.applications["com.microsoft.windows.magnifier"].parameters.MagnificationMode != null)
				// 			//{
				// 			//	delete preferences.applications["com.microsoft.windows.magnifier"].parameters.MagnificationMode;
				// 			//}
				// 			//if(preferences != null && preferences.applications != null && preferences.applications["com.microsoft.windows.magnifier"] != null && preferences.applications["com.microsoft.windows.magnifier"].parameters != null && preferences.applications["com.microsoft.windows.magnifier"].parameters.Invert != null)
				// 			//{
				// 			//	delete preferences.applications["com.microsoft.windows.magnifier"].parameters.Invert;
				// 			//}
				// 			//if(preferences != null && preferences.applications != null && preferences.applications["com.microsoft.windows.magnifier"] != null && preferences.applications["com.microsoft.windows.magnifier"].parameters != null && preferences.applications["com.microsoft.windows.magnifier"].parameters.Magnification != null)
				// 			//{
				// 			//	delete preferences.applications["com.microsoft.windows.magnifier"].parameters.Magnification;
				// 			//}
				// 			//remove application-unique settings - Linux
				// 			//if(preferences != null && preferences.applications != null && preferences.applications["org.gnome.desktop.a11y.magnifier"] != null && preferences.applications["org.gnome.desktop.a11y.magnifier"].parameters != null && preferences.applications["org.gnome.desktop.a11y.magnifier"].parameters["mag-factor"] != null)							{
				// 			//	delete preferences.applications["org.gnome.desktop.a11y.magnifier"].parameters["mag-factor"];
				// 			//}
				// 			//if(preferences != null && preferences.applications != null && preferences.applications["org.gnome.desktop.a11y.magnifier"] != null && preferences.applications["org.gnome.desktop.a11y.magnifier"].parameters != null && preferences.applications["org.gnome.desktop.a11y.magnifier"].parameters["screen-position"] != null)
				// 			//{
				// 			//	delete preferences.applications["org.gnome.desktop.a11y.magnifier"].parameters["screen-position"];
				// 			//}
				// 		}
				// 	}

				// 	resolver.resolve();
				// }));
			}));
		}));
	}));

    return promise;
}
