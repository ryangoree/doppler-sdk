import { ponder } from "ponder:registry";
import { getAssetData } from "@app/utils/getAssetData";
import { asset, pool } from "ponder.schema";
import { getV4PoolData } from "@app/utils/v4-utils";
import { insertTokenIfNotExists } from "./shared/entities/token";
import { fetchEthPrice } from "./shared/oracle";
import {
  insertPoolIfNotExists,
  insertPoolIfNotExistsV4,
} from "./shared/entities/pool";
import { insertOrUpdateDailyVolume } from "./shared/timeseries";
import { insertAssetIfNotExists } from "./shared/entities/asset";
import { insertOrUpdateBuckets } from "./shared/timeseries";

ponder.on("UniswapV4Initializer:Create", async ({ event, context }) => {
  const { poolOrHook, asset: assetId, numeraire } = event.args;

  const creatorAddress = event.transaction.from;

  await insertTokenIfNotExists({
    tokenAddress: numeraire,
    creatorAddress,
    timestamp: event.block.timestamp,
    context,
    isDerc20: false,
  });

  await insertTokenIfNotExists({
    tokenAddress: assetId,
    creatorAddress,
    timestamp: event.block.timestamp,
    context,
    isDerc20: true,
    poolAddress: poolOrHook,
  });

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  const poolEntity = await insertPoolIfNotExistsV4({
    poolAddress: poolOrHook,
    timestamp: event.block.timestamp,
    context,
  });

  console.log(poolEntity);

  await insertAssetIfNotExists({
    assetAddress: assetId,
    timestamp: event.block.timestamp,
    context,
  });

  if (ethPrice) {
    await insertOrUpdateBuckets({
      poolAddress: poolOrHook,
      price: poolEntity.price,
      timestamp: event.block.timestamp,
      ethPrice,
      context,
    });

    await insertOrUpdateDailyVolume({
      poolAddress: poolOrHook,
      amountIn: 0n,
      amountOut: 0n,
      timestamp: event.block.timestamp,
      context,
      tokenIn: assetId,
      tokenOut: numeraire,
      ethPrice,
    });
  }
});

ponder.on("UniswapV4Pool:Mint", async ({ event, context }) => {
  const address = event.log.address;
  const { tickLower, tickUpper, amount, owner } = event.args;

  const poolEntity = await insertPoolIfNotExists({
    poolAddress: address,
    timestamp: event.block.timestamp,
    context,
  });

  const { reserve0, reserve1 } = await getV3PoolReserves({
    address,
    token0: poolEntity.isToken0 ? poolEntity.baseToken : poolEntity.quoteToken,
    token1: poolEntity.isToken0 ? poolEntity.quoteToken : poolEntity.baseToken,
    context,
  });

  const assetBalance = poolEntity.isToken0 ? reserve0 : reserve1;
  const quoteBalance = poolEntity.isToken0 ? reserve1 : reserve0;

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  let dollarLiquidity;
  if (ethPrice) {
    dollarLiquidity = await computeDollarLiquidity({
      assetBalance,
      quoteBalance,
      price: poolEntity.price,
      ethPrice,
    });

    const graduationThresholdDelta = await computeGraduationThresholdDelta({
      poolAddress: address,
      context,
      tickLower,
      tickUpper,
      liquidity: amount,
      isToken0: poolEntity.isToken0,
    });

    if (dollarLiquidity) {
      await updateAsset({
        assetAddress: poolEntity.baseToken,
        context,
        update: {
          liquidityUsd: dollarLiquidity,
        },
      });

      await updatePool({
        poolAddress: address,
        context,
        update: {
          graduationThreshold:
            poolEntity.graduationThreshold + graduationThresholdDelta,
          liquidity: poolEntity.liquidity + amount,
          dollarLiquidity: dollarLiquidity,
        },
      });
    } else {
      await updatePool({
        poolAddress: address,
        context,
        update: {
          graduationThreshold:
            poolEntity.graduationThreshold + graduationThresholdDelta,
          liquidity: poolEntity.liquidity + amount,
        },
      });
    }
  } else {
    await updatePool({
      poolAddress: address,
      context,
      update: {
        graduationThreshold: poolEntity.graduationThreshold,
        liquidity: poolEntity.liquidity + amount,
      },
    });
  }

  if (ethPrice) {
    await updateMarketCap({
      assetAddress: poolEntity.baseToken,
      price: poolEntity.price,
      ethPrice,
      context,
    });
  }

  await updateAsset({
    assetAddress: poolEntity.baseToken,
    context,
    update: {
      liquidityUsd: dollarLiquidity ?? 0n,
    },
  });

  const positionEntity = await insertPositionIfNotExists({
    poolAddress: address,
    tickLower,
    tickUpper,
    liquidity: amount,
    owner,
    timestamp: event.block.timestamp,
    context,
  });

  if (positionEntity.createdAt != event.block.timestamp) {
    await updatePosition({
      poolAddress: address,
      tickLower,
      tickUpper,
      context,
      update: {
        liquidity: positionEntity.liquidity + amount,
      },
    });
  }
});
