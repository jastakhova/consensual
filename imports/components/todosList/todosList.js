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

    this.handleTasks = this.subscribe('tasks');

    this.handleAllUsers = this.subscribe('allusers');

    this.hideCompleted = false;

    this.proposingInProgress = false;
    this.filtersOpen = false;

    const nextMidnight = new Date(moment().format());
    nextMidnight.setHours(24, 0, 0, 0);
    const prevMidnight = new Date(moment().format());
    prevMidnight.setHours(0, 0, 0, 0);

    this.filters = [
        {name: "All", selector: {archived: false}},
        {name: "Open", selector: {status: "open"}},
        {name: "To me", selector: {receiverId: Meteor.userId(), archived: false}},
        {name: "Needs attention", selector: {$or: [{authorId: Meteor.userId(), authorStatus: "yellow"}, {receiverId: Meteor.userId(), receiverStatus: "yellow"}], archived: false}},
        {name: "Overdue", selector: {status: "open", eta: {$lt: new Date(moment().format()).getTime()}}},
        {name: "Blocked", selector: {archived: false, $or: [{authorId: Meteor.userId(), authorStatus: "green", receiverStatus: "yellow"}, {receiverId: Meteor.userId(), receiverStatus: "green", authorStatus: "yellow"}]}},
        {name: "Done", selector: {status: "done"}},
        {name: "Cancelled", selector: {status: "cancelled"}},
        {name: "Archived", selector: {archived: true}},
        ];

    this.sorts = [
      {name: "Default", groups: [
          {name: "Overdue", selector: {status: "open", eta: {$lt: new Date(moment().format()).getTime()}}, sort: function(task1, task2) {return ProfileUtils.comparator(task1.eta, task2.eta)}, limit: 3, appliedFilter: this.filters[4]},
          {name: "Needs attention", selector: {$or: [{authorId: Meteor.userId(), authorStatus: "yellow"}, {receiverId: Meteor.userId(), receiverStatus: "yellow"}], archived: false}, sort: function(task1, task2) {return ProfileUtils.comparator(ProfileUtils.getLatestActivityTime(task1), ProfileUtils.getLatestActivityTime(task2));}, limit: 5, appliedFilter: this.filters[3]},
          {name: "Today", selector: {status: "open", eta: {$lt: nextMidnight.getTime(), $gt: prevMidnight.getTime()}}, sort: function(task1, task2) {
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
      // "By assignee" takes bigger space and overflows the allocated space
      {name: "By Who", configuration: {sort: "receiverId", grouping: function(task) {return (task.receiverId === Meteor.userId()? "1" : "2") + task.receiverName;}, groupingName: function(group) {return group.slice(1);}}},
    ];

    var requestedSort = this.sorts.filter(s => s.name === this.$state.params.group);
    var requestedFilter = this.filters.filter(f => f.name === this.$state.params.filter);

    this.currentSort = requestedSort.length > 0 ? requestedSort[0] : this.sorts[0];
    this.currentFilter = requestedFilter.length > 0 ? requestedFilter[0] : this.filters[0];

    this.adjustFilters = function() {
      // the first filter (index == 0) is not shown and has top == 0
      var filters = $("#filters").find($("button.filterToggle")).slice(1);
      var firstRowTop = $(filters[0]).offset().top;
      var hasHidden = false;
      var filterToggleControl = $($("#filters").find($("a.btn-more"))[0]);
      var filtersOpen = filterToggleControl.text().startsWith("Less");
      filters.each(function(index, element) {
        $(element).css("display", "inline"); // not shown elements have top coordinate as 0
        var endOfBlock = $($(element).parent()).offset().left + $($(element).parent()).width() - 130;
        var notAtTheEndOfBlock = endOfBlock > $(element).offset().left + $(element).width();
        var firstRow = $(element).offset().top === firstRowTop && !hasHidden && (notAtTheEndOfBlock || index === filters.length - 1);
        var wasShown = firstRow || filtersOpen;
        $(element).css("display", wasShown ? "inline" : "none");
        hasHidden = hasHidden || !firstRow;
      });

      if (hasHidden) { // show control
        $($("#filters").find($("a.btn-more"))[0]).removeClass("hidden");
      } else if (!filterToggleControl.hasClass("hidden")) { // hide control
        filterToggleControl.addClass("hidden");
      }
    };

    $(window).resize(this.adjustFilters);
    $("#filters").resize(this.adjustFilters);
    $(document).ready(this.adjustFilters);

    this.helpers({
      tasks() {
        if (!this.handleTasks.ready()) {
          return [];
        }

        try {
      	var selector = this.getReactively("currentFilter");
      	var sortMethod = this.getReactively("currentSort");

      	var id2user = ProfileUtils.createMapFromList(Meteor.users.find().fetch(), "_id");

				function getSuggest() {
					var suggest = [];
					var suggestSize = 0;
					Object.keys(id2user).forEach(function(key) {
							suggest[suggestSize++] = {id: key, name: (id2user[key].profile ? id2user[key].profile.name : id2user[key].username)};
					});
					Meteor.settings.public.contacts = suggest;
					return suggest;
        }

        var suggest = getSuggest();
        if (this.handleAllUsers.ready()) {
          $(".typeahead").typeahead({ source: suggest, autoSelect: false});
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
          var groups = sortMethod.groups.map(sortGroup => {
            var tasks = Tasks.find(sortGroup.selector).fetch().sort(sortGroup.sort).map(prepareTask);
            return {name: sortGroup.name, tasks: sortGroup.limit ? tasks.slice(0, sortGroup.limit): tasks, size: tasks.length, sliced: tasks.length > sortGroup.limit, appliedFilter: sortGroup.appliedFilter};
            }).filter(group => group.tasks.length > 0);
          if (groups.length > 0) {
            return groups;
          }

          this.currentFilter = this.filters[1];
          selector = this.filters[1];
        }

        var sortingField = sortMethod.configuration.sort;
        var tasks = Tasks.find(selector.selector, { sort: { sortingField : 1 } }).fetch().map(prepareTask);
        var groups = _.groupBy(tasks, sortMethod.configuration.grouping);
        return Object.keys(groups).sort(function(key1, key2) {return ProfileUtils.comparator(key1, key2);}).map(groupKey => {
          return {name: sortMethod.configuration.groupingName(groupKey), tasks: groups[groupKey].sort(function(task1, task2) {return ProfileUtils.comparator(task1.eta, task2.eta)})};
        });
        } catch (err) {
          ProfileUtils.showError();
          Meteor.call('email.withError', err);
          return [];
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
    this.$state.go('tab.todo', {'filter': this.currentFilter.name, 'group' : sortToggle.name}, {notify: false});
  }

  applyFilter(filterToggle) {
    if (this.currentFilter.name === filterToggle.name) {
      filterToggle = this.filters[0];
    }
    this.currentFilter = filterToggle;
    this.$state.go('tab.todo', {'filter': filterToggle.name, 'group' : this.currentSort.name}, {notify: false});
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
      }, ProfileUtils.processMeteorResult);

    // Clear form

    this.newTask = '';
    this.setUntouchedAndPristine(this, 'newTask');
    this.runParsers(this, 'newTask', this.newTask);
    this.newReceiver = '';
    this.setUntouchedAndPristine(this, 'newReceiver');
    this.runParsers(this, 'newReceiver', this.newReceiver);
    $('.typeahead').val(''); //TODO: clears form but not model
    this.newDate = '';
    this.setUntouchedAndPristine(this, 'newDate');
    this.runParsers(this, 'newDate', this.newDate);
    this.newTime = '';
    this.setUntouchedAndPristine(this, 'newTime');
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

	flipFiltersStatus() {
    this.filtersOpen = !this.filtersOpen;
    $($("#filters").find($("a.btn-more"))[0]).text(this.filtersOpen ? "Less..." : "More...");
    this.adjustFilters();
  }

	runParsers(controller, fieldName, newValue) {
	  controller.$scope.addTaskForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0].$parsers.forEach(function(x) {x(newValue);});
	}

	setUntouchedAndPristine(controller, fieldName) {
    var fieldCtrl = controller.$scope.addTaskForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0];
    fieldCtrl.$setUntouched();
    fieldCtrl.$setPristine();
    fieldCtrl.$setValidity('', false);
  }

  setViewValue(controller, fieldName, fieldValue, eventName) {
    var fieldCtrl = controller.$scope.addTaskForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0];
    fieldCtrl.$setViewValue(fieldValue, eventName);
    fieldCtrl.$setTouched();
    fieldCtrl.$setDirty();
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
    controller.setViewValue(controller, 'newDate', '', 'click');
    timePicker.on('selected', function (formatTime, now) {
      controller.newDate = formatTime;
      controller.runParsers(controller, 'newDate', controller.newDate);
      controller.scope.$apply();
      timePicker.destroy();
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
		controller.setViewValue(controller, 'newTime', '', 'click');
		timePicker.on('selected', function (formatTime, now) {
			controller.newTime = formatTime;
			controller.runParsers(controller, 'newTime', controller.newTime);
			controller.scope.$apply();
			timePicker.destroy();
		});
	}
}

TodosListCtrl.$name = 'TodosListCtrl';
TodosListCtrl.$inject = ['$state'];