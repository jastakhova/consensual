import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import 'underscore';
import moment from 'moment-timezone';

export const Tasks = new Mongo.Collection('tasks');

// available where Tasks is imported
datetimeDisplayFormat = "MMM DD, YYYY, h:mm A";

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
      eta: new Date(newTask.time),
      authorId: Meteor.userId(),
      authorName: getName(Meteor.user()),
      receiverId: newTask.receiver,
      receiverName: getName(receiver),
      authorStatus: 'green',
      receiverStatus: Meteor.userId() === newTask.receiver ? 'green' : 'yellow',
      location: '...',
      activity: [],
      comments: [],
      status: 'open',
      archived: false
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
  'tasks.updateTime' (taskId, oldTimeUTCString, newTimeUTCString) {
    check(taskId, String);
    check(oldTimeUTCString, String);
    check(newTimeUTCString, String);

    const task = Tasks.findOne(taskId);

    if (newTimeUTCString === oldTimeUTCString) {
      return;
    }
    else {
      var newAuthorStatus = task.authorId != Meteor.userId() ? 'yellow' : task.authorStatus;
      var newReceiverStatus = task.receiverId != Meteor.userId() ? 'yellow' : task.receiverStatus;

      task.activity.push({
        actor: Meteor.userId(),
        actorName: getName(Meteor.user()),
        field: 'time',
        oldValue: new Date(moment(oldTimeUTCString).format()),
        newValue: new Date(moment(newTimeUTCString).format()),
        time: new Date()
      });

      Tasks.update(taskId, {
        $set: {
          eta: new Date(moment(newTimeUTCString).format()),
          activity: task.activity,
          authorStatus: newAuthorStatus,
          receiverStatus: newReceiverStatus
        }
      });
    }

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
  'tasks.updateStatuses' (taskId, status, archive) {
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
      if (!archive) {
        return 'green' === status ? 'Approved' : 'Under Consideration';
      }
      return ('green' === status ? 'Confirmed ': '') + task.status;
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
        receiverStatus: newReceiverStatus,
        archived: archive
      }
    });
  },
  'tasks.addComment' (taskId, text) {
    check(taskId, String);
    check(text, String);

    const task = Tasks.findOne(taskId);

    task.comments.push({
          author: Meteor.userId(),
          authorName: getName(Meteor.user()),
          text: text,
          time: new Date()
        });
    Tasks.update(taskId, {
      $set: {
        comments: task.comments,
        authorStatus: Meteor.userId() === task.authorId ? task.authorStatus : 'yellow',
        receiverStatus: Meteor.userId() === task.receiverId ? task.receiverStatus : 'yellow',
      }
    });
  },
  'tasks.changeTaskStatus' (taskId, status) {
    check(taskId, String);
    check(status, String);

    const task = Tasks.findOne(taskId);

    function capitalize(status) {
      return status.charAt(0).toUpperCase() + status.slice(1);
    }

    task.activity.push({
      actor: Meteor.userId(),
      actorName: getName(Meteor.user()),
      field: 'status',
      oldValue: capitalize(task.status),
      newValue: capitalize(status),
      time: new Date()
    });
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        authorStatus: Meteor.userId() === task.authorId ? 'green' : 'yellow',
        receiverStatus: Meteor.userId() === task.receiverId ? 'green' : 'yellow',
        status: status,
        archived: task.authorId === task.receiverId && status !== 'open'
      }
    });
  },
});