import { Controller } from 'angular-ecmascript/module-helpers';
import { Drafts } from '../../api/background.js';
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

    this.subscribe('currentuser');

    this.draftId = this.$stateParams.draftId;
    this.editingTime = false;
    this.editingLocation = false;
    this.editingDescription = false;
    this.editingTitle = false;
    this.currentUser = Meteor.userId();
    this.editor = undefined;
    this.id2ConnectedUser = new ReactiveVar({});

    this.helpers({
      data() {
        if (!this.handleDrafts.ready()) {
          return {};
        }

        try {
        var foundDraft = Drafts.findOne({_id: this.draftId});
        if (!foundDraft) {
          this.$state.go('tab.notfound', this.$stateParams, {location: 'replace', reload: true, inherit: false});
          return {};
        }

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
}

DraftCtrl.$name = 'DraftCtrl';
DraftCtrl.$inject = ['$stateParams', '$state'];