import { Network } from "../chains/types";

export type BlockConfig = {
  chain: string;
  startBlock: number;
  interval: number;
};

export type BlockConfigMap = Record<string, BlockConfig>;

export type CheckpointConfig = {
  name: string;
  chains: Network[];
  interval: number;
  getStartBlock: (chainConfig: any) => number;
};

export type MetricRefresherConfig = {
  name: string;
  chains: Network[];
  interval: number;
  getStartBlock: (chainConfig: any) => number;
};