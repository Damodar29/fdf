const u1 = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
const u2 = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const u3 = "https://youtu.be/dQw4w9WgXcQ?t=10";
const u4 = "https://youtube.com/shorts/dQw4w9WgXcQ";
const u5 = "https://youtube.com/live/dQw4w9WgXcQ?feature=share";

const newRegex =
	/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|v\/|u\/\w\/|&v=)([a-zA-Z0-9_-]{11})/;

for (const u of [u1, u2, u3, u4, u5]) {
	const match = u.match(newRegex);
	console.log(u, "=>", match ? match[1] : "null");
}
