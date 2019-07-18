import moment from 'moment';
import ProfileUtils from './profile.js';
import { TodosListPartialCtrl } from './todosListPartial.js';
import { Drafts } from '../../api/background.js';

export default class DraftListCtrl extends TodosListPartialCtrl {
    constructor() {
        super(...arguments);

        this.handleTasks = Meteor.subscribe('drafts');
        this.handleUsers = this.subscribe('currentuser');

        this.helpers({
            tasks() {
              var controller = this;

              try {
                return this.todoListMain(
                  function(notUsedSuggest) {},
                  function() {},
                  {
                    db: Drafts,
                    filters: [
                      {name: "All", groupName: "All Your Drafts", hide: true, selector: {}}
                    ],
                    additionalFilter: {removed: {$exists: false}},
                    noStatus: true,
                    tab: "draft",
                    noArchive: true,
                    noActivity : true
                  }
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

DraftListCtrl.$name = 'DraftListCtrl';
DraftListCtrl.$inject = ['$stateParams', '$state'];