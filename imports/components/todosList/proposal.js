import { Controller } from 'angular-ecmascript/module-helpers';
import { Tasks } from '../../api/tasks.js';
import moment from 'moment';

export default class ProposalCtrl extends Controller {
  constructor() {
    super(...arguments);

    this.subscribe('tasks');

    if (Meteor.userId()) {
			this.subscribe('allusers');
		}

    this.proposalId = this.$stateParams.proposalId;

    this.helpers({
      data() {
      	var createMapFromList = function(objectList, property) {
						var objMap = {};
						objectList.forEach(function(obj) {
							objMap[obj[property]] = obj;
						});
						return objMap;
					};

				function picture(id) {
						return 'https://graph.facebook.com/' + id + '/picture?width=500&height=500';
				}

      	var foundTask = Tasks.findOne({_id: this.proposalId});
        if (foundTask) {
        	var id2user = createMapFromList(Meteor.users.find({$or: [{_id: foundTask.authorId}, {_id: foundTask.receiverId}]}).fetch(), "_id");
					foundTask.time = moment(foundTask.createdAt).format("DD MMM h:mm a");
					
					foundTask.authorPicture = picture(id2user[foundTask.authorId].services.facebook.id);
          foundTask.receiverPicture = picture(id2user[foundTask.receiverId].services.facebook.id);
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