import { Controller } from 'angular-ecmascript/module-helpers';
import { Tasks } from '../../api/tasks.js';
import moment from 'moment';
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

    this.helpers({
      data() {
		    ProfileUtils.redirectToLogin();

      	var foundTask = Tasks.findOne({_id: this.proposalId});
        if (foundTask) {
        	var users = Meteor.users.find({$or: [{_id: foundTask.authorId}, {_id: foundTask.receiverId}]}).fetch();
        	var id2user = ProfileUtils.createMapFromList(users, "_id");
					foundTask.time = moment(foundTask.createdAt).format("DD MMM h:mm a");
					this.newDate = moment(foundTask.createdAt).format("MM-DD-YYYY");
					this.newTime = moment(foundTask.createdAt).format("h:mm");
          this.currentUserIsInDoubt = Meteor.userId() === foundTask.authorId && foundTask.authorStatus === 'yellow' ||
            Meteor.userId() === foundTask.receiverId && foundTask.receiverStatus === 'yellow';
          this.activityShowed = this.activityShowed === null && this.currentUserIsInDoubt || this.activityShowed;

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

  saveTime() {
    Meteor.call('tasks.updateTime', this.proposalId, this.newDate + ' ' + this.newTime);
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
        default: this.newDate
      };
      var controller = this;
      var timePicker = new DateTimePicker.Date(options, {})
      timePicker.on('selected', function (formatTime, now) {
        controller.newDate = formatTime;
        controller.$scope.$apply();
        timePicker.destroy();
      });
      timePicker.on('cleared', function () {
        controller.$scope.$apply();
      });
    }

  showTimePicker() {
    var options = {
      minuteStep: 10,
      default: (this.newDate + ' ' + this.newTime)
    };
    var controller = this;
    var timePicker = new DateTimePicker.Time(options, {})
    timePicker.on('selected', function (formatTime, now) {
      controller.newTime = formatTime;
      controller.$scope.$apply();
      timePicker.destroy();
    })
    timePicker.on('cleared', function () {
      this.newTime = '';
      controller.$scope.$apply();
    })
  }

  approveTask() {
    Meteor.call('tasks.updateStatuses', this.proposalId, 'green');
  }

  declineTask() {
    Meteor.call('tasks.updateStatuses', this.proposalId, 'red');
  }
}

ProposalCtrl.$name = 'ProposalCtrl';
ProposalCtrl.$inject = ['$stateParams'];