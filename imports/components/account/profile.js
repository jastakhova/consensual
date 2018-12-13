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

        this.helpers({
            data() {
              if (!this.userHandle || !this.userHandle.ready()) {
                return {};
              }

              return {
                name: ProfileUtils.getName(Meteor.user()),
                email: ProfileUtils.getEmail(Meteor.user()),
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

    flipEmailEditingStatus() {
      this.editingEmail = !this.editingEmail;
    }

    saveName(name) {
      Meteor.call('users.updateName', name);
      this.flipNameEditingStatus();
    }

    saveEmail(email) {
      Meteor.call('users.updateEmail', email);
      this.flipEmailEditingStatus();
    }
}

ProfileCtrl.$name = 'ProfileCtrl';
ProfileCtrl.$inject = ['$stateParams'];