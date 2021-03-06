import { Controller } from 'angular-ecmascript/module-helpers';
import { Tasks } from '../../api/background.js';
import ProfileUtils from './profile.js';
import DateTimePicker from 'date-time-picker';
import { Tracker } from 'meteor/tracker'
import {parse} from 'markdown/lib/index'
import marked from 'marked'
import 'bootstrap-markdown/js/bootstrap-markdown';
import {getCurrentState, getAction, getCondition, getNotice, getRequest} from '../../api/dictionary.js';
import { ReactiveVar } from 'meteor/reactive-var'

export default class ProposalCtrl extends Controller {
  constructor() {
    super(...arguments);

    this.handleTasks = Meteor.subscribe('task', this.$stateParams.proposalId);

    this.subscribe('currentuser');

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
    this.id2ConnectedUser = new ReactiveVar({});
    this.children = new ReactiveVar([]);

    this.helpers({
      data() {
        if (!this.handleTasks.ready()) {
          return {};
        }

        try {
        Meteor.call('tasks.removeNotice', this.proposalId, ProfileUtils.processMeteorResult);

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

        var foundTask = Tasks.findOne({_id: this.proposalId});
        if (!foundTask) {
          this.$state.go('tab.notfound', this.$stateParams, {location: 'replace', reload: true, inherit: false});
          return {};
        }

        foundTask.ETA = moment(foundTask.eta).format(datetimeDisplayFormat);
        this.selectedDate = moment(foundTask.eta).format("MM-DD-YYYY");
        this.selectedTime = moment(foundTask.eta).format("HH:mm");
        this.previousDateTime = moment(foundTask.eta).format();
        foundTask.comments.forEach(function(obj) {
          obj.formattedTime = moment(obj.time).format("DD MMM h:mm a");
        });

        foundTask.activity.forEach(record => record.formattedTime = formatTime(record.time));

        this.prepareChildrenTasks(foundTask, formatTime);

        foundTask.authorPicture = ProfileUtils.pictureBig(this.id2ConnectedUser.get()[foundTask.author.id]);
        foundTask.receiverPicture = ProfileUtils.pictureBig(this.id2ConnectedUser.get()[foundTask.receiver.id]);
        if (foundTask.request) {
          foundTask.request.type = getRequest(foundTask.request.id);
        }

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

  display(value, isDate) {
    return (isDate ? moment(new Date(value)).format(datetimeDisplayFormat) : value);
  }

  logout() {
    Meteor.logout();
  }

  accountPicture() {
    return ProfileUtils.pictureSmall(Meteor.user());
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

  flipChildrenShowingStatus() {
    this.childrenShowed = !this.childrenShowed;
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

  prepareChildrenTasks(foundTask, formatTime) {
    var controller = this;
    if (controller.children.get() && controller.children.get().length == 0) {
      Meteor.call('tasks.getChildren',
        this.proposalId,
        function(err, res) {
          if (!err) {
            var children = res.map(child => {
                child.formattedTime = formatTime(child.eta);
                var receiver = controller.id2ConnectedUser.get()[child.receiver.id];
                child.picture = ProfileUtils.pictureSmall(receiver);
                child.name = ProfileUtils.getName(receiver);
                return child;
              });
            controller.children.set(children.length > 0 ? children : undefined);
          }
          ProfileUtils.processMeteorResult(err, res);
        }
      );
    }
    foundTask.children = controller.children.get();
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
    Meteor.call('tasks.approve',
      this.proposalId,
      ProfileUtils.processMeteorResult);
  }

  markTaskAsDone() {
    Meteor.call('tasks.markAsDone',
      this.proposalId,
      ProfileUtils.processMeteorResult);
  }

  markTaskAsMaybe() {
    Meteor.call('tasks.maybe',
      this.proposalId,
      ProfileUtils.processMeteorResult);
  }

  markTaskAsCancelled(noticeCode) {
    Meteor.call('tasks.cancel',
      this.proposalId,
      getNotice(noticeCode),
      ProfileUtils.processMeteorResult);
  }

  markRequestAsApproved() {
    Meteor.call('tasks.approveRequest',
      this.proposalId,
      ProfileUtils.processMeteorResult);
  }

  markRequestAsDenied() {
    Meteor.call('tasks.denyRequest',
      this.proposalId,
      ProfileUtils.processMeteorResult);
  }

  markTaskAsLocked() {
    Meteor.call('tasks.lock',
      this.proposalId,
      ProfileUtils.processMeteorResult);
  }

  cancelRequest() {
    Meteor.call('tasks.cancelRequest',
      this.proposalId,
      ProfileUtils.processMeteorResult);
  }

  copy() {
    var controller = this;
    Meteor.call('tasks.copy',
      this.proposalId,
      function(err, res) {
        if (!err) {
          controller.$state.go('tab.draft', {'draftId': res});
        }
        ProfileUtils.processMeteorResult(err, res);
      }
    );
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