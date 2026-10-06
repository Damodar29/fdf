import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, getFirestore } from "firebase/firestore";

const firebaseConfig = {
	apiKey: "AIzaSyBrOtzYCbFZgS0nb1gCWDyIqI23V7NikgY",
	authDomain: "cpbs-admin.firebaseapp.com",
	projectId: "cpbs-admin",
	storageBucket: "cpbs-admin.firebasestorage.app",
	messagingSenderId: "33454825743",
	appId: "1:33454825743:web:aa6a872cf5058b284b9e7a",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
	await signInWithEmailAndPassword(auth, "damodar@cpbs.com", "413541");
	const snap = await getDocs(collection(db, "video_folders"));
	const docs = [];
	snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
	console.log(JSON.stringify(docs, null, 2));
	process.exit(0);
}
run();
