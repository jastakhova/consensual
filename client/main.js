import angular from 'angular';
import angularMeteor from 'angular-meteor';
import todosList from '../imports/components/todosList/todosList';
import '../imports/startup/accounts-config.js';

angular.module('consensual', [
  angularMeteor,
  todosList.name,
  'accounts.ui'
]);

function onReady() {
  angular.bootstrap(document, ['consensual']);
}

if (Meteor.isCordova) {
  angular.element(document).on('deviceready', onReady);
} else {
  angular.element(document).ready(onReady);
}