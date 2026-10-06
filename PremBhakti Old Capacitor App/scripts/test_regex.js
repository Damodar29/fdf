const urls = [
	"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
	"https://youtu.be/dQw4w9WgXcQ",
	"https://youtube.com/shorts/dQw4w9WgXcQ",
	"https://www.youtube.com/watch?time_continue=2&v=dQw4w9WgXcQ",
];

const regExp1 =
	/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;

for (const u of urls) {
	const match = u.match(regExp1);
	const id = match && match[2].length === 11 ? match[2] : "";
	console.log(`URL: ${u} -> ID: ${id}`);
}
