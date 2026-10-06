okimport { initializeApp } from 'firebase/app'; 

import { collection, getDocs, getFirestore } from 'firebase/firestore'; 

const app = initializeApp({ apiKey: 'AIzaSyBrOtzYCbFZgS0nb1gCWDyIqI23V7NikgY', authDomain: 'cpbs-admin.firebaseapp.com', projectId: 'cpbs-admin' }); 
const db = getFirestore(app); 
async function run() { 
    const qs = await getDocs(collection(db, 'videos')); 
    const fileToTitles = {}; 
    qs.forEach(d => { 
        const v = d.data(); 
        let decodedFileName = decodeURIComponent(v.url.split('/').pop().split('?')[0]); 
        if (!decodedFileName.match(/\.(mp4|m4v|mov)$/i)) decodedFileName += '.mp4'; 
        const safeFileName = decodedFileName.replace(/\s+/g, '-').replace(/[/\\?%*:|"<>]/g, '-'); 
        
        if (!fileToTitles[safeFileName]) {
            fileToTitles[safeFileName] = [];
        }
        fileToTitles[safeFileName].push(v.title);
    }); 
    
    Object.entries(fileToTitles).filter(([_k,v]) => v.length > 1).forEach(([k,v]) => {
        console.log(`Duplicate Filename: ${k}`);
        console.log(`Used by videos: \n - ${v.join('\n - ')}\n`);
    }); 
    process.exit(0); 
} 
run();
