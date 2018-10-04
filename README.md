# Consensual
App for tracking agreements http://consensu.al/

```
DEPLOY_HOSTNAME=us-east-1.galaxy-deploy.meteor.com meteor deploy app.consensu.al
```

## Source links

Used bootstrap theme: https://github.com/creativetimofficial/light-bootstrap-dashboard

## TODO
- Make Sign in pretty: to right-upper corner with a matching the overall theme CSS (Day)
- Add facebook people search to add-proposal panel (Yulia)
- Edit proposal
- Comments on proposal page
- Days of week
- Profile page
- Sign in page on start + prohibit guest access
- Bind real receiver to proposal
- After adding of the proposal the time input is not cleared
- icons don't appear under consensual domain

## Development

### ENV
```
$ export ROOT_URL="https://dev.consensu.al"
```
(Or this could be put in a shell script and added to scripts. We may eventually figure out how to set these things in `settings.json`.)

### DNS
Make sure that your `/etc/hosts` file lists `dev.consensu.al`, e.g.

```
##
127.0.0.1	localhost dev.consensu.al
```

### SSL
Open Keychain Access on your Mac and go to the Certificates category in your System keychain. Once there, import the rootCA.pem using File > Import Items (it should be at `[/full/path/to/consensual]/private/ssl/rootCA.pem`). Double click the imported certificate and change the “When using this certificate:” dropdown to Always Trust in the Trust section.

```
$ git clone git@github.com:Tarang/Meteor-SSL-proxy.git 
$ cd Meteor-SSL-proxy
$ npm install http-proxy
$ vi main.js
```

Edit to include paths to SSL assets:

```
var PATH_TO_KEY = "[/full/path/to/consensual]/private/ssl/server.key",
    PATH_TO_CERT = "[/full/path/to/consensual]/private/ssl/server.crt";
    PATH_TO_CHAIN = "[/full/path/to/consensual]/private/ssl/rootCA.pem";

var fs = require('fs'),
    httpProxy = require('http-proxy');

var options = {
  ssl: {
    key: fs.readFileSync(PATH_TO_KEY, 'utf8'),
    cert: fs.readFileSync(PATH_TO_CERT, 'utf8'),
    ca : fs.readFileSync(PATH_TO_CHAIN, 'utf8')
  },
  target : "http://dev.consensu.al:3000",
  ws: true,
  xfwd: true
};
```
Run the proxy server in a new terminal tab:

```
$ sudo node main.js
```