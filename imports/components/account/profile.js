import moment from 'moment';
import ProfileUtils from '../todosList/profile.js';
import { TodosListPartialCtrl } from '../todosList/todosListPartial.js';

export default class ProfileCtrl extends TodosListPartialCtrl {
    constructor() {
        super(...arguments);

        this.profileId = this.$stateParams.profileId;

        this.handleTasks = Meteor.subscribe('tasksWith', this.profileId);
        this.handleUsers = this.subscribe('currentuser');

        this.essencial = {};

        this.helpers({
            tasks() {
              var essencial = this.getReactively("essencial");
              this.essencial = essencial; // needed to simulate usage of the previous var

              var controller = this;

              try {
                if (Object.keys(this.essencial).length === 0) {
                  Meteor.call('users.getConnected', function(err, result) {
                    if (err) {
                      ProfileUtils.processMeteorResult(err, result);
                      return;
                    }

                    var id2ConnectedUser = ProfileUtils.createMapFromList(result, "_id");
                    var user = id2ConnectedUser[controller.profileId];

                    if (!user) {
                      controller.$state.go('tab.notfound', controller.$stateParams, {location: 'replace', reload: true, inherit: false});
                    }

                    var facebookPresent = user.services && user.services.facebook && user.services.facebook.name;

                    controller.essencial = {
                       user: user,
                       showFacebookLink: facebookPresent,
                       facebookLink: facebookPresent
                         ? "https://www.facebook.com/search/top/?q=" + encodeURI(user.services.facebook.name)
                         : "",
                       fullName: ProfileUtils.getName(user),
                       profilePicture: ProfileUtils.pictureBig(user),
                       accountPicture: ProfileUtils.pictureSmall(Meteor.user())
                    };
                  });
                }

                var handleAllUsers = this.handleAllUsers;
                var popularUsers = this.popularUsers;

                return this.todoListMain(
                  function(notUsedSuggest) {},
                  function() {}, {
                  additionalFilter:
                    {$or: [{"author.id": this.profileId}, {"receiver.id": this.profileId}]}
                });
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