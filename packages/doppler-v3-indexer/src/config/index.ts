export * from "./chains";
export * from "./contracts"; 
export * from "./blocks";

// Re-export specific items for backwards compatibility
export { chainConfigs as configs } from "./chains";
export { CHAIN_IDS } from "./chains/constants";

// Special Zora configurations (keeping separate for now)
export const ZORA_CONFIG = {
  factoryAddress: "0x777777751622c0d3258f214F9DF38E35BF45baF3",
  startBlock: 29011355,
} as const;