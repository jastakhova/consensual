import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import moment from 'moment-timezone';
import {Drafts} from './background.js';
import ProfileUtils from '../components/todosList/profile.js';


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
    //TODO: + add reference of the copy to the parent
  },
  'drafts.delete' (draftId) {
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
  }
});