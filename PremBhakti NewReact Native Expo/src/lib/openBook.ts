import type { RootNavigation } from "../navigation/types";
import { openInPdfApp, useBookStore } from "../store/bookStore";
import { addToHistory } from "../store/historyStore";
import { useSettingsStore } from "../store/settingsStore";
import { showToast } from "../store/toastStore";
import type { Book } from "../types";
import { triggerHaptic } from "./haptics";

/**
 * App.tsx handleOpenBook on Android, for places that open a book directly
 * (History): a book must be downloaded first; it opens in the phone's PDF app,
 * or in the in-app reader when there is none.
 */
export async function openBook(book: Book, navigation: RootNavigation) {
	triggerHaptic("medium");
	const isHindi = useSettingsStore.getState().settingsLanguage === "hi";
	if (!book.url) {
		showToast(isHindi ? "पुस्तक अभी उपलब्ध नहीं है।" : "Book is not available right now.");
		return;
	}
	if (!useBookStore.getState().downloaded[book.id]) {
		showToast(isHindi ? "पढ़ने के लिए पहले किताब डाउनलोड करें।" : "Download this book first to read it.", "info");
		return;
	}
	const result = await openInPdfApp(book.id);
	if (result === "not_found") {
		showToast(
			isHindi ? "किताब की फ़ाइल नहीं मिली, कृपया फिर से डाउनलोड करें।" : "Book file not found. Please download it again.",
			"error",
		);
		return;
	}
	// "no_viewer": the in-app reader, which records the history entry itself.
	if (result === "opened") addToHistory(book.id, "book");
	else navigation.navigate("BookViewer", { book });
}
