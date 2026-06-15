export class Logger {
	static PREFIX = "FlexiCal";
	private isDebugMode: boolean;

	constructor(isDebugMode: boolean = false) {
		this.isDebugMode = isDebugMode;
	}

	setDebug(enabled: boolean) {
		this.isDebugMode = enabled;
	}

	debug(message: string, ...args: unknown[]) {
		if (this.isDebugMode) {
			console.debug(`[${Logger.PREFIX}][DEBUG] ${message}`, ...args);
		}
	}

	warn(message: string, ...args: unknown[]) {
		console.warn(`[${Logger.PREFIX}][WARN] ${message}`, ...args);
	}

	error(message: string, ...args: unknown[]) {
		console.error(`[${Logger.PREFIX}][ERROR] ${message}`, ...args);
	}
}

const logger = new Logger();
export default logger;
