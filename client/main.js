import angular from 'angular';
import angularMeteor from 'angular-meteor';
import moment from 'moment';
import todosList from '../imports/components/todosList/todosList';
import '../imports/startup/accounts-config.js';

angular.module('consensual', [
  angularMeteor,
  todosList.name,
  'accounts.ui'
]);

function onReady() {
  angular.bootstrap(document, ['consensual']);

  var defaults = {
  		calendarWeeks: true,
  		showClear: true,
  		showClose: true,
  		allowInputToggle: true,
  		useCurrent: false,
  		ignoreReadonly: true,
  		minDate: new Date(),
  		toolbarPlacement: 'top',
  		locale: 'en-ca',
  		icons: {
  			time: 'fa fa-clock-o',
  			date: 'fa fa-calendar',
  			up: 'fa fa-angle-up',
  			down: 'fa fa-angle-down',
  			previous: 'fa fa-angle-left',
  			next: 'fa fa-angle-right',
  			today: 'fa fa-dot-circle-o',
  			clear: 'fa fa-trash',
  			close: 'fa fa-times'
  		}
  	};

  	var optionsDatetime = $.extend({}, defaults, {format:'DD-MM-YYYY HH:mm'});
		var optionsDate = $.extend({}, defaults, {format:'DD-MM-YYYY'});
		var optionsTime = $.extend({}, defaults, {format:'HH:mm'});

		$('.datetimepicker').datetimepicker(optionsDatetime);
}

if (Meteor.isCordova) {
  angular.element(document).on('deviceready', onReady);
} else {
  angular.element(document).ready(onReady);
}