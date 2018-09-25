import angular from 'angular';
import angularMeteor from 'angular-meteor';
import moment from 'moment';
import todosList from '../imports/components/todosList/todosList';
import '../imports/startup/accounts-config.js';
import 'angular-animate';
import 'angular-sanitize';
import 'angular-ui-router';
import 'ionic-scripts';
import Loader from 'angular-ecmascript/module-loader';
import { Meteor } from 'meteor/meteor';

import TodosListCtrl from '../imports/components/todosList/todosList';
import ProposalCtrl from '../imports/components/todosList/proposal';
import RoutesConfig from '../imports/components/routes';

const App = 'consensual';

angular.module(App, [
  angularMeteor,
  'ionic',
  'accounts.ui'
]);

new Loader(App)
	.load(TodosListCtrl)
	.load(ProposalCtrl)
	.load(RoutesConfig);

function onReady() {
  angular.bootstrap(document, [App]);
}

if (Meteor.isCordova) {
  angular.element(document).on('deviceready', onReady);
} else {
  angular.element(document).ready(onReady);
}