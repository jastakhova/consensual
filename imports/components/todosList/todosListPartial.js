import { Controller } from 'angular-ecmascript/module-helpers';
import {getStatus, getNotice, getCurrentState} from '../../api/dictionary.js';
import ProfileUtils from  './profile.js';
import { Tasks, Invitees } from '../../api/tasks.js';
import DateTimePicker from 'date-time-picker';
import { ReactiveVar } from 'meteor/reactive-var'


function getMidnight(time) {
  const day = new Date(time);
  day.setHours(0, 0, 0, 0);
  return day;
}

function getMidnightTime(time) {
  return getMidnight(time).getTime();
}

const nextMidnight = new Date(moment().format());
nextMidnight.setHours(24, 0, 0, 0);
const prevMidnight = getMidnight(moment().format());
const dayAgo = new Date(moment().subtract({ hours: 24}).format());

export class TodosListPartialCtrl extends Controller {

  constructor(...args) {
  	super(...args);

  	this.scope = args[0];

    this.subscribe('currentuser');

    this.filtersOpen = false;

    this.id2ConnectedUser = new ReactiveVar({});

    this.searchEdit = false;
    this.search = "";
    this.searchWithArchive = false;
    this.searchTypeahead = false;

    this.timeOptions = [
      {name: 'tomorrow', addedCount: 1, unit: 'days'},
      {name: 'next week', addedCount: 7, unit: 'days'},
      {name: 'whenever', addedCount: 3, unit: 'months'}];

    this.allUsers = [];

    this.filters = [
/*0*/   {name: "All", groupName: "All Active Proposals and Agreements", hide: true, selector: {}, nonarchive: true},
///*1*/   {name: "Needs Attention", groupName: "Notifications", hide: true, nonarchive: true,
//          selector: {$or: [
//              {"author.id" : Meteor.userId(), "author.notices": {$exists: true, $not: {$size: 0}}},
//              {"receiver.id" : Meteor.userId(), "receiver.notices": {$exists: true, $not: {$size: 0}}}]}},
///*2*/   {name: "Your Recent Activity", groupName: "Your Recent Activity", hide: true,
//          selector: {"activity": {$elemMatch: {"actor": Meteor.userId(), "time": {$gt: prevMidnight.getTime()}}}}},
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

    var sortingByETA = function(task1, task2) {return ProfileUtils.comparator(task1.eta, task2.eta);};
    var sortingNotices = function(notice1, notice2) {return ProfileUtils.comparator(notice2.created, notice1.created);};

    this.sorts = [
      {name: "Initial", visible: false,
        configuration: {
          sort: "eta",
          grouping: function(task) {const day = new Date(task.eta); day.setHours(0, 0, 0, 0); return day.getTime();},
          groupingName: formatDate},
          additionalGroups: [
            {name: "Notifications", selector:
              { $or: [
                {"author.id" : Meteor.userId(), "author.notices": {$exists: true, $not: {$size: 0}}},
                {"receiver.id" : Meteor.userId(), "receiver.notices": {$exists: true, $not: {$size: 0}}}]},
             sort: function(task1, task2) {return ProfileUtils.comparator(task1.eta, task2.eta)},
             limit: 5,
             prepare: function(task) {
                var actor = 0;
                var notices = [];
                if (task.author.id == Meteor.userId()) {
                  actor = task.receiver;
                  notices = task.author.notices.sort(sortingNotices);
                }
                if (task.receiver.id == Meteor.userId()) {
                  actor = task.author;
                  notices = task.receiver.notices.sort(sortingNotices);
                }
                task.notice = {
                  texts: Array.from(new Set(notices.map(notice => getNotice(notice.code).text))),
                  actor : actor,
                  formattedTime: moment(Math.min(...notices.map(notice => notice.created))).fromNow(),
                  time: Math.min(...notices.map(notice => notice.created))
                };
                task.eta = task.notice.time;

                if (notices.filter(notice => getNotice(notice.code).type === 'view' && !notice.touched).length > 0) {
                  Meteor.call('tasks.touchNotice',
                       task._id,
                       ProfileUtils.processMeteorResult);
                }

                return task;
             }},
            {name: "Your Recent Activity", selector: {archived: false, "activity": {$elemMatch: {"actor": Meteor.userId(), "time": {$gt: prevMidnight.getTime()}}}}, sort: function(task1, task2) {return ProfileUtils.comparator(task2.eta, task1.eta)}, limit: 3, appliedFilter: this.filters[2]}
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
          grouping: function(task) { return getMidnightTime(task.eta); },
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
                : task.author.name)
              : task.receiver.name;
           },
           groupingName: function(group, filter) {return group == "Self-agreements" ? group : "Agreements with " + group;},
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
    this.currentDate = this.$state.params.date ? parseInt(this.$state.params.date) : getMidnightTime(moment().format());

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

    var controller = this;
    Meteor.call('users.getAll', {"username": 1, "profile.name" : 1}, function(err, result) {
      if (err) {
        ProfileUtils.processMeteorResult(err, result);
        return;
      }

      if (controller.allUsers.length == 0) {
        result.forEach(r => controller.allUsers.push(r));
      }
    });

    this.todoListMain = function(useSuggest, oneTime, additionalFilter) {
        var startTime = new Date().getTime();

        if (!filterAdjustingWasMade) {
          this.adjustFilters();
          oneTime()
          filterAdjustingWasMade = true;
        }

      	var selector = this.getReactively("currentFilter");
      	var sortMethod = this.getReactively("currentSort");
      	var searchValue = this.getReactively("search");
      	var dateValue = this.getReactively("currentDate");
      	var withArchiveFlag = this.getReactively("searchWithArchive");

        if (Object.keys(controller.id2ConnectedUser.get()).length === 0) {
          Meteor.call('users.getConnected', function(err, result) {
            if (err) {
              ProfileUtils.processMeteorResult(err, result);
              return;
            }

            controller.id2ConnectedUser.set(ProfileUtils.createMapFromList(result, "_id"));
          });
        }

        if (Object.keys(controller.id2ConnectedUser.get()).length > 0) {
          if (this.getReactively("proposingInProgress")) {
            useSuggest(ProfileUtils.getSuggest(controller.id2ConnectedUser.get()));
          }

          if (this.getReactively("searchEdit") && !this.searchTypeahead) {
            $(".searchtypeahead").typeahead({
              source: ProfileUtils.getSuggest(controller.id2ConnectedUser.get())(),
              matcher: function(item) {
                return item.name.startsWith(this.query.replace(/^from:/g, "").replace(/^to:/g, ""));
              },
              autoSelect: false,
              updater: function(item) {
                var newSearch = (this.query.startsWith("from:") ? "from:" : "to:") + item.name;
                return {name: newSearch, id: item.id};
              },
              afterSelect: function(item) {
                $(".searchtypeahead")[0].dispatchEvent(new Event("input", { bubbles: true }));
              }});
            this.searchTypeahead = true;
          }
        }

        function prepareTask(x) {
          x.time = moment(x.eta).format("DD MMM h:mm a");

          x.authorPicture = ProfileUtils.pictureSmall(controller.id2ConnectedUser.get()[x.author.id]);
          x.receiverPicture = ProfileUtils.pictureSmall(controller.id2ConnectedUser.get()[x.receiver.id]);
          x.fromCurrentUser = x.author.id === Meteor.userId() && x.author.id != x.receiver.id;
          x.toCurrentUser = x.receiver.id === Meteor.userId() && x.author.id != x.receiver.id;
          return x;
        }

        function retrieveSearchSelector(query, controller) {
          var stripped = query.replace(/^from:/g, "").replace(/^to:/g, "");
          var hasPrefix = (query).startsWith("from:") || (query).startsWith("to:");
          if (hasPrefix && stripped.length > 0) {
            if (Meteor.settings.public.contacts) {
              var valid = false;
              for (let contact of Meteor.settings.public.contacts) {
                if (stripped === contact.name) {
                  // hide suggest as the match was found
                  if (!$('.typeahead').hasClass('hidden')) {
                    $('.typeahead').addClass('hidden');
                  }
                  if (query.startsWith("from:")) {
                    return {"author.id": contact.id};
                  }
                  return {"receiver.id": contact.id};
                }
              }
            }
            // suggest in progress
            $('.typeahead').removeClass('hidden');
          }
          if (!hasPrefix) {
            // no prefix, so no need in showing suggest
            if (!$('.typeahead').hasClass('hidden')) {
              $('.typeahead').addClass('hidden');
            }
          }
          var searchRegex = new RegExp(query.replace(/\W/g, ""), "i");
          return {$or: [{text: searchRegex}, {title: searchRegex} ]};
        }

        var additionalGroups = [];
        if (sortMethod.name == "Default" && selector.name === this.filters[0].name && searchValue === "" && !this.profileId) {
          sortMethod = this.sorts[0]; // doing "Initial" style of sorting
          additionalGroups = sortMethod.additionalGroups.map(sortGroup => {
            var selector = additionalFilter ? {$and: [additionalFilter, sortGroup.selector]} : sortGroup.selector;
            var tasks = Tasks.find(selector).fetch()
              .sort(sortGroup.sort)
              .map(sortGroup.prepare ? function(task) {
                var prepared = sortGroup.prepare(task);
                prepared.notice.actor.picture = ProfileUtils.pictureSmall(controller.id2ConnectedUser.get()[prepared.notice.actor.id]);
                return prepared;
                } : prepareTask);
            return {
              name: sortGroup.name,
              tasks: tasks,
              size: tasks.length,
              sliced: tasks.length > sortGroup.limit,
              limit: sortGroup.limit,
              notifications: !!sortGroup.prepare
            };
          }).filter(group => group.tasks.length > 0);
        }

        var sortingField = sortMethod.configuration.sort;
        var initialSort = sortMethod.name === "Initial";

        var selectorWithSpecifics = additionalFilter ? {$and: [selector.selector, additionalFilter]} : selector.selector;
        var selectorWithSortFiltering = initialSort ? {$and: [selectorWithSpecifics, {eta: {$gt: dateValue}}]} : selectorWithSpecifics;
        var selectorWithArchive = selector.nonarchive && !withArchiveFlag ? {$and: [selectorWithSortFiltering, {archived: false}]} : selectorWithSortFiltering;
        var selectorWithSearch = searchValue === "" ?
          selectorWithArchive :
          {$and: [selectorWithArchive, retrieveSearchSelector(searchValue, this)]};

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

        var endTime = new Date().getTime();
        console.log("TODO list time was " + (endTime - startTime) + "ms");
        return additionalGroups.concat(resultGroups);
      }

  this.selectSort = function(sortToggle) {
    this.currentSort = sortToggle;
    this.$state.go(this.$state.current.name, {'filter': this.currentFilter.name, 'group' : sortToggle.name}, {notify: false});
  }

  this.applyFilter = function(filterToggle) {
    if (this.currentFilter.name === filterToggle.name) {
      filterToggle = this.filters[0];
    }
    this.currentFilter = filterToggle;
    this.$state.go(this.$state.current.name, {'filter': filterToggle.name, 'group' : this.currentSort.name}, {notify: false});
  }

  this.applyDate = function(d) {
    var time = (d === "today") ? prevMidnight : (d === "tomorrow" ? nextMidnight : "more");
    if (time === "more") {
      this.showDatePickerForFilters();
    } else {
      this.currentDate = time.getTime();
      this.$state.go(this.$state.current.name, {'date': time.getTime()}, {notify: false});
    }
  }

  this.logout = function() {
    Meteor.logout();
  }

  this.accountPicture = function() {
    return ProfileUtils.pictureSmall(Meteor.user());
  }

  this.gotoProposal = function(taskId) {
    this.$state.go('tab.proposal', {'proposalId': taskId});
  }

	this.flipSearchEditing = function() {
    this.searchEdit = true;
  }

	this.flipFiltersStatus = function() {
    this.filtersOpen = !this.filtersOpen;
    $($("#filters").find($("a.btn-more"))[0]).text(this.filtersOpen ? "Less..." : "More...");
    this.adjustFilters();
  }

  this.getTaskStatusImage = function(task) {
    return getCurrentState(task).icon;
  }

  this.showDatePickerForFilters = function() {
    var current = new Date();
    var controller = this;
    var doBeforeShow = function() {};
    var doOnSelect = function(formatTime) {
       controller.currentDate = moment(formatTime + ' 00:00', "MM-DD-YYYY HH:mm").utc().valueOf();
       controller.$state.go(controller.$state.current.name, {'date': controller.currentDate}, {notify: false});
    };
    this.showDateBasePicker(current, doBeforeShow, doOnSelect);
  }

	this.showDateBasePicker = function(current, doBeforeShow, doOnSelect) {
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

  this.removeNotice = function(task) {
   Meteor.call('tasks.removeNotice',
           task._id,
           ProfileUtils.processMeteorResult);
  }

  } // constructor
}

//TodosListPartialCtrl.$name = 'TodosListPartialCtrl';
//TodosListPartialCtrl.$inject = ['$state'];
//templateCache can be used to check whether template is in the cache