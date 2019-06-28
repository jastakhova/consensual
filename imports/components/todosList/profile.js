var ProfileUtils = {

	createMapFromList: function(objectList, property) {
		var objMap = {};
		objectList.forEach(function(obj) {
			objMap[obj[property]] = obj;
		});
		return objMap;
	},
	pictureSmall: function(user) {
	  return ProfileUtils.picture(user, 30);
	},
	pictureBig: function(user) {
    return ProfileUtils.picture(user, 100);
  },
	picture: function(user, size) {
		if (user && user.services && user.services.facebook && user.services.facebook.id) {
			return 'https://graph.facebook.com/' + user.services.facebook.id + '/picture?width=' + size + '&height=' + size;
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

  showError: function(message) {
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0;
    $('.notification').removeClass("hidden");
    $('#notificationMessage').text(message ? message : "An inner error occurred. We are already working on a fix. Please try to use the service later.");
  },

  processMeteorResult: function(err, res) {
    if (err) {
      ProfileUtils.showError();
      Meteor.call('email.withError', err);
    }
  },

  getName: function(user) {
    return user.username ? user.username : user.profile.name;
  },

  getEmail: function(user) {
    return user.email ? user.email : user.services.facebook.email;
  },

  getSuggest: function(id2user) {
    var suggest = [];
    var suggestSize = 0;
    Object.keys(id2user).forEach(function(key) {
        suggest[suggestSize++] = {id: key, name: ProfileUtils.getName(id2user[key])};
    });

    return function() {
      Meteor.settings.public.contacts = suggest;
      if (Meteor.settings.public.contacts.filter(x => x.id === Meteor.userId()).length === 0) {
        Meteor.settings.public.contacts[Meteor.settings.public.contacts.length] = {id: Meteor.userId(), name:  ProfileUtils.getName(Meteor.user())};
      }
      return suggest;
    }
  },

  foundersFilter: function() {
    return {'profile.name': {$in: ["Julia Astakhova", "Day Waterbury", "All Consensual"]}};
  }
};

export default ProfileUtils;

AccountsTemplates.configure({
    overrideLoginErrors: false,
    sendVerificationEmail: true,
    confirmPassword: false,
    continuousValidation: true,
    negativeValidation: true,
    negativeFeedback: true
});

AccountsTemplates.addField({
    _id: 'name',
    type: 'text',
    required: true,
    minLength: 5,
    displayName: "Name",
    errStr: 'At least 5 symbols',
});