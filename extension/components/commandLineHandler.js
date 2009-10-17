const nsISupports           = Components.interfaces.nsISupports;
const nsICategoryManager    = Components.interfaces.nsICategoryManager;
const nsIComponentRegistrar = Components.interfaces.nsIComponentRegistrar;
const nsICommandLine        = Components.interfaces.nsICommandLine;
const nsICommandLineHandler = Components.interfaces.nsICommandLineHandler;
const nsIFactory            = Components.interfaces.nsIFactory;
const nsIModule             = Components.interfaces.nsIModule;
const nsIWindowWatcher      = Components.interfaces.nsIWindowWatcher;

// Unique
const CHROME_URI = "chrome://browser/content/";
const clh_contractID = "@mozilla.org/commandlinehandler/general-startup;1?type=rendertracker";
const clh_CID = Components.ID("{f4eace90-bacb-11de-8a39-0800200c9a66}");
const clh_category = "m-rendertracker";

/**
 * Opens a chrome window.
 * @param aChromeURISpec a string specifying the URI of the window to open.
 * @param aArgument an argument to pass to the window (may be null)
 */
function openWindow(aChromeURISpec, aArgument)
{
  var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
    getService(Components.interfaces.nsIWindowWatcher);
  ww.openWindow(null, aChromeURISpec, "_blank",
                "chrome,dialog=no",
                aArgument);
}

/**
 * The XPCOM component that implements nsICommandLineHandler.
 * It also implements nsIFactory to serve as its own singleton factory.
 */
const myAppHandler = {
  
  wrappedJSObject: {
	targetURIs: [],
    reportPaths: []
  },
  
  /* nsISupports */
  QueryInterface : function clh_QI(iid)
  {
    if (iid.equals(nsICommandLineHandler) ||
        iid.equals(nsIFactory) ||
        iid.equals(nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* nsICommandLineHandler */

  handle : function clh_handle(cmdLine)
  {

	var uristr, uristrs, deststr, deststrs;

	// Single Job

	try
	{
		// -tracker_target [URL]
		uristr = cmdLine.handleFlagWithParam("tracker_target", false);
		if (uristr)
		{
			this.wrappedJSObject.targetURIs.push( uristr );
			cmdLine.preventDefault = true;
		}
	}
	catch (e)
	{
		Components.utils.reportError("incorrect parameter passed to -tracker_target on the command line.");
	}

	try
	{
		// -tracker_report_path [path]
		deststr = cmdLine.handleFlagWithParam("tracker_report_path", false);
		if (deststr)
		{
			this.wrappedJSObject.reportPaths.push( deststr );
			cmdLine.preventDefault = true;
		}
	}
	catch (e)
	{
		Components.utils.reportError("incorrect parameter passed to -tracker_report_path on the command line.");
	}
	
	// Batch

	try
	{
		// -tracker_targets [comma-separated paths]
		uristrs = cmdLine.handleFlagWithParam("tracker_targets", false);
		if (uristrs)
		{
			this.wrappedJSObject.targetURIs = uristrs.split(",");
			cmdLine.preventDefault = true;
		}
	}
	catch (e)
	{
		Components.utils.reportError("incorrect parameter passed to -tracker_targets on the command line.");
	}

	try
	{
		// -tracker_report_paths [comma-separated paths]
		deststrs = cmdLine.handleFlagWithParam("tracker_report_paths", false);
		if (deststrs)
		{
			this.wrappedJSObject.reportPaths = deststrs.split(",");
			cmdLine.preventDefault = true;
		}
	}
	catch (e)
	{
		Components.utils.reportError("incorrect parameter passed to -tracker_report_paths on the command line.");
	}
	
	// Enter branch when there's a) an error, or b) we've set both vars
	// if ( (this.wrappedJSObject.reportPath && this.wrappedJSObject.targetURIs.length) )
	// {
		var blankURI = cmdLine.resolveURI( "about:blank" );
		openWindow(CHROME_URI, blankURI);
	// }
  },

  helpInfo : "  -tracker_target <uri>\n" +
             "  -tracker_report_path <path>\n",

  /* nsIFactory */

  createInstance : function clh_CI(outer, iid)
  {
    if (outer != null)
      throw Components.results.NS_ERROR_NO_AGGREGATION;

    return this.QueryInterface(iid);
  },

  lockFactory : function clh_lock(lock)
  {
    /* no-op */
  }
};

/**
 * The XPCOM glue that implements nsIModule
 */
const myAppHandlerModule = {
  /* nsISupports */
  QueryInterface : function mod_QI(iid)
  {
    if (iid.equals(nsIModule) ||
        iid.equals(nsISupports))
      return this;

    throw Components.results.NS_ERROR_NO_INTERFACE;
  },

  /* nsIModule */
  getClassObject : function mod_gch(compMgr, cid, iid)
  {
	// Components.utils.reportError("CID: " + cid);
    if (cid.equals(clh_CID))
      return myAppHandler.QueryInterface(iid);

    throw Components.results.NS_ERROR_NOT_REGISTERED;
  },

  registerSelf : function mod_regself(compMgr, fileSpec, location, type)
  {
    compMgr.QueryInterface(nsIComponentRegistrar);

    compMgr.registerFactoryLocation(clh_CID,
                                    "myAppHandler",
                                    clh_contractID,
                                    fileSpec,
                                    location,
                                    type);

    var catMan = Components.classes["@mozilla.org/categorymanager;1"].
      getService(nsICategoryManager);
    catMan.addCategoryEntry("command-line-handler",
                            clh_category,
                            clh_contractID, true, true);
  },

  unregisterSelf : function mod_unreg(compMgr, location, type)
  {
    compMgr.QueryInterface(nsIComponentRegistrar);
    compMgr.unregisterFactoryLocation(clh_CID, location);

    var catMan = Components.classes["@mozilla.org/categorymanager;1"].
      getService(nsICategoryManager);
    catMan.deleteCategoryEntry("command-line-handler", clh_category);
  },

  canUnload : function (compMgr)
  {
    return true;
  }
};

/* The NSGetModule function is the magic entry point that XPCOM uses to find what XPCOM objects
 * this component provides
 */
function NSGetModule(comMgr, fileSpec)
{
  return myAppHandlerModule;
}