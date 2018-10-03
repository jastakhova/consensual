import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import 'underscore';

export const Tasks = new Mongo.Collection('tasks');

//Images = new FS.Collection("images", {
//  stores: [new FS.Store.FileSystem("images", {path: "/tmp/uploads"})]
//});

if (Meteor.isServer) {
  // This code only runs on the server
    // Only publish tasks that are public or belong to the current user
    Meteor.publish('tasks', function tasksPublication() {
      return Tasks.find({authorId: this.userId});
    });

    Meteor.publish("allusers",
      function () {
      	var authorIds = Tasks.find({receiverId: this.userId})
      		.fetch()
      		.map(x => {return x.authorId;});
        var receiverIds = Tasks.find({authorId: this.userId})
        	.fetch()
        	.map(x => {return x.receiverId;});
        return Meteor.users.find({$or: [{_id: {$in: receiverIds}}, {_id: {$eq: this.userId}}, {_id: {$in: authorIds}}]},
          {fields: {"services.facebook.accessToken": 1, "services.facebook.id": 1}});
      }
    );

//    Images.allow({
//      'insert': function () {
//        // add custom authentication code here
//        return true;
//      }
//    });
}

Meteor.methods({
  'tasks.insert' (text, execution) {
    check(text, String);
    check(execution, String);

    // Make sure the user is logged in before inserting a task
    if (!Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }

    Tasks.insert({
      text,
      createdAt: new Date(execution),
      authorId: Meteor.userId(),
      authorName: Meteor.user().username ? Meteor.user().username : Meteor.user().profile.name,
      receiverId: Meteor.userId(),
      receiverName: Meteor.user().username ? Meteor.user().username : Meteor.user().profile.name,
      authorStatus: 'green',
      receiverStatus: 'yellow',
    });
  },
  'tasks.remove' (taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);
		if (task.private && task.owner !== Meteor.userId()) {
			// If the task is private, make sure only the owner can delete it
			throw new Meteor.Error('not-authorized');
		}

    Tasks.remove(taskId);
  },
  'tasks.setChecked' (taskId, setChecked) {
    check(taskId, String);
    check(setChecked, Boolean);

    const task = Tasks.findOne(taskId);
		if (task.private && task.owner !== Meteor.userId()) {
			// If the task is private, make sure only the owner can check it off
			throw new Meteor.Error('not-authorized');
		}

    Tasks.update(taskId, {
      $set: {
        checked: setChecked
      }
    });
  },
  'tasks.setPrivate' (taskId, setToPrivate) {
      check(taskId, String);
      check(setToPrivate, Boolean);

      const task = Tasks.findOne(taskId);

      // Make sure only the task owner can make a task private
      if (task.owner !== Meteor.userId()) {
        throw new Meteor.Error('not-authorized');
      }

      Tasks.update(taskId, {
        $set: {
          private: setToPrivate
        }
      });
    },
//   'images.insert' (url) {
//   		var fileObj = new FS.File();
//   		if (Meteor.isServer) {
//   		console.log("About to load " + url);
//   		FS.debug = true;
//          fileObj.attachData(url, function () {
//            Images.insert(fileObj, function (err, fileObj) {
//              console.log(err);
//						  console.log(fileObj);
//						  console.log("File object was created.");
//            });
//          });
//          }
//     },
});