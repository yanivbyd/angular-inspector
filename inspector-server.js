var fs = require('fs'), path = require('path'), http = require('http');
GLOBAL.$ = GLOBAL.jQuery = require('jquery-deferred');

var port = 8090; 
var project = 'defaultWriter.prj'; 

for(var i=0;i<process.argv.length;i++) {
  var arg = process.argv[i];
  if (arg.indexOf('-port:') == 0)
    port = parseInt(arg.split(':')[1]);
  if (arg.indexOf('-project:') == 0)
    project = arg.split(':')[1];
}

var file_type_handlers = {};
(['js','gif','png','jpg','html','xml','css','xtml','txt','json','bmp','woff','jsx','prj']).forEach(function(ext) {
  file_type_handlers[ext] = function(req, res,path) { serveFile(req,res,path); };
})
 

// Settings
var settings = JSON.parse(fs.readFileSync(project,{encoding: 'utf8'}));
// if (!settings.base_dir) {
//   console.log('base_dir is required at the project file');
// }

// Directory Tree
function fileFilter(fn) {
  var extensions = settings.file_extensions || ['html','htm','js','css'];
  var hasExt = false;
  for(var i=0;i<extensions.length;i++) {
    hasExt = hasExt || (fn.indexOf(extensions[i], fn.length - extensions[i].length) !== -1);
  }
  
  if (settings.file_exclude_patterns && fn.match(file_exclude_patterns)) return false;
  return hasExt;
}

function folderFilter(fn) {
  if (settings.folder_exclude_patterns)
    return !fn.match(settings.folder_exclude_patterns);
  return false;
}

function dirTree(filename) {
    var stats = fs.lstatSync(filename),
        info = {
            path: filename,
            name: path.basename(filename)
        };

    if (stats.isDirectory()) {
        info.type = "folder";
        var files = fs.readdirSync(filename).filter(folderFilter);
        info.children = $map(files, function(child) {
          return dirTree(filename + '/' + child);
        })
    } else {
      if (!fileFilter(info.name)) return;
      info.type = "file";
    }
    return info;
}

var directoryTree = settings.base_dir && dirTree(settings.base_dir);

function findInFiles(toFind,folder) {
  var out = [];
  var files = (folder.children || []).filter(function(child) { return child.type == 'file' });
  var folders = (folder.children || []).filter(function(child) { return child.type == 'folder' });
  out = out.concat($map(files, function(file) {
    var content = fs.readFileSync(file.path,{encoding: 'utf8'});
    var foundAt = [], startPos = content.indexOf(toFind);
    while(startPos != -1) {
      foundAt.push(startPos);
      startPos = content.indexOf(toFind, startPos+1);
    }
    if (foundAt.length > 0) 
      return { path: file.path, foundAt: foundAt }
  }));
  out = out.concat($map(folders, function(childFolder) {
    return findInFiles(toFind,childFolder);
  }));
  return out;
}
// services

var op_post_handlers = {
  locateCodeSection: function(req, res,section) { 
    res.statusCode = 200;
    res.end(JSON.stringify(findInFiles(section,directoryTree)));
  },
  saveCodeSection: function (req,res,section) {
    var path = getURLParam(req,'path');
    var location = parseInt(getURLParam(req,'location'));
    var currentContent = getURLParam(req,'currentContent');
    var content = fs.readFileSync(path,{encoding: 'utf8'});
    var currenFileContent = content.substr(location,currentContent.length);
    if (currenFileContent != currentContent) {
      res.statusCode = 409;
      res.end(resultAsXml('error','Can not save to ' + path + ' conflict - current content is not as provided'));
    } else {
      var newContent = content.substr(0,location) + section + content.substr(location+currentContent.length);
      try {
        fs.writeFileSync(path,newContent);
        res.statusCode = 200;
        res.end(resultAsXml('success','Section Saved to ' + path));
      } catch (e) {
        res.statusCode = 400;
        res.end(resultAsXml('error','Can not save to ' + path + ' ' + e));
      }
    }
  }
}


var op_get_handlers = {
  locateCodeSection: function(req,res,path) { 
    return op_post_handlers.locateCodeSection(req, res, getURLParam(req,'section'), path);
  },
  saveCodeSection: function(req,res,path) { 
    return op_post_handlers.saveCodeSection(req, res, getURLParam(req,'section'), path);
  },
  angularjs: function(req,res,path) {
        var urlObj = require('url').parse(req.url,true);
        var urlParams = require('querystring').parse(urlObj.search);

        doHttpCall({ url: urlParams.url, method: 'GET', headers: req.headers }).then(function(result) {
          var str = result.content || result.toString();
          res.write(str);
          res.write('\n\n');
          var addToNG = fs.readFileSync('./add-to-angular-end.js');
          res.write(addToNG);

          res.end();
        },function(result) {
          res.end(result.content || result.toString());
        });

  },
  httpCall: function(req,res,path) {
      try {
        var urlObj = require('url').parse(req.url,true);
        var urlParams = require('querystring').parse(urlObj.search);

        var options = {
          url: urlParams.url,
          method: urlParams.method || 'GET',
          headers: req.headers // heuristic: copy browser headers
        };
        options.headers.host = urlObj.host;

        for(var param in urlParams) {
          if (param.indexOf('header_') == 0) {
            var headerName = param.split('header_')[1];
            options.headers[headerName] = urlParams[param];
          }
        }
      
        doHttpCall(options).then(function(result) {
          res.end(result.content || result.toString());
        },function(result) {
          res.end(result.content || result.toString());
        });
      } catch(e) {
        res.end(e.stack);
      }
  }
}

// Http server
function serve(req, res) {
  try {
    var url_parts = req.url.split('?');
    var path = url_parts[0].substring(1), query= url_parts[1];
    var op = getURLParam(req,'op');
   var file_type = path.split('.').pop();

    if (op && op_get_handlers[op] && req.method == 'GET') {
      return op_get_handlers[op](req,res,path);
    } else if (op && op_post_handlers[op] && req.method == 'POST') {
      var body = '';
      req.on('data', function (data) {
        body += '' + data;
      });
      req.on('end', function () {
        log(user_machine,'post: ' + body,2); 
        return op_post_handlers[op](req, res,body,path);
      });
    } else if (file_type && file_type_handlers[file_type]) {
      return file_type_handlers[file_type](req,res,path);
    } else {
      res.end('<xml type="error" desc="no handler for the request" request="' + req.url + '"/>');
    }
   } catch(e) {
      var st = e.stack || ''
      console.log('main loop exception: ' + st,1,'');
   }
}
http.createServer(serve).listen(port); 
console.log('angular-inspector server at port ' + port);

// utils
function getURLParam(req,name) {
  try {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(req.url)||[,''])[1].replace(/\+/g, '%20'))||null;
  } catch(e) {}
}

function resultAsXml(status,description) {
  return '<xml type="' + status + ' " desc="' + description + '"/>';
}

function $map(list,func) {
  var res = [];
  for(var i in list) {
    var item = func(list[i],i);
    if (Array.isArray(item))
      res = res.concat(item);
    else if (item != null)
      res.push(item);
  }
  return res;
}


function doHttpCall(options) {
  var zlib = require('zlib');
  var deferred = $.Deferred();

  if (options.url.indexOf('//') == 0) options.url = 'http:' + options.url;
  var urlObj = require('url').parse(options.url);
  options.headers = options.headers || {};
  options.headers['accept-encoding'] = 'gzip,deflate'; // unzip is done automatically at the proxy

  options.headers.host = urlObj.host;
  var http_options = {
    host: urlObj.hostname,
    path: urlObj.path,
    method: options.method || 'GET',
    headers: options.headers
  };
  if (urlObj.port) http_options.port = urlObj.port;

  GLOBAL.fiddler = false;
  if (GLOBAL.fiddler) {
    var port = http_options.port ? ':' + http_options.port : '';
    http_options.path = (urlObj.protocol == 'https:' ? 'https' : 'http') + '://' + http_options.host + port + http_options.path;
    http_options.headers.host = http_options.host;
    http_options.host = '127.0.0.1';
    http_options.port = 8888;
//    console.log(JSON.stringify(http_options, null, '\t'));
  }

  // MAY BE BUGGY - do not copy referer and X-Requested-With:XMLHttpRequest from client
  delete(http_options.headers.referer);
  delete(http_options.headers['X-Requested-With']);

  var httpObject = (urlObj.protocol == 'https:') ? https : http;

  var target = httpObject.request(http_options, function (result_stream) {
    var result_ar = [];
    if (result_stream.headers['content-encoding'] == 'gzip' || result_stream.headers['content-encoding'] == 'deflate') 
      var unziped_stream = result_stream.pipe(zlib.createGunzip());
    else
      var unziped_stream = result_stream;
    unziped_stream.on('data', function (chunk) {
      result_ar.push(chunk);
    });
    unziped_stream.on('end', function () {
      var result_buff = Buffer.concat(result_ar);
      var content;
      var content_type = getHeaderIgnoreCase(result_stream.headers,['content-type','Content-Type']);
      // inject encoding into Content-Type - e.g., charset=windows-1255
      if (options.force_encoding && content_type && content_type.indexOf('charset=') == -1) { 
        content_type += '; charset=' + options.force_encoding;
        setHeaderIgnoreCase(result_stream.headers,['content-type','Content-Type'],content_type);
      }
      if (content_type) {
        var encoding = content_type.split('charset=')[1] || '';
        if (encoding)
          content = result_buff; // iconv.decode(result_buff, encoding);
      }
      if (!content)
        content = result_buff.toString();

      var output = { content: content, requestHeaders: http_options.headers, responseHeaders: result_stream.headers }; 

      deferred.resolve(output);  
    });

   unziped_stream.on('error', function(err) {
      deferred.reject(err);
    });    
  });

  if (options.data)
    target.write(options.data);
  target.end();

  return deferred.promise();

  function getHeaderIgnoreCase(headers,keys) {
    for (var i=0;i<keys.length;i++)
      if (headers[keys[i]]) return headers[keys[i]];
  }

  function setHeaderIgnoreCase(headers,keys,value) {
    for (var i=0;i<keys.length;i++)
      if (headers[keys[i]]) 
        headers[keys[i]] = value;
  }
}

function serveFile(req,res,path) {
  var full_path = path;
  var extension = path.split('.').pop();
  var _path = full_path.replace(/[\\\/]/g,'/');

  fs.readFile(_path, function (err, content) {
    if (err) {
      if (err.errno === 34)
        res.statusCode = 404;
      else
        res.statusCode = 500;
      return res.end(error(0,'','Can not read file ' + full_path + ' ' + err,''));
    } else {
      fs.stat(_path, function (err, stat) {
        if (err) {
          res.statusCode = 500;
          return res.end(error(0,'','file status code 500 ' + full_path + ' ' + err,''));
        } else {
          var etag = stat.size + '-' + Date.parse(stat.mtime);
          res.setHeader('Last-Modified', stat.mtime);

          if (extension == 'css') res.setHeader('Content-Type', 'text/css');
          if (extension == 'xml') res.setHeader('Content-Type', 'application/xml');
          if (extension == 'js') res.setHeader('Content-Type', 'application/javascript');
          if (extension == 'woff') res.setHeader('Content-Type', 'application/x-font-woff');

          if (req.headers['if-none-match'] === etag) {
            res.statusCode = 304;
            res.end();
          } else {
            res.setHeader('Content-Length', content.length);
            res.setHeader('ETag', etag);
            res.statusCode = 200;
            res.end(content);
          }
        }
      })
    }
  });     
}

process.on('uncaughtException', function (err) {
    console.log('' + err);
});
