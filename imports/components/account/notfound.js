import { Controller } from 'angular-ecmascript/module-helpers';

export default class NotFoundCtrl extends Controller {
    constructor() {
        super(...arguments);

        this.helpers({
            data() {
                return [];
            }
        });
    }
}

NotFoundCtrl.$name = 'NotFoundCtrl';
NotFoundCtrl.$inject = ['$stateParams'];