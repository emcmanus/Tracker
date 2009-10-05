// Ripped from Firebug 1.4, under a BSD license
// ************************************************************************************************

this.NetProgress = function(context)
{
    this.context = context;

    var queue = null;
    var panel = null;

    this.post = function(handler, args)
    {
        if (panel)
        {
            var file = handler.apply(this, args);
            if (file)
            {
                 panel.updateFile(file);
                return file;
            }
        }
        else
        {
            if (queue.length/2 >= maxQueueRequests)
                queue.splice(0, 2);
            queue.push(handler, args);
        }
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

    this.update = function(file)
    {
        if (panel)
            panel.updateFile(file);
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

NetProgress.prototype =
{
    panel: null,

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    respondedTopWindow: function(request, time, webProgress)
    {
        var win = webProgress ? safeGetWindow(webProgress) : null;
        this.requestedFile(request, time, win);
        return this.respondedFile(request, time);
    },

    requestedFile: function(request, time, win, category) // XXXjjb 3rd arg was webProgress, pulled safeGetWindow up
    {
        // XXXjjb to allow spy to pass win.  var win = webProgress ? safeGetWindow(webProgress) : null;
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

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    getRequestFile: function(request, win)
    {
        var name = safeGetName(request);
        if (!name || reIgnore.exec(name))
            return null;

        var index = this.requests.indexOf(request);
        if (index == -1)
        {
            var file = this.requestMap[name];
            if (file)
                return file;

            if (!win || getRootWindow(win) != this.context.window)
                return;

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

            return file;
        }
        else
            return this.files[index];
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

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

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

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

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

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
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

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // nsIObserver

    observe: function(request, topic, data)
    {
        request = QI(request, nsIHttpChannel);
        if (topic == "http-on-modify-request")
        {
            var webProgress = getRequestWebProgress(request, this);
            var category = getRequestCategory(request);
            var win = webProgress ? safeGetWindow(webProgress) : null;
            this.post(requestedFile, [request, now(), win, category]);
        }
        else
        {
            this.post(respondedFile, [request, now()]);
        }
    },

    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
    // nsIWebProgressListener

    onStateChange: function(progress, request, flag, status)
    {
        if (flag & STATE_TRANSFERRING && flag & STATE_IS_DOCUMENT)
        {
            var win = progress.DOMWindow;
            if (win == win.parent)
                this.post(respondedTopWindow, [request, now(), progress]);
        }
        else if (flag & STATE_STOP && flag & STATE_IS_REQUEST)
        {
            if (this.getRequestFile(request))
                this.post(stopFile, [request, now()]);
        }
    },

    onProgressChange : function(progress, request, current, max, total, maxTotal)
    {
        this.post(progressFile, [request, current, max]);
    },

    stateIsRequest: false,
    onLocationChange: function() {},
    onStatusChange : function() {},
    onSecurityChange : function() {},
    onLinkIconAvailable : function() {}
};

// ************************************************************************************************

this.NetDocument = function()
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

// ************************************************************************************************

this.NetFile = function(href, document)
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


// ************************************************************************************************
// Local Helpers

this.monitorContext = function(context)
{
    if (!context.netProgress)
    {
        var listener = context.netProgress = new NetProgress(context);

        context.browser.addProgressListener(listener, NOTIFY_ALL);

        observerService.addObserver(listener, "http-on-modify-request", false);
        observerService.addObserver(listener, "http-on-examine-response", false);
    }
}

this.unmonitorContext = function(context)
{
    if (context.netProgress)
    {
        if (context.browser.docShell)
            context.browser.removeProgressListener(context.netProgress, NOTIFY_ALL);

        // XXXjoe We also want to do this when the context is hidden, so that
        // background files are only logged in the currently visible context
        observerService.removeObserver(context.netProgress, "http-on-modify-request", false);
        observerService.removeObserver(context.netProgress, "http-on-examine-response", false);

        delete context.netProgress;
    }
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

this.initCacheSession = function()
{
    if (!cacheSession)
    {
        var cacheService = CacheService.getService(nsICacheService);
        cacheSession = cacheService.createSession("HTTP", STORE_ANYWHERE, true);
        cacheSession.doomEntriesIfExpired = false;
    }
}

this.waitForCacheCompletion = function(request, file, netProgress)
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
            ERROR(exc);
            netProgress.post(cacheEntryReady, [request, file, -1]);
        }
    }
}

this.getCacheEntry = function(file, netProgress)
{
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
            ERROR(exc);
        }
    });
}

this.getDateFromSeconds = function(s)
{
    var d = new Date();
    d.setTime(s*1000);
    return d;
}

this.getHttpHeaders = function(request, file)
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
        if (!file.responseHeaders && Firebug.collectHttpHeaders)
        {
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
        }
    }
    catch (exc)
    {
    }
}

this.getRequestWebProgress = function(request, netProgress)
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
            // XXXjjb Joe review: code above sets bypass, so this stmt should be in if (gives exceptions otherwise)
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

this.getRequestCategory = function(request)
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

this.getRequestElement = function(request)
{
    if (request instanceof imgIRequest)
    {
        if (request.decoderObserver && request.decoderObserver instanceof Element)
        {
            return request.decoderObserver;
        }
    }
}

this.safeGetWindow = function(webProgress)
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

this.safeGetName = function(request)
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

this.getFileCategory = function(file)
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

this.getMimeType = function(request)
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

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

this.now = function()
{
    return (new Date()).getTime();
}

this.getFrameLevel = function(win)
{
    var level = 0;

    for (; win && win != win.parent; win = win.parent)
        ++level;

    return level;
}

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *