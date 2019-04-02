/* eslint-env mocha */
const App = 'consensual';

import 'angular-mocks';
import { Meteor } from 'meteor/meteor';
import { assert } from 'meteor/practicalmeteor:chai';
import { sinon } from 'meteor/practicalmeteor:sinon';

import angularMeteor from 'angular-meteor';
import Loader from 'angular-ecmascript/module-loader';
import TodosListCtrl from './todosList';
import RoutesConfig from '../routes';

describe('todosList', function() {
  var element;

  beforeEach(function() {
    var $compile;
    var $rootScope;

    consensual = angular.module(App, [
      angularMeteor,
      'ionic'
    ]);

    new Loader(App)
    	.load(TodosListCtrl)
    	.load(RoutesConfig);

    inject(function(_$compile_, _$rootScope_){
      $compile = _$compile_;
      $rootScope = _$rootScope_;
    });

    element = $compile('<todos-list></todos-list>')($rootScope.$new(true));
    $rootScope.$digest();
  });

  describe('component', function() {
    it('should be instantiating the module', function() {
      assert(true, '' + element[0].outerHTML);
    });
  });
});