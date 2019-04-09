import { Tasks, Invitees } from '../../api/tasks.js';
import moment from 'moment';
import { Controller } from 'angular-ecmascript/module-helpers';
import DateTimePicker from 'date-time-picker';
import graph from 'fbgraph';
import ProfileUtils from  './profile.js';
import '../../../public/assets/js/bootstrap-typeahead.min.js';
import { Tracker } from 'meteor/tracker';
import {getStatus} from '../../api/dictionary.js';

const nextMidnight = new Date(moment().format());
nextMidnight.setHours(24, 0, 0, 0);
const prevMidnight = new Date(moment().format());
prevMidnight.setHours(0, 0, 0, 0);
const dayAgo = new Date(moment().subtract({ hours: 24}).format());

export default class TodosListCtrl extends Controller {

  constructor() {
  	super(...arguments);

  	this.scope = arguments[0];

    this.handleTasks = this.subscribe('tasks');
    this.handleInvitees = this.subscribe('invitees');

    this.handleAllUsers = this.subscribe('allusers');

    this.hideCompleted = false;

    this.proposingInProgress = false;
    this.filtersOpen = false;

    this.newInvitee = {};
    this.invitationLimitReached = false;
    this.invitationLimit = 15;

    this.searchEdit = false;
    this.search = "";
    this.searchWithArchive = false;
    this.popularUsers = [];
    this.timeOptions = [
      {name: 'tomorrow', addedCount: 1, unit: 'days'},
      {name: 'next week', addedCount: 7, unit: 'days'},
      {name: 'whenever', addedCount: 3, unit: 'months'}];

    this.allUsers = [];
    this.invitees = [];

    this.filters = [
/*0*/   {name: "All", groupName: "All Active Proposals and Agreements", hide: true, selector: {}, nonarchive: true},
/*1*/   {name: "Needs Attention", groupName: "Agreements that Need Attention", hide: true, nonarchive: true,
          selector: {$or: [
              {"author.id" : Meteor.userId(), "author.notices": {$exists: true, $not: {$size: 0}}},
              {"receiver.id" : Meteor.userId(), "receiver.notices": {$exists: true, $not: {$size: 0}}}]}},
/*2*/   {name: "Your Recent Activity", groupName: "Your Recent Activity", hide: true,
          selector: {"activity": {$elemMatch: {"actor": Meteor.userId(), "time": {$gt: prevMidnight.getTime()}}}}},
/*3*/   {name: "Recently created", groupName: "Recently Created Proposals",
           selector: {"author.id": Meteor.userId(), "activity": {$elemMatch: {"field": "agreement", "time": {$gt: prevMidnight.getTime()}}}}},
/*4*/   {name: "No response yet", groupName: "Non-Responsive Proposals",
           selector: {status: getStatus("proposed").id}, nonarchive: true},
/*5*/   {name: "Under consideration", groupName: "Proposals Under Consideration",
           selector: {status: getStatus("considered").id}, nonarchive: true},
/*6*/   {name: "Agreed", groupName: "Accomplished Agreements", nonarchive: true, selector: {status: getStatus("agreed").id}},
/*7*/   {name: "Overdue", groupName: "Overdue Agreements", nonarchive: true,
           selector: {eta: {$lt: new Date(moment().format()).getTime()}}},
/*8*/   {name: "Upcoming", groupName: "Upcoming Agreements", nonarchive: true,
           selector: {eta: {$gt: new Date(moment().format()).getTime()}}},
/*9*/   {name: "Archived", groupName: "Archived Agreements", selector: {archived: true}}
        ];

    var formatDate = function(time, unusedParameter) {
      var d = new Date();
      d.setTime(time);
      if (prevMidnight.getTime() == d.getTime()) {
        return "Today";
      }
      if (nextMidnight.getTime() == d.getTime()) {
        return "Tomorrow";
      }
      return moment(d).format("DD MMM");
    };

    var sortingByETA = function(task1, task2) {return ProfileUtils.comparator(task1.eta, task2.eta)};

    this.sorts = [
      {name: "Initial", visible: false,
        configuration: {
          sort: "eta",
          grouping: function(task) {const day = new Date(task.eta); day.setHours(0, 0, 0, 0); return day.getTime();},
          groupingName: formatDate}, additionalGroups: [
            {name: "Needs Attention", selector: {$and: [{archived: false}, { $or: [{"author.id" : Meteor.userId(), "author.notices": {$exists: true, $not: {$size: 0}}}, {"receiver.id" : Meteor.userId(), "receiver.notices": {$exists: true, $not: {$size: 0}}}]}]}, sort: function(task1, task2) {return ProfileUtils.comparator(task1.eta, task2.eta)}, limit: 5, appliedFilter: this.filters[1]},
            {name: "Your Recent Activity", selector: {archived: false, "activity": {$elemMatch: {"actor": Meteor.userId(), "time": {$gt: prevMidnight.getTime()}}}}, sort: function(task1, task2) {return ProfileUtils.comparator(task1.eta, task2.eta)}, limit: 3, appliedFilter: this.filters[2]}
          ],
          ingroupSort: sortingByETA
      },
      {name: "Default", visible: true,
        configuration:
          {sort: "eta",
          grouping: function(task) {return "Agreements";},
          groupingName: function(group, filter) {return filter.groupName;},
          ingroupSort: sortingByETA,
          limit: 3}},
      {name: "By Time", visible: true,
        configuration: {
          sort: "eta",
          grouping: function(task) {const day = new Date(task.eta); day.setHours(0, 0, 0, 0); return day.getTime();},
          groupingName: formatDate,
          ingroupSort: sortingByETA,
          limit: 3}},
      // "By assignee" takes bigger space and overflows the allocated space
      {name: "By Who", visible: true,
        configuration: {
          sort: "receiver.id",
          grouping: function(task) {
            return task.receiver.id === Meteor.userId()
              ? (
                task.receiver.id === task.author.id
                ? "Self-agreements"
                : ("Agreements with " + task.author.name))
              : task.receiver.name;
           },
           groupingName: function(group, filter) {return group;},
           ingroupSort: function(task1, task2) {
              return ProfileUtils.comparator(
                ProfileUtils.getLatestActivityTime(task2, Meteor.userId()),
                ProfileUtils.getLatestActivityTime(task1, Meteor.userId()))
           },
           limit: 3}},
    ];

    var requestedSort = this.sorts.filter(s => s.name === this.$state.params.group);
    var requestedFilter = this.filters.filter(f => f.name === this.$state.params.filter);

    this.currentSort = requestedSort.length > 0 ? requestedSort[0] : this.sorts[1]; // Default, not initial
    this.currentFilter = requestedFilter.length > 0 ? requestedFilter[0] : this.filters[0];
    this.currentDate = this.$state.params.date ? parseInt(this.$state.params.date) : new Date(moment().format()).getTime();

    this.adjustFilters = function() {
      if ($("#filters").find($("button.filterToggle")).length == 0) {
        return;
      }
      var filters = $("#filters").find($("button.filterToggle")).filter((index, element) => {
        return !$($(element)[0]).hasClass("no-show");
      });
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
    var filterAdjustingWasMade = false;

    this.helpers({
      tasks() {
        if (!this.handleTasks.ready() || !this.handleInvitees.ready()) {
          return [];
        }

        if (!filterAdjustingWasMade) {
          this.adjustFilters();
          filterAdjustingWasMade = true;
          var popularUsers = this.popularUsers;
          Meteor.call('users.getPopular', 3, function(err, result) {
            result.forEach(r => {
              r.picture = ProfileUtils.picture(r);
              r.name = ProfileUtils.getName(r);
              popularUsers.push(r);
            });
          });
        }

        try {
      	var selector = this.getReactively("currentFilter");
      	var sortMethod = this.getReactively("currentSort");
      	var searchValue = this.getReactively("search");
      	var dateValue = this.getReactively("currentDate");
      	var withArchiveFlag = this.getReactively("searchWithArchive");

      	function getConnectedPeople(controller) {
      	  var connectedUsers = new Set();
          Tasks.find({$or: [{"author.id": Meteor.userId()}, {"receiver.id": Meteor.userId()}]}).fetch().forEach(task => {
            connectedUsers.add(task.author.id);
            connectedUsers.add(task.receiver.id);
          });

          controller.invitees = Invitees.find().fetch();
          return controller.invitees.concat(Meteor.users.find({$or: [{_id: {$in: Array.from(connectedUsers)}}, foundersFilter]},
            {fields: {"username": 1, "profile.name" : 1, "services.facebook.id": 1}}).fetch());
      	}

      	var id2user = ProfileUtils.createMapFromList(getConnectedPeople(this), "_id");
      	this.allUsers = Meteor.users.find({}, {"username": 1, "profile.name" : 1}).fetch();
      	this.invitationLimitReached = this.invitees.filter(i => dayAgo.getTime() <= i.creationTime).length >= this.invitationLimit;

				function getSuggest() {
					var suggest = [];
					var suggestSize = 0;
					Object.keys(id2user).forEach(function(key) {
							suggest[suggestSize++] = {id: key, name: ProfileUtils.getName(id2user[key])};
					});
					Meteor.settings.public.contacts = suggest;
				  if (Meteor.settings.public.contacts.filter(x => x.id === Meteor.userId()).length === 0) {
				    Meteor.settings.public.contacts[Meteor.settings.public.contacts.length] = {id: Meteor.userId(), name:  ProfileUtils.getName(Meteor.user())};
				  }
					return suggest;
        }

        if (this.handleAllUsers.ready() && this.getReactively("proposingInProgress") && Meteor.userId()) {
          $(".typeahead").typeahead({ source: getSuggest(), autoSelect: false});
        }

        function isNumeric(value) {
            return /^-{0,1}\d+$/.test(value);
        }

        function prepareTask(x) {
          x.time = moment(x.eta).format("DD MMM h:mm a");

          x.authorPicture = ProfileUtils.picture(id2user[x.author.id]);
          x.receiverPicture = ProfileUtils.picture(id2user[x.receiver.id]);
          x.fromCurrentUser = x.author.id === Meteor.userId() && x.author.id != x.receiver.id;
          x.toCurrentUser = x.receiver.id === Meteor.userId() && x.author.id != x.receiver.id;
          return x;
        }

        var additionalGroups = [];
        if (sortMethod.name == "Default") {
          if (selector.name === this.filters[0].name && searchValue === "") {
            sortMethod = this.sorts[0]; // doing "Initial" style of sorting
            additionalGroups = sortMethod.additionalGroups.map(sortGroup => {
              var tasks = Tasks.find(sortGroup.selector).fetch().sort(sortGroup.sort).map(prepareTask);
              return {
                name: sortGroup.name,
                tasks: tasks,
                size: tasks.length,
                sliced: tasks.length > sortGroup.limit,
                appliedFilter: sortGroup.appliedFilter,
                limit: sortGroup.limit
              };
            }).filter(group => group.tasks.length > 0);
          }
        }

        var sortingField = sortMethod.configuration.sort;
        searchValue = searchValue.replace(/\W/g, "");
        var searchRegex = new RegExp(searchValue, "i");
        var initialSort = sortMethod.name === "Initial";

        var selectorWithSortFiltering = initialSort ? {$and: [selector.selector, {eta: {$gt: dateValue}}]} : selector.selector;
        var selectorWithArchive = selector.nonarchive && !withArchiveFlag ? {$and: [selectorWithSortFiltering, {archived: false}]} : selectorWithSortFiltering;
        var selectorWithSearch = searchValue === "" ?
          selectorWithArchive :
          {$and: [selectorWithArchive, {$or: [{text: searchRegex}, {title: searchRegex} ]}]};

        var tasks = Tasks.find(selectorWithSearch, { sort: { sortingField : 1 } }).fetch().map(prepareTask);
        var groups = _.groupBy(tasks, sortMethod.configuration.grouping);
        var resultGroups = Object.keys(groups)
            .sort(function(key1, key2) {return ProfileUtils.comparator(key1, key2);})
            .map(groupKey => {
              return {
                name: sortMethod.configuration.groupingName(groupKey, selector),
                tasks: groups[groupKey].sort(sortMethod.configuration.ingroupSort),
                sliced: Object.keys(groups).length > 1 && groups[groupKey].length > sortMethod.configuration.limit,
                limit: sortMethod.configuration.limit
              };
            });
        if (initialSort) {
          var firstGroupName = sortMethod.configuration.groupingName(dateValue);
          if (resultGroups.length == 0 || resultGroups[0].name != firstGroupName) {
            resultGroups = [{name: firstGroupName, tasks: []}].concat(resultGroups);
          }
          resultGroups[0].datepickerStub = true;
        }
        return additionalGroups.concat(resultGroups);
        } catch (err) {
          console.log(err);
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

  applyDate(d) {
    var time = (d === "today") ? prevMidnight : (d === "tomorrow" ? nextMidnight : "more");
    if (time === "more") {
      this.showDatePickerForFilters();
    } else {
      this.currentDate = time.getTime();
      this.$state.go('tab.todo', {'date': time.getTime()}, {notify: false});
    }
  }

  logout() {
    Meteor.logout();
  }

  accountPicture() {
    return ProfileUtils.picture(Meteor.user());
  }

  gotoProposal(taskId) {
    this.$state.go('tab.proposal', {'proposalId': taskId});
  }

  addTask(newTask) {
    Meteor.call('tasks.insert', {
      task: newTask,
      time: moment(this.newDate + ' ' + this.newTime, "MM-DD-YYYY HH:mm").utc().format(),
      receiver: $('.typeahead').typeahead('getActive') ? $('.typeahead').typeahead('getActive').id : this.newReceiverId
      }, ProfileUtils.processMeteorResult);

    // Clear form
    this.newTask = '';
    this.$scope.addTaskForm.$setPristine();
    this.$scope.addTaskForm.$setUntouched();
    this.newReceiver = '';
    $('.typeahead').val(''); //TODO: clears form but not model
    this.newDate = '';
    this.newTime = '';
    this.newInvitee = {};
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
	  if (!this.proposingInProgress) {
      $('.hideOnTask').addClass('hidden');
    }

		this.proposingInProgress = !this.proposingInProgress;
	}

	setReceiver(user) {
	  if (!user) {
	    user = this.currentUser;
	  }
	  this.newReceiver = user.name ? user.name : ProfileUtils.getName(user);
    this.newReceiverId = user._id;
    $('.typeahead').val(this.newReceiver);
    if ($('.typeahead').typeahead('getActive')) {
      $('.typeahead').typeahead('getActive').id = this.newReceiverId;
      $('.typeahead').typeahead('getActive').name = this.newReceiver;
    }

    this.setViewValue(this, 'newReceiver', this.newReceiver, 'click');
    this.runParsers(this, 'newReceiver', this.newReceiver);
	}

	setTimeOption(timeOption) {
	  var chosenTime = moment().add(timeOption.addedCount, timeOption.unit);

	  this.newDate = chosenTime.format('MM-DD-YYYY');
	  this.setViewValue(this, 'newDate', this.newDate, 'click', true);
    this.runParsers(this, 'newDate', this.newDate);

    this.newTime = chosenTime.format('HH:mm');
    this.setViewValue(this, 'newTime', this.newTime, 'click', true);
    this.runParsers(this, 'newTime', this.newTime);
	}

	flipSearchEditing() {
    this.searchEdit = true;
  }

	flipFiltersStatus() {
    this.filtersOpen = !this.filtersOpen;
    $($("#filters").find($("a.btn-more"))[0]).text(this.filtersOpen ? "Less..." : "More...");
    this.adjustFilters();
  }

	runParsers(controller, fieldName, newValue) {
	  controller.$scope.addTaskForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0]
	    .$parsers.forEach(function(x) {x(newValue);});
	}

	setUntouchedAndPristine(controller, fieldName) {
    var fieldCtrl = controller.$scope.addTaskForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0];
    fieldCtrl.$setUntouched();
    fieldCtrl.$setPristine();
    fieldCtrl.$setValidity('', false);
  }

  setViewValue(controller, fieldName, fieldValue, eventName, noSet) {
    var fieldCtrl = controller.$scope.addTaskForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0];
    if (!noSet) {
      fieldCtrl.$setViewValue(fieldValue, eventName);
    }
    fieldCtrl.$setTouched();
    fieldCtrl.$setDirty();
  }

  getTaskStatusImage(task) {
    if (Meteor.userId() === task.author.id && task.author.status === 'yellow' ||
            Meteor.userId() === task.receiver.id && task.receiver.status === 'yellow') {
              return 'look'; // requires user's attention
            }
    if (task.status === 'open') {
      if (task.author.status === 'yellow' || task.receiver.status === 'yellow') {
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

  showDatePickerForFilters() {
    var current = new Date();
    var controller = this;
    var doBeforeShow = function() {};
    var doOnSelect = function(formatTime) {
       controller.currentDate = moment(formatTime + ' 00:00', "MM-DD-YYYY HH:mm").utc().valueOf();
       controller.$state.go('tab.todo', {'date': controller.currentDate}, {notify: false});
    };
    this.showDateBasePicker(current, doBeforeShow, doOnSelect);
  }

  showDatePicker() {
    var current = (this.newDate === '' || this.newDate === undefined) ? new Date() : this.newDate;
    var controller = this;
    var doBeforeShow = function() {
      controller.setViewValue(controller, 'newDate', '', 'click');
    };
    var doOnSelect = function(formatTime) {
      controller.newDate = formatTime;
      controller.runParsers(controller, 'newDate', controller.newDate);
      controller.scope.$apply();
    };
    this.showDateBasePicker(current, doBeforeShow, doOnSelect);
  }

	showDateBasePicker(current, doBeforeShow, doOnSelect) {
    var options = {
      format: 'MM-dd-yyyy',
      default: current
    };
    var config = {
      shortDay: ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa']
    };

    var timePicker = new DateTimePicker.Date(options, config);
    doBeforeShow();
    timePicker.on('selected', function (formatTime, now) {
      doOnSelect(formatTime);
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

	inviteNewPerson() {
	  var to = this.newInvitee;
	  var controller = this;

	  function addNewPersonToSuggest(id, name) {
      $(".typeahead").typeahead({ source: Meteor.settings.public.contacts, autoSelect: false});
      controller.newReceiver = name;
      controller.newReceiverId = id;
      $('.typeahead').val(name);
      if ($('.typeahead').typeahead('getActive')) {
        $('.typeahead').typeahead('getActive').id = id;
        $('.typeahead').typeahead('getActive').name = name;
      }

      controller.setViewValue(controller, 'newReceiver', name, 'click');
      controller.runParsers(controller, 'newReceiver', controller.newReceiver);
	  }

	  if (this.newInvitee.found) {
	    addNewPersonToSuggest(this.newInvitee.found._id, this.newInvitee.found.name);
	  } else {
      Meteor.call('email.invite', to, function(error, result) {
        if (result) {
          Meteor.settings.public.contacts[Meteor.settings.public.contacts.length] = {id: result, name:  to.name};
          addNewPersonToSuggest(result, to.name);
        } else {
          var err = "We couldn't send an email to " + to.email;
          console.log(err);
          ProfileUtils.showError(err);
          Meteor.call('email.withError', err);
        }
      });
    }
	}

	suggestKeyEntered() {
	  var suggest = $('.typeahead').val().toLowerCase();
	  if (suggest.length < 5) {
	    return;
	  }

	  var initialLength = Meteor.settings.public.contacts.length;
	  var uniqueUsers = new Set(Meteor.settings.public.contacts.map(u => u.id));

	  this.allUsers
	    .filter(u => ProfileUtils.getName(u).toLowerCase().includes(suggest) && !uniqueUsers.has(u._id))
	    .forEach(u => {
	        Meteor.settings.public.contacts[Meteor.settings.public.contacts.length] = {id: u._id, name: ProfileUtils.getName(u)}
        }
      );

	  if (initialLength !== Meteor.settings.public.contacts.length) {
	    $(".typeahead").typeahead({ source: Meteor.settings.public.contacts, autoSelect: false});
	  }
	}

	findInvitee() {
	  if (!this.newInvitee.name) {
	    this.newInvitee.name = "";
	  }

	  if (!this.newInvitee.email) {
      this.newInvitee.email = "";
    }

    function findAlreadyExisting(invitee, collection, nameSuffix) {
      var filtered = collection.filter(u => ProfileUtils.getName(u).toLowerCase() === invitee.name.toLowerCase()
        || ProfileUtils.getEmail(u).toLowerCase() === invitee.email.toLowerCase());

      invitee.found = filtered.length > 0 ? filtered[0] : undefined;
      if (invitee.found) {
        invitee.found.nameToShow = ProfileUtils.getName(invitee.found) + nameSuffix;
        invitee.found.name = ProfileUtils.getName(invitee.found);
        invitee.found.picture = ProfileUtils.picture(invitee.found);
      }
      return invitee.found;
    }

	  if (!findAlreadyExisting(this.newInvitee, this.allUsers, "")) {
	    findAlreadyExisting(this.newInvitee, this.invitees, " (already invited)");
	  }
	}
}

TodosListCtrl.$name = 'TodosListCtrl';
TodosListCtrl.$inject = ['$state'];