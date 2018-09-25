import { Config } from 'angular-ecmascript/module-helpers';

import todoListUrl from './todosList/todosList.html';
import proposalUrl from './todosList/proposal.html';
import tabsTemplateUrl from './tabs.html';

export default class RoutesConfig extends Config {
  configure() {
    this.$stateProvider
      .state('tab', {
        url: '/tab',
        abstract: true,
        templateUrl: tabsTemplateUrl
      })
      .state('tab.todo', {
        url: '/todo',
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
			});

    this.$urlRouterProvider.otherwise('tab/todo');
  }
}

RoutesConfig.$inject = ['$stateProvider', '$urlRouterProvider'];