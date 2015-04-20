SET proj=%1
IF "%1"=="" ( set proj="example.prj" )

chrome-win32\\chrome.exe --disable-web-security --app=http://localhost:8090/ng-studio.html?project=%proj% --allow-file-access --reduce-security-for-testing