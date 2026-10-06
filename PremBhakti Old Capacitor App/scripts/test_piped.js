const https = require("node:https");

https
	.get("https://pipedapi.kavin.rocks/streams/dQw4w9WgXcQ", (res) => {
		let data = "";
		res.on("data", (chunk) => (data += chunk));
		res.on("end", () => {
			try {
				const parsed = JSON.parse(data);
				console.log(
					parsed.videoStreams
						? `Streams found: ${parsed.videoStreams.length}`
						: "No streams",
				);
				if (parsed.videoStreams && parsed.videoStreams.length > 0) {
					console.log(
						"First stream URL:",
						`${parsed.videoStreams[0].url.substring(0, 50)}...`,
					);
				}
			} catch (e) {
				console.error("Error parsing JSON", e);
			}
		});
	})
	.on("error", (e) => console.error(e));
