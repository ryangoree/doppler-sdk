import { ponder } from "ponder:registry";
import { getAssetData } from "@app/utils/getAssetData";
import { asset, pool } from "ponder.schema";
import { getV4PoolData } from "@app/utils/v4-utils";
import { insertTokenIfNotExists } from "./shared/entities/token";
import { fetchEthPrice } from "./shared/oracle";
import {
  insertPoolIfNotExists,
  insertPoolIfNotExistsV4,
  updatePool,
} from "./shared/entities/pool";
import { insertOrUpdateDailyVolume } from "./shared/timeseries";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { insertOrUpdateBuckets } from "./shared/timeseries";
import {
  computeGraduationThresholdDelta,
  computeGraduationThresholdDeltaV4,
} from "@app/utils/v3-utils/computeGraduationThreshold";
import { getV3PoolReserves } from "@app/utils/v3-utils/getV3PoolData";
import { computeDollarLiquidity } from "@app/utils/computeDollarLiquidity";
import { insertV4ConfigIfNotExists } from "./shared/entities/v4-entities/v4Config";
import { getReservesV4 } from "@app/utils/v4-utils/getV4PoolData";

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

  const reserves = await getReservesV4({
    hook: poolOrHook,
    context,
  });
  console.log(reserves);

  const ethPrice = await fetchEthPrice(event.block.timestamp, context);

  const poolEntity = await insertPoolIfNotExistsV4({
    poolAddress: poolOrHook,
    timestamp: event.block.timestamp,
    context,
  });

  await insertV4ConfigIfNotExists({
    hookAddress: poolOrHook,
    context,
  });

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

// ponder.on("UniswapV4Pool:Swap", async ({ event, context }) => {
//   const address = event.log.address;
//   const { currentTick, totalProceeds, totalTokensSold } = event.args;

//   const poolEntity = await insertPoolIfNotExists({
//     poolAddress: address,
//     timestamp: event.block.timestamp,
//     context,
//   });

//   const ethPrice = await fetchEthPrice(event.block.timestamp, context);

//   let dollarLiquidity;
//   if (ethPrice) {
//     dollarLiquidity = await computeDollarLiquidity({
//       assetBalance,
//       quoteBalance,
//       price: poolEntity.price,
//       ethPrice,
//     });

//     // const graduationThresholdDelta = await computeGraduationThresholdDeltaV4({
//     //   hookAddress: address,
//     //   totalProceeds,
//     //   context,
//     // });

//     if (dollarLiquidity) {
//       await updateAsset({
//         assetAddress: poolEntity.baseToken,
//         context,
//         update: {
//           liquidityUsd: dollarLiquidity,
//         },
//       });

//       await updatePool({
//         poolAddress: address,
//         context,
//         update: {
//           // graduationThreshold:
//           //   poolEntity.graduationThreshold + graduationThresholdDelta,
//           liquidity: poolEntity.liquidity + amount,
//           dollarLiquidity: dollarLiquidity,
//         },
//       });
//     } else {
//       await updatePool({
//         poolAddress: address,
//         context,
//         update: {
//           // graduationThreshold:
//           //   poolEntity.graduationThreshold + graduationThresholdDelta,
//           liquidity: poolEntity.liquidity + amount,
//         },
//       });
//     }
//   } else {
//     await updatePool({
//       poolAddress: address,
//       context,
//       update: {
//         graduationThreshold: poolEntity.graduationThreshold,
//         liquidity: poolEntity.liquidity + amount,
//       },
//     });
//   }

//   if (ethPrice) {
//     await updateMarketCap({
//       assetAddress: poolEntity.baseToken,
//       price: poolEntity.price,
//       ethPrice,
//       context,
//     });
//   }

//   await updateAsset({
//     assetAddress: poolEntity.baseToken,
//     context,
//     update: {
//       liquidityUsd: dollarLiquidity ?? 0n,
//     },
//   });

//   const positionEntity = await insertPositionIfNotExists({
//     poolAddress: address,
//     tickLower,
//     tickUpper,
//     liquidity: amount,
//     owner,
//     timestamp: event.block.timestamp,
//     context,
//   });

//   if (positionEntity.createdAt != event.block.timestamp) {
//     await updatePosition({
//       poolAddress: address,
//       tickLower,
//       tickUpper,
//       context,
//       update: {
//         liquidity: positionEntity.liquidity + amount,
//       },
//     });
//   }
// });
