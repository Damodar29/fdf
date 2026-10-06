import { CheckCircle2 } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

interface SuccessAnimationProps {
	isHindi: boolean;
	onDone: () => void;
}

export const SuccessAnimation: React.FC<SuccessAnimationProps> = ({
	isHindi,
	onDone,
}) => {
	const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");

	useEffect(() => {
		const t1 = setTimeout(() => setPhase("visible"), 50);
		const t2 = setTimeout(() => setPhase("exit"), 1800);
		const t3 = setTimeout(onDone, 2200);
		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
		};
	}, [onDone]);

	return (
		<div
			className={`fixed inset-0 z-[500] flex flex-col items-center justify-center bg-white/90 dark:bg-ink-900/90 backdrop-blur-md transition-opacity duration-400 ${phase === "exit" ? "opacity-0" : "opacity-100"}`}
		>
			{/* Confetti particles */}
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				{Array.from({ length: 30 }).map((_, i) => {
					const left = Math.random() * 100;
					const delay = Math.random() * 0.6;
					const duration = 1.5 + Math.random() * 1.5;
					const size = 4 + Math.random() * 8;
					const colors = [
						"#ec4899",
						"#f59e0b",
						"#10b981",
						"#3b82f6",
						"#8b5cf6",
						"#ef4444",
						"#D4AF37",
					];
					const color = colors[i % colors.length];
					const rotation = Math.random() * 360;
					return (
						<div
							key={i}
							className="absolute animate-fade-in-up"
							style={{
								left: `${left}%`,
								top: "-10px",
								width: `${size}px`,
								height: `${size}px`,
								backgroundColor: color,
								borderRadius: Math.random() > 0.5 ? "50%" : "2px",
								animation: `confettiFall ${duration}s ease-in ${delay}s forwards`,
								transform: `rotate(${rotation}deg)`,
								opacity: phase === "enter" ? 0 : 1,
							}}
						/>
					);
				})}
			</div>

			{/* Checkmark */}
			<div
				className={`transition-all duration-500 ${phase === "visible" ? "scale-100 opacity-100" : phase === "enter" ? "scale-50 opacity-0" : "scale-110 opacity-0"}`}
			>
				<div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-4">
					<CheckCircle2 size={48} className="text-white" strokeWidth={2.5} />
				</div>
			</div>
			<p
				className={`text-xl font-bold text-slate-800 dark:text-white transition-all duration-500 delay-200 ${phase === "visible" ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
			>
				{isHindi ? "प्रोफाइल सहेजी गई! ✅" : "Profile Saved! ✅"}
			</p>
			<p
				className={`text-sm text-slate-500 dark:text-slate-400 mt-1 transition-all duration-500 delay-300 ${phase === "visible" ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
			>
				{isHindi ? "राधेश्याम 🙏" : "Radheshyam 🙏"}
			</p>

			{/* Confetti keyframes injected inline */}
			<style>{`
                @keyframes confettiFall {
                    0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
            `}</style>
		</div>
	);
};
