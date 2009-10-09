/**
 *	A Note on our namespacing
 * 	
 * 	We want to be able to execute all code in the scope of some global namespace, like RenderTracker.
 *	To do this, we use both the "with" statement and apply(). Apply lets us resolve "this", while "with"
 *	sets our scope to the target namespace.
 *
 */

// --------------------------------------------------
// XPCOMUtils
// --------------------------------------------------

function RenderTracker() {}

(function() { with(RenderTracker){
	
	// XPCOM Utilities
	
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
	
}}).apply(RenderTracker);


// --------------------------------------------------
// General Extension Framework
// --------------------------------------------------

(function(){ with(RenderTracker){
	
	this.ns = function( fn )
	{
		fn.apply( this );
	}
	
	// 
	// Window iteration
	//

	this.iterateWindows = function(win, handler)
	{
	    if (!win || !win.document)
	        return;

	    handler(win);

	    if (win == top) return; // XXXjjb hack for chromeBug

	    for (var i = 0; i < win.frames.length; ++i)
	    {
	        var subWin = win.frames[i];
	        if (subWin != win)
	            this.iterateWindows(subWin, handler);
	    }
	};

	this.getRootWindow = function(win)
	{
	    for (; win; win = win.parent)
	    {
	        if (!win.parent || win == win.parent)
	            return win;
	    }
	    return null;
	};
	
	//
	// DOM queries
	//

	this.$ = function(id, doc)
	{
	    if (doc)
	        return doc.getElementById(id);
	    else
	        return document.getElementById(id);
	};

	this.getChildByClass = function(node)
	{
	    for (var i = 1; i < arguments.length; ++i)
	    {
	        var className = arguments[i];
	        var child = node.firstChild;
	        node = null;
	        for (; child; child = child.nextSibling)
	        {
	            if (this.hasClass(child, className))
	            {
	                node = child;
	                break;
	            }
	        }
	    }

	    return node;
	};

	this.getAncestorByClass = function(node, className)
	{
	    for (var parent = node; parent; parent = parent.parentNode)
	    {
	        if (this.hasClass(parent, className))
	            return parent;
	    }

	    return null;
	};

	this.getElementByClass = function(node, className)
	{
	    for (var child = node.firstChild; child; child = child.nextSibling)
	    {
	        if (this.hasClass(child, className))
	            return child;
	        else
	        {
	            var found = this.getElementByClass(child, className);
	            if (found)
	                return found;
	        }
	    }

	    return null;
	};

	this.isAncestor = function(node, potentialAncestor)
	{
	    for (var parent = node; parent; parent = parent.parentNode)
	    {
	        if (parent == potentialAncestor)
	            return true;
	    }

	    return false;
	};

	this.getNextElement = function(node)
	{
	    while (node && node.nodeType != 1)
	        node = node.nextSibling;

	    return node;
	};

	this.getPreviousElement = function(node)
	{
	    while (node && node.nodeType != 1)
	        node = node.previousSibling;

	    return node;
	};

	this.getBody = function(doc)
	{
	    if (doc.body)
	        return doc.body;

	    return doc.getElementsByTagName("body")[0];
	};

	this.findNextDown = function(node, criteria)
	{
	    if (!node)
	        return null;

	    for (var child = node.firstChild; child; child = child.nextSibling)
	    {
	        if (criteria(child))
	            return child;

	        var next = this.findNextDown(child, criteria);
	        if (next)
	            return next;
	    }
	};

	this.findPreviousUp = function(node, criteria)
	{
	    if (!node)
	        return null;

	    for (var child = node.lastChild; child; child = child.previousSibling)
	    {
	        var next = this.findPreviousUp(child, criteria);
	        if (next)
	            return next;

	        if (criteria(child))
	            return child;
	    }
	};

	this.findNext = function(node, criteria, upOnly, maxRoot)
	{
	    if (!node)
	        return null;

	    if (!upOnly)
	    {
	        var next = this.findNextDown(node, criteria);
	        if (next)
	            return next;
	    }

	    for (var sib = node.nextSibling; sib; sib = sib.nextSibling)
	    {
	        if (criteria(sib))
	            return sib;

	        var next = this.findNextDown(sib, criteria);
	        if (next)
	            return next;
	    }

	    if (node.parentNode && node.parentNode != maxRoot)
	        return this.findNext(node.parentNode, criteria, true);
	};

	this.findPrevious = function(node, criteria, downOnly, maxRoot)
	{
	    if (!node)
	        return null;

	    for (var sib = node.previousSibling; sib; sib = sib.previousSibling)
	    {
	        var prev = this.findPreviousUp(sib, criteria);
	        if (prev)
	            return prev;

	        if (criteria(sib))
	            return sib;
	    }

	    if (!downOnly)
	    {
	        var next = this.findPreviousUp(node, criteria);
	        if (next)
	            return next;
	    }

	    if (node.parentNode && node.parentNode != maxRoot)
	    {
	        if (criteria(node.parentNode))
	            return node.parentNode;

	        return this.findPrevious(node.parentNode, criteria, true);
	    }
	};

	this.getNextByClass = function(root, state)
	{
	    function iter(node) { return node.nodeType == 1 && FBL.hasClass(node, state); }
	    return this.findNext(root, iter);
	};

	this.getPreviousByClass = function(root, state)
	{
	    function iter(node) { return node.nodeType == 1 && FBL.hasClass(node, state); }
	    return this.findPrevious(root, iter);
	};

	this.hasChildElements = function(node)
	{
	    if (node.contentDocument) // iframes
	        return true;

	    for (var child = node.firstChild; child; child = child.nextSibling)
	    {
	        if (child.nodeType == 1)
	            return true;
	    }

	    return false;
	};

	this.isElement = function(o)
	{
	    try {
	        return o && o instanceof Element;
	    }
	    catch (ex) {
	        return false;
	    }
	};

	this.isNode = function(o)
	{
	    try {
	        return o && o instanceof Node;
	    }
	    catch (ex) {
	        return false;
	    }
	};
	
}}).apply(RenderTracker);



// --------------------------------------------------
// Net Flags
// --------------------------------------------------

RenderTracker.ns( function(){ with(RenderTracker) {
	
	// Contstants
	
	this.nsIWebProgressListener = CI("nsIWebProgressListener")
	this.nsIWebProgress = CI("nsIWebProgress")
	this.nsIRequest = CI("nsIRequest")
	this.nsIChannel = CI("nsIChannel")
	this.nsIHttpChannel = CI("nsIHttpChannel")
	this.nsICacheService = CI("nsICacheService")
	this.nsICache = CI("nsICache")
	this.nsIObserverService = CI("nsIObserverService")
	this.nsISupportsWeakReference = CI("nsISupportsWeakReference")
	this.nsISupports = CI("nsISupports")
	this.nsIIOService = CI("nsIIOService")
	this.imgIRequest = CI("imgIRequest");

	this.CacheService = CC("@mozilla.org/network/cache-service;1");
	this.ImgCache = CC("@mozilla.org/image/cache;1");
	this.IOService = CC("@mozilla.org/network/io-service;1");

	this.NOTIFY_ALL = nsIWebProgress.NOTIFY_ALL;

	this.STATE_IS_WINDOW = nsIWebProgressListener.STATE_IS_WINDOW;
	this.STATE_IS_DOCUMENT = nsIWebProgressListener.STATE_IS_DOCUMENT;
	this.STATE_IS_NETWORK = nsIWebProgressListener.STATE_IS_NETWORK;
	this.STATE_IS_REQUEST = nsIWebProgressListener.STATE_IS_REQUEST;

	this.STATE_START = nsIWebProgressListener.STATE_START;
	this.STATE_STOP = nsIWebProgressListener.STATE_STOP;
	this.STATE_TRANSFERRING = nsIWebProgressListener.STATE_TRANSFERRING;

	this.LOAD_BACKGROUND = nsIRequest.LOAD_BACKGROUND;
	this.LOAD_FROM_CACHE = nsIRequest.LOAD_FROM_CACHE;
	this.LOAD_DOCUMENT_URI = nsIChannel.LOAD_DOCUMENT_URI;

	this.ACCESS_READ = nsICache.ACCESS_READ;
	this.STORE_ANYWHERE = nsICache.STORE_ANYWHERE;

	this.NS_ERROR_CACHE_KEY_NOT_FOUND = 0x804B003D;
	this.NS_ERROR_CACHE_WAIT_FOR_VALIDATION = 0x804B0040;


	this.observerService = CCSV("@mozilla.org/observer-service;1", "nsIObserverService");

	// ----------------------------------------------------

	this.maxPendingCheck = 200;
	this.maxQueueRequests = 50;

	this.mimeExtensionMap =
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

	this.fileCategories =
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

	this.textFileCategories =
	{
	    "txt": 1,
	    "html": 1,
	    "xhr": 1,
	    "css": 1,
	    "js": 1
	};

	this.binaryFileCategories =
	{
	    "bin": 1,
	    "flash": 1
	};

	this.mimeCategoryMap =
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

	this.binaryCategoryMap =
	{
	    "image": 1,
	    "flash" : 1
	};
}});