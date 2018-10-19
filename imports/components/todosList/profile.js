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
};

export default ProfileUtils;