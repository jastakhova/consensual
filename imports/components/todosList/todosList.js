import angular from 'angular';
import angularMeteor from 'angular-meteor';
import { Tasks } from '../../api/tasks.js';
import moment from 'moment';

import template from './todosList.html';

class TodosListCtrl {
  constructor($scope) {
    $scope.viewModel(this);

    this.subscribe('tasks');

    this.hideCompleted = false;

    this.proposingInProgress = false;

    this.helpers({
      tasks() {
      	const selector = {};

      	function isNumeric(value) {
            return /^-{0,1}\d+$/.test(value);
        }

      	// If hide completed is checked, filter tasks
				if (this.getReactively('hideCompleted')) {
					selector.checked = {
						$ne: true
					};
				}
        return Tasks.find(selector, { sort: { createdAt: -1 } }).map(x => {
        	x.time = moment(x.createdAt).format("DD MMM h:mm a");
        	return x;
        });
      },
      incompleteCount() {
				return Tasks.find({
					checked: {
						$ne: true
					}
				}).count();
			},
			currentUser() {
				return Meteor.user();
			}
    })
  }

  addTask(newTask) {
      Meteor.call('tasks.insert', newTask, document.getElementsByClassName('datetimepicker')[0].getElementsByTagName('input')[0].value);

      // Clear form
      this.newTask = '';
    }

  setChecked(task) {
		// Set the checked property to the opposite of its current value
		Meteor.call('tasks.setChecked', task._id, !task.checked);
	}

	removeTask(task) {
		Meteor.call('tasks.remove', task._id);
	}

	setPrivate(task) {
		Meteor.call('tasks.setPrivate', task._id, !task.private);
	}

	flipProposingStatus() {
		this.proposingInProgress = !this.proposingInProgress;
	}
}

export default angular.module('todosList', [
  angularMeteor
])
  .component('todosList', {
    templateUrl: 'imports/components/todosList/todosList.html',
    controller: ['$scope', TodosListCtrl]
  });