const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

try {
  initializeApp();
} catch (e) {}

async function listAllUsers(nextPageToken) {
  let matchedEmails = [];
  let totalChecked = 0;
  try {
    const listUsersResult = await getAuth().listUsers(1000, nextPageToken);
    
    listUsersResult.users.forEach((userRecord) => {
      totalChecked++;
      const email = userRecord.email;
      if (email) {
        const lowerEmail = email.toLowerCase();
        if (lowerEmail.includes('asa') && lowerEmail.includes('gmail.com')) {
          matchedEmails.push(email);
        }
      }
    });

    if (listUsersResult.pageToken) {
      const more = await listAllUsers(listUsersResult.pageToken);
      matchedEmails = matchedEmails.concat(more.matchedEmails);
      totalChecked += more.totalChecked;
    }
  } catch (error) {
    console.error("Error listing users:", error);
  }
  return { matchedEmails, totalChecked };
}

async function checkFirestore() {
    let matchedEmails = [];
    let totalChecked = 0;
    try {
        const snapshot = await getFirestore().collection('users').get();
        snapshot.forEach(doc => {
            totalChecked++;
            const data = doc.data();
            const email = data.email || data.emailAddress;
            if (email) {
                const lowerEmail = email.toLowerCase();
                if (lowerEmail.includes('asa') && lowerEmail.includes('gmail.com')) {
                    matchedEmails.push(email);
                }
            }
        });
    } catch (e) {
        console.error("Error checking firestore:", e);
    }
    return { matchedEmails, totalChecked };
}

async function run() {
  console.log("Checking Firebase Auth...");
  const authRes = await listAllUsers();
  console.log(`Checked ${authRes.totalChecked} users in Auth.`);
  console.log("Matches in Auth (contains 'asa' and 'gmail.com'):", authRes.matchedEmails);
  
  console.log("\nChecking Firestore 'users' collection...");
  const firestoreRes = await checkFirestore();
  console.log(`Checked ${firestoreRes.totalChecked} docs in Firestore.`);
  console.log("Matches in Firestore (contains 'asa' and 'gmail.com'):", firestoreRes.matchedEmails);
  
  process.exit(0);
}

run();
