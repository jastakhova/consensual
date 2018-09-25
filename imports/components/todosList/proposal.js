import { Controller } from 'angular-ecmascript/module-helpers';
import { Tasks } from '../../api/tasks.js';
import moment from 'moment';

export default class ProposalCtrl extends Controller {
  constructor() {
    super(...arguments);

    this.subscribe('tasks');
    this.proposalId = this.$stateParams.proposalId;

    this.helpers({
      data() {
      	var foundTask = Tasks.findOne({_id: this.proposalId});
        if (foundTask) {
					foundTask.time = moment(foundTask.createdAt).format("DD MMM h:mm a");
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