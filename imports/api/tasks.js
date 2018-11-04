import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import 'underscore';
import moment from 'moment-timezone';
import { Email } from 'meteor/email';
import { Promise } from 'meteor/promise';

export const Tasks = new Mongo.Collection('tasks');
export const Emails = new Mongo.Collection('emails');

// available where Tasks is imported
datetimeDisplayFormat = "MMM DD, YYYY, h:mm A";

function getName(user) {
  return user.username ? user.username : user.profile.name;
}

function notifyOnNewValue(task, receiver, verb, entity, newValue, oldValue, timezone) {
  if (task.authorId !== task.receiverId) {
    Emails.insert({
      receiver,
      actor: Meteor.userId(),
      task: task._id,
      doneAt: new Date(moment.utc(new Date()).format()).getTime(),
      /*sentAt: - is provided only when the Email is sent */
      verb,
      entity,
      newValue,
      oldValue,
      timezone
    });
  }
}

function notifyOnActivity(task, activity, timezone) {
  notifyOnNewValue(task, task.authorId === Meteor.userId() ? task.receiverId : task.authorId, "changed to", activity.field,
    activity.newValue, activity.oldValue, timezone);
}

function capitalize(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
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
      eta: new Date(moment(newTask.time).format()).getTime(),
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

    notifyOnNewValue(newTask, newTask.receiver, "created", "agreement", text);
  },
  // NOT USED but preserved for future.
  // SHOULD contain notification functionality
//  'tasks.remove' (taskId) {
//    check(taskId, String);
//
//    const task = Tasks.findOne(taskId);
//		if (task.private && task.owner !== Meteor.userId()) {
//			// If the task is private, make sure only the owner can delete it
//			throw new Meteor.Error('not-authorized');
//		}
//
//    Tasks.remove(taskId);
//  },
  'tasks.updateTime' (taskId, oldTimeUTCString, newTimeUTCString, timezone) {
    check(taskId, String);
    check(oldTimeUTCString, String);
    check(newTimeUTCString, String);

    const task = Tasks.findOne(taskId);

    if (newTimeUTCString === oldTimeUTCString) {
      return;
    }

    var newAuthorStatus = task.authorId != Meteor.userId() ? 'yellow' : task.authorStatus;
    var newReceiverStatus = task.receiverId != Meteor.userId() ? 'yellow' : task.receiverStatus;
    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'time',
       oldValue: new Date(moment(oldTimeUTCString).format()).getTime(),
       newValue: new Date(moment(newTimeUTCString).format()).getTime(),
       time: new Date().getTime()
     };

    task.activity.push(activity);

    Tasks.update(taskId, {
      $set: {
        eta: new Date(moment(newTimeUTCString).format()).getTime(),
        activity: task.activity,
        authorStatus: newAuthorStatus,
        receiverStatus: newReceiverStatus
      }
    });

    notifyOnActivity(task, activity, timezone);
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
    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'location',
       oldValue: task.location,
       newValue: newLocation,
       time: new Date().getTime()
     };

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
        location: newLocation,
        activity: task.activity,
        authorStatus: newAuthorStatus,
        receiverStatus: newReceiverStatus
      }
    });

    notifyOnActivity(task, activity);
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
    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'description',
       oldValue: task.text,
       newValue: newDescription,
       time: new Date().getTime()
     };

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
        text: newDescription,
        activity: task.activity,
        authorStatus: newAuthorStatus,
        receiverStatus: newReceiverStatus
      }
    });

    notifyOnActivity(task, activity);
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
    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       oldValue: verbalize(oldValue),
       newValue: verbalize(status),
       time: new Date().getTime()
     };

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        authorStatus: newAuthorStatus,
        receiverStatus: newReceiverStatus,
        archived: archive || task.archived
      }
    });
    notifyOnActivity(task, activity);
  },
  'tasks.addComment' (taskId, text) {
    check(taskId, String);
    check(text, String);

    const task = Tasks.findOne(taskId);

    task.comments.push({
          author: Meteor.userId(),
          authorName: getName(Meteor.user()),
          text: text,
          time: new Date().getTime()
        });
    Tasks.update(taskId, {
      $set: {
        comments: task.comments,
        authorStatus: Meteor.userId() === task.authorId ? task.authorStatus : 'yellow',
        receiverStatus: Meteor.userId() === task.receiverId ? task.receiverStatus : 'yellow',
      }
    });

    notifyOnNewValue(task, Meteor.userId() === task.authorId ? task.receiverId : task.authorId, "added", "comment", text);
  },
  'tasks.changeTaskStatus' (taskId, status) {
    check(taskId, String);
    check(status, String);

    const task = Tasks.findOne(taskId);

    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       oldValue: capitalize(task.status),
       newValue: capitalize(status),
       time: new Date().getTime()
     };

    task.activity.push();
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        authorStatus: Meteor.userId() === task.authorId ? 'green' : 'yellow',
        receiverStatus: Meteor.userId() === task.receiverId ? 'green' : 'yellow',
        status: status,
        archived: task.authorId === task.receiverId && status !== 'open'
      }
    });

    notifyOnActivity(task, activity);
  },
  'email.send' (to, subject, text) {
    if (Meteor.isServer) {
      Email.send(
        {
          to,
          'from': 'Team Consensual <team.consensual@gmail.com>',
          subject,
          html: text
        }
      );
    }
  }
});

if (Meteor.isServer) {
  process.env.MAIL_URL = "smtps://team.consensual%40gmail.com:team11223344556677@smtp.gmail.com:465/";

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

    Meteor.setInterval(function() {
      console.log("Starting sending cycle...");

      function getEmailsToProcess() {
        var newReceivers = Promise.await(Emails.rawCollection().distinct("receiver", {"sentAt": { "$exists" : false }}));
        var emails = Promise.await(Emails.rawCollection().aggregate([{ $match: { receiver: { $in: newReceivers } } },
          {
          $group: {
            _id: "$receiver",
            lastSent: { $max: "$sentAt" },
            emails: { $push: "$$ROOT" }
          }},
          { $match: { $or: [{lastSent: null}, {lastSent: {$lt: moment.utc().subtract(30, 'minutes').valueOf()}}] }}]).toArray());

        emails.forEach(email => email.emails = email.emails.filter(record => !record.sentAt));
        return emails;
      }

      var emails = getEmailsToProcess();

      function getId2TaskMapping(emails) {
        var taskIds = [];
        emails.forEach(email => email.emails.forEach(e => taskIds.push(e.task)));
        var tasks = Tasks.find({_id: {$in: _.uniq(taskIds)}}).fetch();
        return new Map(tasks.map(i => [i._id, i]));
      }

      function getId2UserMapping(emails) {
        var users = emails.map(email => email._id);
        emails.forEach(record => record.emails.forEach(notification => users.push(notification.actor)));
        var finalReceivers = Meteor.users.find({_id: {$in: _.uniq(users)}}).fetch();
        return new Map(finalReceivers.map(i => [i._id, i]));
      }

      var id2task = getId2TaskMapping(emails);
      var id2user = getId2UserMapping(emails);

      emails.forEach(function(record) {
        var receiver = id2user.get(record._id);
        if (receiver && receiver.services && receiver.services.facebook && receiver.services.facebook.email) {
          var receiverEmail = receiver.services.facebook.email;
          var receiverName = getName(receiver);

          console.log("Sending mail to " + receiverName + " at " + receiverEmail);
          var groupedByActor = Object.values(_.groupBy(record.emails, m => m.actor + m.task))

          var allUpdates = groupedByActor.map(function(taskGroup) {
            var taskId = taskGroup[0].task;
            var task = id2task.get(taskId);
            var actorName = getName(id2user.get(taskGroup[0].actor));
            var link = process.env.ROOT_URL + "/#!/tab/proposal/" + taskId;
            var updates = Object.values(_.groupBy(taskGroup, g => g.verb + g.entity)).map(function(fieldGroup) {
              if (fieldGroup[0].verb === "created") {
                return "";
              }
              if (fieldGroup[0].oldValue && fieldGroup[0].entity !== "status") {
                return fieldGroup.map(function(activity) {
                  var field = activity.entity;
                  if (activity.entity === "time") field = "eta";
                  if (activity.entity === "description") field = "text";
                  var newValue = activity.timezone ? moment.tz(activity.newValue, activity.timezone).format("HH:mm MM-DD-YYYY") : activity.newValue;
                  return (task[field] === activity.newValue) ?
                    capitalize(activity.entity) + " was changed to '" + newValue + "'.<br/>" : "";
                }).filter(u => u.length > 0).join('');
              } else {
                var lastActivity = fieldGroup.sort(function(a1, a2) {return a2.doneAt - a1.doneAt;})[0];
                return "A " + fieldGroup[0].entity + " was " + fieldGroup[0].verb + (fieldGroup.length > 1 ? " (and not even once)" : (": \"" + lastActivity.newValue) + "\"") + ".<br/>" ;
              }
            }).filter(u => u.length > 0);
            var multipleChanges = taskGroup.length > 1;
            return "<br/>New update" + (multipleChanges ? "s" : "") + " from " + actorName
              + " for agreement <a href=\"" + link + "\">'" + id2task.get(taskGroup[0].task).text + "'</a>.<br/>" + updates.join('');
          });

          var activityToSend = record.emails[0];

          var task = id2task.get(activityToSend.task);
          var subject = "Recent changes to Consensual agreements" + (groupedByActor.length > 1 ? "" : " by " + getName(id2user.get((groupedByActor[0])[0].actor)));
          var text = "<html><body>Hi!<br/>" + allUpdates.join('') + "</body></html>";
          Meteor.call('email.send', receiverName + "<" + receiverEmail + ">", subject, text);
          var emailIds = record.emails.map(e => e._id);
          Emails.update({_id: {$in: emailIds}}, {
            $set: {
              sentAt: moment.utc().valueOf()
            }
          }, { multi: true });
        }
      });
    }, 60*1000 /* 1 minute interval */);
}