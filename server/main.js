import { Meteor } from 'meteor/meteor';
import { Tasks } from '../imports/api/tasks.js';
import '../imports/api/subscribe.js';
import '../imports/api/drafts.js';
import 'bas-meteor-facebook-login';
import { Accounts } from 'meteor/accounts-base';

Migrations = [
//  '1539727846000',
//  '1540240902000',
//  '1540319678000',
//  '1540929490000',
//  '1542315428741',
//  'faebcab3cfadde88309be',
//  'new'
];

Meteor.methods({
  'Migrations.1539727846000' () {
    // 1. Added:
    //            activity: default []

    Tasks.update({"activity": null}, {
      $set: {
        activity: []
      }
    },{ multi: true });
  },
  'Migrations.1540240902000' () {
    // 1. Added:
    //            comments: default []

    Tasks.update({"comments": null}, {
      $set: {
        comments: []
      }
    },{ multi: true });
  },
  'Migrations.1540319678000' () {
    // 1. Renamed created --> eta
    // 2. Added:
    //            status: default 'open'
    //            archived: default false

    Tasks.update({"eta": null}, {
      $rename: {
        'createdAt': 'eta'
      }
    },{ multi: true });

    Tasks.update({"status": null}, {
      $set: {
        status: 'open'
      }
    },{ multi: true });

    Tasks.update({"archived": null}, {
      $set: {
        archived: false
      }
    },{ multi: true });
  },
  'Migrations.1540929490000' () {
    // 1. Converted eta from ISODate --> Timestamp
    // 2. Converted activity.time ISODate --> Timestamp
    // 3. Converted comments.time ISODate --> Timestamp

    tasks = Tasks.find();

    for (let task of tasks) {

      if (task.eta instanceof Date) {
        task.eta = task.eta.getTime();
      }

      for (let action of task.activity) {
        if (action.time instanceof Date) {
          action.time = action.time.getTime();
        }
        if (action.oldValue instanceof Date) {
          action.oldValue = action.oldValue.getTime();
        }
        if (action.newValue instanceof Date) {
          action.newValue = action.newValue.getTime();
        }
      }

      for (let comment of task.comments) {
        if (comment.time instanceof Date) {
          comment.time = comment.time.getTime();
        }
      }

      Tasks.update({_id: task._id}, {
        $set: {
          eta: task.eta,
          activity: task.activity,
          comments: task.comments
        }
      });
    }
  },
  'Migrations.1542315428741' () {
    // 1. Added: title:
    //            default 20-character prefix of 'text'

    tasks = Tasks.find();
    var maxTitleLength = 20;

    for (let task of tasks) {
      if (!task.title) {
        var titleIndex = Math.min(maxTitleLength, task.text.length);
        var newLineIndex = task.text.indexOf("\n");
        if (newLineIndex > 0) {
          titleIndex = Math.min(titleIndex, newLineIndex);
        }
        var newTitle = task.text.slice(0, titleIndex) + (task.text.length !== titleIndex ? "..." : "");
        Tasks.update({_id: task._id}, {
          $set: {
            title: newTitle
          }
        });
      }
    }
  },
  'Migrations.faebcab3cfadde88309be' () {
    // 1. Added: author and receiver objects
    // 2. Converted status from "open"
    // 3. Adding ticklers, notices,

    tasks = Tasks.find();

    for (let task of tasks) {
      if (!task.author) {
        Tasks.update({_id: task._id}, {
          $set: {
            author: {
              id: task.authorId,
              name: task.authorName,
              status: task.authorStatus,
              notices: [],
              ticklers: []
            },
            receiver: {
              id: task.receiverId,
              name: task.receiverName,
              status: task.receiverStatus,
              notices: [],
              ticklers: []
            },
            ticklers: [],
            locked: false,
            wasAgreed: task.authorStatus === "green" && task.receiverStatus === "green"
          }
        });
      }
      if (task.status === "open" || task.status.status === "green") {
        var newStatus = "proposed";
        if (task.receiverStatus === "green") {
          newStatus = task.authorStatus === "green" ? "agreed" : "considered";
        }

        Tasks.update({_id: task._id}, {
          $set: { status: newStatus }
        });
      }
      if ((task.status === "cancelled" || task.status === "done") && !task.archived) {
        Tasks.update({_id: task._id}, {
          $set: { archived: true }
        });
      }
    }
  },
  'Migrations.new' () {
    // 1. Added:
    //            new demo account for impersonating
    var name = "Demo account";
    var email = "team.consensual+demo@gmail.com";
    var password = "password";

    var demo = Meteor.users.find({"profile.name": "Demo account"}).fetch();

    if (demo.length == 0) {
      Accounts.onCreateUser((options, user) => {
        // no need for email verification if it's a demo profile
        if (options.profile) {
          if (options.profile.name == name) {
          user.emails = user.emails.map(e => {
            e.verified = true;
            return e;
            });
          }
          user.profile = options.profile;
        }

        return user;
      });

      Accounts.createUser({
        username: name,
        email: email,
        password: password,
        profile: {
          name: name
        }
      });
    }
  }
});

// This only runs on the server
if (Meteor.isServer) {
  // This only runs on startup
  Meteor.startup(() => {
    // Add DB migrations here
    console.log('Running Migrations...');
    for (let commit_id of Migrations) {
      console.log(commit_id + '...');
      Meteor.call('Migrations.' + commit_id);
    }

    Tasks.rawCollection().createIndex({"author.id": 1});
    Tasks.rawCollection().createIndex({"receiver.id": 1});
  });
}

Accounts.emailTemplates.siteName = "Consensual";
Accounts.emailTemplates.from = "Team Consensual <team.consensual@gmail.com>";
Accounts.emailTemplates.verifyEmail.subject = function (user) {
    return "Email verification @ Consensual";
};
Accounts.emailTemplates.verifyEmail.html = function (user, url) {
   return "Hi " + user.profile.name + ",\n\n<br/><br/>" +
     " Please verify your email by simply clicking the link below:\n\n" + url;
};

AccountsTemplates.configure({
    postSignUpHook: function(userId, info) {
      try {
        Meteor.call('tasks.init', userId);
        Meteor.call('users.updateEmail', "undefined", userId);
      } catch (err) {
        console.log(err);
      }
    }
});

//Package.onTfest(function (api) {
//  api.use('cultofcoders:mocha');
//
//   Add any files with mocha tests.
//  api.addFiles('../imports/api/tasks.test.js');
//});
