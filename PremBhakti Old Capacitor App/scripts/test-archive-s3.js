import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const accessKeyId = process.env.IA_ACCESS_KEY;
const secretAccessKey = process.env.IA_SECRET_KEY;

if (!accessKeyId || !secretAccessKey) {
	console.error(
		"Missing Internet Archive credentials in .env file (IA_ACCESS_KEY and IA_SECRET_KEY).",
	);
	process.exit(1);
}

// Internet Archive S3 endpoint is s3.us.archive.org
const s3 = new S3Client({
	endpoint: "https://s3.us.archive.org",
	region: "us-east-1", // Required by AWS SDK, but ignored by Internet Archive
	credentials: {
		accessKeyId,
		secretAccessKey,
	},
});

async function runTest() {
	try {
		console.log("Connecting to Internet Archive S3 API...");

		// Example: List your available "buckets" (which correspond to your Internet Archive items)
		const listResult = await s3.send(new ListBucketsCommand({}));
		console.log("Successfully connected!");
		console.log(`You have ${listResult.Buckets?.length || 0} items (buckets).`);

		if (listResult.Buckets && listResult.Buckets.length > 0) {
			console.log("First few items:");
			listResult.Buckets.slice(0, 5).forEach((bucket) => {
				console.log(` - ${bucket.Name}`);
			});
		}

		// Example of how you would upload a file (commented out):
		/*
    const uploadResult = await s3.send(new PutObjectCommand({
      Bucket: "your-archive-item-identifier", // Must be an item you own and have permissions for
      Key: "test-file.txt",
      Body: "Hello from our app backend!",
    }));
    console.log("Upload result:", uploadResult);
    */
	} catch (error) {
		console.error("Error connecting to Internet Archive:", error);
	}
}

runTest();
