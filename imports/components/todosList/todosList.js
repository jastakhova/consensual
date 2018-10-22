import { Tasks } from '../../api/tasks.js';
import moment from 'moment';
import { Controller } from 'angular-ecmascript/module-helpers';
import DateTimePicker from 'date-time-picker';
import graph from 'fbgraph';
import ProfileUtils from  './profile.js';
import '../../../public/assets/js/bootstrap-typeahead.min.js';
import { Tracker } from 'meteor/tracker'

export default class TodosListCtrl extends Controller {
  constructor() {
  	super(...arguments);

  	this.scope = arguments[0];

    this.subscribe('tasks');

	this.handleAllUsers = this.subscribe('allusers');
	this.handleAllTaskPartners = this.subscribe('alltaskpartners');

    this.hideCompleted = false;

    this.proposingInProgress = false;

    this.helpers({
      tasks() {
      	const selector = {};

      	var id2user = ProfileUtils.createMapFromList(Meteor.users.find().fetch(), "_id");

				function getSuggest() {
					var suggest = [];
					var suggestSize = 0;
					Object.keys(id2user).forEach(function(key) {
							suggest[suggestSize++] = {id: key, name: (id2user[key].profile ? id2user[key].profile.name : id2user[key].username)};
					});
					return suggest;
        }

        var suggest = getSuggest();
        if (this.handleAllUsers.ready() && this.handleAllTaskPartners.ready()) {
          $(".typeahead").typeahead({ source: suggest});
        }

        function isNumeric(value) {
            return /^-{0,1}\d+$/.test(value);
        }

        // If hide completed is checked, filter tasks
        if (this.getReactively('hideCompleted')) {
          selector.checked = {
            $ne: true
          };
        }

        return Tasks.find(selector, { sort: { createdAt: 1 } }).map(x => {
          x.time = moment(x.createdAt).format("DD MMM h:mm a");

          x.authorPicture = ProfileUtils.picture(id2user[x.authorId]);
          x.receiverPicture = ProfileUtils.picture(id2user[x.receiverId]);
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

  logout() {
    Meteor.logout();
  }

  accountPicture() {
    return ProfileUtils.picture(Meteor.user());
  }

  addTask(newTask) {
      Meteor.call('tasks.insert', {
      	task: newTask,
      	time: this.newDate + ' ' + this.newTime,
      	receiver: $('.typeahead').typeahead('getActive').id
      	});

      // Clear form

      this.newTask = '';
      this.setPristineAndUntouched(this, 'newTask');
      this.runParsers(this, 'newTask', this.newTask);
      this.newReceiver = '';
      this.setPristineAndUntouched(this, 'newReceiver');
      this.runParsers(this, 'newReceiver', this.newReceiver);
      $('.typeahead').val(''); //TODO: clears form but not model
      this.newDate = '';
      this.setPristineAndUntouched(this, 'newDate');
      this.runParsers(this, 'newDate', this.newDate);
      this.newTime = '';
      this.setPristineAndUntouched(this, 'newTime');
      this.runParsers(this, 'newTime', this.newTime);
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

	runParsers(controller, fieldName, newValue) {
	  controller.$scope.addTaskForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0].$parsers.forEach(function(x) {x(newValue);});
	}

	setPristineAndUntouched(controller, fieldName) {
    var fieldCtrl = controller.$scope.addTaskForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0];
    fieldCtrl.$setPristine();
    fieldCtrl.$setUntouched();
  }

	showDatePicker() {
			var current = (this.newDate === '' || this.newDate === undefined) ? new Date() : this.newDate;
			var options = {
				format: 'MM-dd-yyyy',
				default: current
      };
      var controller = this;
  		var timePicker = new DateTimePicker.Date(options, {})
  		timePicker.on('selected', function (formatTime, now) {
  			controller.newDate = formatTime;
  			controller.runParsers(controller, 'newDate', controller.newDate);
  			controller.scope.$apply();
  			timePicker.destroy();
  		});
  		timePicker.on('cleared', function () {
  			controller.newDate = '';
  			controller.runParsers(controller, 'newDate', controller.newDate);
				controller.scope.$apply();
  		});
  	}

	showTimePicker() {
		var current = (this.newTime === '' || this.newTime === undefined) ? new Date() : (this.newDate + ' ' + this.newTime);
		var options = {
			minuteStep: 1,
			default: current
		};
		var controller = this;
		var timePicker = new DateTimePicker.Time(options, {})
		timePicker.on('selected', function (formatTime, now) {
			controller.newTime = formatTime;
			controller.runParsers(controller, 'newTime', controller.newTime);
			controller.scope.$apply();
			timePicker.destroy();
		})
		timePicker.on('cleared', function () {
			controller.newTime = '';
			controller.runParsers(controller, 'newTime', controller.newTime);
			controller.scope.$apply();
		})
	}
}

TodosListCtrl.$name = 'TodosListCtrl';