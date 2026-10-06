import React, { createContext, useCallback, useContext, useState } from "react";
import { Toast, type ToastType } from "../components/Toast";

interface ToastContextType {
	showToast: (message: string, type?: ToastType) => void;
	hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let globalToastEmitter: ((message: string, type?: ToastType) => void) | null =
	null;
let globalToastHider: (() => void) | null = null;

export const showGlobalToast = (message: string, type: ToastType = "info") => {
	if (globalToastEmitter) {
		globalToastEmitter(message, type);
	} else {
		console.log(`[Toast] ${type}: ${message}`);
	}
};

export const hideGlobalToast = () => {
	if (globalToastHider) {
		globalToastHider();
	}
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [toast, setToast] = useState<{
		message: string;
		type: ToastType;
	} | null>(null);

	const showToast = useCallback((message: string, type: ToastType = "info") => {
		setToast({ message, type });
	}, []);

	const hideToast = useCallback(() => {
		setToast(null);
	}, []);

	React.useEffect(() => {
		globalToastEmitter = showToast;
		globalToastHider = hideToast;
		return () => {
			globalToastEmitter = null;
			globalToastHider = null;
		};
	}, [showToast, hideToast]);

	return (
		<ToastContext.Provider value={{ showToast, hideToast }}>
			{children}
			{toast && (
				<Toast
					message={toast.message}
					type={toast.type}
					onClose={() => setToast(null)}
				/>
			)}
		</ToastContext.Provider>
	);
};

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) throw new Error("useToast must be used within ToastProvider");
	return context;
};
