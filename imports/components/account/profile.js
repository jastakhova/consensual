import { Controller } from 'angular-ecmascript/module-helpers';
import moment from 'moment';
import ProfileUtils from '../todosList/profile.js';

export default class ProfileCtrl extends Controller {
    constructor() {
        super(...arguments);

        this.profileId = this.$stateParams.profileId;

        this.handleTasks = this.subscribe('tasks');
        this.handleUsers = this.subscribe('allusers');

        this.helpers({
            data() {
              if (!this.handleTasks || !this.handleTasks.ready() || !this.handleUsers || !this.handleUsers.ready()) {
                return {};
              }

              var user = Meteor.users.findOne({_id: this.profileId});
              var facebookPresent = user.services && user.services.facebook && user.services.facebook.name;

              if (!user) {
                this.$state.go('tab.notfound', this.$stateParams, {location: 'replace', reload: true, inherit: false});
                return {};
              }

              return {
                user: user,
                showFacebookLink: facebookPresent,
                facebookLink: facebookPresent
                  ? "https://www.facebook.com/search/top/?q=" + encodeURI(user.services.facebook.name)
                  : "",
                fullName: ProfileUtils.getName(user),
                profilePicture: ProfileUtils.picture(user),
                accountPicture: ProfileUtils.picture(Meteor.user())
              };
            }
        });
    }

    logout() {
      Meteor.logout();
    }
}

ProfileCtrl.$name = 'ProfileCtrl';
ProfileCtrl.$inject = ['$stateParams', '$state'];