import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import 'underscore';
import moment from 'moment-timezone';
import { Email } from 'meteor/email';
import { Promise } from 'meteor/promise';
import fs from 'fs';
import {Actions, Notices, getAction, getCondition, getStatus} from './dictionary.js';

export const Tasks = new Mongo.Collection('tasks');
export const Emails = new Mongo.Collection('emails');
export const Invitees = new Mongo.Collection('invitees');

// available where Tasks is imported
datetimeDisplayFormat = "MMM DD, YYYY, h:mm A";

foundersFilter = {'profile.name': {$in: ["Julia Astakhova", "Day Waterbury", "All Consensual"]}};

mailingFounder = "";

function getMailingFounder() {
  if (mailingFounder.length == 0) {
    mailingFounder = Meteor.users.findOne({ 'profile.name': "All Consensual"});
  }

  return mailingFounder;
}

mailingTemplate = "";

function getMailingTemplate() {
  if (mailingTemplate.length == 0 && Meteor.isServer) {
    mailingTemplate = Assets.getText("copy/user_agreement.txt");
  }

  return mailingTemplate;
}

function getName(user) {
  return user.username ? user.username : user.profile.name;
}

function getEmail(user) {
  return user.email ? user.email : user.services.facebook.email;
}

function notifyOnNewValue(task, receiver, verb, entity, newValue, oldValue, timezone) {
  if (task.author.id !== task.receiver.id) {
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
  notifyOnNewValue(task, task.author.id === Meteor.userId() ? task.receiver.id : task.author.id, "changed to", activity.field,
    activity.newValue, activity.oldValue, timezone);
}

function capitalize(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function changeStatusesOnEditing(task) {
  var statuses = [];
  // comparison is done via negation in order to avoid a change of statuses for self-agreement
  statuses[0] = task.author.id != Meteor.userId() && task.author.status === getCondition("green").id
    ? 'yellow' : task.author.status;
  statuses[1] = (task.receiver.id != Meteor.userId() && task.receiver.status === getCondition("green").id)
    || (task.author.id != Meteor.userId() && task.receiver.status === getCondition("grey").id)
    ? 'yellow' : task.receiver.status;
  statuses[2] = statuses[1] === getCondition("grey").id || task.author.id === task.receiver.id
    ? task.status : getStatus("considered").id;
  return statuses;
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

    if (!Meteor.isServer) {
      return;
    }

    var actor = newTask.author ? newTask.author : Meteor.userId();
    var actorUser = Meteor.users.findOne({_id: actor});
    var actorName = getName(actorUser);
    var selfAgreement = newTask.receiver === actor;
    var receiver = selfAgreement
      ? actorUser
      : Meteor.users.findOne({_id: newTask.receiver}) || Invitees.findOne({_id: newTask.receiver});

    function getTitle(text, title) {
      if (title) {
        return title;
      }
      var maxTitleLength = 20;
      var titleIndex = Math.min(maxTitleLength, text.length);
      var newLineIndex = text.indexOf("\n");
      if (newLineIndex > 0) {
        titleIndex = Math.min(titleIndex, newLineIndex);
      }
      return text.slice(0, titleIndex) + (text.length !== titleIndex ? "..." : "");
    }

    var activity = {
       actor: actor,
       actorName: actorName,
       field: 'agreement',
       time: new Date().getTime()
     };

     var author = {
      id: actor,
      name: actorName,
      status: 'green',
      notices: [],
      ticklers: []
     };

     var notices = selfAgreement ? [] :
      [{
        code: 0,
        created: new Date().getTime()
     }];

     var receiver = {
       id: newTask.receiver,
       name: getName(receiver),
       status: selfAgreement ? 'green' : 'grey',
       notices: notices,
       ticklers: []
      };

    var createdTask = {
      text: newTask.task,
      title: getTitle(newTask.task, newTask.title),
      eta: new Date(moment(newTask.time).format()).getTime(),
      location: '...',

      author: author,
      receiver: receiver,

      activity: [activity],
      comments: [],

      status: selfAgreement ? getStatus('agreed').id : getStatus('proposed').id,
      archived: false,
      locked: false,
      wasAgreed: selfAgreement,
    };

    var id = Tasks.insert(createdTask);
    createdTask['_id'] = id;
    notifyOnNewValue(createdTask, newTask.receiver, "created", "agreement", newTask.task);
  },
  'tasks.updateTime' (taskId, oldTimeUTCString, newTimeUTCString, timezone) {
    check(taskId, String);
    check(oldTimeUTCString, String);
    check(newTimeUTCString, String);

    const task = Tasks.findOne(taskId);

    if (newTimeUTCString === oldTimeUTCString) {
      return;
    }

    var newStatuses = changeStatusesOnEditing(task);
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
        status: newStatuses[2],
        "author.status": newStatuses[0],
        "receiver.status": newStatuses[1]
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

    var newStatuses = changeStatusesOnEditing(task);
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
        status: newStatuses[2],
        "author.status": newStatuses[0],
        "receiver.status": newStatuses[1]
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

    var newStatuses = changeStatusesOnEditing(task);
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
        status: newStatuses[2],
        "author.status": newStatuses[0],
        "receiver.status": newStatuses[1]
      }
    });

    notifyOnActivity(task, activity);
  },
  'tasks.updateTitle' (taskId, newTitle) {
    check(taskId, String);
    check(newTitle, String);

    const task = Tasks.findOne(taskId);
    if (newTitle === task.title) {
      return;
    }

    var newStatuses = changeStatusesOnEditing(task);
    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'title',
       oldValue: task.title,
       newValue: newTitle,
       time: new Date().getTime()
     };

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
        title: newTitle,
        activity: task.activity,
        status: newStatuses[2],
        "author.status": newStatuses[0],
        "receiver.status": newStatuses[1]
      }
    });

    notifyOnActivity(task, activity);
  },
  'tasks.updateStatuses' (taskId, status, archive) {
    check(taskId, String);
    check(status, String);

    const task = Tasks.findOne(taskId);

    var newAuthorStatus = task.author.id === Meteor.userId() ? status : task.author.status;
    var newReceiverStatus = task.receiver.id === Meteor.userId() ? status : task.receiver.status;

    if (newAuthorStatus === task.author.status && newReceiverStatus === task.receiver.status) {
      return;
    }

    var oldValue = task.author.id === Meteor.userId() ? task.author.status : task.receiver.status;

    function verbalize(status) {
      if (!archive) {
        return 'green' === status ? 'approved the agreement' : 'Under Consideration';
      }
      return ('green' === status ? 'confirmed status change to ': '') + task.status;
    }
    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       newValue: verbalize(status),
       time: new Date().getTime()
     };

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        "author.status": newAuthorStatus,
        "receiver.status": newReceiverStatus,
        archived: archive || task.archived
      }
    });
    notifyOnActivity(task, activity);
  },
  'tasks.approve' (taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);

    var newAuthorStatus = task.author.id === Meteor.userId() ? getCondition("green").id : task.author.status;
    var newReceiverStatus = task.receiver.id === Meteor.userId() ? getCondition("green").id : task.receiver.status;

    if (newAuthorStatus === task.author.status && newReceiverStatus === task.receiver.status) {
      return;
    }

    var oldValue = task.author.id === Meteor.userId() ? task.author.status : task.receiver.status;

    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       newValue: getStatus("agreed").id,
       time: new Date().getTime()
     };

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        "author.status": newAuthorStatus,
        "receiver.status": newReceiverStatus,
        status: newAuthorStatus === newReceiverStatus ? getStatus("agreed").id : task.status,
        wasAgreed: newAuthorStatus === newReceiverStatus
      }
    });
    notifyOnActivity(task, activity);
  },
  'tasks.maybe' (taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);
    var noResponseStatus = getCondition("grey").id;
    var consideringStatus = getCondition("yellow").id;
    var agreedStatus = getCondition("green").id;

    if (!(task.receiver.id === Meteor.userId() && task.receiver.status === noResponseStatus)
        && !(task.receiver.id === Meteor.userId() && task.receiver.status === agreedStatus
              || task.author.id === Meteor.userId() && task.author.status === agreedStatus)) {
      return;
    }

    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       newValue: getStatus("considered").id,
       time: new Date().getTime()
     };

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        "author.status": task.author.id === Meteor.userId() ? consideringStatus : task.author.status,
        "receiver.status": task.receiver.id === Meteor.userId() ? consideringStatus : task.receiver.status,
        status: getStatus("considered").id
      }
    });
    notifyOnActivity(task, activity);
  },
  'tasks.cancel' (taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);

    var newAuthorStatus = task.author.id === Meteor.userId() ? getCondition("red").id : task.author.status;
    var newReceiverStatus = task.receiver.id === Meteor.userId() ? getCondition("red").id : task.receiver.status;

    if (newAuthorStatus === task.author.status && newReceiverStatus === task.receiver.status) {
      return;
    }

    var oldValue = task.author.id === Meteor.userId() ? task.author.status : task.receiver.status;

    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       newValue: getStatus("cancelled").id,
       time: new Date().getTime()
     };

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        "author.status": newAuthorStatus,
        "receiver.status": newReceiverStatus,
        status: getStatus("cancelled").id,
        archived: true
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

    var receiverShowedFirstResponse = Meteor.userId() === task.receiver.id
      && task.receiver.status === getCondition("grey").id;
    Tasks.update(taskId, {
      $set: {
        comments: task.comments,
        "receiver.status": receiverShowedFirstResponse ? 'yellow' : task.receiver.status,
        status: receiverShowedFirstResponse ? getStatus('considered').id : task.status
      }
    });

    notifyOnNewValue(task, Meteor.userId() === task.author.id ? task.receiver.id : task.author.id, "added", "comment", text);
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

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        "author.status": Meteor.userId() === task.author.id ? 'green' : 'yellow',
        "receiver.status": Meteor.userId() === task.receiver.id ? 'green' : 'yellow',
        status: status,
        archived: task.author.id === task.receiver.id && status !== 'open'
      }
    });

    notifyOnActivity(task, activity);
  },
  'users.updateName' (name) {
    check(name, String);

    Meteor.users.update({_id: Meteor.userId()}, { $set: { username: name }});
  },
  'users.updateEmail' (email) {
    check(email, String);

    Meteor.users.update({_id: Meteor.userId()}, { $set: { email }});
  },
  'users.subscribe' (subscribed) {
    Meteor.users.update({_id: Meteor.userId()}, { $set: { subscribed }});
  },
  'email.send' (to, subject, text) {
    var options = {
        to,
        'from': 'Team Consensual <team.consensual@gmail.com>',
        subject
    };
    if (text && text.startsWith("<html>")) {
      options.html = text;
    } else {
      options.text = text;
    }
    if (Meteor.isServer) {
      return Email.send(options);
    }
  },
  'email.withError'(error) {
    if (Meteor.user()) {
      Meteor.call('email.send', 'Team Consensual <team.consensual@gmail.com>', "New Error " + error.message,
        "Error occurred for " + getName(Meteor.user()) + " (" + Meteor.userId() + "). Proceed to " + process.env.ROOT_URL);
    }
  },
  'email.invite'(to) {
    check(to.name, String);
    check(to.email, String);

    if (Meteor.user()) {
      var id = Invitees.insert({
        invitorId: Meteor.userId(),
        username: to.name,
        creationTime: new Date(moment().format()).getTime(),
        email: to.email.toLowerCase()
      });

      try {
        Meteor.call('email.send', to.name + ' <' + to.email + '>',
            "Invitation to join Consensual from " + getName(Meteor.user()),
            "<html><body>Hi!<br/>" + getName(Meteor.user()) + " invites you to join Consensual app." +
            "Proceed to " + process.env.ROOT_URL + "?in=" + id + ".</body></html>");

        Meteor.call('tasks.insert', {
          task: getMailingTemplate(),
          time: moment.utc().add(1, 'month').format(),
          receiver: id,
          author: getMailingFounder()._id,
          title: "Consensual Terms of Use"
        });

        return id;
      } catch (noEmailError) {
        console.log("No email " + to.email);
        console.log(noEmailError);
        Invitees.remove({_id: id});
      }
    }
  },
  'invitees.register' (inviteeId) {
    var user = Meteor.user();
    if (user && user.services && user.services.facebook && user.services.facebook.email && Meteor.isServer) {
      var email = user.services.facebook.email;
      var newUserId = user._id;
      console.log("Should register new invitee " + inviteeId + " as " + newUserId + " ?..");

      if (!inviteeId) {
        inviteeId = "undefined"; // if left undefined it will fetch all db records
      }

      if (!email) {
        email = "undefined";
      }

      Invitees.find({ $or: [{email}, {_id: inviteeId}]}).fetch().forEach(invitee => {
        console.log("Merging invitee " + invitee._id + " to " + newUserId + " with facebook email " + email);

        Tasks.update({"author.id": invitee._id}, {
          $set: {
              "author.id": newUserId
            }
          }, { multi: true });
        Tasks.update({"receiver.id": invitee._id}, {
          $set: {
              "receiver.id": newUserId
            }
          }, { multi: true });
      });

      Invitees.remove({ $or: [{email}, {_id: inviteeId}]});

      // TODO: let the invitors know
    }
  },
  'users.getPopular' (size) {
    if (!Meteor.isServer) {
      return [];
    }
    var receivers = Promise.await(Tasks.rawCollection().aggregate([
          { $match: { $and: [{"author.id": Meteor.userId()}, {"receiver.id": {$ne: Meteor.userId()}}]}},
          {
          $group: {
            _id: "$receiver.id",
            count: { $sum: 1 },
            emails: { $push: "$$ROOT" }
          }},
          {$sort:{count: -1}},
          {$limit: size}]).toArray()).map(r => r._id);

     if (receivers.length < size) {
      receivers = receivers.concat(Promise.await(Tasks.rawCollection().aggregate([
                { $match: { $and: [
                    {"receiver.id": Meteor.userId()},
                    { "author.id": {$nin: receivers } },
                    { "author.id": {$ne: Meteor.userId() } }
                    ]}},
                {
                $group: {
                  _id: "$author.id",
                  count: { $sum: 1 },
                  emails: { $push: "$$ROOT" }
                }},
                {$sort:{count: -1}},
                {$limit: (size - receivers.length)}
            ]).toArray()).map(r => r._id));
     }

    if (receivers.length < size) {
      var founders = Meteor.users.find(
        { $and: [foundersFilter, {_id: {$nin: receivers}}, {_id: {$ne: Meteor.userId()}}]},
        { sort: { 'profile.name': 1 }, limit: size - receivers.length }).fetch().map(r => r._id);
      console.log("So the founders list was:");
      console.log(founders);
      receivers = receivers.concat(founders);
    }

    return Meteor.users.find({_id: {$in: receivers}}).fetch();
  }
});

if (Meteor.isServer) {
  process.env.MAIL_URL = "smtps://team.consensual%40gmail.com:teamConsensual123@smtp.gmail.com:465/";

  Meteor.publish('tasks', function tasksPublication() {
    return Tasks.find({$or: [{"author.id": this.userId}, {"receiver.id": this.userId}]});
  });

  Meteor.publish('invitees', function inviteesPublication() {
    return Invitees.find({invitorId: this.userId});
  });

  Meteor.publish("currentuser",
    function () {
          return Meteor.users.find({_id: this.userId},
            {fields: {"username": 1, "email" : 1, "subscribed": 1, "profile.name" : 1, "services.facebook.email": 1, "services.facebook.id": 1}});
        }
  );

  Meteor.publish("allusers",
    function () {
          return Meteor.users.find({},
            {fields: {"username": 1, "profile.name" : 1, "services.facebook.id": 1, "email": 1, "services.facebook.email": 1, "services.facebook.name": 1}});
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
        if (receiver && receiver.services && receiver.services.facebook && getEmail(receiver)) {
          var receiverEmail = getEmail(receiver);
          var receiverName = getName(receiver);

          console.log("Sending mail to " + receiverName + " at " + receiverEmail);
          var groupedByActor = Object.values(_.groupBy(record.emails, m => m.actor + m.task))

          var allUpdates = groupedByActor.map(function(taskGroup) {
            var taskId = taskGroup[0].task;
            var task = id2task.get(taskId);
            var actorName = getName(id2user.get(taskGroup[0].actor));
            var link = process.env.ROOT_URL + "/#!/tab/proposal/" + taskId;
            var href = "<a href=\"" + link + "\">'" + task.title + "'</a>";

            var updates = Object.values(_.groupBy(taskGroup, g => g.verb + g.entity)).map(function(fieldGroup) {
              if (fieldGroup[0].verb === "created") {
                return "created";
              }
              var possiblyStatusUpdates = [];
              if (fieldGroup[0].entity === "status") {
                var lastActivity = fieldGroup.filter(x => !x.oldValue).sort(function(a1, a2) {return a2.doneAt - a1.doneAt;})[0];
                if (lastActivity) {
                  possiblyStatusUpdates.push(actorName + " " + lastActivity.newValue + ".<br/>");
                }
              }
              return possiblyStatusUpdates.concat(fieldGroup.filter(x => x.oldValue).map(function(activity) {
                  var field = activity.entity;
                  if (activity.entity === "time") field = "eta";
                  if (activity.entity === "description") field = "text";
                  var newValue = activity.timezone ? moment.tz(activity.newValue, activity.timezone).format("HH:mm MM-DD-YYYY") : activity.newValue;
                  return (((typeof task[field] === 'string' || task[field] instanceof String) && task[field].toLowerCase() === activity.newValue.toLowerCase())
                  || (task[field] === activity.newValue)) ?
                    capitalize(activity.entity) + " was changed to '" + newValue + "'.<br/>" : "";
                }).filter(u => u.length > 0)).join('');
            }).filter(u => u.length > 0);
            var multipleChanges = taskGroup.length > 1;
            if (updates.includes('created')) {
              return "<br/>" + actorName + " created a new agreement " + href + ".";
            }
            return "<br/>New update" + (multipleChanges ? "s" : "") + " from " + actorName
                     + " for agreement " + href + ".<br/>" + updates.join('');
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