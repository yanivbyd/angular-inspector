
/***************** angular-inspector code ************************/

(function() {
	if (window.jbNgTemplateDB) return;	// do not to run twice

	window.jbNgTemplateDB = {};

	angular.module('jbartStudio',['ng']).run(function($rootScope,$compile, $parse,$templateCache) {
		window.jbNgService = {$rootScope: $rootScope, $compile: $compile, $parse: $parse, $templateCache: $templateCache };
	})

	.config(function($provide) {
		$provide.decorator("$templateCache",function($delegate) {
			return { 
				put:function(k,v) {
					debugger;
					if (!window.jbNgTemplateDB[k] || !window.jbNgTemplateDB[k].updated) {
						window.jbNgTemplateDB[k] = { str: v };
						return v;
					}
					return $delegate.put(k,v);
				},
				info: $delegate.info,				
				get:function(k) {
					return (window.jbNgTemplateDB[k] && window.jbNgTemplateDB[k].str) || $delegate.get(k);
				},
				remove:function(k) { return $delegate.remove(k); }
			}
		})
	})


	var prevFunc = angular.module;
	angular.module = function(name,requires,configFN) {
		if (requires && name.indexOf('ng') != 0)
			return prevFunc.call(angular,name,requires.concat(['jbartStudio']),configFN);
		else
			return prevFunc.call(angular,name,requires,configFN);
	}


	window.jbNgAddToTemplateDB = function(name,valueAsStr,updatedFromStudio) {
		try {
			window.jbId = window.jbId || 0;
			if (Array.isArray(valueAsStr)) { valueAsStr = valueAsStr[1]; }		// xhr (used both in wix and hikeio)

			if (typeof valueAsStr != 'string') return valueAsStr;	// could be a promise object (hikeio)

			var original = valueAsStr;

			var $elem = $(valueAsStr);
			if (!valueAsStr.match(/\s_jb="/)) {
				$elem.findIncludeSelf('*').each(function() { 
					if (this.setAttribute) 
						this.setAttribute('_jb',window.jbId++)
				});
				valueAsStr = $elem.get().map(function(e) { return e.outerHTML; }).join('');
			}

			window.jbNgTemplateDB[name] = { str: valueAsStr, $elem: $elem, original: original };

			if (updatedFromStudio) window.jbNgTemplateDB[name].updated = true;

			return valueAsStr;
		} catch(e) {
			console.log(e);
		}
	}

}());
