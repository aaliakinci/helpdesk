import { StoreRegistry, createLilyStoreKit } from "@lily_platform/lily_ui/state";

const appStateRegistry = new StoreRegistry();

export const { store: appStore } = createLilyStoreKit(appStateRegistry);
