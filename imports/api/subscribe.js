import {Tasks, Emails, Invitees, Drafts} from './background.js';
import { Meteor } from 'meteor/meteor';

if (Meteor.isServer) {
  process.env.MAIL_URL = "smtps://team.consensual%40gmail.com:teamConsensual123@smtp.gmail.com:465/";

  Meteor.publish('tasks', function tasksPublication() {
    return Tasks.find({$or: [{"author.id": this.userId}, {"receiver.id": this.userId}]},
      {fields: {"text": 1, "title": 1, "eta": 1, "author": 1, "receiver": 1, "status": 1, "archived": 1, "locked": 1, "wasAgreed": 1, "activity.field": 1, "activity.time": 1, "activity.actor": 1}});
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

  Meteor.publish('draft', function tasksPublication(draftId) {
    return Drafts.find({_id: draftId});
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
}