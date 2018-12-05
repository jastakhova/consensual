import { Controller } from 'angular-ecmascript/module-helpers';
import { Tasks } from '../../api/tasks.js';
import ProfileUtils from './profile.js';
import DateTimePicker from 'date-time-picker';
import { Tracker } from 'meteor/tracker'

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

        var users = Meteor.users.find({$or: [{_id: foundTask.authorId}, {_id: foundTask.receiverId}]}).fetch();
        var id2user = ProfileUtils.createMapFromList(users, "_id");
        foundTask.ETA = moment(foundTask.eta).format(datetimeDisplayFormat);
        this.selectedDate = moment(foundTask.eta).format("MM-DD-YYYY");
        this.selectedTime = moment(foundTask.eta).format("HH:mm");
        this.previousDateTime = moment(foundTask.eta).format();
        this.currentUserIsInDoubt = Meteor.userId() === foundTask.authorId && foundTask.authorStatus === 'yellow' ||
          Meteor.userId() === foundTask.receiverId && foundTask.receiverStatus === 'yellow';
        this.activityShowed = !this.activityShowed && this.currentUserIsInDoubt || this.activityShowed;
        foundTask.comments.forEach(function(obj) {
          obj.formattedTime = moment(obj.time).format("DD MMM h:mm a");
        });

        var recentStatusChangeActivity = foundTask.activity
          .sort(function(record1, record2) {return ProfileUtils.comparator(record2.time, record1.time);})
          .filter(function(record) {return record.field === 'status' && (record.newValue === 'Done' || record.newValue === 'Cancelled');});
        if (recentStatusChangeActivity.length > 0 && foundTask.status != 'open' && !foundTask.archived
          && this.currentUserIsInDoubt && recentStatusChangeActivity[0].actor !== Meteor.userId()) {
          this.acknowledgeLabel = 'Acknowledge task status change to ' + foundTask.status;
          this.needsToApproveStatusChange = true;
        }

        foundTask.authorPicture = ProfileUtils.picture(id2user[foundTask.authorId]);
        foundTask.receiverPicture = ProfileUtils.picture(id2user[foundTask.receiverId]);
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

  authorStatus(task) {
  	if (!task) {
  		return "";
  	}
		return this.status(task.authorStatus);
  }

  receiverStatus(task) {
		if (!task) {
				return "";
		}
		return this.status(task.receiverStatus);
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

  flipDescriptionEditingStatus(newOne) {
    this.editingDescription = newOne ? newOne : !this.editingDescription;
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

  saveDescription(description) {
    Meteor.call('tasks.updateDescription',
      this.proposalId,
      description,
      ProfileUtils.processMeteorResult);
    this.flipDescriptionEditingStatus();
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
}

ProposalCtrl.$name = 'ProposalCtrl';
ProposalCtrl.$inject = ['$stateParams', '$state'];