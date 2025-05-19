import { Context } from "ponder:registry";
import { activePoolsBlob, dailyVolume } from "ponder:schema";
import { Address } from "viem";
import {
  updateAsset,
  updatePool,
  updateToken,
} from "@app/indexer/shared/entities";
import { pool } from "ponder:schema";
import { secondsInDay } from "@app/utils/constants";
import { updateDailyVolume } from "./timeseries";

interface ActivePools {
  [poolAddress: Address]: number;
}

export const insertActivePoolsBlobIfNotExists = async ({
  context,
}: {
  context: Context;
}) => {
  const { db, network } = context;
  const chainId = network.chainId;

  const existingConfig = await db.find(activePoolsBlob, {
    chainId: BigInt(chainId),
  });

  if (existingConfig) {
    return existingConfig;
  }

  return await db.insert(activePoolsBlob).values({
    chainId: BigInt(chainId),
    activePools: {},
  });
};

export const updateCheckpointBlob = async ({
  context,
  update,
}: {
  context: Context;
  update?: Partial<typeof activePoolsBlob.$inferInsert>;
}) => {
  const { db, network } = context;
  const chainId = network.chainId;

  await db
    .update(activePoolsBlob, {
      chainId: BigInt(chainId),
    })
    .set({
      ...update,
    });
};

export const tryAddActivePool = async ({
  poolAddress,
  lastSwapTimestamp,
  context,
}: {
  poolAddress: Address;
  lastSwapTimestamp: number;
  context: Context;
}) => {
  const { db, network } = context;
  const chainId = network.chainId;

  const existingData = await db.find(activePoolsBlob, {
    chainId: BigInt(chainId),
  });

  if (!existingData) {
    throw new Error("Active pools blob not found");
  }

  const activePools = existingData.activePools as ActivePools;

  const data = {
    [poolAddress]: lastSwapTimestamp,
  };

  if (activePools[poolAddress]) {
    return;
  }

  await db
    .update(activePoolsBlob, {
      chainId: BigInt(chainId),
    })
    .set({
      activePools: {
        ...(existingData.activePools as ActivePools),
        ...data,
      },
    });
};

export const refreshActivePoolsBlob = async ({
  context,
  timestamp,
}: {
  context: Context;
  timestamp: number;
}) => {
  const { db, network } = context;
  const chainId = network.chainId;

  const existingBlob = await db.find(activePoolsBlob, {
    chainId: BigInt(chainId),
  });

  if (!existingBlob) {
    return;
  }

  const poolsToRefresh: Address[] = [];
  const timestampMinusDay = timestamp - 86400;

  for (const [poolAddress, lastSwapTimestamp] of Object.entries(
    existingBlob.activePools as ActivePools
  )) {
    // ignore pools that dont have an earliest timestamp that is greater than the timestamp minus 24 hours
    if (lastSwapTimestamp > timestampMinusDay) {
      continue;
    }

    poolsToRefresh.push(poolAddress as Address);
  }

  const poolsToClear: Address[] = [];
  const poolsToUpdate: ActivePools[] = [];

  await Promise.all(
    poolsToRefresh.map(async (poolAddress) => {
      const volumeEntity = await db.find(dailyVolume, {
        pool: poolAddress,
      });

      if (!volumeEntity) {
        return null;
      }
      const { checkpoints } = volumeEntity;

      const volumeCheckpoints = checkpoints as Record<string, string>;

      const updatedCheckpoints = Object.fromEntries(
        Object.entries(volumeCheckpoints).filter(
          ([ts]) => BigInt(ts) >= BigInt(timestamp) - BigInt(secondsInDay)
        )
      );

      const oldestCheckpointTime =
        Object.keys(updatedCheckpoints).length > 0
          ? BigInt(Math.min(...Object.keys(updatedCheckpoints).map(Number)))
          : undefined;

      const totalVolumeUsd = oldestCheckpointTime
        ? Object.values(updatedCheckpoints).reduce(
            (acc, vol) => acc + BigInt(vol),
            BigInt(0)
          )
        : 0n;

      if (!oldestCheckpointTime) {
        poolsToClear.push(poolAddress);
      } else {
        poolsToUpdate.push({
          [poolAddress]: Number(oldestCheckpointTime),
        });
      }

      const volumeEntityUpdate = {
        poolAddress,
        volumeUsd: totalVolumeUsd,
        checkpoints: updatedCheckpoints,
        lastUpdated: BigInt(timestamp),
      };

      await updateDailyVolume({
        poolAddress,
        volumeData: volumeEntityUpdate,
        context,
      });

      const poolEntity = await db.find(pool, {
        address: poolAddress,
        chainId: BigInt(chainId),
      });

      if (!poolEntity) {
        return;
      }

      await updatePool({
        poolAddress,
        context,
        update: {
          volumeUsd: totalVolumeUsd,
        },
      });
      await updateToken({
        tokenAddress: poolEntity.asset,
        context,
        update: {
          volumeUsd: totalVolumeUsd,
        },
      });
      await updateAsset({
        assetAddress: poolEntity.asset,
        context,
        update: {
          dayVolumeUsd: totalVolumeUsd,
        },
      });
    })
  );

  const blob = existingBlob.activePools as ActivePools;
  poolsToClear.forEach((poolAddress) => {
    delete blob[poolAddress];
  });

  poolsToUpdate.forEach((record) => {
    Object.entries(record).forEach(([poolAddress, lastSwapTimestamp]) => {
      blob[poolAddress as Address] = lastSwapTimestamp;
    });
  });

  await updateCheckpointBlob({
    context,
    update: {
      activePools: blob,
    },
  });
};
