import { Tasks } from '../../api/tasks.js';
import moment from 'moment';
import { Controller } from 'angular-ecmascript/module-helpers';
import DateTimePicker from 'date-time-picker';
import graph from 'fbgraph';
import ProfileUtils from  './profile.js';

export default class TodosListCtrl extends Controller {
  constructor() {
  	super(...arguments);

  	this.scope = arguments[0];

    this.subscribe('tasks');

		if (Meteor.userId()) {
			this.subscribe('allusers');
		}

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

				var id2user = ProfileUtils.createMapFromList(Meteor.users.find().fetch(), "_id");

				return Tasks.find(selector, { sort: { createdAt: -1 } }).map(x => {
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

  addTask(newTask) {
      Meteor.call('tasks.insert', newTask, this.newDate + ' ' + this.newTime);

      // Clear form
      this.newTask = '';
      this.newDate = '';
      this.newTime = '';
      this.scope.$apply();
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

	showDatePicker() {
			var current = (this.newDate === '') ? new Date() : this.newDate;
			var options = {
				format: 'MM-dd-yyyy',
				default: current
      };
      var controller = this;
  		var timePicker = new DateTimePicker.Date(options, {})
  		timePicker.on('selected', function (formatTime, now) {
  			controller.newDate = formatTime;
				controller.scope.$apply();
  			timePicker.destroy();
  		});
  		timePicker.on('cleared', function () {
  			this.newDate = '';
				controller.scope.$apply();
  		});
  	}

	showTimePicker() {
		var current = (this.newTime === '') ? new Date() : (this.newDate + ' ' + this.newTime);
		var options = {
			minuteStep: 10,
			default: current
		};
		var controller = this;
		var timePicker = new DateTimePicker.Time(options, {})
		timePicker.on('selected', function (formatTime, now) {
			controller.newTime = formatTime;
			controller.scope.$apply();
			timePicker.destroy();
		})
		timePicker.on('cleared', function () {
			this.newTime = '';
			controller.scope.$apply();
		})
	}
}

TodosListCtrl.$name = 'TodosListCtrl';