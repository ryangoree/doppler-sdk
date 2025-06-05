import { Address } from "viem";
import { Network } from "../chains/types";

export type ContractConfig = {
  abi: any;
  chain: Partial<Record<Network, ChainContractConfig>>;
};

export type ChainContractConfig = {
  startBlock: number;
  address: Address | FactoryConfig;
};

export type FactoryConfig = {
  address: Address;
  event: any;
  parameter: string;
};

export type ContractConfigMap = Record<string, ContractConfig>;