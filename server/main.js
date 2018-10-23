import { Meteor } from 'meteor/meteor';
import { Tasks } from '../imports/api/tasks.js';

Migrations = [
  '67b1618851a9021478046c74b350c968f599c68b'
];

Meteor.methods({
  'Migrations.67b1618851a9021478046c74b350c968f599c68b' () {
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
