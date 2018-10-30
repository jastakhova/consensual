import { Meteor } from 'meteor/meteor';
import { Tasks } from '../imports/api/tasks.js';

Migrations = [
  '1539727846000',
  '1540319678000',
  '1540929490000'
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

    tasks = Tasks.find();

    for (let task of tasks) {
      var newEta = task.eta instanceof Date ? task.eta.getTime() : task.eta;

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

      Tasks.update({_id: task._id}, {
        $set: {
          eta: newEta,
          activity: task.activity
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
  });
}

//Package.onTest(function (api) {
//  api.use('cultofcoders:mocha');
//
//   Add any files with mocha tests.
//  api.addFiles('../imports/api/tasks.test.js');
//});
