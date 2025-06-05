import { Address } from "viem";

export type Network =
  | "mainnet"
  | "unichain"
  | "baseSepolia"
  | "ink"
  | "base";

export type ChainConfig = {
  id: number;
  name: Network;
  startBlock: number;
  v4StartBlock?: number;
  oracleStartBlock: number;
  rpcEnvVar: string;
  addresses: ChainAddresses;
};

export type ChainAddresses = {
  v2: V2Addresses;
  v3: V3Addresses;
  v4: V4Addresses;
  shared: SharedAddresses;
  oracle: OracleAddresses;
};

export type SharedAddresses = {
  airlock: Address;
  tokenFactory: Address;
  universalRouter: Address;
  governanceFactory: Address;
  migrator: Address;
  weth: Address;
};

export type V4Addresses = {
  dopplerDeployer: Address;
  stateView: Address;
  poolManager: Address;
  dopplerLens: Address;
  v4Initializer: Address;
  v4Initializer2: Address;
};

export type V3Addresses = {
  v3Initializer: Address;
};

export type V2Addresses = {
  factory: Address;
};

export type OracleAddresses = {
  mainnetEthUsdc: Address;
  weth: Address;
  usdc: Address;
  chainlinkEth: Address;
};

export type IndexerConfigs = Record<Network, ChainConfig>;