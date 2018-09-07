import { Meteor } from 'meteor/meteor';

import '../imports/api/tasks.js';

Meteor.startup(() => {
  // code to run on server at startup
});

//Package.onTest(function (api) {
//  api.use('cultofcoders:mocha');
//
//   Add any files with mocha tests.
//  api.addFiles('../imports/api/tasks.test.js');
//});
