import qrcode from "qrcode-generator";
import type React from "react";
import { useMemo } from "react";

interface ProfileQrCodeProps {
	/** Text the code holds — keep it short so the squares stay big. */
	value: string;
	/** Shown in a badge over the middle of the code, one word per line. */
	badge?: string;
	/** Rendered width and height in px. */
	size?: number;
}

// Quiet zone around the code, in modules (the spec asks for 4; 2 scans fine
// on a white card and leaves bigger squares).
const MARGIN = 2;

/**
 * A real, scannable QR code drawn as SVG, generated on the device (works
 * offline). Uses the highest error correction so the badge in the middle
 * doesn't stop it from scanning.
 */
export const ProfileQrCode: React.FC<ProfileQrCodeProps> = ({
	value,
	badge,
	size = 200,
}) => {
	const { count, path } = useMemo(() => {
		const qr = qrcode(0, "H");
		qr.addData(value);
		qr.make();
		const n = qr.getModuleCount();
		let d = "";
		for (let row = 0; row < n; row++) {
			for (let col = 0; col < n; col++) {
				if (qr.isDark(row, col))
					d += `M${col + MARGIN} ${row + MARGIN}h1v1h-1z`;
			}
		}
		return { count: n, path: d };
	}, [value]);

	const total = count + MARGIN * 2;
	// Badge covers under a tenth of the code's area — inside what level-H
	// error correction recovers (a decode test passed at 0.44 × 0.24).
	const badgeW = Math.round(count * 0.42);
	const badgeH = Math.round(count * 0.22);
	const lines = (badge || "").split(" ").filter(Boolean);
	const lineHeight = badgeH / Math.max(lines.length, 1);
	const fontSize = Math.min(lineHeight * 0.8, (badgeW / 6.5) * 1.6);

	return (
		<svg
			viewBox={`0 0 ${total} ${total}`}
			width={size}
			height={size}
			role="img"
			aria-label={`QR: ${value}`}
			shapeRendering="crispEdges"
			className="block"
		>
			<rect width={total} height={total} fill="#ffffff" />
			<path d={path} fill="#0b1320" />
			{badge && (
				<g>
					<rect
						x={(total - badgeW) / 2}
						y={(total - badgeH) / 2}
						width={badgeW}
						height={badgeH}
						rx={1}
						fill="#ffffff"
						stroke="#0b1320"
						strokeWidth={0.35}
						shapeRendering="geometricPrecision"
					/>
					{lines.map((line, i) => (
						<text
							key={line}
							x={total / 2}
							y={(total - badgeH) / 2 + lineHeight * (i + 0.5)}
							textAnchor="middle"
							dominantBaseline="central"
							fontSize={fontSize}
							fontWeight={800}
							fontFamily="Roboto, system-ui, sans-serif"
							fill="#0b1320"
						>
							{line}
						</text>
					))}
				</g>
			)}
		</svg>
	);
};
