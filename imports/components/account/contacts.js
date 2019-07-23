import { Controller } from 'angular-ecmascript/module-helpers';
import ProfileUtils from '../todosList/profile.js';

export default class ContactsCtrl extends Controller {
    constructor() {
        super(...arguments);

        this.searchEdit = false;
        this.search = "";
        this.contacts = [];
        var controller = this;

        var nameComparator = function(user1, user2) {
          return ProfileUtils.comparator(ProfileUtils.getName(user1), ProfileUtils.getName(user2));};

        this.helpers({
            data() {
              try {
                var searchString = this.getReactively("search");

                Meteor.call('users.getConnected', function(err, result) {
                  if (err) {
                    ProfileUtils.processMeteorResult(err, result);
                    return;
                  }

                  var id2user = ProfileUtils.createMapFromList(result, "_id");

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
                  // Clearing contacts before push to prevent duplicates
                  controller.contacts = [];
                  Object.keys(groups)
                      .sort(function(key1, key2) {return ProfileUtils.comparator(key1, key2);})
                      .map(groupKey => {
                        return {
                          letter: groupKey,
                          users: groups[groupKey].sort(nameComparator)
                        };
                      }).forEach(g => { controller.contacts.push(g);});
                  });
              } catch (err) {
                console.log(err);
                ProfileUtils.showError();
                Meteor.call('email.withError', err);
                return [];
              };
              return this.getCollectionReactively('contacts');
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