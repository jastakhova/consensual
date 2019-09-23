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

import { FB_API } from 'bas-meteor-facebook-login';

import TodosListCtrl from '../imports/components/todosList/todosList';
import DraftListCtrl from '../imports/components/todosList/draftList';
import ProposalCtrl from '../imports/components/todosList/proposal';
import DraftCtrl from '../imports/components/todosList/draft';
import LoginCtrl from '../imports/components/account/login';
import ProfileCtrl from '../imports/components/account/profile';
import SettingsCtrl from '../imports/components/account/settings';
import ContactsCtrl from '../imports/components/account/contacts';
import NotFoundCtrl from '../imports/components/account/notfound';
import RoutesConfig from '../imports/components/routes';

// Alias for readability
Meteor.isLoggedIn = function() {
    return Meteor.userId();
}

function getQuery(q) {
   return (window.location.search.match(new RegExp('[?&]' + q + '=([^&]+)')) || [, null])[1];
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

consensual.run(['$ionicHistory', '$state', '$rootScope', '$templateCache', function ($ionicHistory, $state, $rootScope, $templateCache) {
  AccountsTemplates.options.onSubmitHook = onSubmitHook;
  AccountsTemplates.options.onLogoutHook = onLogoutHook;
  AccountsTemplates.setState('signUp');

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

    $state.go("login", {'in': getQuery("in")});
  }

  $rootScope.$on('$stateChangeStart', function(event, toState, fromState) {
    if (Meteor.settings.public.autoSaveIntervalHandle) {
      Meteor.clearInterval(Meteor.settings.public.autoSaveIntervalHandle);
    }
  });

//  $rootScope.$on('$stateChangeSuccess', function(event, toState) {
//    console.log('success ', toState);
//  });
}]);

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

Accounts.verifyEmail = _.wrap(Accounts.verifyEmail, function (origVerifyEmail, token, callback) {
  return origVerifyEmail.call(Accounts, token, _.wrap(callback, function (origCallback, err) {
    try {
      if (! err) {
        Meteor.users.find({$and: [{ 'email': { $exists: false } , 'emails.verified': { $exists: true }}]})
        .fetch().forEach(function(user) {
          Meteor.call('users.updateEmail', user.emails[0].address);
       });
      }
    } finally {
      return origCallback.apply(null, _.rest(arguments));
    }
  }));
});

new Loader(App)
	.load(TodosListCtrl)
	.load(ProposalCtrl)
	.load(DraftCtrl)
	.load(DraftListCtrl)
  .load(LoginCtrl)
  .load(ProfileCtrl)
  .load(SettingsCtrl)
  .load(ContactsCtrl)
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
  Meteor.call('invitees.register', getQuery("in"));
});