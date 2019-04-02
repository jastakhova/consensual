import { Meteor } from 'meteor/meteor';
import { Tasks } from '../imports/api/tasks.js';
import 'bas-meteor-facebook-login';

Migrations = [
  '1539727846000',
  '1540240902000',
  '1540319678000',
  '1540929490000',
  '1542315428741',
  'new'
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
  'Migrations.new' () {
    // 1. Added: author and receiver objects
    // 2. Converted status from "open"

    tasks = Tasks.find();

    for (let task of tasks) {
      if (!task.author) {
        Tasks.update({_id: task._id}, {
          $set: {
            author: {
              id: task.authorId,
              name: task.authorName,
              status: task.authorStatus
            },
            receiver: {
              id: task.receiverId,
              name: task.receiverName,
              status: task.receiverStatus
            }
          }
        });
      }
      if (task.status === "open" || task.status.status === "green") {
        Tasks.update({_id: task._id}, {
          $set: {
            status: ((task.author.status === "green" && task.receiver.status === "green") ? "agreed" : "proposed")
          }
        });
      }
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
  });
}

//Package.onTest(function (api) {
//  api.use('cultofcoders:mocha');
//
//   Add any files with mocha tests.
//  api.addFiles('../imports/api/tasks.test.js');
//});
