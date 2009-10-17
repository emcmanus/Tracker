Render Tracker
====================================

*A Firefox extension that logs the render performance for a particular web page.*


#### Building ####

`ant pack`


#### Development Install ####

You can point Firefox to this repo and it'll load it up every time you restart Firefox.

Locate your profile folder and beneath it the profile you want to work with (e.g. /Users/`<user>`/Library/Application Support/Firefox/Profiles/`<profile_id>`.default).

Open the extensions/ folder, creating it if needed.

Create a new text file called `rendertracker@ed.mcmanus` and put the full path to this repo, with trailing slash, inside.

Next, delete your compreg.dat file to force Firefox to rebuild its component list.

Restart Firefox.


#### Usage ####

The extension looks for two command-line parameters: tracker\_target and tracker\_report_path for a single job, or tracker\_targets and tracker\_report\_paths for batch jobs.

Target is the URL to render, report path is the location of the log file.

Single Job Example:

./firefox-bin -P "Dev" -tracker\_target "http://google.com" -tracker\_report\_path "/tmp/out.js"

Batch Example:

./firefox-bin -P "Dev" -tracker\_targets "http://news.ycombinator.com,http://google.com" -tracker\_report_paths "/tmp/out1.js,/tmp/out2.js"
