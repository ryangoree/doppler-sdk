import { Address } from "viem";
import { SwapType } from "@app/types/shared";
import { PriceService } from "@app/core/pricing";

/**
 * Common swap data structure across all protocols
 */
export interface SwapData {
  poolAddress: Address;
  sender: Address;
  transactionHash: `0x${string}`;
  transactionFrom: Address;
  blockNumber: bigint;
  timestamp: bigint;
  assetAddress: Address;
  quoteAddress: Address;
  isToken0: boolean;
  amountIn: bigint;
  amountOut: bigint;
  price: bigint;
  ethPriceUSD: bigint;
}

/**
 * Market metrics calculated from swap data
 */
export interface MarketMetrics {
  liquidityUsd: bigint;
  marketCapUsd: bigint;
  swapValueUsd: bigint;
  percentDayChange: number;
}

/**
 * Core service for handling swap operations across all protocols
 */
export class SwapService {
  /**
   * Determines if a swap is a buy or sell based on token position and amounts
   * This unifies the logic that was duplicated across V2, V3, and V4
   */
  static determineSwapType(params: {
    isToken0: boolean;
    amountIn: bigint;
    amountOut: bigint;
  }): SwapType {
    const { isToken0, amountIn, amountOut } = params;

    // For V2/V3: positive amount means tokens going in (swap input)
    // If asset is token0 and amount0 is positive, user is buying with token0
    if (isToken0 && amountIn > 0n) {
      return "buy";
    } else if (!isToken0 && amountIn > 0n) {
      return "sell";
    } else if (isToken0 && amountIn < 0n) {
      return "sell";
    } else if (!isToken0 && amountIn < 0n) {
      return "buy";
    }

    // Default case (shouldn't happen in practice)
    return "buy";
  }

  /**
   * Simplified swap type determination for V4 based on proceeds
   */
  static determineSwapTypeV4(params: {
    currentProceeds: bigint;
    previousProceeds: bigint;
  }): SwapType {
    return params.currentProceeds > params.previousProceeds ? "buy" : "sell";
  }

  /**
   * Calculates market metrics from swap data
   */
  static calculateMarketMetrics(params: {
    liquidity: bigint;
    totalSupply: bigint;
    price: bigint;
    swapAmountIn: bigint;
    swapAmountOut: bigint;
    ethPriceUSD: bigint;
    assetDecimals: number;
    isQuoteETH?: boolean;
  }): MarketMetrics {
    const {
      liquidity,
      totalSupply,
      price,
      swapAmountIn,
      swapAmountOut,
      ethPriceUSD,
      assetDecimals,
      isQuoteETH = true,
    } = params;

    // Calculate liquidity in USD
    const liquidityUsd = isQuoteETH
      ? (liquidity * ethPriceUSD) / BigInt(10 ** 18)
      : liquidity;

    // Calculate market cap in USD
    const priceUsd = PriceService.computePriceUSD({
      price,
      ethPriceUSD,
      isQuoteETH,
    });

    const marketCapUsd = (totalSupply * priceUsd) / BigInt(10 ** assetDecimals);

    // Calculate swap value in USD
    const swapAmount = swapAmountIn > 0n ? swapAmountIn : swapAmountOut;
    const swapValueUsd = isQuoteETH
      ? (swapAmount * ethPriceUSD) / BigInt(10 ** 18)
      : swapAmount;

    // TODO: Calculate percent day change (requires historical price)
    const percentDayChange = 0;

    return {
      liquidityUsd,
      marketCapUsd,
      swapValueUsd,
      percentDayChange,
    };
  }

  /**
   * Formats swap data for database insertion
   */
  static formatSwapEntity(params: {
    swapData: SwapData;
    swapType: SwapType;
    swapValueUsd: bigint;
    chainId: bigint;
  }) {
    const { swapData, swapType, swapValueUsd, chainId } = params;

    return {
      txHash: swapData.transactionHash,
      timestamp: swapData.timestamp,
      pool: swapData.poolAddress.toLowerCase() as Address,
      asset: swapData.assetAddress.toLowerCase() as Address,
      quote: swapData.quoteAddress.toLowerCase() as Address,
      chainId,
      type: swapType,
      user: swapData.transactionFrom.toLowerCase() as Address,
      amountIn: swapData.amountIn,
      amountOut: swapData.amountOut,
      usdPrice: swapValueUsd,
    };
  }

  /**
   * Formats pool update data
   */
  static formatPoolUpdate(params: {
    price: bigint;
    liquidityUsd: bigint;
    marketCapUsd: bigint;
    volume24h: bigint;
    timestamp: bigint;
  }) {
    return {
      price: params.price,
      dollarLiquidity: params.liquidityUsd, // Pool entity uses 'dollarLiquidity' field
      marketCapUsd: params.marketCapUsd,
      volume24h: params.volume24h,
      lastSwapTimestamp: params.timestamp,
    };
  }

  /**
   * Formats asset update data
   */
  static formatAssetUpdate(params: {
    liquidityUsd: bigint;
    marketCapUsd: bigint;
    percentDayChange: number;
  }) {
    return {
      liquidityUsd: params.liquidityUsd,
      marketCapUsd: params.marketCapUsd,
      percentDayChange: params.percentDayChange.toString(),
    };
  }
}