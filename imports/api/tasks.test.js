import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { assert } from 'meteor/practicalmeteor:chai';
import { sinon } from 'meteor/practicalmeteor:sinon';

import { Invitees, Tasks } from './tasks.js';
import { getCurrentState, getState, getCondition, getNotice, getRequest } from './dictionary.js';

if (Meteor.isServer) {
  describe('Tasks', () => {
    describe('methods', () => {
    	const userId = "dpy3hmJHy8ZQyuw5t";
    	const otherUserId = "3iSfMT3X4TYyvvRQ4";
    	const inviteeId = "XbTqCFm4GMTZwRfyu";
    	const email = "bla@bla.com";
    	const otherEmail = "bla2@bla.com";

    	function changeUser(id) {
    	  Meteor.user = sinon.stub();
        Meteor.user.returns( {
          _id: id,
          username: "name",
          services: {facebook: {email: email}}
        });

        Meteor.userId = sinon.stub();
        Meteor.userId.returns(id);
    	}

			beforeEach(() => {
			  changeUser(userId);

        Meteor.users.insert({
          _id: userId,
          username: "author name",
          services: {facebook: { email: email}}
        });

        Meteor.users.insert({
          _id: otherUserId,
          username: "receiver name",
          services: {facebook: { email: otherEmail}}
        });
			});

			afterEach(( ) => {
			  Invitees.remove({_id: inviteeId});
			  Tasks.remove({"author.id": userId});

        Meteor.users.remove({_id: userId});
        Meteor.users.remove({_id: otherUserId});
      });
    
      it('can register matching invitee by email', () => {
        Invitees.insert({
           _id: inviteeId,
           invitorId: userId,
           username: "Invitee",
           creationTime: new Date(moment().format()).getTime(),
           email: email
        });
        assert.equal(Invitees.find().count(), 1);

        const registerTask = Meteor.server.method_handlers['invitees.register'];
        registerTask.apply({}, []);

        assert.equal(Invitees.find().count(), 0);
      });

      it('can register matching invitee by id', () => {
        Invitees.insert({
           _id: inviteeId,
           invitorId: userId,
           username: "Invitee",
           creationTime: new Date(moment().format()).getTime(),
           email: "notmatching@bla.com"
        });
        assert.equal(Invitees.find().count(), 1);

        const registerTask = Meteor.server.method_handlers['invitees.register'];
        registerTask.apply({}, [inviteeId]);

        assert.equal(Invitees.find().count(), 0);
      });

      it('can persists invitees if no match', () => {
        Invitees.insert({
           _id: inviteeId,
           invitorId: userId,
           username: "Invitee",
           creationTime: new Date(moment().format()).getTime(),
           email: "notmatching@bla.com"
        });
        assert.equal(Invitees.find().count(), 1);

        const registerTask = Meteor.server.method_handlers['invitees.register'];
        registerTask.apply({}, []);

        assert.equal(Invitees.find().count(), 1);
      });

      it('can create task', () => {
        assert.equal(Tasks.find().count(), 0);

        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(tasks[0].author.id, userId);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);
        // a notice should have been created for the receiver
        assert.equal(tasks[0].receiver.notices.length, 1);
      });

      it('can remove notice', () => {
        assert.equal(Tasks.find().count(), 0);

        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(tasks[0].author.id, userId);
        assert.equal(tasks[0].receiver.notices.length, 1);

        changeUser(otherUserId);

        const removeNotice = Meteor.server.method_handlers['tasks.removeNotice'];
        removeNotice.apply({}, [tasks[0]._id]);

        tasks = Tasks.find().fetch();
        assert.equal(tasks.length, 1);
        assert.equal(tasks[0].receiver.notices.length, 0);
      });

      it('can create self task', () => {
        assert.equal(Tasks.find().count(), 0);

        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: userId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(tasks[0].author.id, userId);
        assert.equal(tasks[0].receiver.id, userId);
        assert.equal(getCurrentState(tasks[0]).id, getState("AGREED").id);
        // no notices as self agreement
        assert.equal(tasks[0].receiver.notices.length, 0);
      });

      it('can edit task by author after proposal', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        const registerTask2 = Meteor.server.method_handlers['tasks.updateTime'];
        registerTask2.apply({}, [tasks[0]._id, initialTime, moment().add(1, 'days').utc().format()]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.ok(initialTime !== tasks2[0].eta);
        assert.equal(getCurrentState(tasks2[0]).id, getState("PROPOSED").id);

        assert.equal(tasks[0].author.status, tasks2[0].author.status);
        assert.equal(tasks[0].receiver.status, tasks2[0].receiver.status);
      });

      it('can edit task by receiver after proposal', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);
        assert.equal(tasks[0].author.notices.length, 0);

        changeUser(otherUserId);

        var newLocation = "new location";
        const registerTask2 = Meteor.server.method_handlers['tasks.updateLocation'];
        registerTask2.apply({}, [tasks[0]._id, newLocation]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(tasks2[0].location, newLocation);
        assert.equal(getCurrentState(tasks2[0]).id, getState("DEEPLY_CONSIDERED").id);
        assert.equal(tasks2[0].author.notices.length, 1);
      });

      it('can edit task in case of self agreement', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: userId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("AGREED").id);

        var newDescription = task.task + "2";
        const registerTask2 = Meteor.server.method_handlers['tasks.updateDescription'];
        registerTask2.apply({}, [tasks[0]._id, newDescription]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(tasks2[0].text, newDescription);
        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);
        //no notices for self agreements
        assert.equal(tasks2[0].author.notices.length, 0);
        assert.equal(tasks2[0].receiver.notices.length, 0);
      });

      it('can edit task when it is considered by both parties', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        var newTitle = "stupid title";
        const registerTask2 = Meteor.server.method_handlers['tasks.updateTitle'];
        registerTask2.apply({}, [tasks[0]._id, newTitle]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(tasks2[0].title, newTitle);
        assert.equal(getCurrentState(tasks2[0]).id, getState("DEEPLY_CONSIDERED").id);
        assert.equal(tasks2[0].author.notices.length, 1);
        assert.equal(tasks2[0].receiver.notices.length, 1);

        changeUser(userId);

        var newTitle3 = "smart title";
        registerTask2.apply({}, [tasks[0]._id, newTitle3]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);

        assert.equal(tasks3[0].title, newTitle3);
        assert.equal(getCurrentState(tasks3[0]).id, getState("DEEPLY_CONSIDERED").id);
        assert.equal(tasks3[0].author.notices.length, 1);
        assert.equal(tasks3[0].receiver.notices.length, 2);
      });

      it('can approve task', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);
        assert.equal(tasks[0].receiver.ticklers.length, 1);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);
        assert.equal(tasks2[0].author.notices.length, 1);
        assert.equal(tasks2[0].receiver.notices.length, 1);
        assert.equal(tasks2[0].receiver.ticklers.length, 0);
      });

      it('can approve task when it is considered by both parties', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        var newTitle = "stupid title";
        const registerTask2 = Meteor.server.method_handlers['tasks.updateTitle'];
        registerTask2.apply({}, [tasks[0]._id, newTitle]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(tasks2[0].title, newTitle);
        assert.equal(getCurrentState(tasks2[0]).id, getState("DEEPLY_CONSIDERED").id);

        changeUser(userId);

        const registerTask3 = Meteor.server.method_handlers['tasks.approve'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);

        assert.equal(getCurrentState(tasks3[0]).id, getState("CONSIDERED").id);
        assert.equal(tasks3[0].author.status, getCondition("green").id);
        assert.equal(tasks3[0].receiver.status, getCondition("yellow").id);
        assert.equal(tasks3[0].receiver.notices.length, 2); // NEW_PROPOSAL and PROPOSAL_APPROVED
        assert.ok(!tasks3[0].wasAgreed);
      });

      it('can edit approved task', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);

        var newTitle = "stupid title";
        const registerTask3 = Meteor.server.method_handlers['tasks.updateTitle'];
        registerTask3.apply({}, [tasks[0]._id, newTitle]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);

        assert.equal(tasks3[0].title, newTitle);
        assert.equal(getCurrentState(tasks3[0]).id, getState("CONSIDERED").id);
        assert.equal(tasks3[0].author.status, getCondition("yellow").id);
        assert.equal(tasks3[0].wasAgreed, true);
      });

      it('can oppose task', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.cancel'];
        registerTask2.apply({}, [tasks[0]._id, getNotice("PROPOSAL_REJECTED")]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("OPPOSED").id);
        assert.equal(tasks2[0].author.status, getCondition("green").id);
        assert.equal(tasks2[0].receiver.status, getCondition("red").id);
        assert.equal(tasks2[0].author.notices.length, 1);
        assert.equal(tasks2[0].receiver.notices.length, 1);
        assert.ok(tasks2[0].archived);
      });

      it('can respond by adding a comment', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.addComment'];
        registerTask2.apply({}, [tasks[0]._id, "I got pregnant in this bathroom."]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("CONSIDERED").id);
        assert.equal(tasks2[0].author.status, getCondition("green").id);
        assert.equal(tasks2[0].receiver.status, getCondition("yellow").id);
        assert.equal(tasks2[0].author.notices.length, 1);
        assert.equal(tasks2[0].receiver.notices.length, 1);
      });

      it('can consider', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.maybe'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("CONSIDERED").id);
        assert.equal(tasks2[0].author.status, getCondition("green").id);
        assert.equal(tasks2[0].receiver.status, getCondition("yellow").id);
        assert.equal(tasks2[0].author.notices.length, 1);
        assert.equal(tasks2[0].receiver.notices.length, 1);
      });

      it('can reconsider', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);

        const registerTask3 = Meteor.server.method_handlers['tasks.maybe'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);

        assert.equal(getCurrentState(tasks3[0]).id, getState("CONSIDERED").id);
        assert.equal(tasks3[0].author.status, getCondition("green").id);
        assert.equal(tasks3[0].receiver.status, getCondition("yellow").id);
        assert.equal(tasks3[0].author.notices.length, 2); // for agreed and considered status changes separately
        assert.equal(tasks3[0].receiver.notices.length, 1);
      });

      it('can correctly identify if the proposal was agreed before', () => {
        assert.equal(Tasks.find().count(), 0);

        var initialTime = moment().utc().format();

        var task = {
          task: "Long description",
          time: initialTime,
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);

        const registerTask3 = Meteor.server.method_handlers['tasks.maybe'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);
        assert.equal(getCurrentState(tasks3[0]).id, getState("CONSIDERED").id);

        changeUser(userId);
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks4 = Tasks.find().fetch();
        assert.equal(tasks4.length, 1);
        assert.equal(getCurrentState(tasks4[0]).id, getState("DEEPLY_CONSIDERED").id);

        registerTask2.apply({}, [tasks[0]._id]);
        var tasks5 = Tasks.find().fetch();
        assert.equal(tasks5.length, 1);
        assert.equal(tasks5[0].wasAgreed, true);
      });

      it('can mark as done self-agreement', () => {
        assert.equal(Tasks.find().count(), 0);

        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: userId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("AGREED").id);

        const registerTask3 = Meteor.server.method_handlers['tasks.markAsDone'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);
        assert.equal(getCurrentState(tasks3[0]).id, getState("COMPLETED").id);
        assert.equal(tasks3[0].wasAgreed, true);
        assert.equal(tasks3[0].archived, true);
      });

      it('can request marking as done and confirm that', () => {
        assert.equal(Tasks.find().count(), 0);

        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);

        const registerTask3 = Meteor.server.method_handlers['tasks.markAsDone'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);
        assert.equal(getCurrentState(tasks3[0]).id, getState("UNDER_REQUEST").id);
        assert.equal(tasks3[0].wasAgreed, true);
        assert.equal(tasks3[0].archived, false);
        assert.equal(tasks3[0].request.id, getRequest("DONE").id);
        assert.equal(tasks3[0].request.actorId, otherUserId);

        changeUser(userId);

        const registerTask4 = Meteor.server.method_handlers['tasks.approveRequest'];
        registerTask4.apply({}, [tasks[0]._id]);

        var tasks4 = Tasks.find().fetch();
        assert.equal(tasks4.length, 1);
        assert.equal(getCurrentState(tasks4[0]).id, getState("COMPLETED").id);
        assert.equal(tasks4[0].wasAgreed, true);
        assert.equal(tasks4[0].archived, true);
        assert.equal(!!tasks4[0].request, false);
        assert.equal(tasks4[0].author.notices.length, 2);
        assert.equal(tasks4[0].receiver.notices.length, 2);
      });

      it('can request marking as done and be denied', () => {
        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);

        changeUser(userId);

        const registerTask3 = Meteor.server.method_handlers['tasks.markAsDone'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);
        assert.equal(getCurrentState(tasks3[0]).id, getState("UNDER_REQUEST").id);
        assert.equal(tasks3[0].wasAgreed, true);
        assert.equal(tasks3[0].archived, false);
        assert.equal(tasks3[0].request.id, getRequest("DONE").id);
        assert.equal(tasks3[0].request.actorId, userId);

        changeUser(otherUserId);

        const registerTask4 = Meteor.server.method_handlers['tasks.denyRequest'];
        registerTask4.apply({}, [tasks[0]._id]);

        var tasks4 = Tasks.find().fetch();
        assert.equal(tasks4.length, 1);
        assert.equal(getCurrentState(tasks4[0]).id, getState("AGREED").id);
        assert.equal(tasks4[0].wasAgreed, true);
        assert.equal(tasks4[0].archived, false);
        assert.equal(!!tasks4[0].request, false);
        assert.equal(tasks4[0].author.notices.length, 2);
        assert.equal(tasks4[0].receiver.notices.length, 2);
      });

      it('can request marking as done and then cancel the request without other person noticing', () => {
        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);

        changeUser(userId);

        const registerTask3 = Meteor.server.method_handlers['tasks.markAsDone'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);
        assert.equal(getCurrentState(tasks3[0]).id, getState("UNDER_REQUEST").id);

        const registerTask4 = Meteor.server.method_handlers['tasks.cancelRequest'];
        registerTask4.apply({}, [tasks[0]._id]);

        var tasks4 = Tasks.find().fetch();
        assert.equal(tasks4.length, 1);
        assert.equal(getCurrentState(tasks4[0]).id, getState("AGREED").id);
        assert.equal(!!tasks4[0].request, false);
        assert.equal(tasks4[0].author.notices.length, 1);
        assert.equal(tasks4[0].receiver.notices.length, 1);
      });

      it('can request marking as done and then cancel the request with notices to the other party', () => {
        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);

        changeUser(userId);

        const registerTask3 = Meteor.server.method_handlers['tasks.markAsDone'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);
        assert.equal(getCurrentState(tasks3[0]).id, getState("UNDER_REQUEST").id);

        changeUser(otherUserId);
        const registerTask3a = Meteor.server.method_handlers['tasks.removeNotice'];
        registerTask3a.apply({}, [tasks[0]._id]);

        var tasks3a = Tasks.find().fetch();
        assert.equal(tasks3a.length, 1);
        assert.equal(getCurrentState(tasks3a[0]).id, getState("UNDER_REQUEST").id);
        assert.equal(tasks3a[0].receiver.notices.length, 0);

        changeUser(userId);

        const registerTask4 = Meteor.server.method_handlers['tasks.cancelRequest'];
        registerTask4.apply({}, [tasks[0]._id]);

        var tasks4 = Tasks.find().fetch();
        assert.equal(tasks4.length, 1);
        assert.equal(getCurrentState(tasks4[0]).id, getState("AGREED").id);
        assert.equal(!!tasks4[0].request, false);
        assert.equal(tasks4[0].author.notices.length, 1);
        assert.equal(tasks4[0].receiver.notices.length, 1);
      });
      it('can lock agreement', () => {
        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);

        changeUser(userId);

        const registerTask3 = Meteor.server.method_handlers['tasks.lock'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);
        assert.equal(tasks3[0].locked, true);
        assert.equal(getCurrentState(tasks3[0]).id, getState("LOCKED").id);
      });
      it('can cancel locked agreement', () => {
        var task = {
          task: "Long description",
          time: moment().utc().format(),
          receiver: otherUserId
        };

        const registerTask = Meteor.server.method_handlers['tasks.insert'];
        registerTask.apply({}, [task]);

        var tasks = Tasks.find().fetch();

        assert.equal(tasks.length, 1);
        assert.equal(getCurrentState(tasks[0]).id, getState("PROPOSED").id);

        changeUser(otherUserId);

        const registerTask2 = Meteor.server.method_handlers['tasks.approve'];
        registerTask2.apply({}, [tasks[0]._id]);

        var tasks2 = Tasks.find().fetch();
        assert.equal(tasks2.length, 1);

        assert.equal(getCurrentState(tasks2[0]).id, getState("AGREED").id);

        changeUser(userId);

        const registerTask3 = Meteor.server.method_handlers['tasks.lock'];
        registerTask3.apply({}, [tasks[0]._id]);

        var tasks3 = Tasks.find().fetch();
        assert.equal(tasks3.length, 1);
        assert.equal(getCurrentState(tasks3[0]).id, getState("LOCKED").id);

        const registerTask3a = Meteor.server.method_handlers['tasks.cancel'];
        registerTask3a.apply({}, [tasks[0]._id]);

        var tasks3a = Tasks.find().fetch();
        assert.equal(tasks3a.length, 1);
        assert.equal(getCurrentState(tasks3a[0]).id, getState("UNDER_REQUEST").id);
        assert.equal(tasks3a[0].wasAgreed, true);
        assert.equal(tasks3a[0].archived, false);
        assert.equal(tasks3a[0].request.id, getRequest("CANCELLED").id);
        assert.equal(tasks3a[0].request.actorId, userId);

        changeUser(otherUserId);

        const registerTask4 = Meteor.server.method_handlers['tasks.approveRequest'];
        registerTask4.apply({}, [tasks[0]._id]);

        var tasks4 = Tasks.find().fetch();
        assert.equal(tasks4.length, 1);
        assert.equal(getCurrentState(tasks4[0]).id, getState("OPPOSED").id);
        assert.equal(tasks4[0].wasAgreed, true);
        assert.equal(tasks4[0].archived, true);
        assert.equal(!!tasks4[0].request, false);
        assert.equal(tasks4[0].author.notices.length, 2);
        assert.equal(tasks4[0].receiver.notices.length, 3);
        assert.equal(tasks4[0].author.status, getCondition("red").id);
      });
		});
  });
}