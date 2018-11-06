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

  getLatestActivityTime: function(task) {
    if (task.activity.length === 0) {
      return null;
    }
    return task.activity.sort(function(x, y) {return ProfileUtils.comparator(y.time, x.time);})[0].time;
  },

  showError(message) {
    $('.notification').removeClass("hidden");
    $('#notificationMessage').text(message ? message : "An inner error occurred. We are already working on a fix. Please try to use the service later.");
  }
};

export default ProfileUtils;