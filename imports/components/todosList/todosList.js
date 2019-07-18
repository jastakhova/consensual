import { Tasks, Invitees } from '../../api/tasks.js';
import moment from 'moment';
import { TodosListPartialCtrl } from './todosListPartial.js';
import DateTimePicker from 'date-time-picker';
import ProfileUtils from  './profile.js';
import '../../../public/assets/js/bootstrap-typeahead.min.js';

export default class TodosListCtrl extends TodosListPartialCtrl {

  constructor() {
  	super(...arguments);

  	this.scope = arguments[0];

    this.subscribe('tasks');
    this.handleInvitees = this.subscribe('invitees');

    this.hideCompleted = false;
    this.proposingInProgress = false;

    this.newInvitee = {};
    this.invitationLimitReached = false;
    this.invitationLimit = 15;

    this.invitees = [];
    this.popularUsers = [];

    this.helpers({
      tasks() {
        try {
          var popularUsers = this.popularUsers;

          return this.todoListMain(function(getSuggest) {
            $(".nametypeahead").typeahead({ source: getSuggest(), autoSelect: false});
          }, function() {
            Meteor.call('users.getPopular', 3, function(err, result) {
              result.forEach(r => {
                r.picture = ProfileUtils.pictureSmall(r);
                r.name = ProfileUtils.getName(r);
                popularUsers.push(r);
              });
            });
          }, {
            showAdditionalGroups: true
          });
        } catch (err) {
          console.log(err);
          ProfileUtils.showError();
          Meteor.call('email.withError', err);
          return [];
        }
      }
    })
  }

  addTask(newTask) {
    Meteor.call('tasks.insert', {
      task: newTask,
      time: moment(this.newDate + ' ' + this.newTime, "MM-DD-YYYY HH:mm").utc().format(),
      receiver: $('.nametypeahead').typeahead('getActive') ? $('.nametypeahead').typeahead('getActive').id : this.newReceiverId
      }, ProfileUtils.processMeteorResult);

    // Clear form
    this.newTask = '';
    this.$scope.addTaskForm.$setPristine();
    this.$scope.addTaskForm.$setUntouched();
    this.newReceiver = '';
    $('.nametypeahead').val(''); //TODO: clears form but not model
    this.newDate = '';
    this.newTime = '';
    this.newInvitee = {};
  }

	flipProposingStatus() {
	  if (!this.proposingInProgress) {
      $('.hideOnTask').addClass('hidden');
    }

		this.proposingInProgress = !this.proposingInProgress;
	}

	setReceiver(user) {
	  if (!user) {
	    user = Meteor.user();
	  }
	  this.newReceiver = user.name ? user.name : ProfileUtils.getName(user);
    this.newReceiverId = user._id;
    $('.nametypeahead').val(this.newReceiver);
    if ($('.nametypeahead').typeahead('getActive')) {
      $('.nametypeahead').typeahead('getActive').id = this.newReceiverId;
      $('.nametypeahead').typeahead('getActive').name = this.newReceiver;
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
      $(".nametypeahead").typeahead({ source: Meteor.settings.public.contacts, autoSelect: false});
      controller.newReceiver = name;
      controller.newReceiverId = id;
      $('.nametypeahead').val(name);
      if ($('.nametypeahead').typeahead('getActive')) {
        $('.nametypeahead').typeahead('getActive').id = id;
        $('.nametypeahead').typeahead('getActive').name = name;
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
	  var suggest = $('.nametypeahead').val().toLowerCase();
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
	    $(".nametypeahead").typeahead({ source: Meteor.settings.public.contacts, autoSelect: false});
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
        invitee.found.picture = ProfileUtils.pictureSmall(invitee.found);
      }
      return invitee.found;
    }

	  if (!findAlreadyExisting(this.newInvitee, this.allUsers, "")) {
	    findAlreadyExisting(this.newInvitee, this.invitees, " (already invited)");
	  }
	}
}

TodosListCtrl.$name = 'TodosListCtrl';
TodosListCtrl.$inject = ['$state', '$templateCache'];
//templateCache can be used to check whether template is in the cache