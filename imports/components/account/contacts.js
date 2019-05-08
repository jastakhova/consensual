import { Controller } from 'angular-ecmascript/module-helpers';
import ProfileUtils from '../todosList/profile.js';
import { Tasks, Invitees } from '../../api/tasks.js';

export default class ContactsCtrl extends Controller {
    constructor() {
        super(...arguments);

        this.handleUsers = this.subscribe('allusers');
        this.handleTasks = this.subscribe('tasksContacts');

        this.searchEdit = false;
        this.search = "";

        var nameComparator = function(user1, user2) {
          return ProfileUtils.comparator(ProfileUtils.getName(user1), ProfileUtils.getName(user2));};

        this.helpers({
            data() {
              if (!this.handleUsers || !this.handleUsers.ready() || !this.handleTasks || !this.handleTasks.ready()) {
                return [];
              }

              try {
                var id2user = ProfileUtils.getId2User(this, Tasks, Invitees);
                var searchString = this.getReactively("search");

                var users = Object.keys(id2user)
                .filter(function(key) {
                  var user = id2user[key];
                  if (key == Meteor.userId()) {
                  }
                  return key != Meteor.userId() && (
                    searchString == ""
                    || ProfileUtils.getName(user).toLowerCase().includes(searchString.toLowerCase()));
                })
                .map(function(key) {
                  var user = id2user[key];
                  user.picture = ProfileUtils.pictureSmall(user);
                  user.name = ProfileUtils.getName(user);
                  return user;
                }).sort(nameComparator);
                var groups = _.groupBy(users, function(user) {
                  return ProfileUtils.getName(user).charAt(0);
                });
                return Object.keys(groups)
                    .sort(function(key1, key2) {return ProfileUtils.comparator(key1, key2);})
                    .map(groupKey => {
                      return {
                        letter: groupKey,
                        users: groups[groupKey].sort(nameComparator)
                      };
                    });
              } catch (err) {
                console.log(err);
                ProfileUtils.showError();
                Meteor.call('email.withError', err);
                return [];
              };
            }
        });
    }

    logout() {
      Meteor.logout();
    }

    accountPicture() {
      return ProfileUtils.pictureSmall(Meteor.user());
    }

    flipSearchEditing() {
      this.searchEdit = true;
    }
}

ContactsCtrl.$name = 'ContactsCtrl';
ContactsCtrl.$inject = ['$stateParams', '$state'];