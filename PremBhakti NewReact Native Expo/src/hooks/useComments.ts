import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { doc, getDoc, getFirestore, onSnapshot, setDoc, updateDoc, arrayUnion } from "@react-native-firebase/firestore";

export interface Comment {
	id: string;
	text: string;
	authorName: string;
	authorPhotoURL?: string;
	timestamp: number;
	userId?: string;
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
		const db = getFirestore();
		const commentsRef = doc(db, `comments_${category}`, itemId);
		
		const unsubscribe = onSnapshot(
			commentsRef,
			(snap: any) => {
				if (!isMounted) return;
				if (snap.exists()) {
					const data = snap.data();
					setComments(
						(data?.comments || []).sort(
							(a: Comment, b: Comment) => b.timestamp - a.timestamp,
						),
					);
				} else {
					setComments([]);
				}
				setLoading(false);
			},
			(err: any) => {
				console.error("Failed to fetch comments:", err);
				if (isMounted) setLoading(false);
			},
		);

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [itemId, category]);

	const addComment = useCallback(
		async (
			text: string,
			authorName: string,
			authorPhotoURL?: string,
			userId?: string,
		) => {
			if (Platform.OS === "web") return false; 
			if (!text.trim() || !authorName.trim()) return false;

			const newComment: Comment = {
				id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
				text: text.trim(),
				authorName: authorName.trim(),
				...(authorPhotoURL ? { authorPhotoURL } : {}),
				...(userId ? { userId } : {}),
				timestamp: Date.now(),
			};

			try {
				const db = getFirestore();
				const commentsRef = doc(db, `comments_${category}`, itemId);
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
