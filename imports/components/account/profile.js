import { Controller } from 'angular-ecmascript/module-helpers';
import moment from 'moment';
import ProfileUtils from '../todosList/profile.js';

export default class ProfileCtrl extends Controller {
    constructor() {
        super(...arguments);

        if (Meteor.userId()) {
          this.userHandle = this.subscribe('currentuser');
        }

        this.editingName = false;
        this.editingEmail = false;

        function getName(user) {
          return user.username ? user.username : user.profile.name;
        }

        this.helpers({
            data() {
              if (!this.userHandle || !this.userHandle.ready()) {
                return {};
              }

              return {
                name: getName(Meteor.user()),
                user: Meteor.user(),
                picture: ProfileUtils.picture(Meteor.user())
              };
            }
        });
    }

    logout() {
      Meteor.logout();
    }

    flipNameEditingStatus() {
      this.editingName = !this.editingName;
    }

    saveName(name) {
//      Meteor.call('tasks.updateLocation',
//        this.proposalId,
//        location,
//        ProfileUtils.processMeteorResult);
      this.flipNameEditingStatus();
    }
}

ProfileCtrl.$name = 'ProfileCtrl';
ProfileCtrl.$inject = ['$stateParams'];