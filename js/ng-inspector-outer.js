window.initJbartInspector = function(_window,_document) {

	var prevFunc = angular.module;
	angular.module = function(name,requires,configFN) {
		console.log('module loaded - ' + name);
		// if (requires && name.indexOf('ng') != 0)
		// 	return prevFunc.call(angular,name,requires.concat(['jbartStudio']),configFN);
		// else
			return prevFunc.call(angular,name,requires,configFN);
	}
}