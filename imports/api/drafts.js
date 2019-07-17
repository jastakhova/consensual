import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import moment from 'moment-timezone';
import {Drafts, Tasks} from './background.js';
import ProfileUtils from '../components/todosList/profile.js';
import { Promise } from 'meteor/promise';


export {
  Drafts
}

Meteor.methods({
  'drafts.create' (title, description, receiverId, location, eta, parentId) {
    check(title, String);
    check(description, String);
    check(receiverId, String);
    check(location, String);
    check(parentId, String);

    var receiver = Meteor.users.findOne({_id: receiverId});

    return Drafts.insert({
      title: ("Copy of '" + title + "'"),
      text: description,
      author: {
        id: Meteor.userId(),
        name: ProfileUtils.getName(Meteor.user())
      },
      receiver: {
        id: receiverId,
        name: ProfileUtils.getName(receiver)
      },
      location,
      eta,
      parent: parentId
    });
  },
  'drafts.publish' (draftId) {
    const draft = Drafts.findOne(draftId);
    var task = {
      title: draft.title,
      task: draft.text,
      eta: draft.eta,
      receiver: draft.receiver.id,
    };
    var newTaskId = Promise.await(Meteor.call('tasks.insert', task));

    var task = Tasks.findOne(draft.parent);
    var children = task.children ? task.children : [];
    children.push(newTaskId);
    Tasks.update(draft.parent, { $set: {children} });
    Drafts.update(draftId, { $set: {removed: new Date().getTime()} });

    return newTaskId;
  },
  'drafts.delete' (draftId) {
    Drafts.update(draftId, { $set: {removed: new Date().getTime()} });
  },
  'drafts.updateTime' (draftId, oldTimeUTCString, newTimeUTCString, timezone) {
    check(draftId, String);
    check(oldTimeUTCString, String);
    check(newTimeUTCString, String);

    if (newTimeUTCString === oldTimeUTCString) {
      return;
    }

    const draft = Drafts.findOne(draftId);
    draft.eta = new Date(moment(newTimeUTCString).format()).getTime();
    Drafts.update(draftId, { $set: draft });
  },
  'drafts.updateLocation' (draftId, newLocation) {
    check(draftId, String);
    check(newLocation, String);

    const draft = Drafts.findOne(draftId);

    if (newLocation === draft.location) {
      return;
    }

    draft.location = newLocation;
    Drafts.update(draftId, { $set: draft });
  },
  'drafts.updateDescription' (draftId, newDescription) {
    check(draftId, String);
    check(newDescription, String);

    const draft = Drafts.findOne(draftId);

    if (newDescription === draft.text) {
      return;
    }

    draft.text = newDescription;
    Drafts.update(draftId, { $set: draft });
  },
  'drafts.updateTitle' (draftId, newTitle) {
    check(draftId, String);
    check(newTitle, String);

    const draft = Drafts.findOne(draftId);

    if (newTitle === draft.title) {
      return;
    }

    draft.title = newTitle;
    Drafts.update(draftId, { $set: draft });
  },
  'drafts.updateReceiver' (draftId, newReceiverId) {
    check(draftId, String);
    check(newReceiverId, String);

    const draft = Drafts.findOne(draftId);

    if (newReceiverId === draft.receiver.id) {
      return;
    }

    draft.receiver.id = newReceiverId;
    draft.receiver.name = ProfileUtils.getName(Meteor.users.findOne({_id: newReceiverId}));
    Drafts.update(draftId, { $set: draft });
  }
});