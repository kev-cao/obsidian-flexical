import FlexiCal from "@/main";
import { createContext, useContext } from "react";

export const PluginContext = createContext<FlexiCal | undefined>(undefined);

export const usePlugin = (): FlexiCal | undefined => {
	return useContext(PluginContext);
};

