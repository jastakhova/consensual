import { Controller } from 'angular-ecmascript/module-helpers';
import { Drafts, Invitees } from '../../api/background.js';
import ProfileUtils from './profile.js';
import DateTimePicker from 'date-time-picker';
import { Tracker } from 'meteor/tracker'
import {parse} from 'markdown/lib/index'
import marked from 'marked'
import 'bootstrap-markdown/js/bootstrap-markdown';
import { ReactiveVar } from 'meteor/reactive-var'

export default class DraftCtrl extends Controller {
  constructor() {
    super(...arguments);

    this.handleDrafts = Meteor.subscribe('draft', this.$stateParams.draftId);
    this.handleInvitees = this.subscribe('invitees');

    this.subscribe('currentuser');

    this.draftId = this.$stateParams.draftId;
    this.editingTime = false;
    this.editingLocation = false;
    this.editingDescription = false;
    this.editingTitle = false;
    this.editingReceiver = false;

    this.currentUser = Meteor.userId();
    this.editor = undefined;
    this.id2ConnectedUser = new ReactiveVar({});

    this.newReceiver = {};
    this.receiverCorrect = true;
    this.suggestInitialized = false;

    this.invitationLimitReached = false;
    this.newInvitee = {};
    this.invitees = [];

    this.popularUsers = [];
    this.allUsers = [];

    this.helpers({
      data() {
        if (!this.handleDrafts.ready()) {
          return {};
        }

        try {
        var popularUsers = this.popularUsers;
        var controller = this;

        if (this.invitees.length == 0) {
          this.invitees = Invitees.find({}).fetch();
        }

        if (this.allUsers.length == 0) {
          Meteor.call('users.getAll', {"username": 1, "profile.name" : 1}, function(err, result) {
            if (err) {
              ProfileUtils.processMeteorResult(err, result);
              return;
            }

            if (controller.allUsers.length == 0) {
              result.forEach(r => controller.allUsers.push(r));
            }
          });
        }

        if (Object.keys(this.id2ConnectedUser.get()).length === 0) {
          Meteor.call('users.getConnected', function(err, result) {
            if (err) {
              ProfileUtils.processMeteorResult(err, result);
              return;
            }

            controller.id2ConnectedUser.set(ProfileUtils.createMapFromList(result, "_id"));
          });
        }

        if (Object.keys(controller.id2ConnectedUser.get()).length > 0 && !this.suggestInitialized) {
          var howToGetSuggest = ProfileUtils.getSuggest(controller.id2ConnectedUser.get());
          $(".nametypeahead").typeahead({
            source: howToGetSuggest(),
            autoSelect: false,
            updater: function(item) {
              controller.receiverCorrect = true;
              controller.$scope.$apply();
              return item;
            }
          });
          this.suggestInitialized = true;
        }

        if (this.popularUsers.length == 0) {
          Meteor.call('users.getPopular', 3, function(err, result) {
            if (popularUsers.length == 0) {
              result.forEach(r => {
                r.picture = ProfileUtils.pictureSmall(r);
                r.name = ProfileUtils.getName(r);
                popularUsers.push(r);
              });
            }
          });
        }

        var foundDraft = Drafts.findOne({_id: this.draftId});
        if (!foundDraft) {
          this.$state.go('tab.notfound', this.$stateParams, {location: 'replace', reload: true, inherit: false});
          return {};
        }

        var receiverData = this.id2ConnectedUser.get()[foundDraft.receiver.id];
        this.newReceiver.name = foundDraft.receiver.name;
        this.newReceiver.id = foundDraft.receiver.id;
        foundDraft.receiver.picture = ProfileUtils.pictureSmall(receiverData);

        var currentTime = moment();
        var formatTime = function(ts) {
          var timeObj = moment(ts);
          if (timeObj.year() !== currentTime.year()) {
            return timeObj.format("YYYY");
          }

          if (timeObj.month() !== currentTime.month() || timeObj.day() !== currentTime.day()) {
            return timeObj.format("MMM Do");
          }

          return timeObj.format("hh:mm a");
        }

        var controller = this;
        if (Object.keys(this.id2ConnectedUser.get()).length === 0) {
          Meteor.call('users.getConnected', function(err, result) {
            if (err) {
              ProfileUtils.processMeteorResult(err, result);
              return;
            }

            controller.id2ConnectedUser.set(ProfileUtils.createMapFromList(result, "_id"));
          });
        }

        foundDraft.ETA = moment(foundDraft.eta).format(datetimeDisplayFormat);
        this.selectedDate = moment(foundDraft.eta).format("MM-DD-YYYY");
        this.selectedTime = moment(foundDraft.eta).format("HH:mm");
        this.previousDateTime = moment(foundDraft.eta).format();

        var markdown = this.markdown;

        $($("textarea[name='editDescription']")[0]).markdown({autofocus:false, savable:false,
          onPreview: function(e) {
            return markdown(e.getContent());
          },
          onShow: function(e) {
            e.setContent(foundDraft.text);
          }});

        $('div.pre').html(markdown(foundDraft.text));

        return foundDraft;
        } catch (err) {
          console.log(err);
          ProfileUtils.showError();
          Meteor.call('email.withError', err);
          return {};
        }
      }
    });
  }

  markdown(text) {
    return marked(text, { breaks: true });
  }

  display(value, isDate) {
    return (isDate ? moment(new Date(value)).format(datetimeDisplayFormat) : value);
  }

  logout() {
    Meteor.logout();
  }

  accountPicture() {
    return ProfileUtils.pictureSmall(Meteor.user());
  }

	flipTitleEditingStatus(newOne) {
    this.editingTitle = newOne ? newOne : !this.editingTitle;
  }

	flipTimeEditingStatus() {
    this.editingTime = !this.editingTime;
  }

  flipLocationEditingStatus() {
    this.editingLocation = !this.editingLocation;
  }

  flipReceiverEditingStatus() {
      this.editingReceiver = !this.editingReceiver;
    }

  flipDescriptionEditingStatus(text) {
    this.editingDescription = !this.editingDescription;
  }

  flipActivityShowingStatus() {
    this.activityShowed = !this.activityShowed;
  }

  flipCommentsShowingStatus() {
    this.commentsShowed = !this.commentsShowed;
  }

  saveTime() {
    this.newDateTime = moment(this.selectedDate + ' ' + this.selectedTime, "MM-DD-YYYY HH:mm").utc().format();

    Meteor.call('drafts.updateTime',
        this.draftId,
        moment.utc(this.previousDateTime).format(),
        this.newDateTime,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        ProfileUtils.processMeteorResult);
    this.flipTimeEditingStatus();
  }

  saveLocation(location) {
    Meteor.call('drafts.updateLocation',
      this.draftId,
      location,
      ProfileUtils.processMeteorResult);
    this.flipLocationEditingStatus();
  }

  saveDescription() {
    var description = $('textarea[name="editDescription"]').val();
    Meteor.call('drafts.updateDescription',
      this.draftId,
      description,
      ProfileUtils.processMeteorResult);
    $('div.pre').html(this.markdown(description));
    this.flipDescriptionEditingStatus(description);
  }

  saveTitle(title) {
    Meteor.call('drafts.updateTitle',
      this.draftId,
      title,
      ProfileUtils.processMeteorResult);
    this.flipTitleEditingStatus();
  }

  setReceiver(user) {
    if (!user) {
      user = Meteor.user();
    }

    this.newReceiver.name = user.name ? user.name : ProfileUtils.getName(user);
    this.newReceiver.id = user._id;

    if ($('.nametypeahead').typeahead('getActive')) {
      $('.nametypeahead').typeahead('getActive').id = user._id;
      $('.nametypeahead').typeahead('getActive').name = this.newReceiver.name;
    }

    this.saveReceiver();
  }

  saveReceiver() {
    if ($('.nametypeahead').typeahead('getActive')
      && this.newReceiver.id != $('.nametypeahead').typeahead('getActive').id) {
      this.newReceiver.id = $('.nametypeahead').typeahead('getActive').id;
      this.newReceiver.name = $('.nametypeahead').typeahead('getActive').name;
    }

    if (this.newReceiver.id) {
      Meteor.call('drafts.updateReceiver',
            this.draftId,
            this.newReceiver.id,
            ProfileUtils.processMeteorResult);
      this.flipReceiverEditingStatus();
    }
  }

  suggestKeyEntered() {
    var suggest = this.newReceiver.name.toLowerCase();

    this.receiverCorrect = $('.nametypeahead').typeahead('getActive')
      && $('.nametypeahead').typeahead('getActive').name.toLowerCase() === this.newReceiver.name.toLowerCase();

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

  showDatePicker() {
      var options = {
        format: 'MM-dd-yyyy',
        default: this.selectedDate
      };
      var config = {
        shortDay: ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa']
      };
      var controller = this;
      var datePicker = new DateTimePicker.Date(options, config)
      datePicker.on('selected', function (formatDate, now) {
        controller.selectedDate = formatDate;
        controller.$scope.$apply();
        datePicker.destroy();
      });
      datePicker.on('cleared', function () {
        controller.$scope.$apply();
      });
    }

  showTimePicker() {
    var options = {
      minuteStep: 1,
      default: this.previousDateTime
    };
    var controller = this;
    var timePicker = new DateTimePicker.Time(options, {})
    timePicker.on('selected', function (formatTime, now) {
      controller.selectedTime = formatTime;
      controller.$scope.$apply();
      timePicker.destroy();
    })
    timePicker.on('cleared', function () {
      controller.$scope.$apply();
    })
  }

  publishDraft() {
    Meteor.call('drafts.publish',
      this.draftId,
      ProfileUtils.processMeteorResult);
  }

  deleteDraft() {
    Meteor.call('drafts.delete',
      this.draftId,
      ProfileUtils.processMeteorResult);
  }

  setPristineAndUntouched(controller, fieldName) {
    var fieldCtrl = controller.$scope.editDraftForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0];
    fieldCtrl.$setPristine();
    fieldCtrl.$setUntouched();
  }

  findInvitee() {
    if (!this.newInvitee.name) {
      this.newInvitee.name = "";
    }

    if (!this.newInvitee.email) {
      this.newInvitee.email = "";
    }

    function findAlreadyExisting(invitee, collection, nameSuffix) {
      var filtered = collection.filter(u =>
        invitee.name != "" && ProfileUtils.getName(u).toLowerCase() === invitee.name.toLowerCase()
        || invitee.email != "" && ProfileUtils.getEmail(u).toLowerCase() === invitee.email.toLowerCase());

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

  inviteNewPerson() {
    var to = this.newInvitee;
    var controller = this;

    function addNewPersonToSuggest(id, name) {
      $(".nametypeahead").typeahead({ source: Meteor.settings.public.contacts, autoSelect: false});
      controller.newReceiver.name = name;
      controller.newReceiver.id = id;
      controller.receiverCorrect = true;
      $('.nametypeahead').val(name);
      if ($('.nametypeahead').typeahead('getActive')) {
        $('.nametypeahead').typeahead('getActive').id = id;
        $('.nametypeahead').typeahead('getActive').name = name;
      }

      controller.$scope.$apply();
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
}

DraftCtrl.$name = 'DraftCtrl';
DraftCtrl.$inject = ['$stateParams', '$state'];