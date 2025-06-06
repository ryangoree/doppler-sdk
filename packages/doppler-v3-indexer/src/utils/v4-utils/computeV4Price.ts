import { Address, zeroAddress } from "viem";
import { DERC20ABI, DopplerABI } from "@app/abis";
import { Context } from "ponder:registry";
import { PriceService } from "@app/core/pricing";
import { getV4PoolData, getPoolId } from "@app/utils/v4-utils";
import { getAssetData } from "@app/utils/getAssetData";
import { PoolKey } from "@app/types/v4-types";
import { configs } from "addresses";
import { TickMath } from "@uniswap/v3-sdk";

export const computeV4Price = ({
  isToken0,
  currentTick,
  baseTokenDecimals,
}: {
  isToken0: boolean;
  currentTick: number;
  baseTokenDecimals: number;
}) => {
  const sqrtPriceX96 = BigInt(
    TickMath.getSqrtRatioAtTick(currentTick).toString()
  );
  
  return PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: baseTokenDecimals,
  });
};

export const computeV4PriceFromSqrtPriceX96 = ({
  isToken0,
  sqrtPriceX96,
  baseTokenDecimals,
}: {
  isToken0: boolean;
  sqrtPriceX96: bigint;
  baseTokenDecimals: number;
}) => {
  return PriceService.computePriceFromSqrtPriceX96({
    sqrtPriceX96,
    isToken0,
    decimals: baseTokenDecimals,
  });
};
