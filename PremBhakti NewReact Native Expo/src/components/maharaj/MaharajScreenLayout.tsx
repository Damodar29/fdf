import { ArrowLeft, Loader2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore";

import { SideScrollView } from "../../components/SideScrollView";
import { SimpleHtml } from "../../lib/simpleHtml";
import { webGet, webSet } from "../../lib/webStore";
import { useAppTheme } from "../../theme/useAppTheme";
import { cream, gold, ink } from "../../theme/jmColors";
import { toCdnUrl } from "../../lib/cdnUrl";

export interface MaharajScreenLayoutProps {
	/** Title of the screen (e.g. "Guru Maharaj Ji") */
	title: string;
	/** Hero image path/url */
	imageUrl: string;
	/** Firestore document id (e.g. "guru_maharaj") */
	docId: string;
	/** LocalStorage cache key (e.g. "guru_maharaj_cache") */
	cacheKey: string;
	/** Fallback content if fetch fails and no cache exists */
	fallbackContent: string;
	/** Back button handler */
	onBack: () => void;
}

export function MaharajScreenLayout({
	title,
	imageUrl,
	docId,
	cacheKey,
	fallbackContent,
	onBack,
}: MaharajScreenLayoutProps) {
	const theme = useAppTheme();
	const insets = useSafeAreaInsets();
	const dark = theme.isDark;

	const [content, setContent] = useState<string>("");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// 1. Initial Load from Cache
		const cachedData = webGet(cacheKey);
		if (cachedData) {
			setContent(cachedData as string);
			setLoading(false);
		}

		const fetchContent = async () => {
			if (Platform.OS === "web" && !navigator.onLine) {
				setLoading(false);
				return; // Skip fetching if offline
			}
			try {
				const docRef = doc(getFirestore(), "app_config", docId);
				const docSnap = await getDoc(docRef);
				if (docSnap.exists()) {
					const data = docSnap.data();
					if (data?.content) {
						const freshContent = data.content;
						setContent(freshContent);
						webSet(cacheKey, freshContent);
					}
				}
			} catch (error) {
				console.error(`Error fetching ${docId} content:`, error);
			} finally {
				setLoading(false);
			}
		};
		fetchContent();
	}, [docId, cacheKey]);

	return (
		<View style={[{ flex: 1 }, { backgroundColor: dark ? ink[900] : cream[50] }]}>
			{/* Background Pattern */}
			<View style={StyleSheet.absoluteFill} pointerEvents="none">
				<View style={[StyleSheet.absoluteFill, { opacity: 0.1 }]}>
					<Svg width="100%" height="100%" viewBox="0 0 60 60" style={StyleSheet.absoluteFill}>
						<Defs>
							<Pattern id="bgPattern" patternUnits="userSpaceOnUse" width="60" height="60">
								<Path fill="#d97706" d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z" />
							</Pattern>
						</Defs>
						<Rect width="100%" height="100%" fill="url(#bgPattern)" />
					</Svg>
				</View>
			</View>

			{/* Header (matches OG bg-gradient-to-r from-saffron-500 to-orange-500) */}
			<View
				style={StyleSheet.create({
					header: {
						flexDirection: "row",
						alignItems: "center",
						paddingHorizontal: 16,
						paddingBottom: 16,
						paddingTop: 16 + insets.top,
						backgroundColor: "#f97316", // Tailwind orange-500 approx (saffron-500 to orange-500 gradient simulation)
						borderBottomWidth: 2,
						borderBottomColor: "rgba(212, 160, 23, 0.4)", // ry-gold/40
						borderBottomLeftRadius: 24,
						borderBottomRightRadius: 24,
						shadowColor: "#000",
						shadowOffset: { width: 0, height: 4 },
						shadowOpacity: 0.15,
						shadowRadius: 8,
						elevation: 8,
						zIndex: 10,
					},
				}).header}
			>
				<Pressable
					onPress={onBack}
					style={({ pressed }) => [
						{
							padding: 8,
							marginRight: 12,
							borderRadius: 9999,
						},
						pressed && { backgroundColor: "rgba(255, 255, 255, 0.2)" },
					]}
					accessibilityRole="button"
					accessibilityLabel="Go back"
				>
					<ArrowLeft size={24} color={cream[25]} />
				</Pressable>
				<Text
					style={{
						color: cream[25],
						fontFamily: "serif",
						fontSize: 20,
						fontWeight: "600",
						letterSpacing: 0.5,
					}}
					numberOfLines={1}
				>
					{title}
				</Text>
			</View>

			<SideScrollView
				contentContainerStyle={{
					padding: 16,
					paddingBottom: 80 + insets.bottom,
					maxWidth: 768,
					alignSelf: "center",
					width: "100%",
				}}
				showsVerticalScrollIndicator={false}
			>
				{/* Hero Image */}
				<View
					style={{
						width: "100%",
						aspectRatio: 16 / 9,
						backgroundColor: dark ? ink[800] : ink[200],
						borderRadius: 16,
						overflow: "hidden",
						marginBottom: 24,
						borderWidth: 1,
						borderColor: dark ? ink[700] : ink[100],
						shadowColor: "#000",
						shadowOffset: { width: 0, height: 4 },
						shadowOpacity: 0.1,
						shadowRadius: 12,
						elevation: 6,
					}}
				>
					<Image
						source={{ uri: toCdnUrl(imageUrl) }}
						style={StyleSheet.absoluteFill}
						contentFit="cover"
						accessibilityLabel={title}
					/>
				</View>

				{/* Biography Section */}
				<View>
					{loading ? (
						<View style={{ paddingVertical: 48, alignItems: "center", justifyContent: "center" }}>
							<Loader2 size={32} color={gold[500]} style={{ opacity: 0.8 }} />
						</View>
					) : (
						<SimpleHtml html={content || fallbackContent} isDark={dark} />
					)}
				</View>
			</SideScrollView>
		</View>
	);
}
