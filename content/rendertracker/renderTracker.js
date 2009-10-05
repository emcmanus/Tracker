RenderTracker.ns( function(){ with(RenderTracker) {


// Declarations
this.log = [];

this.panelBarReady = function( panelBar )
{
	initialize();
}

this.initialize = function()
{
	// Add observer
	// gBrowser.addProgressListener( this.progressListener, this.NOTIFY_ALL );
}

this.addHooks = function()
{
	// Add observer
	gBrowser.selectedBrowser.addProgressListener( this.progressListener, NOTIFY_ALL );
	
	// Clear log
	this.log = [];
	
	// Load new page
	gBrowser.selectedBrowser.contentWindow.location.href = "http://news.ycombinator.com/";
}

this.progressListener = 
{
	onStateChange: function(progress, request, flag, status)
    {
        if (flag & this.STATE_TRANSFERRING && flag & this.STATE_IS_DOCUMENT)
        {
			log.push("state transferring, document.", request.name );
            // var win = progress.DOMWindow;
            // if (win == win.parent)
            //     this.post(respondedTopWindow, [request, now(), progress]);
        }
        else if (flag & STATE_STOP && flag & STATE_IS_REQUEST)
        {
			log.push("state stop, state is request.", request.name );
            // if (this.getRequestFile(request))
            //     this.post(stopFile, [request, now()]);
        }
    },

    onProgressChange : function(progress, request, current, max, total, maxTotal)
    {
		log.push("progress change: " + request.name );
		return;
		// this.post(progressFile, [request, current, max]);
    },

    stateIsRequest: false,
    onLocationChange: function() {},
    onStatusChange : function() {},
    onSecurityChange : function() {},
    onLinkIconAvailable : function() {},
	
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
    }
}

window.addEventListener("load", function() { addHooks() }, false);

}});	// RenderTracker.ns