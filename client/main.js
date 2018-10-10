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
import { Template } from 'meteor/templating';

import TodosListCtrl from '../imports/components/todosList/todosList';
import ProposalCtrl from '../imports/components/todosList/proposal';
import LoginCtrl from '../imports/components/account/login';
import RoutesConfig from '../imports/components/routes';

const App = 'consensual';

Meteor.isLoggedIn = function() {
    return Meteor.userId();
}

//if (!Meteor.isLoggedIn()) {
//    document.location.href = '#!/login';
//}

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

angular.module(App, [
  angularMeteor,
  'ionic',
  'accounts.ui'
]);

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
    //forbidClientAccountCreation: false,
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
	.load(RoutesConfig);

function onReady() {
  angular.bootstrap(document, [App]);
}

if (Meteor.isCordova) {
  angular.element(document).on('deviceready', onReady);
} else {
  angular.element(document).ready(onReady);
}