import fs from "node:fs";

let code = fs.readFileSync("src/components/admin-panel/GalleryUI.tsx", "utf8");

if (!code.includes("b2Uploader")) {
	code = code.replace(
		`import { uploadFileViaWorker } from '../../utils/uploadManager';`,
		`import { uploadFileViaWorker } from '../../utils/uploadManager';\nimport { uploadFileToB2 } from '../../utils/b2Uploader';`,
	);
}

const oldHandleVideoUpload = `    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetFileName = \`\${Date.now()}_\${safeFileName}\`;
    const storageRef = ref(storage, \`pending_videos/\${targetFileName}\`);
    const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
        customMetadata: {
            videoId: currentVideoId,
            collectionType: 'mandals',
            mandalId: effectiveMandalId,
            targetFileName: targetFileName
        }
    });

    uploadTask.on('state_changed', 
        (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadVideoProgress(progress);
        }, 
        (error) => {
            showToast(\`Video upload failed: \${error.message}\`, "error");
            setUploadingVideo(false);
            setEditingVideo(prev => prev ? { ...prev, url: '' } : null);
        }, 
        async () => {
            const dlUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const mandalRef = doc(db, 'mandals', effectiveMandalId!);
            const snap = await getDoc(mandalRef);
            if (snap.exists()) {
                const data = snap.data();
                const updatedVideos = (data.videos || []).map((v: any) => v.id === currentVideoId ? { ...v, url: dlUrl } : v);
                await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
            }
            showToast("Video uploaded! It will play from our server until Archive.org is ready.", "success");
            setUploadingVideo(false);
        }
    );
    if (videoInputRef.current) videoInputRef.current.value = "";`;

const newHandleVideoUpload = `    try {
        const dlUrl = await uploadFileToB2(file, (progress) => {
            setUploadVideoProgress(progress);
        });
        const mandalRef = doc(db, 'mandals', effectiveMandalId!);
        const snap = await getDoc(mandalRef);
        if (snap.exists()) {
            const data = snap.data();
            const updatedVideos = (data.videos || []).map((v: any) => v.id === currentVideoId ? { ...v, url: dlUrl } : v);
            await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
        }
        showToast("Video uploaded successfully to B2!", "success");
        setUploadingVideo(false);
    } catch (error: any) {
        showToast(\`Video upload failed: \${error.message}\`, "error");
        setUploadingVideo(false);
        setEditingVideo(prev => prev ? { ...prev, url: '' } : null);
    }
    if (videoInputRef.current) videoInputRef.current.value = "";`;

code = code.replace(oldHandleVideoUpload, newHandleVideoUpload);

const oldBulkUpload = `        const storageRef = ref(storage, \`pending_videos/\${item.targetFileName}\`);
        const uploadTask = uploadBytesResumable(storageRef, item.file, {
            contentType: item.file.type,
            customMetadata: { videoId: item.task.id, collectionType: 'mandals', mandalId: effectiveMandalId, targetFileName: item.targetFileName }
        });

        uploadTask.on('state_changed', 
            (snapshot) => setBulkUploadTasks(prev => prev.map(t => t.id === item.task.id ? { ...t, progress: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) } : t)), 
            (error) => setBulkUploadTasks(prev => prev.map(t => t.id === item.task.id ? { ...t, status: 'error', error: error.message } : t)), 
            async () => {
                const dlUrl = await getDownloadURL(uploadTask.snapshot.ref);
                const mandalRef = doc(db, 'mandals', effectiveMandalId!);
                const snap = await getDoc(mandalRef);
                if (snap.exists()) {
                    const data = snap.data();
                    const updatedVideos = (data.videos || []).map((v: any) => v.id === item.task.id ? { ...v, url: dlUrl } : v);
                    await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
                }
                setBulkUploadTasks(prev => prev.map(t => t.id === item.task.id ? { ...t, status: 'completed', progress: 100 } : t));
            }
        );`;

const newBulkUpload = `        try {
            const dlUrl = await uploadFileToB2(item.file, (progress) => {
                setBulkUploadTasks(prev => prev.map(t => t.id === item.task.id ? { ...t, progress } : t));
            });
            const mandalRef = doc(db, 'mandals', effectiveMandalId!);
            const snap = await getDoc(mandalRef);
            if (snap.exists()) {
                const data = snap.data();
                const updatedVideos = (data.videos || []).map((v: any) => v.id === item.task.id ? { ...v, url: dlUrl } : v);
                await setDoc(mandalRef, { videos: updatedVideos }, { merge: true });
            }
            setBulkUploadTasks(prev => prev.map(t => t.id === item.task.id ? { ...t, status: 'completed', progress: 100 } : t));
        } catch (error: any) {
            setBulkUploadTasks(prev => prev.map(t => t.id === item.task.id ? { ...t, status: 'error', error: error.message } : t));
        }`;

code = code.replace(oldBulkUpload, newBulkUpload);

fs.writeFileSync("src/components/admin-panel/GalleryUI.tsx", code);
console.log("Update complete");
