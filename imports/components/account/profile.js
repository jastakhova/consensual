import moment from 'moment';
import ProfileUtils from '../todosList/profile.js';
//import { Controller } from 'angular-ecmascript/module-helpers';
import { TodosListPartialCtrl } from '../todosList/todosListPartial.js';

export default class ProfileCtrl extends TodosListPartialCtrl {
//export default class ProfileCtrl extends Controller {
    constructor() {
        super(...arguments);

        this.profileId = this.$stateParams.profileId;

        this.handleTasks = Meteor.subscribe('tasksWith', this.profileId);
        this.handleUsers = this.subscribe('allusers');

        this.essencial = {};

        this.helpers({
            tasks() {
              if (!this.handleTasks || !this.handleTasks.ready() || !this.handleUsers || !this.handleUsers.ready()) {
                return {};
              }

              try {
                var user = Meteor.users.findOne({_id: this.profileId});

                if (!user) {
                  this.$state.go('tab.notfound', this.$stateParams, {location: 'replace', reload: true, inherit: false});
                  return {};
                }

                var facebookPresent = user.services && user.services.facebook && user.services.facebook.name;

                this.essencial = {
                   user: user,
                   showFacebookLink: facebookPresent,
                   facebookLink: facebookPresent
                     ? "https://www.facebook.com/search/top/?q=" + encodeURI(user.services.facebook.name)
                     : "",
                   fullName: ProfileUtils.getName(user),
                   profilePicture: ProfileUtils.pictureBig(user),
                   accountPicture: ProfileUtils.pictureSmall(Meteor.user())
                };

                var handleAllUsers = this.handleAllUsers;
                var proposingInProgress = this.getReactively("proposingInProgress");
                var popularUsers = this.popularUsers;

                return this.todoListMain(
                  function(getSuggest) {},
                  function() {},
                  {$or: [{"author.id": user._id}, {"receiver.id": user._id}]}
                );
              } catch (err) {
                console.log(err);
                ProfileUtils.showError();
                Meteor.call('email.withError', err);
                return [];
              };
            }
        });

        this.logout = function() {
          Meteor.logout();
        }
    }
}

ProfileCtrl.$name = 'ProfileCtrl';
ProfileCtrl.$inject = ['$stateParams', '$state'];