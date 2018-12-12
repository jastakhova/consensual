// Global settings
const App = 'consensual';

import angular from 'angular';
import angularMeteor from 'angular-meteor';
import moment from 'moment';
import todosList from '../imports/components/todosList/todosList';
import '../imports/startup/accounts-config.js';
import { Accounts } from 'meteor/accounts-base';
import 'angular-animate';
import 'angular-sanitize';
import 'angular-ui-router';
import 'ionic-scripts';
import Loader from 'angular-ecmascript/module-loader';
import { Meteor } from 'meteor/meteor';

import { Template } from 'meteor/templating';

import TodosListCtrl from '../imports/components/todosList/todosList';
import ProposalCtrl from '../imports/components/todosList/proposal';
import LoginCtrl from '../imports/components/account/login';
import ProfileCtrl from '../imports/components/account/profile';
import NotFoundCtrl from '../imports/components/account/notfound';
import RoutesConfig from '../imports/components/routes';

// Alias for readability
Meteor.isLoggedIn = function() {
    return Meteor.userId();
}

// The useraccounts:ionic package uses Blaze even though the rest of the app uses Angular
var angularMeteorTemplate = angular.module('angular-blaze-template', []);

// blaze-template adds Blaze templates to Angular as directives
angularMeteorTemplate.directive('blazeTemplate', [
    '$compile',
    function ($compile) {
        return {
            restrict: 'AE',
            scope: false,
            link: function (scope, element, attributes) {
                // Check if templating and Blaze package exist, they won't exist in a
                // Meteor Client Side (https://github.com/idanwe/meteor-client-side) application
                if (Template && Package['blaze']){

                    var name = attributes.blazeTemplate || attributes.name;
                    if (name && Template[name]) {

                        var template = Template[name],
                            viewHandler;

                        if (typeof attributes['replace'] !== 'undefined') {
                            viewHandler = Blaze.
                            renderWithData(template, scope, element.parent()[0], element[0]);
                            element.remove();
                        } else {
                            viewHandler = Blaze.renderWithData(template, scope, element[0]);
                            $compile(element.contents())(scope);
                            element.find().unwrap();
                        }

                        scope.$on('$destroy', function() {
                            Blaze.remove(viewHandler);
                        });

                    } else {
                        console.error("meteorTemplate: There is no template with the name '" + name + "'");
                    }
                }
            }
        };
    }
]);

var angularMeteorModule = angular.module('angular-meteor');
angularMeteorModule.requires.push('angular-blaze-template');

consensual = angular.module(App, [
  angularMeteor,
  'ionic'
]);

consensual.run(['$ionicHistory', '$state', '$rootScope', function ($ionicHistory, $state, $rootScope) {
  AccountsTemplates.options.onSubmitHook = onSubmitHook;
  AccountsTemplates.options.onLogoutHook = onLogoutHook;

  // Always enforce login on page load
  if (!Meteor.isLoggedIn()) {
    onLogoutHook();
  }

  var logout = Meteor.logout;
  Meteor.logout = function() {
     // Invoke the original method
     logout.apply(Meteor);
     onLogoutHook();
  };

  function onSubmitHook(error, state) {
    if (!error) {
      if (state === "signIn" || state === "signUp") {
        $ionicHistory.nextViewOptions({
          historyRoot: true
        });

        $state.go("tab.todo");
      }
    }
  }

  function onLogoutHook() {
    $ionicHistory.nextViewOptions({
        disableBack: true,
        historyRoot: true
    });

    $state.go("login");
  }

//  $rootScope.$on('$stateChangeStart', function(event, toState, fromState) {
//    console.log('from/to', fromState, toState);
//  });
//
//  $rootScope.$on('$stateChangeSuccess', function(event, toState) {
//    console.log('success ', toState);
//  });
}]);

// Defines an angular directive, 'required-field', which runs validation when an input is changed
//consensual.directive('requiredField', function() {
//  return {
//    require: 'ngModel',
//    link: function(scope, element, attr, mCtrl) {
//      if (mCtrl.$$parentForm.$name.substring(0,3) === "add") {
//        mCtrl.$setValidity('required-field', false);
//      }
//      function requiredField(value) {
//        mCtrl.$setValidity('required-field', (value !== ""));
//        return value;
//      }
//      mCtrl.$parsers.push(requiredField);
//    }
//  };
//});
//
consensual.directive('contactsOnly', function() {
  return {
    require: 'ngModel',
    link: function(scope, element, attr, mCtrl) {
      function contactsOnly(value) {
        var valid = false;
        for (let contact of Meteor.settings.public.contacts) {
          if (value === contact.name) {
            valid = true;
          }
        }
        mCtrl.$setValidity('contacts-only', valid);
        return value;
      }
      mCtrl.$parsers.push(contactsOnly);
      element.on('blur', function() {
        mCtrl.$setViewValue(this.value, 'blur');
      });
    }
  };
});

AccountsTemplates.configure({
    //defaultLayout: 'emptyLayout',
    showForgotPasswordLink: false,
    overrideLoginErrors: true,
    enablePasswordChange: true,
    sendVerificationEmail: false,
    //enforceEmailVerification: true,
    //confirmPassword: true,
    //continuousValidation: false,
    //displayFormLabels: false,
    forbidClientAccountCreation: true,
    //formValidationFeedback: true,
    //homeRoutePath: 'paaths',
    //showAddRemoveServices: false,
    //showPlaceholders: true,

    negativeValidation: false,
    negativeFeedback: false,
    positiveValidation: false,
    positiveFeedback: false,

    // Privacy Policy and Terms of Use
    //privacyUrl: 'privacy',
    //termsUrl: 'terms-of-use',

    // onSubmitHook: mySubmitFunc
});

new Loader(App)
	.load(TodosListCtrl)
	.load(ProposalCtrl)
  .load(LoginCtrl)
  .load(ProfileCtrl)
  .load(NotFoundCtrl)
	.load(RoutesConfig);

function onReady() {
  angular.bootstrap(document, [App]);
}

if (Meteor.isCordova) {
  angular.element(document).on('deviceready', onReady);
} else {
  angular.element(document).ready(onReady);
}

Accounts.onLogin(function(event) {
  Meteor.call('invitees.register');
});