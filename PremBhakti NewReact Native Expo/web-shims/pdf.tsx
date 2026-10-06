// Browser stand-in for react-native-pdf: the browser's own PDF viewer in a frame.
import { forwardRef, useImperativeHandle } from "react";
import { View } from "react-native";

export type PdfRef = { setPage(page: number): void };
type Props = { source?: { uri?: string }; style?: object; onLoadComplete?: (pages: number) => void };

const Pdf = forwardRef<PdfRef, Props>(function Pdf({ source, style }, ref) {
	useImperativeHandle(ref, () => ({ setPage: () => {} }));
	return (
		<View style={style}>
			<iframe title="pdf" src={source?.uri} style={{ border: 0, width: "100%", height: "100%" }} />
		</View>
	);
});
export default Pdf;
