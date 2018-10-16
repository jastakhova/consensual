import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import 'underscore';
import moment from 'moment';

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

function getName(user) {
  return user.username ? user.username : user.profile.name;
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

    Tasks.insert({
      text: newTask.task,
      createdAt: new Date(newTask.time),
      authorId: Meteor.userId(),
      authorName: getName(Meteor.user()),
      receiverId: newTask.receiver,
      receiverName: getName(receiver),
      authorStatus: 'green',
      receiverStatus: Meteor.userId() === newTask.receiver ? 'green' : 'yellow',
      location: '...',
      activity: []
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

    var newTimeObj = new Date(newTime);

    const task = Tasks.findOne(taskId);
    if (newTimeObj === task.createdAt) {
      return;
    }

    var newAuthorStatus = task.authorId != Meteor.userId() ? 'yellow' : task.authorStatus;
    var newReceiverStatus = task.receiverId != Meteor.userId() ? 'yellow' : task.receiverStatus;

    task.activity.push({
      actor: Meteor.userId(),
      actorName: getName(Meteor.user()),
      field: 'time',
      oldValue: moment(task.createdAt).format("DD MMM h:mm a"),
      newValue: moment(newTimeObj).format("DD MMM h:mm a"),
      time: new Date()
    });

    Tasks.update(taskId, {
      $set: {
        createdAt: newTimeObj,
        activity: task.activity,
        authorStatus: newAuthorStatus,
        receiverStatus: newReceiverStatus
      }
    });
  },
  'tasks.updateLocation' (taskId, newLocation) {
    check(taskId, String);
    check(newLocation, String);

    const task = Tasks.findOne(taskId);
    if (newLocation === task.location) {
      return;
    }

    var newAuthorStatus = task.authorId != Meteor.userId() ? 'yellow' : task.authorStatus;
    var newReceiverStatus = task.receiverId != Meteor.userId() ? 'yellow' : task.receiverStatus;

    task.activity.push({
          actor: Meteor.userId(),
          actorName: getName(Meteor.user()),
          field: 'location',
          oldValue: task.location,
          newValue: newLocation,
          time: new Date()
        });
    Tasks.update(taskId, {
      $set: {
        location: newLocation,
        activity: task.activity,
        authorStatus: newAuthorStatus,
        receiverStatus: newReceiverStatus
      }
    });
  },
  'tasks.updateDescription' (taskId, newDescription) {
    check(taskId, String);
    check(newDescription, String);

    const task = Tasks.findOne(taskId);
    if (newDescription === task.text) {
      return;
    }

    var newAuthorStatus = task.authorId != Meteor.userId() ? 'yellow' : task.authorStatus;
    var newReceiverStatus = task.receiverId != Meteor.userId() ? 'yellow' : task.receiverStatus;

    task.activity.push({
          actor: Meteor.userId(),
          actorName: getName(Meteor.user()),
          field: 'description',
          oldValue: task.text,
          newValue: newDescription,
          time: new Date()
        });
    Tasks.update(taskId, {
      $set: {
        text: newDescription,
        activity: task.activity,
        authorStatus: newAuthorStatus,
        receiverStatus: newReceiverStatus
      }
    });
  },
  'tasks.updateStatuses' (taskId, status) {
    check(taskId, String);
    check(status, String);

    const task = Tasks.findOne(taskId);

    var newAuthorStatus = task.authorId === Meteor.userId() ? status : task.authorStatus;
    var newReceiverStatus = task.receiverId === Meteor.userId() ? status : task.receiverStatus;

    if (newAuthorStatus === task.authorStatus && newReceiverStatus === task.receiverStatus) {
      return;
    }

    var oldValue = task.authorId === Meteor.userId() ? task.authorStatus : task.receiverStatus;

    function verbalize(status) {
      if ('green' === status) {
        return 'Approved';
      }
      if ('yellow' === status) {
        return 'Under Consideration';
      }
      return 'Declined';
    }

    task.activity.push({
          actor: Meteor.userId(),
          actorName: getName(Meteor.user()),
          field: 'status',
          oldValue: verbalize(oldValue),
          newValue: verbalize(status),
          time: new Date()
        });
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        authorStatus: newAuthorStatus,
        receiverStatus: newReceiverStatus
      }
    });
  },
});