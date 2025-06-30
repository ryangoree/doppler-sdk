import { ponder } from "ponder:registry";
import { pool } from "ponder.schema";
import { insertAssetIfNotExists, updateAsset } from "./shared/entities/asset";
import { insertTokenIfNotExists, updateToken } from "./shared/entities/token";
import { insertV2PoolIfNotExists } from "./shared/entities/v2Pool";
import { updateUserAsset } from "./shared/entities/userAsset";
import { insertUserAssetIfNotExists } from "./shared/entities/userAsset";
import { insertUserIfNotExists, updateUser } from "./shared/entities/user";
import { updatePool } from "./shared/entities/pool";
import { V4MigratorABI } from "../abis";
import { chainConfigs } from "../config/chains";
import { getPoolId } from "../utils/v4-utils/getPoolId";


ponder.on("Airlock:Migrate", async ({ event, context }) => {
  const { timestamp } = event.block;
  const assetId = event.args.asset.toLowerCase() as `0x${string}`;
  const poolAddress = event.args.pool.toLowerCase() as `0x${string}`;

  // Check if this is a V4 migration (pool address is 0x0)
  if (poolAddress === "0x0000000000000000000000000000000000000000") {
    // V4 Migration
    const { chain } = context;
    if (!chain) {
      console.warn("Chain not available in context");
      return;
    }
    
    const chainConfig = chainConfigs[chain.name as keyof typeof chainConfigs];
    
    if (!chainConfig || chainConfig.addresses.v4.v4Migrator === "0x0000000000000000000000000000000000000000") {
      console.warn(`V4 migrator not configured for chain ${chain.name}`);
      return;
    }

    // Get the asset to find the old pool and numeraire
    const assetEntity = await insertAssetIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    });

    const oldPoolAddress = assetEntity.poolAddress;
    const numeraireAddress = assetEntity.numeraire;

    // Determine token0 and token1 order for the V4 migrator mapping
    const [token0, token1] = assetId < numeraireAddress 
      ? [assetId, numeraireAddress] 
      : [numeraireAddress, assetId];

    try {
      // Query the V4 migrator to get the asset data
      const assetData = await context.client.readContract({
        address: chainConfig.addresses.v4.v4Migrator,
        abi: V4MigratorABI,
        functionName: 'getAssetData',
        args: [token0, token1],
      });

      const { poolKey } = assetData;
      
      // Calculate the pool ID from the pool key - this is the unique identifier for V4 pools
      const poolId = getPoolId(poolKey);
      
      // For V4 migrated pools, we can't use getV4PoolData because they don't have individual hook contracts
      // Instead, we'll create a basic pool entity with the migration information
      
      // Create a basic pool entity for the migrated V4 pool
      const { db, chain } = context;
      if (!chain) {
        console.warn("Chain not available in context");
        return;
      }
      
      // Use the pool ID as the address for migrated V4 pools
      const poolAddress = poolId.toLowerCase() as `0x${string}`;
      
      const existingPool = await db.find(pool, {
        address: poolAddress,
        chainId: BigInt(chain.id),
      });

      if (!existingPool) {
        // Extract basic information from the poolKey
        const isToken0First = poolKey.currency0.toLowerCase() < poolKey.currency1.toLowerCase();
        const baseToken = isToken0First ? poolKey.currency0 : poolKey.currency1;
        const quoteToken = isToken0First ? poolKey.currency1 : poolKey.currency0;
        
        await db.insert(pool).values({
          address: poolAddress,
          chainId: BigInt(chain.id),
          baseToken: baseToken.toLowerCase() as `0x${string}`,
          quoteToken: quoteToken.toLowerCase() as `0x${string}`,
          asset: assetId,
          isToken0: assetId === baseToken.toLowerCase(),
          createdAt: timestamp,
          lastRefreshed: timestamp,
          fee: Number(poolKey.fee),
          price: 0n, // Will be updated when trading starts
          tick: 0, // Will be updated on initialization
          sqrtPrice: 0n, // Will be updated on initialization
          liquidity: 0n, // Will be updated on initialization
          type: "v4", // V4 pool type
          dollarLiquidity: 0n,
          dailyVolume: "0x0000000000000000000000000000000000000000" as `0x${string}`, // Will be updated
          volumeUsd: 0n,
          percentDayChange: 0,
          totalFee0: 0n,
          totalFee1: 0n,
          graduationBalance: 0n,
          graduationPercentage: 0,
          maxThreshold: 0n,
          reserves0: 0n,
          reserves1: 0n,
          totalProceeds: 0n,
          totalTokensSold: 0n,
          holderCount: 0,
          marketCapUsd: 0n,
          migrated: false, // This is the new pool, not migrated itself
          migratedFromPool: oldPoolAddress,
          isQuoteEth: quoteToken.toLowerCase() === "0x0000000000000000000000000000000000000000" || 
                      quoteToken.toLowerCase() === chainConfigs[chain.name as keyof typeof chainConfigs].addresses.shared.weth.toLowerCase(),
        });
      }

      // Update the old pool as migrated
      await updatePool({
        poolAddress: oldPoolAddress,
        context,
        update: {
          migratedAt: timestamp,
          migrated: true,
          migratedToPool: poolId,
        },
      });

      // Update the new pool with migration info
      await updatePool({
        poolAddress: poolId,
        context,
        update: {
          migratedFromPool: oldPoolAddress,
        },
      });

      // Update the asset as migrated
      await updateAsset({
        assetAddress: assetId,
        context,
        update: {
          migratedAt: timestamp,
          migrated: true,
          poolAddress: poolId, // Update to point to new pool
        },
      });

    } catch (error) {
      console.error(`Failed to process V4 migration for asset ${assetId}:`, error);
    }

  } else {
    // V2 Migration (existing logic)
    const v2Pool = await insertV2PoolIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    });

    await Promise.all([
      updateAsset({
        assetAddress: assetId,
        context,
        update: {
          migratedAt: timestamp,
          migrated: true,
        },
      }),
      updatePool({
        poolAddress: v2Pool.parentPool,
        context,
        update: {
          migratedAt: timestamp,
          migrated: true,
          migratedToPool: poolAddress, // The V2 pool address
        },
      }),
    ]);
  }
});

ponder.on("DERC20:Transfer", async ({ event, context }) => {
  const { address } = event.log;
  const { timestamp } = event.block;
  const { from, to, value } = event.args;

  const { db, chain } = context;

  const creatorAddress = event.transaction.from;

  const fromId = from.toLowerCase() as `0x${string}`;
  const toId = to.toLowerCase() as `0x${string}`;
  const assetId = address.toLowerCase() as `0x${string}`;

  const [tokenData, assetData, fromUser, toUserAsset, fromUserAsset] = await Promise.all([
    insertTokenIfNotExists({
      tokenAddress: assetId,
      creatorAddress,
      timestamp,
      context,
      isDerc20: true,
    }),
    insertAssetIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: fromId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: toId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: fromId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: toId,
      timestamp,
      context,
    }),
  ]);

  if (fromUser.lastSeenAt != timestamp) {
    await updateUser({
      userId: fromId,
      context,
      update: {
        lastSeenAt: timestamp,
      },
    });
  }

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && toUserAsset.balance + value > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && fromUserAsset.balance - value == 0n) {
    holderCountDelta -= 1;
  }

  const [poolEntity] = await Promise.all([
    db.find(pool, {
      address: assetData.poolAddress,
      chainId: BigInt(chain.id),
    }),
    updateToken({
      tokenAddress: assetId,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateAsset({
      assetAddress: assetId,
      context,
      update: {
        holderCount: assetData.holderCount + holderCountDelta,
      },
    }),
    updateUserAsset({
      userId: toId,
      assetId: assetId,
      context,
      update: {
        balance: toUserAsset.balance + value,
        lastInteraction: timestamp,
      },
    }),
    updateUserAsset({
      userId: fromId,
      assetId: assetId,
      context,
      update: {
        lastInteraction: timestamp,
        balance: fromUserAsset.balance - value,
      },
    }),
  ]);

  if (poolEntity) {
    await updatePool({
      poolAddress: assetData.poolAddress,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    });
  }
});

ponder.on("V4DERC20:Transfer", async ({ event, context }) => {
  const { address } = event.log;
  const { timestamp } = event.block;
  const { from, to, value } = event.args;
  const { db, chain } = context;

  const creatorAddress = event.transaction.from;

  const fromId = from.toLowerCase() as `0x${string}`;
  const toId = to.toLowerCase() as `0x${string}`;
  const assetId = address.toLowerCase() as `0x${string}`;

  const [tokenData, assetData, fromUser, toUserAsset, fromUserAsset] = await Promise.all([
    insertTokenIfNotExists({
      tokenAddress: assetId,
      creatorAddress,
      timestamp,
      context,
      isDerc20: true,
    }),
    insertAssetIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: fromId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: toId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: fromId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: toId,
      timestamp,
      context,
    }),
  ])

  if (fromUser.lastSeenAt != timestamp) {
    await updateUser({
      userId: fromId,
      context,
      update: {
        lastSeenAt: timestamp,
      },
    });
  }

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && toUserAsset.balance + value > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && fromUserAsset.balance - value == 0n) {
    holderCountDelta -= 1;
  }

  const [poolEntity] = await Promise.all([
    db.find(pool, {
      address: assetData.poolAddress,
      chainId: BigInt(chain.id),
    }),
    updateUserAsset({
      userId: toId,
      assetId: assetId,
      context,
      update: {
        balance: toUserAsset.balance + value,
        lastInteraction: timestamp,
      },
    }),
    updateUserAsset({
      userId: fromId,
      assetId: assetId,
      context,
      update: {
        lastInteraction: timestamp,
        balance: fromUserAsset.balance - value,
      },
    }),
    updateToken({
      tokenAddress: assetId,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateAsset({
      assetAddress: assetId,
      context,
      update: {
        holderCount: assetData.holderCount + holderCountDelta,
      },
    }),
  ])

  if (poolEntity) {
    await updatePool({
      poolAddress: assetData.poolAddress,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    });
  }
});

ponder.on("V4DERC20_2:Transfer", async ({ event, context }) => {
  const { address } = event.log;
  const { timestamp } = event.block;
  const { from, to, value } = event.args;
  const { db, chain } = context;

  const creatorAddress = event.transaction.from;

  const fromId = from.toLowerCase() as `0x${string}`;
  const toId = to.toLowerCase() as `0x${string}`;
  const assetId = address.toLowerCase() as `0x${string}`;

  const [tokenData, assetData, fromUser, toUserAsset, fromUserAsset] = await Promise.all([
    insertTokenIfNotExists({
      tokenAddress: assetId,
      creatorAddress,
      timestamp,
      context,
      isDerc20: true,
    }),
    insertAssetIfNotExists({
      assetAddress: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: fromId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: toId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserAssetIfNotExists({
      userId: fromId,
      assetId: assetId,
      timestamp,
      context,
    }),
    insertUserIfNotExists({
      userId: toId,
      timestamp,
      context,
    }),
  ])

  if (fromUser.lastSeenAt != timestamp) {
    await updateUser({
      userId: fromId,
      context,
      update: {
        lastSeenAt: timestamp,
      },
    });
  }

  let holderCountDelta = 0;
  if (toUserAsset.balance == 0n && toUserAsset.balance + value > 0n) {
    holderCountDelta += 1;
  }
  if (fromUserAsset.balance > 0n && fromUserAsset.balance - value == 0n) {
    holderCountDelta -= 1;
  }

  const [poolEntity] = await Promise.all([
    db.find(pool, {
      address: assetData.poolAddress,
      chainId: BigInt(chain.id),
    }),
    updateUserAsset({
      userId: toId,
      assetId: assetId,
      context,
      update: {
        balance: toUserAsset.balance + value,
        lastInteraction: timestamp,
      },
    }),
    updateUserAsset({
      userId: fromId,
      assetId: assetId,
      context,
      update: {
        lastInteraction: timestamp,
        balance: fromUserAsset.balance - value,
      },
    }),
    updateToken({
      tokenAddress: assetId,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    }),
    updateAsset({
      assetAddress: assetId,
      context,
      update: {
        holderCount: assetData.holderCount + holderCountDelta,
      },
    }),
  ])

  if (poolEntity) {
    await updatePool({
      poolAddress: assetData.poolAddress,
      context,
      update: {
        holderCount: tokenData.holderCount + holderCountDelta,
      },
    });
  }
});
