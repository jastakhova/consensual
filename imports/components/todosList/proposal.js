import { Controller } from 'angular-ecmascript/module-helpers';
import { Tasks } from '../../api/tasks.js';
import ProfileUtils from './profile.js';
import DateTimePicker from 'date-time-picker';
import { Tracker } from 'meteor/tracker'
import {parse} from 'markdown/lib/index'
import marked from 'marked'
import 'bootstrap-markdown/js/bootstrap-markdown';
import {getCurrentState, getAction, getCondition} from '../../api/dictionary.js';

export default class ProposalCtrl extends Controller {
  constructor() {
    super(...arguments);

    this.handleTasks = this.subscribe('tasks');

    if (Meteor.userId()) {
			this.subscribe('allusers');
		}

    this.proposalId = this.$stateParams.proposalId;
    this.editingTime = false;
    this.editingLocation = false;
    this.editingDescription = false;
    this.editingTitle = false;
    this.currentUser = Meteor.userId();
    this.currentUserIsInDoubt = false;
    this.commentsShowed = true;
    this.comment = '';
    this.acknowledgeLabel = 'Approve';
    this.needsToApproveStatusChange = false;
    this.editor = undefined;

    this.helpers({
      data() {
        if (!this.handleTasks.ready()) {
          return {};
        }

        try {
        var foundTask = Tasks.findOne({_id: this.proposalId});
        if (!foundTask) {
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

        var users = Meteor.users.find({$or: [{_id: foundTask.author.id}, {_id: foundTask.receiver.id}]}).fetch();
        var id2user = ProfileUtils.createMapFromList(users, "_id");
        foundTask.ETA = moment(foundTask.eta).format(datetimeDisplayFormat);
        this.selectedDate = moment(foundTask.eta).format("MM-DD-YYYY");
        this.selectedTime = moment(foundTask.eta).format("HH:mm");
        this.previousDateTime = moment(foundTask.eta).format();
//        this.currentUserIsInDoubt = Meteor.userId() === foundTask.author.id && foundTask.author.status === 'yellow' ||
//          Meteor.userId() === foundTask.receiver.id && foundTask.receiver.status === 'yellow';
//        this.activityShowed = !this.activityShowed && this.currentUserIsInDoubt || this.activityShowed;
        foundTask.comments.forEach(function(obj) {
          obj.formattedTime = moment(obj.time).format("DD MMM h:mm a");
        });

        foundTask.activity.forEach(record => record.formattedTime = formatTime(record.time));

//        var recentStatusChangeActivity = foundTask.activity
//          .sort(function(record1, record2) {return ProfileUtils.comparator(record2.time, record1.time);})
//          .filter(function(record) {return record.field === 'status' && (record.newValue === 'Done' || record.newValue === 'Cancelled');});
//        if (recentStatusChangeActivity.length > 0 && foundTask.status != 'open' && !foundTask.archived
//          && this.currentUserIsInDoubt && recentStatusChangeActivity[0].actor !== Meteor.userId()) {
//          this.acknowledgeLabel = 'Acknowledge task status change to ' + foundTask.status;
//          this.needsToApproveStatusChange = true;
//        }

        foundTask.authorPicture = ProfileUtils.picture(id2user[foundTask.author.id]);
        foundTask.receiverPicture = ProfileUtils.picture(id2user[foundTask.receiver.id]);

        var markdown = this.markdown;

        $($("textarea[name='editDescription']")[0]).markdown({autofocus:false, savable:false,
          onPreview: function(e) {
            return markdown(e.getContent());
          },
          onShow: function(e) {
            e.setContent(foundTask.text);
          }});

        $('div.pre').html(markdown(foundTask.text));

        foundTask.allowedActions = getCurrentState(foundTask).actions(foundTask, this.currentUser);

        return foundTask;
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

  display(value) {
    return (moment(new Date(value)).isValid() ? moment(new Date(value)).format(datetimeDisplayFormat) : value);
  }

  logout() {
    Meteor.logout();
  }

  accountPicture() {
    return ProfileUtils.picture(Meteor.user());
  }

  status(statusColor) {
  	if (statusColor === 'green') {
  		return "approves";
  	}
		return "is considering"
  }

  getStatusLabel(task, person) {
		if (!task || !task._id) {
      return "";
		}
		return getCondition(person.status, task).label;
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

    Meteor.call('tasks.updateTime',
        this.proposalId,
        moment.utc(this.previousDateTime).format(),
        this.newDateTime,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        ProfileUtils.processMeteorResult);
    this.flipTimeEditingStatus();
  }

  saveLocation(location) {
    Meteor.call('tasks.updateLocation',
      this.proposalId,
      location,
      ProfileUtils.processMeteorResult);
    this.flipLocationEditingStatus();
  }

  saveDescription() {
    var description = $('textarea[name="editDescription"]').val();
    Meteor.call('tasks.updateDescription',
      this.proposalId,
      description,
      ProfileUtils.processMeteorResult);
    $('div.pre').html(this.markdown(description));
    this.flipDescriptionEditingStatus(description);
  }

  saveTitle(title) {
    Meteor.call('tasks.updateTitle',
      this.proposalId,
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

  approveTask() {
    Meteor.call('tasks.updateStatuses',
      this.proposalId,
      'green',
      this.needsToApproveStatusChange,
      ProfileUtils.processMeteorResult);
  }

  markTaskAsDone() {
    Meteor.call('tasks.changeTaskStatus',
      this.proposalId,
      'done',
      ProfileUtils.processMeteorResult);
  }

  markTaskAsCancelled() {
    Meteor.call('tasks.changeTaskStatus',
      this.proposalId,
      'cancelled',
      ProfileUtils.processMeteorResult);
  }

  markTaskAsReopened() {
    Meteor.call('tasks.changeTaskStatus',
      this.proposalId,
      'open',
      ProfileUtils.processMeteorResult);
  }

  addComment() {
    Meteor.call('tasks.addComment', this.proposalId, this.comment, ProfileUtils.processMeteorResult);
    this.comment = '';
    this.setPristineAndUntouched(this, 'addComment');
  }

  setPristineAndUntouched(controller, fieldName) {
    var fieldCtrl = controller.$scope.editProposalForm.$$controls.filter(function(x) { return x.$name === fieldName;})[0];
    fieldCtrl.$setPristine();
    fieldCtrl.$setUntouched();
  }

  showAction(task, action) {
    return task.allowedActions && task.allowedActions.indexOf(getAction(action)) >= 0;
  }
}

ProposalCtrl.$name = 'ProposalCtrl';
ProposalCtrl.$inject = ['$stateParams', '$state'];