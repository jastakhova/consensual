import {Actions, getNotice, getAction, getCondition, getStatus, getTickler, getRequest, getState, getCurrentState} from './dictionary.js';
import ProfileUtils from '../components/todosList/profile.js';

export const Tasks = new Mongo.Collection('tasks');
export const Emails = new Mongo.Collection('emails');
export const Invitees = new Mongo.Collection('invitees');
export const Drafts = new Mongo.Collection('drafts');

function capitalize(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const createTickler = function (ticklerId) {
 return {
  id: ticklerId,
  length: 1,
  lastActivated: new Date().getTime() - (24*60*60*1000),
  created: new Date().getTime()
 };
};

export const createNotice = function (notice) {
 return {
     code: notice.id,
     created: new Date().getTime()
  };
}

export const updateTicklersRaw = function (person, ticklerId, task, noUpdate) {
 return task.author.id === task.receiver.id
   || noUpdate
   || person.ticklers.filter(t => t.id === ticklerId).length > 0
     ? person.ticklers
     : person.ticklers.concat(createTickler(ticklerId));
}

if (Meteor.isServer) {
  Meteor.setInterval(function() {
    console.log("Starting sending cycle...");
    var startTime = new Date().getTime();

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
      if (receiver && receiver.services && receiver.services.facebook && ProfileUtils.getEmail(receiver)) {
        var receiverEmail = ProfileUtils.getEmail(receiver);
        var receiverName = ProfileUtils.getName(receiver);

        console.log("Sending mail to " + receiverName + " at " + receiverEmail);
        var groupedByActor = Object.values(_.groupBy(record.emails, m => m.actor + m.task))

        var allUpdates = groupedByActor.map(function(taskGroup) {
          var taskId = taskGroup[0].task;
          var task = id2task.get(taskId);
          var actorName = ProfileUtils.getName(id2user.get(taskGroup[0].actor));
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
        var subject = "Recent changes to Consensual agreements" + (groupedByActor.length > 1 ? "" : " by " + ProfileUtils.getName(id2user.get((groupedByActor[0])[0].actor)));
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

    var endTime = new Date().getTime();
    console.log("Email background process finished in " + (endTime - startTime) + " ms");
  }, 60*1000 /* 1 minute interval */);

  Meteor.setInterval(function() {
    console.log("Starting notice check cycle...");
    var startTime = new Date().getTime();

    var dayPeriod = 24*60*60*1000;
//      var minPeriod = 5*60*1000;
    var timeToCheck = new Date().getTime() - dayPeriod;
    var noticeFilter = notice => notice.touched > timeToCheck;

    var tasks = Tasks.find({$or: [
      {"author.notices": {$elemMatch: {touched: {$lt: timeToCheck}}}},
      {"receiver.notices": {$elemMatch: {touched: {$lt: timeToCheck}}}}]}).fetch().forEach(function(task) {
        Tasks.update(task._id, {
          $set: {
            "author.notices": task.author.notices.filter(noticeFilter),
            "receiver.notices": task.receiver.notices.filter(noticeFilter)
          }
        });
    });

    var endTime = new Date().getTime();
    console.log("Notice background process finished in " + (endTime - startTime) + " ms");

    }, 10*60*1000  /* 10 minute interval */);

  Meteor.setInterval(function() {
    console.log("Starting ticklers check cycle...");
    var startTime = new Date().getTime();

    var dayPeriod = 24*60*60*1000;
//    var dayPeriod = 5*60*1000;
    var timeToCheck = new Date().getTime() - dayPeriod;

    var findActionableTicklers = function(profile) {
      return ProfileUtils.createMapFromList(profile.ticklers
           .filter(t => t.lastActivated < new Date().getTime() - dayPeriod * t.length
             && profile.notices.filter(n => n.code === getTickler(t.id).notice.id).length == 0)
           .map(function(t) { return {
              'id': t.id,
              'notice': createNotice(getTickler(t.id).notice)
              };}), "id");
    };

    var touchTickler = function(tickler, chosen) {
      if (chosen[tickler.id]) {
        tickler.length = tickler.length * 2;
        tickler.lastActivated = new Date().getTime();
      }
      return tickler;
    }

    var tasks = Tasks.find({$or: [
      {"author.ticklers": {$elemMatch: {lastActivated: {$lt: timeToCheck}}}},
      {"receiver.ticklers": {$elemMatch: {lastActivated: {$lt: timeToCheck}}}}]}).fetch().forEach(function(task) {
        var authorNoticesToAdd = findActionableTicklers(task.author);
        var receiverNoticesToAdd = findActionableTicklers(task.receiver);
        if (Object.keys(authorNoticesToAdd).length > 0  || Object.keys(receiverNoticesToAdd).length > 0) {
          console.log("Tickler notice added for " + task._id);
          Tasks.update(task._id, {
            $set: {
              "author.notices": Object.keys(authorNoticesToAdd).length > 0 ? task.author.notices.concat(Object.values(authorNoticesToAdd).map(n => n.notice)) : task.author.notices,
              "receiver.notices": Object.keys(receiverNoticesToAdd).length ? task.receiver.notices.concat(Object.values(receiverNoticesToAdd).map(n => n.notice)) : task.receiver.notices,
              "author.ticklers": Object.keys(authorNoticesToAdd).length > 0 ? task.author.ticklers.map(t => touchTickler(t, authorNoticesToAdd)) : task.author.ticklers,
              "receiver.ticklers": Object.keys(receiverNoticesToAdd).length ? task.receiver.ticklers.map(t => touchTickler(t, receiverNoticesToAdd)) : task.receiver.ticklers
            }
          });
        }
    });

    var endTime = new Date().getTime();
    console.log("Tickler background process finished in " + (endTime - startTime) + " ms");

  }, 10*60*1000  /* 10 minute interval */);

  Meteor.setInterval(function() {
    console.log("Starting overdue check cycle...");
    var startTime = new Date().getTime();

    var timeToCheck = new Date().getTime();
    var tickler = getTickler("OVERDUE").id;

    var tasks = Tasks.find({ $and: [
      {"eta": {$lt: timeToCheck}},
      {"archived": false},
      {$nor: [{"author.ticklers": {"id": getTickler("OVERDUE").id}}]}
      ]}).fetch().forEach(function(task) {
        console.log(task._id);
        Tasks.update(task._id, {
          $set: {
            "author.ticklers": updateTicklersRaw(task.author, tickler, task, false),
            "receiver.ticklers": updateTicklersRaw(task.receiver, tickler, task, false)
          }
        });
    });

    var endTime = new Date().getTime();
    console.log("Overdue background process finished in " + (endTime - startTime) + " ms");


  }, 10*60*1000  /* 10 minute interval */);
}