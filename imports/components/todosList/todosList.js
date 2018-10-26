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

    // TODO: align with the client timezone
    const nextMidnight = new Date(moment().format());
    nextMidnight.setHours(24, 0, 0, 0);
    const prevMidnight = new Date(moment().format());
    prevMidnight.setHours(0, 0, 0, 0);

    this.sorts = [
      {name: "Default", groups: [
          {name: "Overdue", selector: {status: "open", eta: {$lt: new Date(moment().format())}}, sort: function(task1, task2) {return ProfileUtils.comparator(task1.eta, task2.eta)}, limit: 3},
          {name: "Needs attention", selector: {$or: [{authorId: Meteor.userId(), authorStatus: "yellow"}, {receiverId: Meteor.userId(), receiverStatus: "yellow"}], archived: false}, sort: function(task1, task2) {return ProfileUtils.comparator(ProfileUtils.getLatestActivityTime(task1), ProfileUtils.getLatestActivityTime(task2));}, limit: 5},
          {name: "Today", selector: {status: "open", eta: {$lt: nextMidnight, $gt: prevMidnight}}, sort: function(task1, task2) {
            if (task1.receiverId === Meteor.userId() && task2.receiverId === Meteor.userId() ||
                task1.receiverId !== Meteor.userId() && task2.receiverId !== Meteor.userId()) {
              return ProfileUtils.comparator(task1.eta, task2.eta);
            }
            return task1.receiverId === Meteor.userId() ? -1 : 1;
          }},
        ], configuration: {sort: "eta", grouping: function(task) {return "Tasks";}, groupingName: function(group) {return group;}}},
      {name: "By Time", configuration: {sort: "eta", grouping: function(task) {const day = new Date(task.eta); day.setHours(0, 0, 0, 0); return day.getTime();}, groupingName: function(groupField) {
        var d = new Date();
        d.setTime(groupField);
        return moment(d).format("DD MMM");
      }}},
      {name: "By Assignee", configuration: {sort: "receiverId", grouping: function(task) {return (task.receiverId === Meteor.userId()? "1" : "2") + task.receiverName;}, groupingName: function(group) {return group.slice(1);}}},
    ];

    this.filters = [
    {name: "All", selector: {archived: false}},
    {name: "Open", selector: {status: "open"}},
    {name: "To me", selector: {receiverId: Meteor.userId(), archived: false}},
    {name: "Needs attention", selector: {$or: [{authorId: Meteor.userId(), authorStatus: "yellow"}, {receiverId: Meteor.userId(), receiverStatus: "yellow"}], archived: false}},
    {name: "Overdue", selector: {status: "open", eta: {$lt: new Date(moment().format())}}},
    {name: "Blocked", selector: {archived: false, $or: [{authorId: Meteor.userId(), authorStatus: "green", receiverStatus: "yellow"}, {receiverId: Meteor.userId(), receiverStatus: "green", authorStatus: "yellow"}]}},
    {name: "Done", selector: {status: "done"}},
    {name: "Cancelled", selector: {status: "cancelled"}},
    {name: "Archived", selector: {archived: true}},
    ];

    this.currentSort = this.sorts[0];
    this.currentFilter = this.filters[0];

    this.helpers({
      tasks() {
      	const selector = this.getReactively("currentFilter");
      	const sortMethod = this.getReactively("currentSort");

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

        function prepareTask(x) {
          x.time = moment(x.eta).format("DD MMM h:mm a");

          x.authorPicture = ProfileUtils.picture(id2user[x.authorId]);
          x.receiverPicture = ProfileUtils.picture(id2user[x.receiverId]);
          return x;
        }

        if (sortMethod.groups && selector.name === this.filters[0].name) {
          return sortMethod.groups.map(sortGroup => {
            var tasks = Tasks.find(sortGroup.selector).fetch().sort(sortGroup.sort).map(prepareTask);
            return {name: sortGroup.name, tasks: sortGroup.limit ? tasks.slice(0, sortGroup.limit): tasks, size: tasks.length};
            }).filter(group => group.size > 0);
        } else {
          var sortingField = sortMethod.configuration.sort;
          var tasks = Tasks.find(selector.selector, { sort: { sortingField : 1 } }).fetch().map(prepareTask);
          var groups = _.groupBy(tasks, sortMethod.configuration.grouping);
          return Object.keys(groups).sort(function(key1, key2) {return ProfileUtils.comparator(key1, key2);}).map(groupKey => {
            return {name: sortMethod.configuration.groupingName(groupKey), tasks: groups[groupKey].sort(function(task1, task2) {return ProfileUtils.comparator(task1.eta, task2.eta)})};
          });
        }
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

  selectSort(sortToggle) {
    this.currentSort = sortToggle;
  }

  applyFilter(filterToggle) {
    this.currentFilter = filterToggle;
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
      	time: moment.utc(new Date(this.newDate + ' ' + this.newTime)).format(),
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

  getTaskStatusImage(task) {
    if (Meteor.userId() === task.authorId && task.authorStatus === 'yellow' ||
            Meteor.userId() === task.receiverId && task.receiverStatus === 'yellow') {
              return 'look'; // requires user's attention
            }
    if (task.status === 'open') {
      if (task.authorStatus === 'yellow' || task.receiverStatus === 'yellow') {
        return 'timer'; // is blocking current user
      }
      if (task.eta < new Date()) {
        return 'alarm'; // is overdue
      }
      return 'paper-plane'; // agreed upon and can be executed
    }
    if (task.status === 'done') {
      return 'check'; // done
    }
    if (task.status === 'cancelled') {
      return 'close-circle'; // cancelled
    }
    return 'science'; // unrecognized state
  }

	showDatePicker() {
			var current = (this.newDate === '' || this.newDate === undefined) ? new Date() : this.newDate;
			var options = {
				format: 'MM-dd-yyyy',
				default: current
      };
      var config = {
        shortDay: ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa']
      };

      var controller = this;
  		var timePicker = new DateTimePicker.Date(options, config)
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