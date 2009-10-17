// Namespaces

var _Tracker = function(){};
var _TrackerLib = function(){};


/**************************************
	Library
**************************************/

(function(){
	
	var _CI = Components.interfaces;
	var _CC = Components.classes;

	this.CC = function(cName)
	{
	    return _CC[cName];
	};

	this.CI = function(ifaceName)
	{
	    return _CI[ifaceName];
	};

	this.CCSV = function(cName, ifaceName)
	{
	    return _CC[cName].getService(_CI[ifaceName]);
	};

	this.CCIN = function(cName, ifaceName)
	{
	    return _CC[cName].createInstance(_CI[ifaceName]);
	};

	this.QI = function(obj, iface)
	{
	    return obj.QueryInterface(iface);
	};
	
	//  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *
	
	this.getRootWindow = function(win)
	{
	    for (; win; win = win.parent)
	    {
	        if (!win.parent || win == win.parent)
	            return win;
	    }
	    return null;
	};
	
	
	//  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *
	// URL's
	
	this.getFileName = function(url)
	{
	    var split = this.splitURLBase(url);
	    return split.name;
	};

	this.splitFileName = function(url)
	{ // Dead code
	    var d = this.reDataURL.exec(url);
	    if (d)
	    {
	        var path = decodeURIComponent(d[1]);
	        if (!d[2])
	            return { path: path, name: 'eval' };
	        else
	            return { path: path, name: 'eval', line: d[2] };
	    }

	    var m = reSplitFile.exec(url);
	    if (!m)
	        return {name: url, path: url};
	    else if (!m[2])
	        return {path: m[1], name: m[1]};
	    else
	        return {path: m[1], name: m[2]};
	};

	this.splitURLBase = function(url)
	{
	    this.reDataURL.lastIndex = 0;
	    var d = this.reDataURL.exec(url); // 1: fileName, 2: baseLineNumber, 3: first line
	    if (d)
	    {
	        var src_starts = this.reDataURL.lastIndex;
	        var caller_URL = decodeURIComponent(d[1]);
	        var caller_split = this.splitURLTrue(caller_URL);

	        if (!d[3])
	            var hint = url.substr(src_starts);
	        else
	            var hint = decodeURIComponent(d[3]).replace(/\s*$/, "");

	        if (!d[2])
	            return { path: caller_split.path, name: 'eval->'+hint };
	        else
	            return { path: caller_split.path, name: 'eval->'+hint, line: d[2] };
	    }
	    return this.splitURLTrue(url);
	};

	this.splitURLTrue = function(url)
	{
	    var m = reSplitFile.exec(url);
	    if (!m)
	        return {name: url, path: url};
	    else if (!m[2])
	        return {path: m[1], name: m[1]};
	    else
	        return {path: m[1], name: m[2]+m[3]};
	};

	this.getFileExtension = function(url)
	{
	    var lastDot = url.lastIndexOf(".");
	    return url.substr(lastDot+1);
	};

	this.isSystemURL = function(url)
	{
	    if (!url) return true;
	    if (url.length == 0) return true; // spec for about:blank
	    if (url.substr(0, 9) == "resource:")
	        return true;
	    else if (url.substr(0, 17) == "chrome://firebug/")
	        return true;
	    else if (url.substr(0, 6) == "about:")
	        return true;
	    else if (url.indexOf("firebug-service.js") != -1)
	        return true;
	    else
	        return false;
	};

	this.isSystemPage = function(win)
	{
	    try
	    {
	        var doc = win.document;
	        if (!doc)
	            return false;

	        // Detect pages for pretty printed XML
	        if ((doc.styleSheets.length && doc.styleSheets[0].href
	                == "chrome://global/content/xml/XMLPrettyPrint.css")
	            || (doc.styleSheets.length > 1 && doc.styleSheets[1].href
	                == "chrome://browser/skin/feeds/subscribe.css"))
	            return true;

	        return FBL.isSystemURL(win.location.href);
	    }
	    catch (exc)
	    {
	        // Sometimes documents just aren't ready to be manipulated here, but don't let that
	        // gum up the works
	        ERROR("tabWatcher.isSystemPage document not ready:"+ exc);
	        return false;
	    }
	}

	this.isLocalURL = function(url)
	{
	    if (url.substr(0, 5) == "file:")
	        return true;
	    else
	        return false;
	};

	this.getLocalPath = function(url)
	{
	    if (this.isLocalURL(url))
	    {
	        var ioService = this.CCSV("@mozilla.org/network/io-service;1", "nsIIOService");
	        var fileHandler = ioService.getProtocolHandler("file").QueryInterface(this.CI("nsIFileProtocolHandler"));
	        var file = fileHandler.getFileFromURLSpec(url);
	        return file.path;
	    }
	};

	this.getDomain = function(url)
	{
	    var m = /[^:]+:\/{1,3}([^\/]+)/.exec(url);
	    return m ? m[1] : "";
	};

	this.getURLPath = function(url)
	{
	    var m = /[^:]+:\/{1,3}[^\/]+(\/.*?)$/.exec(url);
	    return m ? m[1] : "";
	};

	this.getPrettyDomain = function(url)
	{
	    var m = /[^:]+:\/{1,3}(www.)?([^\/]+)/.exec(url);
	    return m ? m[2] : "";
	};

	this.absoluteURL = function(url, baseURL)
	{
	    if (url[0] == "?")
	        return baseURL + url;

	    var reURL = /(([^:]+:)\/{1,2}[^\/]*)(.*?)$/;
	    var m = reURL.exec(url);
	    if (m)
	        return url;

	    var m = reURL.exec(baseURL);
	    if (!m)
	        return "";

	    var head = m[1];
	    var tail = m[3];
	    if (url.substr(0, 2) == "//")
	        return m[2] + url;
	    else if (url[0] == "/")
	    {
	        return head + url;
	    }
	    else if (tail[tail.length-1] == "/")
	        return baseURL + url;
	    else
	    {
	        var parts = tail.split("/");
	        return head + parts.slice(0, parts.length-1).join("/") + "/" + url;
	    }
	}

	this.normalizeURL = function(url)
	{
	    // For some reason, JSDS reports file URLs like "file:/" instead of "file:///", so they
	    // don't match up with the URLs we get back from the DOM
	    return url ? url.replace(/file:\/([^/])/g, "file:///$1") : "";
	};

	this.denormalizeURL = function(url)
	{
	    return url.replace(/file:\/\/\//g, "file:/");
	};

	this.parseURLParams = function(url)
	{
	    var q = url ? url.indexOf("?") : -1;
	    if (q == -1)
	        return [];

	    var search = url.substr(q+1);
	    var h = search.lastIndexOf("#");
	    if (h != -1)
	        search = search.substr(0, h);

	    if (!search)
	        return [];

	    return this.parseURLEncodedText(search);
	};

	this.parseURLEncodedText = function(text)
	{
	    const maxValueLength = 25000;

	    var params = [];

	    var args = text.split("&");
	    for (var i = 0; i < args.length; ++i)
	    {
	        var parts = args[i].split("=");
	        if (parts.length == 2)
	        {
	            if (parts[1].length > maxValueLength)
	                parts[1] = this.$STR("LargeData");

	            params.push({name: unescape(parts[0]), value: unescape(parts[1])});
	        }
	        else
	            params.push({name: unescape(parts[0]), value: ""});
	    }

	    params.sort(function(a, b) { return a.name < b.name ? -1 : 1; });

	    return params;
	};
	
	this.consoleWarning = function(text)
	{
	    const consoleService = Components.classes["@mozilla.org/consoleservice;1"].
	        getService(Components.interfaces["nsIConsoleService"]);
	    consoleService.logStringMessage(text + "");
	};
	
	
	(function () {
	    var m = {  // A character conversion map
	            '\b': '\\b', '\t': '\\t',  '\n': '\\n', '\f': '\\f',
	            '\r': '\\r', '"' : '\\"',  '\\': '\\\\'
	        },
	        s = { // Map type names to functions for serializing those types
	            'boolean': function (x) { return String(x); },
	            'null': function (x) { return "null"; },
	            number: function (x) { return isFinite(x) ? String(x) : 'null'; },
	            string: function (x) {
	                if (/["\\\x00-\x1f]/.test(x)) {
	                    x = x.replace(/([\x00-\x1f\\"])/g, function(a, b) {
	                        var c = m[b];
	                        if (c) {
	                            return c;
	                        }
	                        c = b.charCodeAt();
	                        return '\\u00' +
	                            Math.floor(c / 16).toString(16) +
	                            (c % 16).toString(16);
	                    });
	                }
	                return '"' + x + '"';
	            },
	            array: function (x) {
	                var a = ['['], b, f, i, l = x.length, v;
	                for (i = 0; i < l; i += 1) {
	                    v = x[i];
	                    f = s[typeof v];
	                    if (f) {
	                        v = f(v);
	                        if (typeof v == 'string') {
	                            if (b) {
	                                a[a.length] = ',';
	                            }
	                            a[a.length] = v;
	                            b = true;
	                        }
	                    }
	                }
	                a[a.length] = ']';
	                return a.join('');
	            },
	            object: function (x) {
	                if (x) {
	                    if (x instanceof Array) {
	                        return s.array(x);
	                    }
	                    var a = ['{'], b, f, i, v;
	                    for (i in x) {
	                        v = x[i];
	                        f = s[typeof v];
	                        if (f) {
	                            v = f(v);
	                            if (typeof v == 'string') {
	                                if (b) {
	                                    a[a.length] = ',';
	                                }
	                                a.push(s.string(i), ':', v);
	                                b = true;
	                            }
	                        }
	                    }
	                    a[a.length] = '}';
	                    return a.join('');
	                }
	                return 'null';
	            }
	        };

	    // Export our serialize function outside of this anonymous function
	    _TrackerLib.serialize = function(o) { return s.object(o); };
	})(); // Invoke the anonymous function once to define JSON.serialize()
	
	
	this.FileIO = {
			
			/////////////////////////////////////////////////
			// Basic file IO object based on Mozilla source 
			// code post at forums.mozillazine.org
			/////////////////////////////////////////////////

			// Example use:
			// var fileIn = FileIO.open('/test.txt');
			// if (fileIn.exists()) {
			// 	var fileOut = FileIO.open('/copy of test.txt');
			// 	var str = FileIO.read(fileIn);
			// 	var rv = FileIO.write(fileOut, str);
			// 	alert('File write: ' + rv);
			// 	rv = FileIO.write(fileOut, str, 'a');
			// 	alert('File append: ' + rv);
			// 	rv = FileIO.unlink(fileOut);
			// 	alert('File unlink: ' + rv);
			// }
			
			localfileCID  : '@mozilla.org/file/local;1',
			localfileIID  : Components.interfaces.nsILocalFile,

			finstreamCID  : '@mozilla.org/network/file-input-stream;1',
			finstreamIID  : Components.interfaces.nsIFileInputStream,

			foutstreamCID : '@mozilla.org/network/file-output-stream;1',
			foutstreamIID : Components.interfaces.nsIFileOutputStream,

			sinstreamCID  : '@mozilla.org/scriptableinputstream;1',
			sinstreamIID  : Components.interfaces.nsIScriptableInputStream,

			suniconvCID   : '@mozilla.org/intl/scriptableunicodeconverter',
			suniconvIID   : Components.interfaces.nsIScriptableUnicodeConverter,

			open   : function(path) {
				try {
					var file = Components.classes[this.localfileCID]
									.createInstance(this.localfileIID);
					file.initWithPath(path);
					return file;
				}
				catch(e) {
					return false;
				}
			},

			read   : function(file, charset) {
				try {
					var data     = new String();
					var fiStream = Components.classes[this.finstreamCID]
										.createInstance(this.finstreamIID);
					var siStream = Components.classes[this.sinstreamCID]
										.createInstance(this.sinstreamIID);
					fiStream.init(file, 1, 0, false);
					siStream.init(fiStream);
					data += siStream.read(-1);
					siStream.close();
					fiStream.close();
					if (charset) {
						data = this.toUnicode(charset, data);
					}
					return data;
				} 
				catch(e) {
					return false;
				}
			},

			write  : function(file, data, mode, charset) {
				try {
					var foStream = Components.classes[this.foutstreamCID]
										.createInstance(this.foutstreamIID);
					if (charset) {
						data = this.fromUnicode(charset, data);
					}
					var flags = 0x02 | 0x08 | 0x20; // wronly | create | truncate
					if (mode == 'a') {
						flags = 0x02 | 0x10; // wronly | append
					}
					foStream.init(file, flags, 0664, 0);
					foStream.write(data, data.length);
					// foStream.flush();
					foStream.close();
					return true;
				}
				catch(e) {
					return false;
				}
			},

			create : function(file) {
				try {
					file.create(0x00, 0664);
					return true;
				}
				catch(e) {
					return false;
				}
			},

			unlink : function(file) {
				try {
					file.remove(false);
					return true;
				}
				catch(e) {
					return false;
				}
			},

			path   : function(file) {
				try {
					return 'file:///' + file.path.replace(/\\/g, '\/')
								.replace(/^\s*\/?/, '').replace(/\ /g, '%20');
				}
				catch(e) {
					return false;
				}
			},

			toUnicode   : function(charset, data) {
				try{
					var uniConv = Components.classes[this.suniconvCID]
										.createInstance(this.suniconvIID);
					uniConv.charset = charset;
					data = uniConv.ConvertToUnicode(data);
				} 
				catch(e) {
					// foobar!
				}
				return data;
			},

			fromUnicode : function(charset, data) {
				try {
					var uniConv = Components.classes[this.suniconvCID]
										.createInstance(this.suniconvIID);
					uniConv.charset = charset;
					data = uniConv.ConvertFromUnicode(data);
					// data += uniConv.Finish();
				}
				catch(e) {
					// foobar!
				}
				return data;
			}

		}
}).apply(_TrackerLib);