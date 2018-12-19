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
#### Urgent tasks
None

#### Active ToDo (2 weeks)
- [ui debt] Description field should accept markdown, checkboxes (estimate: 1 day, Dec 18th)
- [talk] Approve logic is not well understood by ppl
- [security debt] Limitation for how many people you can invite (estimate: 2h, Dec 19th)
- [error handling] If the person was already invited (estimate: 2h, Dec 19th)
- [error handling] Input error check for inviting (estimate: 4h, Dec 19th)
- [app] Assess current state of the app (Yulia) ETA: Dec 10th (was blocked by Xcode 10 update, Dec 20th)
- [app] Native facebook login in the app (https://gist.github.com/jamielob/881e0fe059c0ef0eb36d)
- [ui] clear the search (estimate: 2h)
- [logic] client side search (not regexp) (estimate: 2 days)
- [logic] By who should sort by assignee and author
- [ui bug] Browser suggest in different browsers (gathering statistical data so far from users)
- [logic debt] Send inviteeId in the link to Consensual from email (in order to fight the situation when email of invitee doesn’t match with his facebook one or facebook doesn't provide email)
- [ui] Make the column width equal between different tasks lists on the main page
- [ui] Calendar dialog shouldn't have Save button but save on the choice of the date
- [logic] Not redirect to Open filter when nothing for today, act as in Inbox with empty list
- [feature] Profile pages of other people
- [ui] Links under profile pics on proposal pages should lead to profile pages
- [ui] When agreement was created provide a link to it
- [ui] In a small font inform users what Shift+Enter will do
- [logic] Search should include author and receivers name
- [logic] Better title extraction (break on words and longer)
- [ui] Render external and internal links
- [research] Investigate process for getting approval to query friends list from Facebook
- [design] Redesign email texts
- [ui] Ctrl click should open a new tab (estimate: 1h)
- [logic debt] Duplicate names case issues for suggest and invitee selection
- [feature] Repeating/recurring agreements (discuss implementation)
- [feature] Ability to create proposal/agreement templates so you can send it multiple people
- [feature] Reassignment/delegation of agreements; this would allow us to start with self-assignment and later reassign
- [feature] Actively disagree, break, rescind agreement
- [feature] Decline to negotiate agreement (let's discuss this)
- [feature] Related agreements: Dependencies, subtasks, and subsequents
- [feature] Associating images (or files) with the agreement
- [talk] Should comments and activity log be aligned in one UI component?

#### Known Issues
- Discuss roles (witness, who is assignee, etc)
- Comments block CSS doesn't look nice when there is no comments
- It's not obvious what are you about to approve
- Error handling saves empty object to log
- Functions showDatePicker and showTimePicker are duplicated on proposal and todos, we may wish to DRY this up
- Date should not wrap...and there should be a min width for the date picker
- [mobile] Description field should be taller on web (not sure how it is on mobile)
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
- [app] Notifications
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
- Let invitors know that their invitees joined

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

### To use in future
* Mail service: www.mailgun.com/‎
* Markdown: https://simplemde.com/