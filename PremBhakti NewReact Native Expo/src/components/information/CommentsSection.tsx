import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Image } from "react-native";
import { MessageSquare, Send, User } from "lucide-react-native";
import { useAuthStore } from "../../store/authStore";
import { useProfileStore } from "../../store/profileStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useComments } from "../../hooks/useComments";
import { useNavigation } from "@react-navigation/native";
import type { RootNavigation } from "../../navigation/types";
import { useAppTheme } from "../../theme/useAppTheme";

// Utility for formatting time
const formatTime = (ts: number, isHindi: boolean) => {
	const date = new Date(ts);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return isHindi ? "अभी-अभी" : "Just now";
	if (diffMins < 60) return isHindi ? `${diffMins} मिनट पहले` : `${diffMins}m ago`;
	if (diffHours < 24) return isHindi ? `${diffHours} घंटे पहले` : `${diffHours}h ago`;
	if (diffDays < 7) return isHindi ? `${diffDays} दिन पहले` : `${diffDays}d ago`;
	return date.toLocaleDateString(isHindi ? "hi-IN" : "en-US", {
		day: "numeric",
		month: "short",
	});
};

interface CommentsSectionProps {
	itemId: string;
	category: "darshan" | "activities" | "videos" | "information";
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({ itemId, category }) => {
	const theme = useAppTheme();
	const navigation = useNavigation<RootNavigation>();
	const { settingsLanguage } = useSettingsStore();
	const isHindi = settingsLanguage === "hi";
	const { user } = useAuthStore();
	const { profile } = useProfileStore();
	const { comments, loading, addComment } = useComments(itemId, category);

	const [text, setText] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const canComment = user && profile?.isApproved;
	const profileStarted = profile !== null && profile?.realName; // Approximate "hasStartedProfile"

	const handleSubmit = async () => {
		if (!text.trim() || !user) return;

		const authorName = profile?.realName || user.displayName || "Devotee";
		const authorPhotoURL = profile?.photoURL;

		setIsSubmitting(true);
		const success = await addComment(text, authorName, authorPhotoURL, user.uid);
		if (success) {
			setText("");
		}
		setIsSubmitting(false);
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
			{/* Header */}
			<View style={[styles.header, { backgroundColor: theme.page, borderBottomColor: theme.border }]}>
				<MessageSquare size={16} color={theme.accent} />
				<Text style={[styles.title, { color: theme.text }]}>
					{category === "information"
						? isHindi ? "प्रश्न" : "Questions"
						: isHindi ? "टिप्पणियाँ" : "Comments"}
				</Text>
				{!loading && (
					<View style={[styles.badge, { backgroundColor: theme.surface }]}>
						<Text style={[styles.badgeText, { color: theme.text }]}>{comments.length}</Text>
					</View>
				)}
			</View>

			{/* Input Area */}
			<View style={[styles.inputContainer, { borderBottomColor: theme.border }]}>
				{!canComment ? (
					<View style={styles.authPrompt}>
						<Text style={[styles.authText, { color: theme.textMuted }]}>
							{!user
								? category === "information"
									? isHindi ? "प्रश्न पूछने के लिए कृपया लॉगिन करें" : "Please sign in to ask a question"
									: isHindi ? "टिप्पणी करने के लिए कृपया लॉगिन करें" : "Please sign in to comment"
								: !profileStarted
									? category === "information"
										? isHindi ? "प्रश्न पूछने के लिए प्रोफाइल बनाएं" : "Create your profile to ask a question"
										: isHindi ? "टिप्पणी करने के लिए प्रोफाइल बनाएं" : "Create your profile to comment"
									: category === "information"
										? isHindi ? "प्रोफाइल मंज़ूरी के बाद प्रश्न पूछ सकते हैं" : "Profile approval required to ask a question"
										: isHindi ? "प्रोफाइल मंज़ूरी के बाद टिप्पणी कर सकते हैं" : "Profile approval required to comment"}
						</Text>
						{!user ? (
							<Pressable
								style={({ pressed }) => [styles.authBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}
								onPress={() => navigation.navigate("Login")}
							>
								<User size={15} color="#fff" />
								<Text style={styles.authBtnText}>{isHindi ? "लॉगिन करें" : "Sign In"}</Text>
							</Pressable>
						) : !profileStarted ? (
							<Pressable
								style={({ pressed }) => [styles.authBtn, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}
								onPress={() => navigation.navigate("Web", { target: "profile" as any })}
							>
								<User size={15} color="#fff" />
								<Text style={styles.authBtnText}>{isHindi ? "प्रोफाइल बनाएं" : "Create Profile"}</Text>
							</Pressable>
						) : null}
					</View>
				) : (
					<View style={styles.inputRow}>
						<View style={[styles.avatar, { borderColor: theme.border }]}>
							{profile?.photoURL ? (
								<Image source={{ uri: profile.photoURL }} style={styles.avatarImg} />
							) : (
								<View style={[styles.avatarFallback, { backgroundColor: theme.accent }]}>
									<Text style={styles.avatarInitial}>
										{(profile?.realName || user?.displayName || "D").charAt(0).toUpperCase()}
									</Text>
								</View>
							)}
						</View>
						<View style={[styles.textInputWrapper, { backgroundColor: theme.page }]}>
							<TextInput
								value={text}
								onChangeText={setText}
								placeholder={category === "information"
									? (isHindi ? "प्रश्न पूछें..." : "Ask a question...")
									: (isHindi ? "एक टिप्पणी लिखें..." : "Write a comment...")
								}
								placeholderTextColor={theme.textMuted}
								style={[styles.textInput, { color: theme.text }]}
								multiline
								maxLength={500}
							/>
						</View>
						<Pressable
							style={({ pressed }) => [
								styles.sendBtn,
								{
									backgroundColor: !text.trim() || isSubmitting ? theme.border : theme.accent,
									opacity: pressed ? 0.8 : 1,
								}
							]}
							onPress={handleSubmit}
							disabled={!text.trim() || isSubmitting}
						>
							{isSubmitting ? (
								<ActivityIndicator size="small" color="#fff" />
							) : (
								<Send size={16} color="#fff" />
							)}
						</Pressable>
					</View>
				)}
			</View>

			{/* Comments List */}
			<View style={styles.list}>
				{loading ? (
					<View style={styles.center}>
						<ActivityIndicator color={theme.accent} />
						<Text style={[styles.centerText, { color: theme.textMuted, marginTop: 8 }]}>
							{isHindi ? "लोड हो रहा है..." : "Loading..."}
						</Text>
					</View>
				) : comments.length === 0 ? (
					<View style={styles.center}>
						<MessageSquare size={32} color={theme.textMuted} style={{ opacity: 0.5, marginBottom: 8 }} />
						<Text style={[styles.centerText, { color: theme.textMuted, fontWeight: "500" }]}>
							{category === "information"
								? isHindi ? "कोई प्रश्न नहीं" : "No questions yet"
								: isHindi ? "कोई टिप्पणी नहीं" : "No comments yet"}
						</Text>
						<Text style={[styles.centerText, { color: theme.textMuted, fontSize: 12, marginTop: 2 }]}>
							{category === "information"
								? isHindi ? "पहला प्रश्न पूछें!" : "Be the first to ask!"
								: isHindi ? "पहली टिप्पणी लिखें!" : "Be the first to comment!"}
						</Text>
					</View>
				) : (
					comments.map((comment) => (
						<View key={comment.id} style={styles.commentItem}>
							<View style={[styles.avatarSmall, { borderColor: theme.border }]}>
								{comment.authorPhotoURL ? (
									<Image source={{ uri: comment.authorPhotoURL }} style={styles.avatarImg} />
								) : (
									<View style={[styles.avatarFallback, { backgroundColor: theme.accent }]}>
										<Text style={styles.avatarInitial}>
											{comment.authorName.charAt(0).toUpperCase()}
										</Text>
									</View>
								)}
							</View>
							<View style={styles.commentBody}>
								<View style={styles.commentHeader}>
									<Text style={[styles.commentAuthor, { color: theme.text }]}>{comment.authorName}</Text>
									<Text style={[styles.commentTime, { color: theme.textMuted }]}>{formatTime(comment.timestamp, isHindi)}</Text>
								</View>
								<Text style={[styles.commentText, { color: theme.text }]}>{comment.text}</Text>
							</View>
						</View>
					))
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginTop: 16,
		borderRadius: 16,
		borderWidth: 1,
		overflow: "hidden",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
	},
	title: {
		fontWeight: "bold",
		fontSize: 14,
		marginLeft: 8,
	},
	badge: {
		marginLeft: "auto",
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 12,
	},
	badgeText: {
		fontSize: 12,
		fontWeight: "600",
	},
	inputContainer: {
		padding: 12,
		borderBottomWidth: 1,
	},
	authPrompt: {
		alignItems: "center",
		paddingVertical: 8,
	},
	authText: {
		fontSize: 12,
		textAlign: "center",
		marginBottom: 12,
	},
	authBtn: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 12,
		gap: 8,
	},
	authBtnText: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "bold",
	},
	inputRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: 8,
	},
	avatar: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		overflow: "hidden",
	},
	avatarSmall: {
		width: 32,
		height: 32,
		borderRadius: 16,
		borderWidth: 1,
		overflow: "hidden",
		marginTop: 2,
	},
	avatarImg: {
		width: "100%",
		height: "100%",
	},
	avatarFallback: {
		width: "100%",
		height: "100%",
		alignItems: "center",
		justifyContent: "center",
	},
	avatarInitial: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "bold",
	},
	textInputWrapper: {
		flex: 1,
		borderRadius: 16,
		paddingHorizontal: 12,
		paddingVertical: 8,
		minHeight: 40,
		maxHeight: 100,
	},
	textInput: {
		fontSize: 14,
		padding: 0,
		margin: 0,
	},
	sendBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	list: {
		minHeight: 100,
		paddingVertical: 8,
	},
	center: {
		padding: 32,
		alignItems: "center",
		justifyContent: "center",
	},
	centerText: {
		fontSize: 14,
		textAlign: "center",
	},
	commentItem: {
		flexDirection: "row",
		paddingHorizontal: 16,
		paddingVertical: 12,
		gap: 12,
	},
	commentBody: {
		flex: 1,
	},
	commentHeader: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 8,
		marginBottom: 4,
	},
	commentAuthor: {
		fontSize: 13,
		fontWeight: "bold",
	},
	commentTime: {
		fontSize: 10,
	},
	commentText: {
		fontSize: 14,
		lineHeight: 20,
	},
});
