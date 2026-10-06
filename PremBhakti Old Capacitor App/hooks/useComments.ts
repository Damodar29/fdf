import {
	arrayUnion,
	doc,
	getDoc,
	onSnapshot,
	setDoc,
	updateDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { profileDb as db } from "../services/firebase";
import { iosOnSnapshotDoc, shouldUseRestFallback } from "../utils/firebaseRest";

export interface Comment {
	id: string;
	text: string;
	authorName: string;
	authorPhotoURL?: string;
	timestamp: number;
	userId?: string; // Firebase Auth UID — used for ownership checks in Firestore rules
}

export const useComments = (
	itemId: string,
	category: "darshan" | "activities" | "videos" | "information",
) => {
	const [comments, setComments] = useState<Comment[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!itemId) return;

		let isMounted = true;
		let unsubscribe: (() => void) | undefined;
		const docPath = `comments_${category}/${itemId}`;

		const handleSnapshot = (snap: any) => {
			if (!isMounted) return;
			if (snap.exists()) {
				const data = snap.data();
				setComments(
					(data.comments || []).sort(
						(a: Comment, b: Comment) => b.timestamp - a.timestamp,
					),
				);
			} else {
				setComments([]);
			}
			setLoading(false);
		};

		if (shouldUseRestFallback()) {
			unsubscribe = iosOnSnapshotDoc(docPath, handleSnapshot, (err) => {
				console.error("Failed to fetch comments (iOS REST):", err);
				if (isMounted) setLoading(false);
			});
		} else {
			const commentsRef = doc(db, `comments_${category}`, itemId);
			unsubscribe = onSnapshot(commentsRef, handleSnapshot, (err) => {
				console.error("Failed to fetch comments:", err);
				if (isMounted) setLoading(false);
			});
		}

		return () => {
			isMounted = false;
			if (unsubscribe) unsubscribe();
		};
	}, [itemId, category]);

	const addComment = useCallback(
		async (
			text: string,
			authorName: string,
			authorPhotoURL?: string,
			userId?: string,
		) => {
			if (!text.trim() || !authorName.trim()) return;

			const newComment: Comment = {
				id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
				text: text.trim(),
				authorName: authorName.trim(),
				...(authorPhotoURL ? { authorPhotoURL } : {}),
				...(userId ? { userId } : {}), // Save userId for ownership enforcement in Firestore rules
				timestamp: Date.now(),
			};

			const commentsRef = doc(db, `comments_${category}`, itemId);
			try {
				// Check if document exists first, since arrayUnion fails if the document doesn't exist
				const docSnap = await getDoc(commentsRef);
				if (docSnap.exists()) {
					await updateDoc(commentsRef, {
						comments: arrayUnion(newComment),
					});
				} else {
					await setDoc(commentsRef, {
						comments: [newComment],
					});
				}
				return true;
			} catch (err) {
				console.error("Failed to add comment", err);
				return false;
			}
		},
		[itemId, category],
	);

	return { comments, loading, addComment };
};
