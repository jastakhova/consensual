import { Controller } from 'angular-ecmascript/module-helpers';
import { Tasks } from '../../api/tasks.js';
import ProfileUtils from './profile.js';
import DateTimePicker from 'date-time-picker';
import { Tracker } from 'meteor/tracker'

export default class ProposalCtrl extends Controller {
  constructor() {
    super(...arguments);

    this.subscribe('tasks');

    if (Meteor.userId()) {
			this.subscribe('alltaskpartners');
		}

    this.proposalId = this.$stateParams.proposalId;
    this.editingTime = false;
    this.editingLocation = false;
    this.editingDescription = false;
    this.currentUser = Meteor.userId();
    this.currentUserIsInDoubt = false;
    this.commentsShowed = true;
    this.comment = '';

    this.helpers({
      data() {
      	var foundTask = Tasks.findOne({_id: this.proposalId});
        if (foundTask) {
        	var users = Meteor.users.find({$or: [{_id: foundTask.authorId}, {_id: foundTask.receiverId}]}).fetch();
        	var id2user = ProfileUtils.createMapFromList(users, "_id");
					foundTask.ETA = moment(foundTask.createdAt).format(datetimeDisplayFormat);
					this.selectedDate = moment(foundTask.createdAt).format("MM-DD-YYYY");
					this.selectedTime = moment(foundTask.createdAt).format("HH:mm");
					this.previousDateTime = moment(foundTask.createdAt).format();
          this.currentUserIsInDoubt = Meteor.userId() === foundTask.authorId && foundTask.authorStatus === 'yellow' ||
            Meteor.userId() === foundTask.receiverId && foundTask.receiverStatus === 'yellow';
          this.activityShowed = this.activityShowed === null && this.currentUserIsInDoubt || this.activityShowed;
          foundTask.comments.forEach(function(obj) {
            obj.formattedTime = moment(obj.time).format("DD MMM h:mm a");
          });

					foundTask.authorPicture = ProfileUtils.picture(id2user[foundTask.authorId]);
          foundTask.receiverPicture = ProfileUtils.picture(id2user[foundTask.receiverId]);
					return foundTask;
				} else {
				  // TODO: show error message
					return foundTask;
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
  	if (statusColor === 'red') {
			return "declines";
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

	flipTimeEditingStatus() {
    this.editingTime = !this.editingTime;
  }

  flipLocationEditingStatus() {
    this.editingLocation = !this.editingLocation;
  }

  flipDescriptionEditingStatus() {
    this.editingDescription = !this.editingDescription;
  }

  flipActivityShowingStatus() {
    this.activityShowed = !this.activityShowed;
  }

  flipCommentsShowingStatus() {
    this.commentsShowed = !this.commentsShowed;
  }

  saveTime() {
    this.newDateTime = moment.utc(new Date(this.selectedDate + ' ' + this.selectedTime)).format();
    Meteor.call('tasks.updateTime', this.proposalId, moment.utc(this.previousDateTime).format(), this.newDateTime);
    this.flipTimeEditingStatus();
  }

  saveLocation(location) {
    Meteor.call('tasks.updateLocation', this.proposalId, location);
    this.flipLocationEditingStatus();
  }

  saveDescription(description) {
    Meteor.call('tasks.updateDescription', this.proposalId, description);
    this.flipDescriptionEditingStatus();
  }

  showDatePicker() {
      var options = {
        format: 'MM-dd-yyyy',
        default: this.previousDateTime
      };
      var controller = this;
      var datePicker = new DateTimePicker.Date(options, {})
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
    Meteor.call('tasks.updateStatuses', this.proposalId, 'green');
  }

  declineTask() {
    Meteor.call('tasks.updateStatuses', this.proposalId, 'red');
  }

  addComment() {
    Meteor.call('tasks.addComment', this.proposalId, this.comment);
    this.comment = '';
  }
}

ProposalCtrl.$name = 'ProposalCtrl';
ProposalCtrl.$inject = ['$stateParams'];