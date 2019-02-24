import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { assert } from 'meteor/practicalmeteor:chai';
import { sinon } from 'meteor/practicalmeteor:sinon';

import { Invitees } from './tasks.js';

if (Meteor.isServer) {
  describe('Tasks', () => {
    describe('methods', () => {
    	const userId = "dpy3hmJHy8ZQyuw5t";
    	const inviteeId = "XbTqCFm4GMTZwRfyu";
    	const email = "bla@bla.com";

			beforeEach(() => {
			  Meteor.user = sinon.stub();
			  Meteor.user.returns( {
          _id: userId,
          services: {facebook: {email: email}}
        });

        Invitees.remove({_id: inviteeId});
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
		});
  });
}