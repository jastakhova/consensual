import { Controller } from 'angular-ecmascript/module-helpers';
import { Tasks } from '../../api/tasks.js';
import moment from 'moment';
import ProfileUtils from './profile.js';

export default class ProposalCtrl extends Controller {
  constructor() {
    super(...arguments);

    this.subscribe('tasks');

    if (Meteor.userId()) {
			this.subscribe('alltaskpartners');
		}

    this.proposalId = this.$stateParams.proposalId;

    this.helpers({
      data() {
      	var foundTask = Tasks.findOne({_id: this.proposalId});
        if (foundTask) {
        	var users = Meteor.users.find({$or: [{_id: foundTask.authorId}, {_id: foundTask.receiverId}]}).fetch();
        	var id2user = ProfileUtils.createMapFromList(users, "_id");
					foundTask.time = moment(foundTask.createdAt).format("DD MMM h:mm a");
					
					foundTask.authorPicture = ProfileUtils.picture(id2user[foundTask.authorId]);
          foundTask.receiverPicture = ProfileUtils.picture(id2user[foundTask.receiverId]);
					return foundTask;
				} else {
					return foundTask;
				}
      }
    });
  }

  status(statusColor) {
  	if (statusColor === 'green') {
  		return "approves";
  	}
  	if (statusColor === 'green') {
			return "disagrees";
		}
		return "is indecisive"
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
}

ProposalCtrl.$name = 'ProposalCtrl';
ProposalCtrl.$inject = ['$stateParams'];