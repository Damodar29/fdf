const admin = require("firebase-admin");
admin.initializeApp();

const token =
	"extAtB-yRuaK4AYokpLjNz:APA91bGx4MH_CxmfPWHBAHeeW7v5dULGOEdfadgGIYXGVqRaqhGF089wS-7CpU3JiMrx0z8SxdSeLHgLNmPn4FIDCX-9iqBG00YcJ5yiNJKCAQ1aoZugfxY";
const liveLink = "https://www.facebook.com/share/v/1HXaPpmMwE/";

const payload = {
	token: token,
	data: {
		title: "🔴 हम लाइव आ चुके हैं!",
		body: "दर्शन और कथा के लिए अभी क्लिक करें",
		action_type: "link",
		target_link: liveLink,
	},
	android: {
		priority: "high",
		notification: {
			title: "🔴 हम लाइव आ चुके हैं!",
			body: "दर्शन और कथा के लिए अभी क्लिक करें",
			color: "#EF4444",
			channelId: "push_notifications_v6",
			sound: "notisound3",
		},
	},
	apns: {
		payload: {
			aps: {
				alert: {
					title: "🔴 हम लाइव आ चुके हैं!",
					body: "दर्शन और कथा के लिए अभी क्लिक करें",
				},
				sound: "notisound3.m4a",
			},
		},
	},
};

admin
	.messaging()
	.send(payload)
	.then((response) => {
		console.log("Successfully sent message:", response);
		process.exit(0);
	})
	.catch((error) => {
		console.log("Error sending message:", error);
		process.exit(1);
	});
