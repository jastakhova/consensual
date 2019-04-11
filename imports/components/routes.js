import { Config } from 'angular-ecmascript/module-helpers';

import todoListUrl from './todosList/todosList.html';
import proposalUrl from './todosList/proposal.html';
import loginUrl from './account/login.html';
import settingsUrl from './account/settings.html';
import profileUrl from './account/profile.html';
import tabsTemplateUrl from './tabs.html';
import notFoundTemplateUrl from './account/notfound.html';

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
      .state('tab.proposal', {
        url: '/proposal/:proposalId',
        views: {
          'tab-proposal': {
            templateUrl: proposalUrl,
            controller: 'ProposalCtrl as proposal'
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
        url: '/profile/:profileId',
        views: {
        'tab-profile': {
          templateUrl: profileUrl,
          controller: 'ProfileCtrl as profile'
          }
        }
      })
      .state('login', {
        url: '/login?in',
        templateUrl: loginUrl,
        controller: 'LoginCtrl as login'
      })
      ;

    this.$urlRouterProvider.otherwise('tab/todo');
  }
}

RoutesConfig.$inject = ['$stateProvider', '$urlRouterProvider'];