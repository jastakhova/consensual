import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import 'underscore';
import moment from 'moment-timezone';
import { Email } from 'meteor/email';
import { Promise } from 'meteor/promise';
import fs from 'fs';
import {Actions, getNotice, getAction, getCondition, getStatus, getTickler, getRequest, getState, getCurrentState} from './dictionary.js';
import ProfileUtils from '../components/todosList/profile.js';

export const Tasks = new Mongo.Collection('tasks');
export const Emails = new Mongo.Collection('emails');
export const Invitees = new Mongo.Collection('invitees');

// available where Tasks is imported
datetimeDisplayFormat = "MMM DD, YYYY, h:mm A";

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

function touchNotice(notices, noticeReceiverId) {
  return noticeReceiverId === Meteor.userId()
    ? notices.map(function(notice) {
      if (getNotice(notice.code).type === "view") {
        notice.touched = new Date().getTime();
      }
      return notice;
    })
    : notices;
}

function createNotice(notice) {
  return {
      code: notice.id,
      created: new Date().getTime()
   };
}

function updateNotices(person, notice) {
  return person.id === Meteor.userId() ? person.notices : person.notices.concat(notice);
}

function createTickler(ticklerId) {
 return {
  id: ticklerId,
  length: 1,
  lastActivated: new Date().getTime() - (24*60*60*1000),
  created: new Date().getTime()
 };
}

function updateTicklers(person, ticklerId, task) {
  return task.author.id === task.receiver.id
    || person.id === Meteor.userId()
    || person.ticklers.filter(t => t.id === ticklerId).length > 0
      ? person.ticklers
      : person.ticklers.concat(createTickler(ticklerId));
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

function registerChange(taskId, isNotNeeded, fillActivity, fillUpdateEntity, notify) {
  const task = Tasks.findOne(taskId);

  if (isNotNeeded(task)) {
    return;
  }

  var newStatuses = changeStatusesOnEditing(task);
  var activity = {
     actor: Meteor.userId(),
     actorName: getName(Meteor.user()),
     time: new Date().getTime()
  };
  fillActivity(task, activity);
  task.activity.push(activity);

  var notice = createNotice(getNotice("HAS_UPDATES"));
  var updateEntity = {
     activity: task.activity,
     status: newStatuses[2],
     "author.status": newStatuses[0],
     "receiver.status": newStatuses[1],
     "author.notices": updateNotices(task.author, notice),
     "receiver.notices": updateNotices(task.receiver, notice),
     "author.ticklers": updateTicklers(task.author, "CONSIDERING", task),
     "receiver.ticklers": updateTicklers(task.receiver, "CONSIDERING", task)
  };
  fillUpdateEntity(updateEntity, task);

  Tasks.update(taskId, { $set: updateEntity });
  notify(task, activity);
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

     var notices = selfAgreement ? [] : [createNotice(getNotice("NEW_PROPOSAL"))];

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
    createdTask.receiver.ticklers = updateTicklers(receiver, "CONSIDERING", createdTask);

    var id = Tasks.insert(createdTask);
    createdTask['_id'] = id;
    notifyOnNewValue(createdTask, newTask.receiver, "created", "agreement", newTask.task);
  },
  'tasks.updateTime' (taskId, oldTimeUTCString, newTimeUTCString, timezone) {
    check(taskId, String);
    check(oldTimeUTCString, String);
    check(newTimeUTCString, String);

    registerChange(taskId, function(task) {
      return newTimeUTCString === oldTimeUTCString;
    }, function(activity) {
      activity.field = 'time';
      activity.oldValue = new Date(moment(oldTimeUTCString).format()).getTime();
      activity.newValue = new Date(moment(newTimeUTCString).format()).getTime();
    }, function(updateEntity, task) {
      updateEntity.eta = new Date(moment(newTimeUTCString).format()).getTime();
      // if not overdue anymore remove overdue notice and tickler
      var notice = createNotice(getNotice("HAS_UPDATES"));
      var overdue = updateEntity.eta < new Date().getTime();
      var overdueNoticeId = getNotice("OVERDUE").id;
      var overdueTicklerId = getTickler("OVERDUE").id;
      var noticeFilter = n => overdue || n.code != overdueNoticeId;
      var ticklerFilter = n => overdue || n.id != overdueTicklerId;
      updateEntity["author.notices"] = updateNotices(task.author, notice).filter(noticeFilter);
      updateEntity["receiver.notices"] = updateNotices(task.receiver, notice).filter(noticeFilter);
      updateEntity["author.ticklers"] = updateTicklers(task.author, "CONSIDERING", task).filter(ticklerFilter);
      updateEntity["receiver.ticklers"] = updateTicklers(task.receiver, "CONSIDERING", task).filter(ticklerFilter);
    }, function(task, activity) {
      notifyOnActivity(task, activity, timezone);
    });
  },
  'tasks.updateLocation' (taskId, newLocation) {
    check(taskId, String);
    check(newLocation, String);

    registerChange(taskId, function(task) {
      return newLocation === task.location;
    }, function(task, activity) {
      activity.field = 'location';
      activity.oldValue = task.location;
      activity.newValue = newLocation;
    }, function(updateEntity, task) {
      updateEntity.location = newLocation;
    }, function(task, activity) {
      notifyOnActivity(task, activity);
    });
  },
  'tasks.updateDescription' (taskId, newDescription) {
    check(taskId, String);
    check(newDescription, String);

    registerChange(taskId, function(task) {
      return newDescription === task.text;
    }, function(task, activity) {
      activity.field = 'description';
      activity.oldValue = task.text;
      activity.newValue = newDescription;
    }, function(updateEntity, task) {
      updateEntity.text = newDescription;
    }, function(task, activity) {
      notifyOnActivity(task, activity);
    });
  },
  'tasks.updateTitle' (taskId, newTitle) {
    check(taskId, String);
    check(newTitle, String);

    registerChange(taskId, function(task) {
      return newTitle === task.title;
    }, function(task, activity) {
      activity.field = 'title';
      activity.oldValue = task.title;
      activity.newValue = newTitle;
    }, function(updateEntity, task) {
      updateEntity.title = newTitle;
    }, function(task, activity) {
      notifyOnActivity(task, activity);
    });
  },
  'tasks.removeNotice' (taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);
    if (task.author.notices.length > 0 && task.author.id === Meteor.userId()
      || task.receiver.notices.length > 0 && task.receiver.id === Meteor.userId()) {
      Tasks.update(taskId, {
          $set: {
            "author.notices": task.author.id === Meteor.userId() ? [] : task.author.notices,
            "receiver.notices":  task.receiver.id === Meteor.userId() ? [] : task.receiver.notices
          }
        });
    }
  },
  'tasks.touchNotice' (taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);
    var authorNotices = touchNotice(task.author.notices, task.author.id);
    var receiverNotices = touchNotice(task.receiver.notices, task.receiver.id);

    Tasks.update(taskId, {
      $set: {
        "author.notices": authorNotices,
        "receiver.notices": receiverNotices
      }
    });
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
    var filterTickler = t => t.id != getTickler("CONSIDERING").id;

    var notice = createNotice(getNotice("PROPOSAL_APPROVED"));
    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        "author.status": newAuthorStatus,
        "receiver.status": newReceiverStatus,
        status: newAuthorStatus === newReceiverStatus ? getStatus("agreed").id : task.status,
        wasAgreed: task.wasAgreed || newAuthorStatus === newReceiverStatus,
        "author.notices": updateNotices(task.author, notice),
        "receiver.notices": updateNotices(task.receiver, notice),
        "author.ticklers": task.author.id === Meteor.userId() ? task.author.ticklers.filter(filterTickler) : task.author.ticklers,
        "receiver.ticklers": task.receiver.id === Meteor.userId() ? task.receiver.ticklers.filter(filterTickler) : task.receiver.ticklers
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
        "author.notices": task.author.notices.concat(createNotice(getNotice("UNDER_CONSIDERATION"))),
        status: getStatus("considered").id
      }
    });
    notifyOnActivity(task, activity);
  },
  'tasks.cancel' (taskId, noticeType) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);

    if (getCurrentState(task).id === getState("LOCKED").id) {
      var activity = {
         actor: Meteor.userId(),
         actorName: getName(Meteor.user()),
         field: 'status',
         newValue: 'requested marking as Cancelled',
         time: new Date().getTime()
      };

      var request = getRequest("CANCELLED");
      var notice = createNotice(request.requestNotice);
      var tickler = request.tickler.id;

      task.activity.push(activity);
      Tasks.update(taskId, {
        $set: {
           activity: task.activity,
           "author.notices": updateNotices(task.author, notice),
           "receiver.notices": updateNotices(task.receiver, notice),
           "author.ticklers": updateTicklers(task.author, tickler, task),
           "receiver.ticklers": updateTicklers(task.receiver, tickler, task),
           request: {
              id: request.id,
              actorId: Meteor.userId(),
              created: new Date().getTime()
            }
       }
      });

      notifyOnActivity(task, activity);
      return;
    }

    var newAuthorStatus = task.author.id === Meteor.userId() ? getCondition("red").id : task.author.status;
    var newReceiverStatus = task.receiver.id === Meteor.userId() ? getCondition("red").id : task.receiver.status;

    if (newAuthorStatus === task.author.status && newReceiverStatus === task.receiver.status) {
      return;
    }

    var oldValue = task.author.id === Meteor.userId() ? task.author.status : task.receiver.status;

    var notice = createNotice(noticeType);
    var authorNotices = updateNotices(task.author, notice);
    var receiverNotices = updateNotices(task.receiver, notice);

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
        "author.notices": authorNotices,
        "receiver.notices": receiverNotices,
        "author.ticklers": [],
        "receiver.ticklers": [],
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

    var notice = createNotice(getNotice("HAS_COMMENTS"));

    var receiverShowedFirstResponse = Meteor.userId() === task.receiver.id
      && task.receiver.status === getCondition("grey").id;
    Tasks.update(taskId, {
      $set: {
        comments: task.comments,
        "receiver.status": receiverShowedFirstResponse ? 'yellow' : task.receiver.status,
        status: receiverShowedFirstResponse ? getStatus('considered').id : task.status,
        "author.notices": updateNotices(task.author, notice),
        "receiver.notices": updateNotices(task.receiver, notice)
      }
    });

    notifyOnNewValue(task, Meteor.userId() === task.author.id ? task.receiver.id : task.author.id, "added", "comment", text);
  },
  'tasks.markAsDone' (taskId) {
    check(taskId, String);

    /*
      if self-agreement -> A activity log, status, archived
      regular           -> B activity log, request, notification, tickler
    */

    const task = Tasks.findOne(taskId);
    var selfAgreement = task.author.id === task.receiver.id;

    var activity = selfAgreement
    ? {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       oldValue: 'Open',
       newValue: 'Completed',
       time: new Date().getTime()
     }
     : {
        actor: Meteor.userId(),
        actorName: getName(Meteor.user()),
        field: 'status',
        newValue: 'requested marking as Done',
        time: new Date().getTime()
      };

    var request = getRequest("DONE");
    var notice = createNotice(request.requestNotice);
    var tickler = request.tickler.id;

    var updateEntity = {
        activity: task.activity,
        status: selfAgreement ? getStatus("done").id : task.status,
        archived: selfAgreement,
        "author.notices": selfAgreement ? [] : updateNotices(task.author, notice),
        "receiver.notices": selfAgreement ? [] : updateNotices(task.receiver, notice),
        "author.ticklers": selfAgreement ? [] : updateTicklers(task.author, tickler, task),
        "receiver.ticklers": selfAgreement ? [] : updateTicklers(task.receiver, tickler, task)
    }

    if (!selfAgreement) {
      updateEntity.request = {
        id: request.id,
        actorId: Meteor.userId(),
        created: new Date().getTime()
      }
    }

    task.activity.push(activity);
    Tasks.update(taskId, { $set: updateEntity });

    notifyOnActivity(task, activity);
  },
  'tasks.approveRequest' (taskId) {
    check(taskId, String);
    // remove request, move to a new state, remove tickler, archive, notice, activity log

    const task = Tasks.findOne(taskId);
    var request = getRequest(task.request.id);
    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       newValue: request.activityLogApprovalRecord,
       time: new Date().getTime()
    };

    task.activity.push(activity);
    var filterTickler = t => t.id != request.tickler.id;
    var notice = createNotice(request.approvalNotice);

    var updateEntity = {
     activity: task.activity,
     status: request.statusOnApproval.id,
     "author.notices": updateNotices(task.author, notice),
     "receiver.notices": updateNotices(task.receiver, notice),
     "author.ticklers": task.author.ticklers.filter(filterTickler),
     "receiver.ticklers": task.receiver.ticklers.filter(filterTickler)
    };

    request.updateFields.forEach(function(updateField) {
      var toUpdate = updateField(task);
      updateEntity[toUpdate.field] = toUpdate.value;
    });

    Tasks.update(taskId, {
      $set: updateEntity,
      $unset : { "request": 1 }
    });

    notifyOnActivity(task, activity);
  },
  'tasks.denyRequest' (taskId) {
    check(taskId, String);
    // remove request, notice, activity log, remove tickler

    const task = Tasks.findOne(taskId);
    var request = getRequest(task.request.id);
    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       newValue: request.activityLogDenialRecord,
       time: new Date().getTime()
    };

    task.activity.push(activity);
    var filterTickler = t => t.id != request.tickler.id;
    var notice = createNotice(request.deniedNotice);

    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        "author.notices": updateNotices(task.author, notice),
        "receiver.notices": updateNotices(task.receiver, notice),
        "author.ticklers": task.author.ticklers.filter(filterTickler),
        "receiver.ticklers": task.receiver.ticklers.filter(filterTickler)
      },
    $unset : { "request": 1 }
    });

    notifyOnActivity(task, activity);
  },
  'tasks.cancelRequest' (taskId) {
    check(taskId, String);
    // remove request, new notice or remove old one, activity log, remove tickler

    const task = Tasks.findOne(taskId);
    var request = getRequest(task.request.id);
    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       newValue: request.activityLogCancelRecord,
       time: new Date().getTime()
    };

    task.activity.push(activity);
    var filterTickler = t => t.id != request.tickler.id;

    var filterUnseenNotice = n => n.code === request.requestNotice.id;
    var requestNoticeWasUnseen = task.author.id != Meteor.userId() && task.author.notices.filter(filterUnseenNotice).length > 0
    || task.receiver.id != Meteor.userId() && task.receiver.notices.filter(filterUnseenNotice).length > 0;
    // unseen -> remove
    // seen -> add new notice
    var authorNotices = task.author.notices;
    var receiverNotices = task.receiver.notices;
    if (requestNoticeWasUnseen) {
      var filterNotice = n => n.code != request.requestNotice.id && n.code != request.tickler.notice.id;
      authorNotices = authorNotices.filter(filterNotice);
      receiverNotices = receiverNotices.filter(filterNotice);
    } else {
      var notice = createNotice(request.cancelNotice);
      authorNotices = updateNotices(task.author, notice);
      receiverNotices = updateNotices(task.receiver, notice);
    }

    Tasks.update(taskId, {
      $set: {
        activity: task.activity,
        "author.notices": authorNotices,
        "receiver.notices": receiverNotices,
        "author.ticklers": task.author.ticklers.filter(filterTickler),
        "receiver.ticklers": task.receiver.ticklers.filter(filterTickler)
      },
    $unset : { "request": 1 }
    });

    notifyOnActivity(task, activity);
  },
  'tasks.lock' (taskId) {
    check(taskId, String);

    const task = Tasks.findOne(taskId);

    var activity = {
       actor: Meteor.userId(),
       actorName: getName(Meteor.user()),
       field: 'status',
       newValue: 'locked the agreement',
       time: new Date().getTime()
     };

    var notice = createNotice(getNotice("LOCKED"));

    task.activity.push(activity);
    Tasks.update(taskId, {
      $set: {
       activity: task.activity,
       locked: true,
       "author.notices": updateNotices(task.author, notice),
       "receiver.notices": updateNotices(task.receiver, notice)
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
    var startTime = new Date().getTime();
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
      var endTime = new Date().getTime();
      console.log("Register invitee took " + (endTime - startTime) + "ms");
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
        { $and: [ProfileUtils.foundersFilter(), {_id: {$nin: receivers}}, {_id: {$ne: Meteor.userId()}}]},
        { sort: { 'profile.name': 1 }, limit: size - receivers.length }).fetch().map(r => r._id);
      console.log("So the founders list was:");
      console.log(founders);
      receivers = receivers.concat(founders);
    }

    return Meteor.users.find({_id: {$in: receivers}}).fetch();
  },
  'users.getConnected' () {
    if (!Meteor.isServer) {
      return [];
    }
    var startTime = new Date().getTime();
    var connectedUsers = new Set();
    Tasks.find({$or: [{"author.id": Meteor.userId()}, {"receiver.id": Meteor.userId()}]},
      {fields: {"author.id": 1, "receiver.id": 1}}).fetch().forEach(task => {
      connectedUsers.add(task.author.id);
      connectedUsers.add(task.receiver.id);
    });
    var endTime = new Date().getTime();
    console.log("Collecting connected users in " + (endTime - startTime) + "ms");

    startTime = new Date().getTime();
    var invitees = Invitees.find().fetch();
    var existingUsers = Meteor.users.find({$or: [
        {_id: {$in: Array.from(connectedUsers)}},
        ProfileUtils.foundersFilter()]},
      {fields: {"username": 1, "profile.name" : 1, "services.facebook.id": 1}}).fetch();
    endTime = new Date().getTime();
    console.log("Collecting invitees in " + (endTime - startTime) + "ms");
    return invitees.concat(existingUsers);
  }
});

if (Meteor.isServer) {
  process.env.MAIL_URL = "smtps://team.consensual%40gmail.com:teamConsensual123@smtp.gmail.com:465/";

  Meteor.publish('tasks', function tasksPublication() {
    return Tasks.find({$or: [{"author.id": this.userId}, {"receiver.id": this.userId}]},
      {fields: {"text": 1, "title": 1, "eta": 1, "author": 1, "receiver": 1, "status": 1, "archived": 1, "locked": 1, "wasAgreed": 1}});
  });

  Meteor.publish('tasksContacts', function tasksPublication() {
    return Tasks.find({$or: [{"author.id": this.userId}, {"receiver.id": this.userId}]},
      {fields: {"author.id": 1, "receiver.id": 1}}).limit(10);
  });

  Meteor.publish('tasksWith', function tasksPublication(profileId) {
    return Tasks.find({$or: [{"author.id": this.userId, "receiver.id": profileId}, {"receiver.id": this.userId, "author.id": profileId}]});
  });

  Meteor.publish('task', function tasksPublication(taskId) {
    return Tasks.find({_id: taskId});
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

//  Meteor.setInterval(function() {
//    console.log("Starting sending cycle...");
//    var startTime = new Date().getTime();
//
//    function getEmailsToProcess() {
//      var newReceivers = Promise.await(Emails.rawCollection().distinct("receiver", {"sentAt": { "$exists" : false }}));
//      var emails = Promise.await(Emails.rawCollection().aggregate([{ $match: { receiver: { $in: newReceivers } } },
//        {
//        $group: {
//          _id: "$receiver",
//          lastSent: { $max: "$sentAt" },
//          emails: { $push: "$$ROOT" }
//        }},
//        { $match: { $or: [{lastSent: null}, {lastSent: {$lt: moment.utc().subtract(30, 'minutes').valueOf()}}] }}]).toArray());
//
//      emails.forEach(email => email.emails = email.emails.filter(record => !record.sentAt));
//      return emails;
//    }
//
//    var emails = getEmailsToProcess();
//
//    function getId2TaskMapping(emails) {
//      var taskIds = [];
//      emails.forEach(email => email.emails.forEach(e => taskIds.push(e.task)));
//      var tasks = Tasks.find({_id: {$in: _.uniq(taskIds)}}).fetch();
//      return new Map(tasks.map(i => [i._id, i]));
//    }
//
//    function getId2UserMapping(emails) {
//      var users = emails.map(email => email._id);
//      emails.forEach(record => record.emails.forEach(notification => users.push(notification.actor)));
//      var finalReceivers = Meteor.users.find({_id: {$in: _.uniq(users)}}).fetch();
//      return new Map(finalReceivers.map(i => [i._id, i]));
//    }
//
//    var id2task = getId2TaskMapping(emails);
//    var id2user = getId2UserMapping(emails);
//
//    emails.forEach(function(record) {
//      var receiver = id2user.get(record._id);
//      if (receiver && receiver.services && receiver.services.facebook && getEmail(receiver)) {
//        var receiverEmail = getEmail(receiver);
//        var receiverName = getName(receiver);
//
//        console.log("Sending mail to " + receiverName + " at " + receiverEmail);
//        var groupedByActor = Object.values(_.groupBy(record.emails, m => m.actor + m.task))
//
//        var allUpdates = groupedByActor.map(function(taskGroup) {
//          var taskId = taskGroup[0].task;
//          var task = id2task.get(taskId);
//          var actorName = getName(id2user.get(taskGroup[0].actor));
//          var link = process.env.ROOT_URL + "/#!/tab/proposal/" + taskId;
//          var href = "<a href=\"" + link + "\">'" + task.title + "'</a>";
//
//          var updates = Object.values(_.groupBy(taskGroup, g => g.verb + g.entity)).map(function(fieldGroup) {
//            if (fieldGroup[0].verb === "created") {
//              return "created";
//            }
//            var possiblyStatusUpdates = [];
//            if (fieldGroup[0].entity === "status") {
//              var lastActivity = fieldGroup.filter(x => !x.oldValue).sort(function(a1, a2) {return a2.doneAt - a1.doneAt;})[0];
//              if (lastActivity) {
//                possiblyStatusUpdates.push(actorName + " " + lastActivity.newValue + ".<br/>");
//              }
//            }
//            return possiblyStatusUpdates.concat(fieldGroup.filter(x => x.oldValue).map(function(activity) {
//                var field = activity.entity;
//                if (activity.entity === "time") field = "eta";
//                if (activity.entity === "description") field = "text";
//                var newValue = activity.timezone ? moment.tz(activity.newValue, activity.timezone).format("HH:mm MM-DD-YYYY") : activity.newValue;
//                return (((typeof task[field] === 'string' || task[field] instanceof String) && task[field].toLowerCase() === activity.newValue.toLowerCase())
//                || (task[field] === activity.newValue)) ?
//                  capitalize(activity.entity) + " was changed to '" + newValue + "'.<br/>" : "";
//              }).filter(u => u.length > 0)).join('');
//          }).filter(u => u.length > 0);
//          var multipleChanges = taskGroup.length > 1;
//          if (updates.includes('created')) {
//            return "<br/>" + actorName + " created a new agreement " + href + ".";
//          }
//          return "<br/>New update" + (multipleChanges ? "s" : "") + " from " + actorName
//                   + " for agreement " + href + ".<br/>" + updates.join('');
//        });
//
//        var activityToSend = record.emails[0];
//
//        var task = id2task.get(activityToSend.task);
//        var subject = "Recent changes to Consensual agreements" + (groupedByActor.length > 1 ? "" : " by " + getName(id2user.get((groupedByActor[0])[0].actor)));
//        var text = "<html><body>Hi!<br/>" + allUpdates.join('') + "</body></html>";
//        Meteor.call('email.send', receiverName + "<" + receiverEmail + ">", subject, text);
//        var emailIds = record.emails.map(e => e._id);
//        Emails.update({_id: {$in: emailIds}}, {
//          $set: {
//            sentAt: moment.utc().valueOf()
//          }
//        }, { multi: true });
//      }
//    });
//
//    var endTime = new Date().getTime();
//    console.log("Email background process finished in " + (endTime - startTime) + " ms");
//  }, 60*1000 /* 1 minute interval */);
//
//  Meteor.setInterval(function() {
//    console.log("Starting notice check cycle...");
//    var startTime = new Date().getTime();
//
//    var dayPeriod = 24*60*60*1000;
////      var minPeriod = 5*60*1000;
//    var timeToCheck = new Date().getTime() - dayPeriod;
//    var noticeFilter = notice => notice.touched > timeToCheck;
//
//    var tasks = Tasks.find({$or: [
//      {"author.notices": {$elemMatch: {touched: {$lt: timeToCheck}}}},
//      {"receiver.notices": {$elemMatch: {touched: {$lt: timeToCheck}}}}]}).fetch().forEach(function(task) {
//        Tasks.update(task._id, {
//          $set: {
//            "author.notices": task.author.notices.filter(noticeFilter),
//            "receiver.notices": task.receiver.notices.filter(noticeFilter)
//          }
//        });
//    });
//
//    var endTime = new Date().getTime();
//    console.log("Notice background process finished in " + (endTime - startTime) + " ms");
//
//    }, 10*60*1000  /* 10 minute interval */);
//
//  Meteor.setInterval(function() {
//    console.log("Starting ticklers check cycle...");
//    var startTime = new Date().getTime();
//
//    var dayPeriod = 24*60*60*1000;
////    var dayPeriod = 5*60*1000;
//    var timeToCheck = new Date().getTime() - dayPeriod;
//
//    var findActionableTicklers = function(profile) {
//      return ProfileUtils.createMapFromList(profile.ticklers
//           .filter(t => t.lastActivated < new Date().getTime() - dayPeriod * t.length
//             && profile.notices.filter(n => n.code === getTickler(t.id).notice.id).length == 0)
//           .map(function(t) { return {
//              'id': t.id,
//              'notice': createNotice(getTickler(t.id).notice)
//              };}), "id");
//    };
//
//    var touchTickler = function(tickler, chosen) {
//      if (chosen[tickler.id]) {
//        tickler.length = tickler.length * 2;
//        tickler.lastActivated = new Date().getTime();
//      }
//      return tickler;
//    }
//
//    var tasks = Tasks.find({$or: [
//      {"author.ticklers": {$elemMatch: {lastActivated: {$lt: timeToCheck}}}},
//      {"receiver.ticklers": {$elemMatch: {lastActivated: {$lt: timeToCheck}}}}]}).fetch().forEach(function(task) {
//        var authorNoticesToAdd = findActionableTicklers(task.author);
//        var receiverNoticesToAdd = findActionableTicklers(task.receiver);
//        if (Object.keys(authorNoticesToAdd).length > 0  || Object.keys(receiverNoticesToAdd).length > 0) {
//          console.log("Tickler notice added for " + task._id);
//          Tasks.update(task._id, {
//            $set: {
//              "author.notices": Object.keys(authorNoticesToAdd).length > 0 ? task.author.notices.concat(Object.values(authorNoticesToAdd).map(n => n.notice)) : task.author.notices,
//              "receiver.notices": Object.keys(receiverNoticesToAdd).length ? task.receiver.notices.concat(Object.values(receiverNoticesToAdd).map(n => n.notice)) : task.receiver.notices,
//              "author.ticklers": Object.keys(authorNoticesToAdd).length > 0 ? task.author.ticklers.map(t => touchTickler(t, authorNoticesToAdd)) : task.author.ticklers,
//              "receiver.ticklers": Object.keys(receiverNoticesToAdd).length ? task.receiver.ticklers.map(t => touchTickler(t, receiverNoticesToAdd)) : task.receiver.ticklers
//            }
//          });
//        }
//    });
//
//    var endTime = new Date().getTime();
//    console.log("Tickler background process finished in " + (endTime - startTime) + " ms");
//
//  }, 10*60*1000  /* 10 minute interval */);
//
//  Meteor.setInterval(function() {
//    console.log("Starting overdue check cycle...");
//    var startTime = new Date().getTime();
//
//    var timeToCheck = new Date().getTime();
//    var tickler = getTickler("OVERDUE").id;
//
//    var tasks = Tasks.find({ $and: [
//      {"eta": {$lt: timeToCheck}},
//      {"archived": false},
//      {$nor: [{"author.ticklers": {"id": getTickler("OVERDUE").id}}]}
//      ]}).fetch().forEach(function(task) {
//        console.log(task._id);
//        Tasks.update(task._id, {
//          $set: {
//            "author.ticklers": task.author.ticklers.concat(createTickler(tickler)),
//            "receiver.ticklers": task.receiver.ticklers.concat(createTickler(tickler))
//          }
//        });
//    });
//
//    var endTime = new Date().getTime();
//    console.log("Overdue background process finished in " + (endTime - startTime) + " ms");
//
//
//  }, 10*60*1000  /* 10 minute interval */);
}