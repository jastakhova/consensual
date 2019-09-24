import { Meteor } from 'meteor/meteor';
import { Controller } from 'angular-ecmascript/module-helpers';
import moment from 'moment';
import { FB_API } from 'bas-meteor-facebook-login';
import ProfileUtils from '../todosList/profile.js';

export default class LoginCtrl extends Controller {
    constructor() {
        super(...arguments);

        this.isNativeApp = Meteor.isCordova;

        if (this.isNativeApp) {
          let fbLogoutSuccess = function (userData) {
            console.log('UserInfo after logout: ', userData);
            console.log(Meteor.user());
          };

          let fbLogoutFail = function (error) {
            console.log('Facebook plugin logout error: ', error);
          };
          facebookConnectPlugin.logout(fbLogoutSuccess, fbLogoutFail)
        }

        this.helpers({
            data() {
              return Meteor.user();
            }
        });
    }

    login() {
      let permissions = ['email'];

      let fbLoginSuccess = function (userData) {
        console.log('UserInfo after login: ', userData);
        console.log(Meteor.user());
      };

      let fbLoginFail = function (error) {
        console.log('Facebook plugin login error: ', error);
      };

      FB_API.login(permissions, fbLoginSuccess, fbLoginFail);
    }

    loginWithDemoUser() {
      var controller = this;
      Meteor.call('users.impersonate', function(err, result) {
          if (err) {
            ProfileUtils.processMeteorResult(err, result);
            return;
          }

          Meteor.connection.setUserId(result);
          controller.$state.go('tab.todo');
      });
    }
}

LoginCtrl.$name = 'LoginCtrl';
LoginCtrl.$inject = ['$stateParams', '$state'];