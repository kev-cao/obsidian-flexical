import { ButtonHTMLAttributes, useEffect, useRef } from "react";
import { setIcon } from "obsidian";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	iconId: string;       // Native Obsidian/Lucide icon ID (e.g., "trash", "settings")
	ariaLabel?: string;   // Tooltip text matching Obsidian standards
}

export default function ObsidianIconButton({
	iconId,
	ariaLabel,
	className = "",
	...props
}: IconButtonProps) {
	const iconRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (iconRef.current) {
			iconRef.current.empty();
			setIcon(iconRef.current, iconId);
		}
	}, [iconId]);

	return (
		<button
			// "clickable-icon" adds Obsidian's native hover effects and spacing
			className={`clickable-icon ${className}`}
			aria-label={ariaLabel}
			{...props}
		>
			<span ref={iconRef} style={{ display: "inline-flex" }} />
		</button>
	);
}
