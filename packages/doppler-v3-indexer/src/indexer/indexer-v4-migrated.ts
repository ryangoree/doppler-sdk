import { ponder } from "ponder:registry";
import { chainConfigs } from "@app/config/chains";
import { getPoolId } from "@app/utils/v4-utils/getPoolId";
import { PoolKey } from "@app/types/v4-types";
import { insertSwapIfNotExists } from "./shared/entities/swap";
import { updatePool } from "./shared/entities/pool";
import { updateAsset } from "./shared/entities/asset";
import { fetchEthPrice } from "./shared/oracle";
import { computeV4Price } from "@app/utils/v4-utils/computeV4Price";
import { Address } from "viem";
import { 
  insertOrUpdateBuckets,
  insertOrUpdateDailyVolume,
  compute24HourPriceChange,
} from "./shared/timeseries";
import { SwapService, SwapOrchestrator, PriceService } from "@app/core";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { tryAddActivePool } from "./shared/scheduledJobs";
import { insertTokenIfNotExists } from "./shared/entities/token";
import { CHAINLINK_ETH_DECIMALS } from "@app/utils/constants";
import { computeMarketCap } from "./shared/oracle";

// Helper to get V4MigratorHook address for a chain
const getV4MigratorHook = (chainName: string): Address | null => {
  const config = chainConfigs[chainName as keyof typeof chainConfigs];
  if (!config || config.addresses.v4.v4MigratorHook === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return config.addresses.v4.v4MigratorHook;
};

// Track PoolManager Initialize events for pools created via V4Migrator
ponder.on("PoolManager:Initialize", async ({ event, context }) => {
  const { id: poolId, key: poolKey, sqrtPriceX96, tick } = event.args;
  const { timestamp } = event.block;
  const { db, chain } = context;
  
  // Get the V4MigratorHook address for this chain
  const v4MigratorHook = getV4MigratorHook(chain.name);
  if (!v4MigratorHook) {
    return; // V4 migrator not configured for this chain
  }
  
  // Only process if this pool uses our migrator hook
  if (poolKey.hooks.toLowerCase() !== v4MigratorHook.toLowerCase()) {
    return; // Not a migrated pool
  }
  
  // Get the existing pool entity (should have been created by Airlock:Migrate)
  const existingPool = await db.pool.findUnique({
    where: {
      address: poolId,
      chainId: BigInt(chain.id),
    },
  });
  
  if (!existingPool) {
    console.warn(`Pool ${poolId} initialized via V4Migrator but not found in database`);
    return;
  }
  
  // Get ETH price for initial calculations
  const ethPrice = await fetchEthPrice(timestamp, context);
  
  // Calculate the initial price from tick
  const price = computeV4Price({
    tick: Number(tick),
    isToken0: existingPool.isToken0,
  });
  
  // Calculate initial dollar price
  const dollarPrice = (price * ethPrice) / CHAINLINK_ETH_DECIMALS;
  
  // Update the pool with initialization data
  await updatePool({
    poolAddress: poolId,
    context,
    update: {
      price: dollarPrice,
      tick: Number(tick),
      sqrtPrice: sqrtPriceX96,
      lastRefreshed: timestamp,
    },
  });
});

// Track PoolManager Swap events for migrated pools
ponder.on("PoolManager:Swap", async ({ event, context }) => {
  const { id: poolId, sender, amount0, amount1, sqrtPriceX96, liquidity, tick, fee } = event.args;
  const { timestamp } = event.block;
  const { hash: txHash, from: txFrom } = event.transaction;
  const { db, chain } = context;
  
  // Check if this pool was created via migration
  const pool = await db.pool.findUnique({
    where: {
      address: poolId,
      chainId: BigInt(chain.id),
    },
  });
  
  if (!pool || !pool.migratedFromPool) {
    return; // Not a migrated pool, skip
  }
  
  // Get ETH price for USD calculations
  const ethPrice = await fetchEthPrice(timestamp, context);
  
  // Calculate the new price after the swap
  const newTick = Number(tick);
  const price = computeV4Price({
    tick: newTick,
    isToken0: pool.isToken0, // Use the stored token order
  });
  
  // Determine swap amounts (V4 uses negative values for amounts out)
  const amountIn = amount0 > 0n ? amount0 : amount1;
  const amountOut = amount0 < 0n ? -amount0 : -amount1;
  const isZeroForOne = amount0 > 0n;
  
  // Determine the swap type
  const type = SwapService.determineSwapType({
    isToken0: pool.isToken0,
    amount0: amount0 > 0n ? amount0 : -amount0,
    amount1: amount1 > 0n ? amount1 : -amount1,
  });
  
  // Get token total supply for market cap calculation
  const { totalSupply } = await insertTokenIfNotExists({
    tokenAddress: pool.asset,
    creatorAddress: pool.address,
    timestamp,
    context,
    isDerc20: true,
  });
  
  // Calculate market metrics
  const metrics = SwapService.calculateMarketMetrics({
    totalSupply,
    price,
    swapAmountIn: amountIn,
    swapAmountOut: amountOut,
    ethPriceUSD: ethPrice,
    assetDecimals: 18,
    assetBalance: pool.reserves0, // Use stored reserves
    quoteBalance: pool.reserves1,
    isQuoteETH: pool.isQuoteEth,
  });
  
  // Calculate swap value in USD
  let quoteDelta = 0n;
  if (pool.isToken0) {
    if (amount1 > 0n) {
      quoteDelta = amount1;
    } else {
      quoteDelta = -amount1;
    }
  } else {
    if (amount0 > 0n) {
      quoteDelta = amount0;
    } else {
      quoteDelta = -amount0;
    }
  }
  const swapValueUsd = quoteDelta * ethPrice / CHAINLINK_ETH_DECIMALS;
  
  // Calculate 24-hour price change
  const priceChange = await compute24HourPriceChange({
    poolAddress: poolId,
    marketCapUsd: metrics.marketCapUsd,
    context,
  });
  
  // Create swap data
  const swapData = SwapOrchestrator.createSwapData({
    poolAddress: poolId,
    sender: sender.toLowerCase() as Address,
    transactionHash: txHash,
    transactionFrom: txFrom,
    blockNumber: event.block.number,
    timestamp,
    assetAddress: pool.asset,
    quoteAddress: pool.quoteToken,
    isToken0: pool.isToken0,
    amountIn,
    amountOut,
    price,
    ethPriceUSD: ethPrice,
  });
  
  // Create market metrics
  const marketMetrics = {
    liquidityUsd: metrics.liquidityUsd,
    marketCapUsd: metrics.marketCapUsd,
    swapValueUsd,
    percentDayChange: priceChange,
  };
  
  // Calculate fee amounts
  // V4 fees are taken from the amount in
  const feeAmount = (amountIn * BigInt(fee)) / 1000000n; // fee is in hundredths of a bip
  
  // Define entity updaters
  const entityUpdaters = {
    updatePool,
    updateAsset,
    insertSwap: insertSwapIfNotExists,
    insertOrUpdateBuckets,
    insertOrUpdateDailyVolume,
    tryAddActivePool,
  };
  
  // Perform common updates via orchestrator
  await Promise.all([
    SwapOrchestrator.performSwapUpdates(
      {
        swapData,
        swapType: type,
        metrics: marketMetrics,
        poolData: {
          parentPoolAddress: poolId,
          price,
        },
        chainId: BigInt(chain.id),
        context,
      },
      entityUpdaters
    ),
    updatePool({
      poolAddress: poolId,
      context,
      update: {
        price,
        tick: newTick,
        sqrtPrice: sqrtPriceX96,
        liquidity,
        volumeUsd: pool.volumeUsd + BigInt(Math.floor(swapValueUsd)), 
        lastSwapTimestamp: timestamp,
        totalFee0: isZeroForOne ? pool.totalFee0 + feeAmount : pool.totalFee0,
        totalFee1: !isZeroForOne ? pool.totalFee1 + feeAmount : pool.totalFee1,
        reserves0: pool.isToken0 ? pool.reserves0 - (isZeroForOne ? amountOut : amountIn) : pool.reserves0 + (isZeroForOne ? amountIn : amountOut),
        reserves1: pool.isToken0 ? pool.reserves1 + (!isZeroForOne ? amountIn : amountOut) : pool.reserves1 - (!isZeroForOne ? amountOut : amountIn),
      },
    }),
  ]);
});

// Track PoolManager ModifyLiquidity events for migrated pools
ponder.on("PoolManager:ModifyLiquidity", async ({ event, context }) => {
  const { id: poolId, sender, tickLower, tickUpper, liquidityDelta, salt } = event.args;
  const { timestamp } = event.block;
  const { db, chain } = context;
  
  // Check if this pool was created via migration
  const pool = await db.pool.findUnique({
    where: {
      address: poolId,
      chainId: BigInt(chain.id),
    },
  });
  
  if (!pool || !pool.migratedFromPool) {
    return; // Not a migrated pool, skip
  }
  
  // Get ETH price for liquidity calculations
  const ethPrice = await fetchEthPrice(timestamp, context);
  
  // Update pool liquidity
  const newLiquidity = liquidityDelta > 0n 
    ? pool.liquidity + BigInt(liquidityDelta)
    : pool.liquidity - BigInt(-liquidityDelta);
  
  // Calculate dollar liquidity
  const dollarLiquidity = await computeDollarLiquidity({
    assetBalance: pool.reserves0,
    quoteBalance: pool.reserves1,
    price: pool.price,
    ethPrice,
  });
  
  await updatePool({
    poolAddress: poolId,
    context,
    update: {
      liquidity: newLiquidity,
      dollarLiquidity,
      lastRefreshed: timestamp,
    },
  });
  
  // Update position tracking if this is a new position
  if (liquidityDelta > 0n) {
    await db.position.upsert({
      where: {
        pool_tickLower_tickUpper_chainId: {
          pool: poolId,
          tickLower: Number(tickLower),
          tickUpper: Number(tickUpper),
          chainId: BigInt(chain.id),
        },
      },
      create: {
        owner: sender.toLowerCase() as Address,
        pool: poolId,
        tickLower: Number(tickLower),
        tickUpper: Number(tickUpper),
        liquidity: BigInt(liquidityDelta),
        createdAt: timestamp,
        chainId: BigInt(chain.id),
      },
      update: {
        liquidity: newLiquidity,
      },
    });
  }
});

// Track PoolManager Donate events for migrated pools
ponder.on("PoolManager:Donate", async ({ event, context }) => {
  const { id: poolId, sender, amount0, amount1 } = event.args;
  const { timestamp } = event.block;
  const { db, chain } = context;
  
  // Check if this pool was created via migration
  const pool = await db.pool.findUnique({
    where: {
      address: poolId,
      chainId: BigInt(chain.id),
    },
  });
  
  if (!pool || !pool.migratedFromPool) {
    return; // Not a migrated pool, skip
  }
  
  // Update pool reserves with donated amounts
  await updatePool({
    poolAddress: poolId,
    context,
    update: {
      reserves0: pool.reserves0 + amount0,
      reserves1: pool.reserves1 + amount1,
      lastRefreshed: timestamp,
    },
  });
});