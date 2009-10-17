
/**************************************
	Tracker Implementation
**************************************/

(function(){ with(_TrackerLib){
	

/****************************************************************************************************************
 * Global Vars
 */

var progressListener;

var cacheSession = null;

var logFile = null;


/****************************************************************************************************************
 * Global Constants
 */

// Settings
const ALLOW_CACHE = false;
const ALLOW_POPUPS = false;
const ALLOW_REDIRECTS = false;
const ALLOW_CONTENT_REFRESHES = false;

const THROTTLE_MESSAGES = false;
const COLLECT_HTTP_HEADERS = true;

const DEFER_HEADER_COLLECTION = true;

const TIKHON_SUCKS = true;

// Aliases
const nsIPrefBranch = CI("nsIPrefBranch");
const nsIPrefBranch2 = CI("nsIPrefBranch2");
const nsIPermissionManager = CI("nsIPermissionManager");
const nsIFile = CI("nsIFile");
const nsILocalFile = CI("nsILocalFile");
const nsISafeOutputStream = CI("nsISafeOutputStream");
const nsIURI = CI("nsIURI");

const PrefService = CC("@mozilla.org/preferences-service;1");
const PermManager = CC("@mozilla.org/permissionmanager;1");
const DirService =  CCSV("@mozilla.org/file/directory_service;1", "nsIDirectoryServiceProvider");

// Our component, contains command-line parameters
const trackerService = CC("@mozilla.org/commandlinehandler/general-startup;1?type=rendertracker").getService().wrappedJSObject;

const prefs = PrefService.getService(nsIPrefBranch2);
const pm = PermManager.getService(nsIPermissionManager);

const DENY_ACTION = nsIPermissionManager.DENY_ACTION;
const ALLOW_ACTION = nsIPermissionManager.ALLOW_ACTION;

const nsIWebProgressListener = CI("nsIWebProgressListener");
const nsIWebNavigation = CI("nsIWebNavigation");
const nsIWebProgress = CI("nsIWebProgress");
const nsIRequest = CI("nsIRequest");
const nsIChannel = CI("nsIChannel");
const nsIHttpChannel = CI("nsIHttpChannel");
const nsICacheService = CI("nsICacheService");
const nsICache = CI("nsICache");
const nsIObserverService = CI("nsIObserverService");
const nsISupportsWeakReference = CI("nsISupportsWeakReference");
const nsISupports = CI("nsISupports");
const nsIIOService = CI("nsIIOService");
const imgIRequest = CI("imgIRequest");

const CacheService = CC("@mozilla.org/network/cache-service;1");
const ImgCache = CC("@mozilla.org/image/cache;1");
const IOService = CC("@mozilla.org/network/io-service;1");

const NOTIFY_ALL = nsIWebProgress.NOTIFY_ALL;

const STOP_ALL = nsIWebNavigation.STOP_ALL;

const STATE_IS_WINDOW = nsIWebProgressListener.STATE_IS_WINDOW;
const STATE_IS_DOCUMENT = nsIWebProgressListener.STATE_IS_DOCUMENT;
const STATE_IS_NETWORK = nsIWebProgressListener.STATE_IS_NETWORK;
const STATE_IS_REQUEST = nsIWebProgressListener.STATE_IS_REQUEST;

const STATE_START = nsIWebProgressListener.STATE_START;
const STATE_STOP = nsIWebProgressListener.STATE_STOP;
const STATE_TRANSFERRING = nsIWebProgressListener.STATE_TRANSFERRING;

const LOAD_BACKGROUND = nsIRequest.LOAD_BACKGROUND;
const LOAD_FROM_CACHE = nsIRequest.LOAD_FROM_CACHE;
const LOAD_DOCUMENT_URI = nsIChannel.LOAD_DOCUMENT_URI;

const LOAD_FLAGS_BYPASS_PROXY = nsIWebNavigation.LOAD_FLAGS_BYPASS_PROXY;
const LOAD_FLAGS_BYPASS_CACHE = nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE;
const LOAD_FLAGS_NONE = nsIWebNavigation.LOAD_FLAGS_NONE;

const ACCESS_READ = nsICache.ACCESS_READ;
const STORE_ANYWHERE = nsICache.STORE_ANYWHERE;

const NS_ERROR_CACHE_KEY_NOT_FOUND = 0x804B003D;
const NS_ERROR_CACHE_WAIT_FOR_VALIDATION = 0x804B0040;

const observerService = CCSV("@mozilla.org/observer-service;1", "nsIObserverService");

const reIgnore = /about:|javascript:|resource:|chrome:|jar:/;

const layoutInterval = 300;
const phaseInterval = 1000;
const indentWidth = 18;

const maxPendingCheck = 200;
const maxQueueRequests = 50


/****************************************************************************************************************
 * Public
 */

_Tracker.initialize = function()
{
	// Add Hooks
	window.addEventListener("load", function(){ onWindowLoad(); }, false);
}

_Tracker.updateMessages = [];
_Tracker.flushUpdates = function()
{
	return _Tracker.updateMessages.join("\n");
}

_Tracker.logMessages = [];
_Tracker.flush = function()
{
	return _Tracker.logMessages.join("\n");
}

_Tracker.exit = function()
{
	var Application;
	
	// Track the number of window openings, if it exceeds our restartLimit kill the app
	if ( false )
	{
		Application = Components.classes["@mozilla.org/fuel/application;1"].getService(Components.interfaces.fuelIApplication);
		Application.quit();
	}
	else
	{
		// Otherwise just close the current window and leave the firefox server running
		gBrowser.selectedBrowser.contentWindow.close();
	}
}

_Tracker.progressListener = null;	// Ref to most recent progressListener
_Tracker.printFiles = function()
{
	// var report = "";
	var dest;
	var curFile = null;
	
	// Build Report Object
	var report = {};
	
	for ( var i=0; i<_Tracker.progressListener.files.length; i++ )
	{
		curFile = _Tracker.progressListener.files[i];
		
		dest = report[i] = {};
		
		for ( var property in curFile )
		{
			if (property)
				if (property=="requestHeaders" || property=="responseHeaders")
					dest[property] = curFile[property];
				else
					// Make sure we're not copying any pointers
					if ( typeof curFile[property] != 'function' && typeof curFile[property] != 'object' )
						dest[property] = curFile[property];
		}
	}
	
	var reportString = serialize(report);
	
	writeToReportFile( reportString );
	
	// Close window, leave firefox server instance running
	_Tracker.exit();
}


/****************************************************************************************************************
 * Private
 */

var writeToReportFile = function( str )
{
	if (!logFile)
		logFile = FileIO.open( trackerService.reportPath );
	
	if (logFile)
		if (!FileIO.write(logFile, str))
			Components.utils.reportError("Error writing to log file.");
	else
		Components.utils.reportError("Error opening log file.");
}

var onWindowLoad = function()
{
	// IMMEDIATELY stop load
	gBrowser.selectedBrowser.webNavigation.stop( STOP_ALL );
	
	
	// Setup check
	if ( typeof trackerService.reportPath == "undefined" || typeof trackerService.targetURI == "undefined" )
	{
		Components.utils.reportError("Did not supply appropriate command-line parameters -tracker_report_path and/or -tracker_target");
		return;
	}
	
	initialConfig();
	addEventHooks();
	
	// Load target page
	gBrowser.selectedBrowser.contentWindow.location.href = trackerService.targetURI;
	
	// Print report and exit
	setTimeout( function(){_Tracker.printFiles();}, 5000 );
}

var initialConfig = function()
{
	// Force our settings
	
	prefs.setBoolPref("browser.cache.disk.enable", ALLOW_CACHE); // cache
	prefs.setBoolPref("browser.cache.memory.enable", ALLOW_CACHE); // cache
	prefs.setBoolPref( "browser.accept.redirects", ALLOW_REDIRECTS ); // redirects
	prefs.setBoolPref( "browser.accept.refreshes", ALLOW_CONTENT_REFRESHES ); // content refresh
	
	if ( !ALLOW_POPUPS )
	{
		prefs.setCharPref( "capability.policy.default.windowinternal.open", "noAccess" );
	}
	
	// Startup page
	prefs.setCharPref( "browser.startup.homepage", "about:blank" ); // Default home page
	prefs.setIntPref( "browser.startup.homepage.count", 1 ); // Num tabs on startup
	prefs.setIntPref( "browser.startup.page", 0 ); // Blank start page - should override browser.startup.homepage
	prefs.setIntPref( "browser.tabs.loadOnNewTab", 0 ); // New tabs load about:blank
	prefs.setIntPref( "browser.windows.loadOnNewWindow", 0 ); // New windows load about:blank
	prefs.setBoolPref( "browser.update.resetHomepage", false ); // Do not reset homepage on update
	
	// Warnings
	prefs.setBoolPref( "browser.tabs.warnOnClose", false ); // Do not warn about multiple tabs when quiting
	prefs.setBoolPref( "browser.tabs.warnOnCloseOther", false ); // Do not warn about other tabs on "close other tabs"
	
	// Updates - Extensions
	prefs.setBoolPref( "extensions.checkCompatibility", false ); // Do not check extension compatability on upgrade
	prefs.setBoolPref( "extensions.checkUpdateSecurity", false ); // Do not check for secure updates
	prefs.setBoolPref( "extensions.update.autoUpdate", false ); // Automatically install extension updates
	prefs.setBoolPref( "extensions.update.autoUpdateEnabled", false ); // Disable extension update checking
	prefs.setBoolPref( "extensions.update.enabled", false ); // Do not check for updates
	prefs.setBoolPref( "extensions.update.notifyUser", false ); // Never notify the user of available updates
	
	// Updates - Browser
	prefs.setBoolPref( "app.update.enabled", false ); // Master pref
	prefs.setBoolPref( "update_notifications.enabled", false ); // Never notify the user of available updates
	prefs.setIntPref( "update_notifications.provider.0.frequency", 18250 ); // Check for updates every 50 years (in days)
	prefs.setIntPref( "update.interval", 1572480000000 ); // Check for updates every 50 years
	
	// Updating - Other
	prefs.setBoolPref( "browser.search.update", false ); // Do not check for search plugin updates
	
	// Microsummaries
	prefs.setBoolPref( "browser.microsummary.enabled", false ); // Disable microsummary updates
}

var addEventHooks = function()
{	
	var context = createContext();
	
	// Add Listeners
	_Tracker.progressListener = progressListener = new ProgressListener( context );
	
	context.progressListener = progressListener;
	
	gBrowser.selectedBrowser.addProgressListener( progressListener, NOTIFY_ALL );
	
	observerService.addObserver(progressListener, "http-on-modify-request", false);
    observerService.addObserver(progressListener, "http-on-examine-response", false);
}

function createContext()
{
	var context =
	{
		window: gBrowser.selectedBrowser.contentWindow,
		
		browser: gBrowser.selectedBrowser,
		
	    setTimeout: function()
	    {
	        var timeout = setTimeout.apply(top, arguments);

	        if (!this.timeouts)
	            this.timeouts = {};

	        this.timeouts[timeout] = 1;

	        return timeout;
	    },

	    clearTimeout: function(timeout)
	    {
	        clearTimeout(timeout);

	        if (this.timeouts)
	            delete this.timeouts[timeout];
	    },

	    setInterval: function()
	    {
	        var timeout = setInterval.apply(top, arguments);

	        if (!this.intervals)
	            this.intervals = {};

	        this.intervals[timeout] = 1;

	        return timeout;
	    },

	    clearInterval: function(timeout)
	    {
	        clearInterval(timeout);

	        if (this.intervals)
	            delete this.intervals[timeout];
	    },

	    delay: function(message, object)
	    {
	        this.throttle(message, object, null, true);
	    },

	    throttle: function(message, object, args, forceDelay)
	    {
	        if (!this.throttleInit)
	        {
	            this.throttleBuildup = 0;
	            this.throttleQueue = [];
	            this.throttleTimeout = 0;
	            this.lastMessageTime = 0;
	            this.throttleInit = true;
	        }

	        if (!forceDelay)
	        {
	            if (THROTTLE_MESSAGES)
	            {
	                message.apply(object, args);
	                return false;
	            }

	            // Count how many messages have been logged during the throttle period
	            var logTime = new Date().getTime();
	            if (logTime - this.lastMessageTime < throttleTimeWindow)
	                ++this.throttleBuildup;
	            else
	                this.throttleBuildup = 0;

	            this.lastMessageTime = logTime;

	            // If the throttle limit has been passed, enqueue the message to be logged later on a timer,
	            // otherwise just execute it now
	            if (!this.throttleQueue.length && this.throttleBuildup <= throttleMessageLimit)
	            {
	                message.apply(object, args);
	                return false;
	            }
	        }

	        this.throttleQueue.push(message, object, args);

	        if (this.throttleTimeout)
	            this.clearTimeout(this.throttleTimeout);

	        var self = this;
	        this.throttleTimeout =
	            this.setTimeout(function() { self.flushThrottleQueue(); }, throttleInterval);
	        return true;
	    },

	    flushThrottleQueue: function()
	    {
	        var queue = this.throttleQueue;

	        var max = throttleFlushCount * 3;
	        if (max > queue.length)
	            max = queue.length;

	        for (var i = 0; i < max; i += 3)
	            queue[i].apply(queue[i+1], queue[i+2]);

	        queue.splice(0, throttleFlushCount*3);

	        if (queue.length)
	        {
	            var self = this;
	            this.throttleTimeout =
	                this.setTimeout(function f() { self.flushThrottleQueue(); }, throttleInterval);
	        }
	        else
	            this.throttleTimeout = 0;
	    }
	}
	
	return context;
}

function initCacheSession()
{
    if (!cacheSession)
    {
        var cacheService = CacheService.getService(nsICacheService);
        cacheSession = cacheService.createSession("HTTP", STORE_ANYWHERE, true);
        cacheSession.doomEntriesIfExpired = false;
    }
}

function waitForCacheCompletion(request, file, netProgress)
{
    try
    {
        initCacheSession();
        var descriptor = cacheSession.openCacheEntry(file.href, ACCESS_READ, false);
        if (descriptor)
            netProgress.post(cacheEntryReady, [request, file, descriptor.dataSize]);
    }
    catch (exc)
    {
        if (exc.result != NS_ERROR_CACHE_WAIT_FOR_VALIDATION
            && exc.result != NS_ERROR_CACHE_KEY_NOT_FOUND)
        {
			if ( ALLOW_CACHE ) // we always enter this block when caching is disabled - ed
            	ERROR(exc);
			
            netProgress.post(netProgress.cacheEntryReady, [request, file, -1]);
        }
    }
}

function getCacheEntry(file, netProgress)
{	
	// Because we are bypassing the cache for all requests, we should never call this function.
	// It just updates the file properties in the event an asset is fetched from the cache - ed
	
    // Pause first because this is usually called from stopFile, at which point
    // the file's cache entry is locked
    setTimeout(function()
    {
        try
        {
            initCacheSession();
            cacheSession.asyncOpenCacheEntry(file.href, ACCESS_READ, {
                onCacheEntryAvailable: function(descriptor, accessGranted, status)
                {
                    if (descriptor)
                    {
                        if(file.size == -1)
                        {
                            file.size = descriptor.dataSize;
                        }
                        if(descriptor.lastModified && descriptor.lastFetched &&
                            descriptor.lastModified < Math.floor(file.startTime/1000)) {
                            file.fromCache = true;
                        }
                        file.cacheEntry = [
                          { name: "Last Modified",
                            value: getDateFromSeconds(descriptor.lastModified)
                          },
                          { name: "Last Fetched",
                            value: getDateFromSeconds(descriptor.lastFetched)
                          },
                          { name: "Data Size",
                            value: descriptor.dataSize
                          },
                          { name: "Fetch Count",
                            value: descriptor.fetchCount
                          },
                          { name: "Device",
                            value: descriptor.deviceID
                          }
                        ];
                        netProgress.update(file);
                    }
                }
            });
        }
        catch (exc)
        {
			if ( ALLOW_CACHE )	// we'll always enter this block when caching is disabled - ed 
            	ERROR(exc);
        }
    });
}

function inspect(obj, maxRecurs, level)
{
	if (level > maxRecurs)
	{
		return;
	}
	
	var type, str = "";
	
	function getTabs(v)
	{
		var s = "";
		for (var i=0; i<v; i++) s += "  ";
		return s;
	}
	
	level = level || 0;
	
	for( var property in obj )
	{
		try
		{
			type = typeof( obj[property] );
			
			if ( type == 'object' )
				str += getTabs(level) + property + ":\n" + inspect( obj[property], maxRecurs, level+1 );
			else if ( type != 'null' && type != 'function' )
				str += getTabs(level) + property + ': ' + obj[property] + "\n";
		}
		catch(e){}
	}
	
	return str;
}

function getDateFromSeconds(s)
{
    var d = new Date();
    d.setTime(s*1000);
    return d;
}

function getHttpHeaders(request, file)
{
    try
    {	
        var http = QI(request, nsIHttpChannel);
		
        file.method = http.requestMethod;
        file.status = request.responseStatus;
        file.urlParams = parseURLParams(file.href);

        if (!file.mimeType)
            file.mimeType = getMimeType(request);

        // Disable temporarily
        if (!file.responseHeaders && COLLECT_HTTP_HEADERS)
        {
			_Tracker.logMessages.push("Entered branch");
			
            var requestHeaders = [], responseHeaders = [];

            http.visitRequestHeaders({
                visitHeader: function(name, value)
                {
                    requestHeaders.push({name: name, value: value});
                }
            });
            http.visitResponseHeaders({
                visitHeader: function(name, value)
                {
                    responseHeaders.push({name: name, value: value});
                }
            });

            file.requestHeaders = requestHeaders;
            file.responseHeaders = responseHeaders;
			
			_Tracker.logMessages.push("should've set headers\n");
        }
    }
    catch (exc)
    {
		consoleWarning( "Catch. File: " + safeGetName(request) + ", error: " + exc );
    }
}

function getRequestWebProgress(request, netProgress)
{
    try
    {
        if (request.notificationCallbacks)
        {
            var bypass = false;
            if (request.notificationCallbacks instanceof XMLHttpRequest)
            {
                request.notificationCallbacks.channel.visitRequestHeaders(
                {
                    visitHeader: function(header, value)
                    {
                        if (header == "X-Moz" && value == "microsummary")
                            bypass = true;
                    }
                });
            }
            // XXXjjb Joe review: code above sets bypass,
			// so this stmt should be in if (gives exceptions otherwise)
            // The instanceof can't be used here. Fix for #434 [Honza]
            if (!bypass)
                return request.notificationCallbacks.getInterface(nsIWebProgress);
        }
    }
    catch (exc) {}

    try
    {
        if (request.loadGroup && request.loadGroup.groupObserver)
            return QI(request.loadGroup.groupObserver, nsIWebProgress);
    }
    catch (exc) {}
}

function getRequestCategory(request)
{
    try
    {
        if (request.notificationCallbacks)
        {
            if (request.notificationCallbacks instanceof XMLHttpRequest)
                return "xhr";
        }
    }
    catch (exc) {}
}

function getRequestElement(request)
{
    if (request instanceof imgIRequest)
    {
        if (request.decoderObserver && request.decoderObserver instanceof Element)
        {
            return request.decoderObserver;
        }
    }
}

function safeGetWindow(webProgress)
{
    try
    {
        return webProgress.DOMWindow;
    }
    catch (exc)
    {
        return null;
    }
}

function safeGetName(request)
{
    try
    {
        return request.name;
    }
    catch (exc)
    {
        return null;
    }
}

function getFileCategory(file)
{
    if (file.category)
        return file.category;

    if (!file.mimeType)
    {
        var ext = getFileExtension(file.href);
        if (ext)
            file.mimeType = mimeExtensionMap[ext.toLowerCase()];
    }

    return (file.category = mimeCategoryMap[file.mimeType]);
}

function getMimeType(request)
{
    var mimeType = request.contentType;
    if (!mimeType || !(mimeType in mimeCategoryMap))
    {
        var ext = getFileExtension(request.name);
        if (!ext)
            return mimeType;
        else
        {
            var extMimeType = mimeExtensionMap[ext.toLowerCase()];
            return extMimeType ? extMimeType : mimeType;
        }
    }
    else
        return mimeType;
}

function now()
{
    return (new Date()).getTime();
}

function getFrameLevel(win)
{
    var level = 0;

    for (; win && win != win.parent; win = win.parent)
        ++level;

    return level;
}


/****************************************************************************************************************
 * Classes
 */

function NetDocument()
{
    this.files = [];
}
NetDocument.prototype =
{
    loaded: false,

    addFile: function(request)
    {
        var file = new NetFile(request.name, this);
        this.files.push(file);

        if (this.files.length == 1)
            this.rootFile = file;

        return file;
    }
};


function NetFile(href, document)
{
    this.href = href;
    this.document = document
}
NetFile.prototype =
{
    status: 0,
    files: 0,
    loaded: false,
    fromCache: false,
    size: -1,
    expectedSize: -1,
    endTime: null
};


function ProgressListener( context )
{
	var queue = null;
	
	this.context = context;
	
    this.post = function(handler, args)
    {
        // if (panel)
        // {
            var file = handler.apply(this, args);
            if (file)
            {
				this.customUpdateFile(file);
                return file;
            }
        // }
        // else
        // {
        //     if (queue.length/2 >= maxQueueRequests)
        //         queue.splice(0, 2);
        //     queue.push(handler, args);
        // }
    };

    this.flush = function()
    {
        for (var i = 0; i < queue.length; i += 2)
        {
            var file = queue[i].apply(this, queue[i+1]);
            if (file)
                panel.updateFile(file);
        }

        queue = [];
    };

    this.activate = function(activePanel)
    {
        this.panel = panel = activePanel;
        if (panel)
            this.flush();
    };

	this.customUpdateFile = function(file)
	{
		// IMPLEMENT OUR RECORDING HERE!
		// _Tracker.updateMessages.push("href: " + file.href + ",\tstart: " + file.startTime + ",\tend: " + file.endTime);
	};

    this.update = function(file)
    {
		this.customUpdateFile(file);
    };

    this.clear = function()
    {
        this.requests = [];
        this.requestMap = {};
        this.files = [];
        this.phases = [];
        this.documents = [];
        this.windows = [];

        queue = [];
    };

    this.clear();
}
ProgressListener.prototype =
{
	//
	// Helpers
	
	respondedTopWindow: function(request, time, webProgress)
    {
        var win = webProgress ? safeGetWindow(webProgress) : null;
		// _Tracker.logMessages.push("\nin respondedTopWindow, win = " + win);	// Let's track code paths to see which calls are contributing null win's
        this.requestedFile(request, time, win);
        return this.respondedFile(request, time);
    },

    requestedFile: function(request, time, win, category)
    { 	// XXXjjb 3rd arg was webProgress, pulled safeGetWindow up
        // XXXjjb to allow spy to pass win. 
		// var win = webProgress ? safeGetWindow(webProgress) : null;
		// _Tracker.logMessages.push("in requestedFile (calling with win), win = " + win);	// Let's track code paths to see which calls are contributing null win's
        var file = this.getRequestFile(request, win);
        if (file)
        {
            // For cached image files, we may never hear another peep from any observers
            // after this point, so we have to assume that the file is cached and loaded
            // until we get a respondedFile call later
            file.startTime = file.endTime = time;
            //file.fromCache = true;
            //file.loaded = true;
            if (category && !file.category)
                file.category = category;
            file.isBackground = request.loadFlags & LOAD_BACKGROUND;

            this.awaitFile(request, file);
            this.extendPhase(file);

            return file;
        }
    },

    respondedFile: function(request, time)
    {
		// _Tracker.logMessages.push("\nin respondedFile calling with NO WINDOW");	// Let's track code paths to see which calls are contributing null win's
        var file = this.getRequestFile(request);
        if (file)
        {
            var endedAlready = !!file.endTime;

            file.respondedTime = time;
            file.endTime = time;

            if (request.contentLength > 0)
                file.size = request.contentLength;

            if (request.responseStatus == 304)
                file.fromCache = true;
            else if (!file.fromCache)
                file.fromCache = false;
			
			// if ( !DEFER_HEADER_COLLECTION )
            	getHttpHeaders(request, file);

            // This is a strange but effective tactic for simulating the
            // load of background images, which we can't actually track.
            // If endTime was set before this, that means the cache request
            // came back, which only seems to happen for background images.
            // We thus end the load now, since we know we'll never hear
            // from these requests again.
            if (endedAlready)
                this.endLoad(file);

            return file;
        }
    },

    progressFile: function(request, progress, expectedSize)
    {
		// _Tracker.logMessages.push("\nin progressFile calling with NO WINDOW");	// Let's track code paths to see which calls are contributing null win's
        var file = this.getRequestFile(request);
        if (file)
        {
            file.size = progress;
            file.expectedSize = expectedSize;

            this.arriveFile(file, request);

            return file;
        }
    },

    stopFile: function(request, time, postText, responseText)
    {
		// _Tracker.logMessages.push("\nin stopFile calling with NO WINDOW");	// Let's track code paths to see which calls are contributing null win's
        var file = this.getRequestFile(request);
        if (file)
        {
            file.endTime = time;
            file.postText = postText;
            file.responseText = responseText;

            // XXXjoe Nice work, pavlov.  This crashes randomly when it access decoderObserver.
            //file.sourceObject = getRequestElement(request);

            getHttpHeaders(request, file);

            this.arriveFile(file, request);
            this.endLoad(file);
			
	        getCacheEntry(file, this);
			
            return file;
        }
    },

    cacheEntryReady: function(request, file, size)
    {
        file.loaded = true;
        if (size != -1)
            file.size = size;

        getHttpHeaders(request, file);

        this.arriveFile(file, request);
        this.endLoad(file);

        return file;
    },

    //  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *

    getRequestFile: function(request, win)
    {
		// _Tracker.logMessages.push("entered getRequestFile");
		
        var name = safeGetName(request);
        if (!name || reIgnore.exec(name))
		{
			// _Tracker.logMessages.push("exit, no name or ignore name: " + (name || "") + "\n");
            return null;
		}

        var index = this.requests.indexOf(request);
        if (index == -1)
        {
			// _Tracker.logMessages.push("could not find matching request");
            var file = this.requestMap[name];
            if (file)
			{
				// _Tracker.logMessages.push("RETURNING FILE, even though there was no associated request. name: " + name + "\n");
                return file;
			}
			
			// FOLLOWING COND IS DEBUG
			if (!this.context)
			{
				// _Tracker.logMessages.push("this.context is NULL");
			}
			
            if (!win || getRootWindow(win) != this.context.window)
			{
				// _Tracker.logMessages.push("could not find file. early EXIT. no window, or event from incorrect window. request name: " + name + "\n");
				return;
			}
			
            var fileDoc = this.getRequestDocument(win);
            var isDocument = request.loadFlags & LOAD_DOCUMENT_URI && fileDoc.parent;
            var doc = isDocument ? fileDoc.parent : fileDoc;

            file = doc.addFile(request);
            if (isDocument)
            {
                fileDoc.documentFile = file;
                file.ownDocument = fileDoc;
            }

            if (!this.rootFile)
                this.rootFile = file;  // don't set file.previousFile
            else
                file.previousFile = this.files[this.files.length-1];

            file.request = request;
            file.index = this.files.length;
            this.requestMap[name] = file;
            this.requests.push(request);
            this.files.push(file);
			
			// _Tracker.logMessages.push("Adding new file to requests. RETURNING NEW FILE, name: " + name);
            return file;
        }
        else
		{
			// _Tracker.logMessages.push("existing file, existing request. RETURNING FILE, name: " + name + " \n");
            return this.files[index];
		}
    },

    getRequestDocument: function(win)
    {
        if (win)
        {
            var index = this.windows.indexOf(win);
            if (index == -1)
            {
                var doc = new NetDocument(win);  // XXXjjb arg ignored
                if (win.parent != win)
                    doc.parent = this.getRequestDocument(win.parent);

                doc.index = this.documents.length;
                doc.level = getFrameLevel(win);

                this.documents.push(doc);
                this.windows.push(win);

                return doc;
            }
            else
                return this.documents[index];
        }
        else
            return this.documents[0];
    },

    //  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *

    awaitFile: function(request, file)
    {
        if (!this.pending)
            this.pending = [];

        // XXXjoe Remove files after they have been checked N times
        if (!this.pendingInterval)
        {
            this.pendingInterval = this.context.setInterval(bindFixed(function()
            {
                for (var i = 0; i < this.pending.length; ++i)
                {
                    var file = this.pending[i];
                    if (file.pendingCount > maxPendingCheck)
                    {
                        this.post(cacheEntryReady, [request, file, 0]);
                        this.pending.splice(i, 0);
                        --i;
                    }
                    else
                        waitForCacheCompletion(request, file, this);
                }
            }, this), 300);
        }

        file.pendingIndex = this.pending.length;
        this.pending.push(file);
    },

    arriveFile: function(file, request)
    {
        delete this.requestMap[file.href];

        var index = this.pending.indexOf(file);
        if (index != -1)
            this.pending.splice(index, 1);

        if (!this.pending.length)
        {
            this.context.clearInterval(this.pendingInterval);
            delete this.pendingInterval;
        }
    },

    //  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *  *

    endLoad: function(file)
    {
        file.loaded = true;

        file.phase.phaseLastEnd = file;
        if (!file.phase.phaseLastEndTime || file.endTime > file.phase.phaseLastEndTime)
            file.phase.phaseLastEndTime = file.endTime;
    },

    extendPhase: function(file)
    {
        if (this.currentPhase)
        {
            var phaseLastStart = this.currentPhase.phaseLastStart;

            if (this.loaded && file.startTime - phaseLastStart.startTime >= phaseInterval)
                this.startPhase(file, phaseLastStart);
            else
                file.phase = this.currentPhase;
        }
        else
            this.startPhase(file, null);

        file.phase.phaseLastStart = file;
    },

    startPhase: function(file, phaseLastStart)
    {
        if (phaseLastStart)
            phaseLastStart.endPhase = true;

        file.phase = this.currentPhase = file;
        file.startPhase = true;

        this.phases.push(file);
    },
	
	
	//
    // nsISupports

    QueryInterface: function(iid)
    {
        if (iid.equals(nsIWebProgressListener)
            || iid.equals(nsISupportsWeakReference)
            || iid.equals(nsISupports))
        {
            return this;
        }

        throw Components.results.NS_NOINTERFACE;
    },
	
	//
    // nsIObserver

    observe: function(request, topic, data)
    {
        request = QI(request, nsIHttpChannel);
        if (topic == "http-on-modify-request")
        {
            var webProgress = getRequestWebProgress(request, this);
            var category = getRequestCategory(request);
            var win = webProgress ? safeGetWindow(webProgress) : null;
            this.post(this.requestedFile, [request, now(), win, category]);
        }
        else
        {
            this.post(this.respondedFile, [request, now()]);
        }
    },

	//
    // nsIWebProgressListener

    onStateChange: function(progress, request, flag, status)
    {
        if (flag & STATE_TRANSFERRING && flag & STATE_IS_DOCUMENT)
        {
            var win = progress.DOMWindow;
            if (win == win.parent)
                this.post(this.respondedTopWindow, [request, now(), progress]);
        }
        else if (flag & STATE_STOP && flag & STATE_IS_REQUEST)
        {
			// _Tracker.logMessages.push("\nin onStateChange STATE_STOP branch, calling getRequestFile with NO WINDOW");	// Let's track code paths to see which calls are contributing null win's
            if (this.getRequestFile(request))
                this.post(this.stopFile, [request, now()]);
        }
    },

    onProgressChange : function(progress, request, current, max, total, maxTotal)
    {
        this.post(this.progressFile, [request, current, max]);
    },
	
    stateIsRequest: false,
    onLocationChange: function() {}, onStatusChange : function() {},
	onSecurityChange : function() {}, onLinkIconAvailable : function() {}
};


/****************************************************************************************************************
 * Maps
 */

const mimeExtensionMap =
{
    "txt": "text/plain",
    "html": "text/html",
    "htm": "text/html",
    "xhtml": "text/html",
    "xml": "text/xml",
    "css": "text/css",
    "js": "application/x-javascript",
    "jss": "application/x-javascript",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "png": "image/png",
    "bmp": "image/bmp",
    "swf": "application/x-shockwave-flash"
};

const fileCategories =
{
    "undefined": 1,
    "html": 1,
    "css": 1,
    "js": 1,
    "xhr": 1,
    "image": 1,
    "flash": 1,
    "txt": 1,
    "bin": 1
};

const textFileCategories =
{
    "txt": 1,
    "html": 1,
    "xhr": 1,
    "css": 1,
    "js": 1
};

const binaryFileCategories =
{
    "bin": 1,
    "flash": 1
};

const mimeCategoryMap =
{
    "text/plain": "txt",
    "application/octet-stream": "bin",
    "text/html": "html",
    "text/xml": "html",
    "text/css": "css",
    "application/x-javascript": "js",
    "text/javascript": "js",
    "image/jpeg": "image",
    "image/gif": "image",
    "image/png": "image",
    "image/bmp": "image",
    "application/x-shockwave-flash": "flash"
};

const binaryCategoryMap =
{
    "image": 1,
    "flash" : 1
};


/****************************************************************************************************************
 * Local Utils
 */

function $(id, doc)
{
    if (doc)
        return doc.getElementById(id);
    else
        return document.getElementById(id);
}

function cloneArray(array, fn)
{
   var newArray = [];

   for (var i = 0; i < array.length; ++i)
       newArray.push(array[i]);

   return newArray;
}

function bindFixed()
{
    var args = cloneArray(arguments), fn = args.shift(), object = args.shift();
    return function() { return fn.apply(object, args); }
}


}}).apply({});



/**************************************
	Initializer
**************************************/


_Tracker.initialize();