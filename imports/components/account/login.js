import { Controller } from 'angular-ecmascript/module-helpers';
import moment from 'moment';

export default class LoginCtrl extends Controller {
    constructor() {
        super(...arguments);

        this.helpers({
            data() {
                return [];
            }
        });
    }
}

LoginCtrl.$name = 'LoginCtrl';
LoginCtrl.$inject = ['$stateParams'];