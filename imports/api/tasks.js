import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import 'underscore';

export const Tasks = new Mongo.Collection('tasks');

if (Meteor.isServer) {
  // This code only runs on the server
    // Only publish tasks that are public or belong to the current user
    Meteor.publish('tasks', function tasksPublication() {
      return Tasks.find({$or: [{authorId: this.userId}, {receiverId: this.userId}]});
    });

    Meteor.publish("alltaskpartners",
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

    Meteor.publish("allusers",
    	function () {
          	return Meteor.users.find({},
              {fields: {"username": 1, "profile.name" : 1}});
          }
    );
}

Meteor.methods({
  'tasks.insert' (newTask) {
    check(newTask.task, String);
    check(newTask.time, String);
    check(newTask.receiver, String);

    // Make sure the user is logged in before inserting a task
    if (!Meteor.userId()) {
      throw new Meteor.Error('not-authorized');
    }

    var receiver = Meteor.users.findOne({_id: newTask.receiver});

    function getName(user) {
    	return user.username ? user.username : user.profile.name;
    }

    Tasks.insert({
      text: newTask.task,
      createdAt: new Date(newTask.time),
      authorId: Meteor.userId(),
      authorName: getName(Meteor.user()),
      receiverId: newTask.receiver,
      receiverName: getName(receiver),
      authorStatus: 'green',
      receiverStatus: 'yellow',
      location: '...'
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
  'tasks.updateTime' (taskId, newTime) {
    check(taskId, String);
    check(newTime, String);

    const task = Tasks.findOne(taskId);
    Tasks.update(taskId, {
      $set: {
        createdAt: new Date(newTime)
      }
    });
  },
  'tasks.updateLocation' (taskId, newLocation) {
    check(taskId, String);
    check(newLocation, String);

    const task = Tasks.findOne(taskId);
    Tasks.update(taskId, {
      $set: {
        location: newLocation
      }
    });
  },
});