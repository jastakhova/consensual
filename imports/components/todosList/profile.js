var ProfileUtils = {

	createMapFromList: function(objectList, property) {
		var objMap = {};
		objectList.forEach(function(obj) {
			objMap[obj[property]] = obj;
		});
		return objMap;
	},
	picture: function(user) {
		if (user && user.services && user.services.facebook && user.services.facebook.id) {
			return 'https://graph.facebook.com/' + user.services.facebook.id + '/picture?width=500&height=500';
		} else {
			return 'assets/img/default-avatar.png';
		}
	},

	comparator: function(a, b) {
    let comparison = 0;

    if (a > b) {
      comparison = 1;
    } else if (b > a) {
      comparison = -1;
    }

    return comparison;
  },

  getLatestActivityTime: function(task, by) {
    if (task.activity.length === 0) {
      return null;
    }
    var result = task.activity
       .filter(record => !by || record.actor === by)
       .sort(function(x, y) {return ProfileUtils.comparator(y.time, x.time);});
    return result.length > 0 ? result[0].time : -1;
  },

  showError(message) {
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0;
    $('.notification').removeClass("hidden");
    $('#notificationMessage').text(message ? message : "An inner error occurred. We are already working on a fix. Please try to use the service later.");
  },

  processMeteorResult(err, res) {
    if (err) {
      ProfileUtils.showError();
      Meteor.call('email.withError', err);
    }
  },

  getName(user) {
    return user.username ? user.username : user.profile.name;
  },

  getEmail(user) {
    return user.email ? user.email : user.services.facebook.email;
  }
};

export default ProfileUtils;