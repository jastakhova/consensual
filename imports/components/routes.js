import { Config } from 'angular-ecmascript/module-helpers';

import todoListUrl from './todosList/todosList.html';
import proposalUrl from './todosList/proposal.html';
import draftListUrl from './todosList/draftList.html';
import draftUrl from './todosList/draft.html';
import loginUrl from './account/login.html';
import settingsUrl from './account/settings.html';
import contactsUrl from './account/contacts.html';
import profileUrl from './account/profile.html';
import tabsTemplateUrl from './tabs.html';
import notFoundTemplateUrl from './account/notfound.html';
import noAccessTemplateUrl from './account/noaccess.html';
import partialTemplateUrl from './todosList/todosListPartial.html'; // important for ng-include
import { Accounts } from 'meteor/accounts-base';

export default class RoutesConfig extends Config {
  configure() {
    this.$stateProvider
      .state('tab', {
        url: '/tab',
        templateUrl: tabsTemplateUrl,
        abstract: true
      })
      .state('tab.todo', {
        url: '/todo?group&filter&date',
        views: {
          'tab-todo': {
            templateUrl: todoListUrl,
            controller: 'TodosListCtrl as todoList'
          }
        }
      })
      .state('tab.drafts', {
        url: '/drafts?group&date',
        views: {
          'tab-drafts': {
            templateUrl: draftListUrl,
            controller: 'DraftListCtrl as todoList'
          }
        }
      })
      .state('tab.proposal', {
        url: '/proposal/:proposalId',
        views: {
          'tab-proposal': {
            templateUrl: proposalUrl,
            controller: 'ProposalCtrl as proposal'
            }
          }
      })
      .state('tab.draft', {
        url: '/draft/:draftId',
        views: {
          'tab-draft': {
            templateUrl: draftUrl,
            controller: 'DraftCtrl as draft'
            }
          }
      })
      .state('tab.contacts', {
        url: '/contacts',
        views: {
          'tab-contacts': {
            templateUrl: contactsUrl,
            controller: 'ContactsCtrl as contacts'
            }
          }
      })
      .state('tab.notfound', {
          url: '/notfound',
          views: {
            'tab-notfound': {
              templateUrl: notFoundTemplateUrl,
              controller: 'NotFoundCtrl as notfound'
              }
            }
        })
      .state('tab.noaccess', {
        url: '/noaccess',
        views: {
          'tab-noaccess': {
            templateUrl: noAccessTemplateUrl,
            controller: 'NotFoundCtrl as notfound'
            }
          }
      })
      .state('tab.settings', {
        url: '/settings',
        views: {
        'tab-settings': {
          templateUrl: settingsUrl,
          controller: 'SettingsCtrl as profile'
          }
        }
      })
      .state('tab.profile', {
        url: '/profile/:profileId?group&filter&date',
        views: {
        'tab-profile': {
          templateUrl: profileUrl,
          controller: 'ProfileCtrl as todoList'
          }
        }
      })
      .state('login', {
        url: '/login?',
        templateUrl: loginUrl,
        controller: 'LoginCtrl as login'
      })
      ;

    this.$urlRouterProvider.otherwise(function($injector, $location) {
      if ($location.$$hash.startsWith("/verify-email/")) {
        const token = $location.$$hash.replace("/verify-email/", "");
        Accounts.verifyEmail(token, function(error) {
          Accounts._enableAutoLogin();
          if (!error) {
            Accounts._loginButtonsSession.set('justVerifiedEmail', true);
          } else {
            Meteor.logout();
          }
        });
        return;
      }

      return 'tab/todo';
    });

//    this.$urlRouterProvider.otherwise('tab/todo');
  }
}

RoutesConfig.$inject = ['$stateProvider', '$urlRouterProvider'];