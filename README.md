# Consensual
App for tracking agreements http://consensu.al/

```
DEPLOY_HOSTNAME=us-east-1.galaxy-deploy.meteor.com meteor deploy app.consensu.al
```

## Source links

Used bootstrap theme: https://github.com/creativetimofficial/light-bootstrap-dashboard

## TODO
- Order tasks by days of week (Yulia)
- Add user profile page
- Add current user mini profile (image in upper right) w/ logout
- Order tasks by days of week
- Emails and/or notifications about status changes
- Show error message on proposal page if task is not found
- Deal with side menu on the left
- Make responsive layouts render properly on mobile devices (DNS and SSL issue; i.e. domain cloaking)
- Icons don't appear under consensual domain (this is also because of domain cloaking, as above)

## Known issues
- Handling input errors for add proposal form (disable submit)
- Error notifications on add, delete actions (show alert)
- We're abusing task.createdAt as the execution time for the agreement
- Hamburger menu in upper right of mobile view does nothing. What should it do?
- You need to fiddle with the controls to select the same hour as previously selected in the datetime picker
- Functions showDatePicker and showTimePicker are duplicated on proposal and todos, we may wish to DRY this up

## Bugs
- Cannot read property 'services' of undefined at Object.picture on Proposal page. How to reproduce this?

## Mysteries
- What is happening with server vs. client time, and in what context are collection methods executed?

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

### Mongo cheat sheet

```
meteor mongo
>> db.<table>.find() - show the whole table
```