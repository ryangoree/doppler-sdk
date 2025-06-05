import { 
  chainConfigs, 
  generateAllBlockConfigs, 
  generateAllContractConfigs 
} from "./src/config";

console.log("=== DEBUGGING PONDER CONFIG ===");

// Check chains
console.log("\n📍 CHAINS:");
const chains = Object.fromEntries(
  Object.entries(chainConfigs).map(([name, config]) => [
    name,
    {
      id: config.id,
      rpcEnvVar: config.rpcEnvVar,
      rpcValue: process.env[config.rpcEnvVar] ? "✅ SET" : "❌ MISSING",
    },
  ])
);
console.log(JSON.stringify(chains, null, 2));

// Check blocks
console.log("\n📦 BLOCKS:");
const blocks = generateAllBlockConfigs();
console.log("Block configs:", Object.keys(blocks));
console.log("Example block:", JSON.stringify(blocks.ChainlinkEthPriceFeed, null, 2));

// Check contracts
console.log("\n📋 CONTRACTS:");
const contracts = generateAllContractConfigs();
console.log("Contract configs:", Object.keys(contracts));

// Check a specific contract
if (contracts.Airlock) {
  console.log("\nAirlock contract:");
  console.log("- Chains:", Object.keys(contracts.Airlock.chain));
  console.log("- Example chain config:", JSON.stringify(contracts.Airlock.chain.base, null, 2));
  console.log("- Has ABI:", !!contracts.Airlock.abi);
}

// Check for missing RPC URLs
console.log("\n🔗 RPC ENVIRONMENT VARIABLES:");
const missingRpcs = Object.entries(chainConfigs)
  .filter(([_, config]) => !process.env[config.rpcEnvVar])
  .map(([name, config]) => ({ chain: name, envVar: config.rpcEnvVar }));

if (missingRpcs.length > 0) {
  console.log("❌ Missing RPC URLs:");
  missingRpcs.forEach(({ chain, envVar }) => {
    console.log(`  - ${chain}: ${envVar}`);
  });
} else {
  console.log("✅ All RPC URLs are set");
}