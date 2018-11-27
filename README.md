# Consensual
All of human society is built upon the agreements we make...with ourselves, and with one another.
Consensual helps us keep track of the agreements we've made, and helps us build the trust
essential to a truly planetary civilization.

Our small dedicated team, based in Oakland, CA, is committed to providing an easy-to-use cross-platform
solution that is robust, trustworthy, and scalable.

The "Hella Alpha" release (PWA version, currently under active development) is available at:

https://app.consensu.al/

Please feel free to play around with it and give us feedback. Bug reports and feature requests can be
made using the app by sending a proposal directly to our Product Manager, Day Waterbury, or via email to:

team.consensual@gmail.com

Thanks for your support!

*~Team Consensual*

## Roadmap

### Alpha Release (v0): 2018 Q4
#### Active ToDo
- Assess current state of the app (Yulia) **Work In Progress** ETA: Nov 27th (was blocked by Xcode 10 update)
- Assign tasks to people not yet registered (estimate: 1 day) **Work In Progress** ETA: Nov 26th
- Full text agreement search (estimate: 1 day)
- Add user profile page (+ unsubscribe) (estimate: 2 days)
- Make responsive layouts render properly on mobile devices (DNS issue; i.e. domain cloaking) (Day)
- Icons don't appear under consensual domain (this is also because of domain cloaking, as above) (Day)
- Single field add item
- Free text for estimates (e.g. "in 2 weeks", "tomorrow")
- Description field should accept markdown, checkboxes
- Native facebook login in the app (https://gist.github.com/jamielob/881e0fe059c0ef0eb36d)
- proposal page should be opened by the click on the whole row in todo list
- Add time for activity records. Add activity on creation of task
- Limitation for how many people you can invite
- If the person was already invited
- Input error check for inviting

#### Known Issues
- Comments block CSS doesn't look nice when there is no comments
- It's not obvious what are you about to approve
- Error handling saves empty object to log
- Functions showDatePicker and showTimePicker are duplicated on proposal and todos, we may wish to DRY this up
- Date should not wrap...and there should be a min width for the date picker
- Description field should be taller on web (not sure how it is on mobile) [mobile]
- Proposal description shouldn't be a disabled textarea. They are not bright enough
- Done and cancelled agreements are not shown anywhere in todo list view
- Side menu should be closed when "Tasks" link is clicked
- ETA is seen as creation date and is set by people to NOW

### Kickstarter Campaign: 2019 Q1
- Identity/Logo
- Video(s)
- About Us Page
- Blog
- Instagram
- Marketing
-- Social Media
-- Meetups

### Beta Release (v1): 2019 Q2
- Notifications [app]
- Start and end dates (ranges)
- Ability to mark tasks as 'In Progress'
- Allow unassigned agreements
- Allow author to reassign proposal to new receiver
- Allow receiver to delegate fulfillment
- Integration with Google Calendar
- Integration with iCal
- Single field, multi-line entry for multiple items
- Repeating and scheduled tasks
- Adding images
- Agreement witness(es)
- Electronic signatures
- Scaling architecture

### Series A Funding Round: 2019 Q3
- Networking

### Future Releases: No ETA
- Multiparty agreements
- Dependencies and subtasks
- Browse "offers" (open/unassigned standing agreements)
- Social Karma
- Arbitration

### Bugs & Mysteries
- Date picker sometimes freezes (not sure how to reproduce)
- If you mouseover a name in the receiver typeahead, but don't select it, the value is put in the input, but the model isn't validated
- Cannot read property 'services' of undefined at Object.picture on Proposal page. How to reproduce this?
- What is happening with server vs. client time, and in what context are collection methods executed?

# Dev Setup

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

### Deployment
```
$ DEPLOY_HOSTNAME=us-east-1.galaxy-deploy.meteor.com meteor deploy app.consensu.al
```

### Mongo

```
meteor mongo
>> db.<table>.find() - show the whole table
>> db.<table>.find().pretty() - you can make it pretty
>> db.<table>.remove({}) - removes all records
```

### Sources
* Bootstrap Theme: https://github.com/creativetimofficial/light-bootstrap-dashboard

### References
* Meteor: https://docs.meteor.com/api
* AngularJS: https://docs.angularjs.org/api
* Bootstrap Typeahead: https://github.com/bassjobsen/Bootstrap-3-Typeahead
* MomentJS: http://momentjs.com

### Forums
* Meteor: https://forums.meteor.com