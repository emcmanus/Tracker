Render Tracker
====================================

*A Firefox extension that logs the render performance for a particular web page.*


#### Building ####

`ant pack`


#### Development Install ####

You can point Firefox to this repo and it'll load it up every time you restart Firefox.

Locate your profile folder and beneath it the profile you want to work with (e.g. /Users/`<user>`/Library/Application Support/Firefox/Profiles/`<profile_id>`.default).

Open the extensions/ folder, creating it if need be.

Create a new text file called `rendertracker@ed.mcmanus` and put the full path to this repo, with trailing slash, inside.

Restart Firefox.
