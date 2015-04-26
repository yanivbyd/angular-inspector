chrome.runtime.sendMessage({ type: "document-start" }, function(response) {
});

// chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
// 	// var s = document.createElement('script');
// 	// s.innerHTML = 'window.yaniv=123; debugger; console.log(document.documentElement.outerHTML)';
// 	// document.head.appendChild(s);
// 	console.log(document.documentElement.outerHTML)
// //	document.write('<script>alert(1);debugger</script>');
// });


// var xx = document.documentElement.outerHTML;

// xx = xx.replace(/angular.js/,'angular2.js');

// document.open();
// document.write(xx);
// document.close();

