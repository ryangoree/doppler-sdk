# V4 Pool Migration Indexer Implementation Summary

## Overview
We've successfully implemented support for tracking Uniswap V4 pools that are created through the migration process when assets "graduate" from Doppler Dutch auction pools. This allows the indexer to track the full lifecycle of assets as they move from Doppler pools to standard Uniswap V4 pools.

## Key Architectural Insights

### Pool Hook Architecture
- **Pre-migration V4 pools**: Deploy individual Doppler hook contracts for each pool (Dutch auction logic)
- **Migrated V4 pools**: Share a single `UniswapV4MigratorHook` that only restricts initialization
- This design saves gas and simplifies the migration process since graduated pools don't need auction logic

### Pool Identification
- Pre-migration pools use hook contract addresses as identifiers (20 bytes)
- Migrated pools use pool IDs calculated from PoolKey (32 bytes)
- We store pool IDs in the `address` field with `type: "v4"` to distinguish them

## Implementation Details

### 1. Contract Configuration
Added V4 migration support to the indexer configuration:
- Added `v4Migrator` and `v4MigratorHook` addresses to chain configs
- Added `PoolManager` contract to track migrated pool events
- Updated type definitions to include new V4 addresses

### 2. Migration Detection (Airlock:Migrate)
When a V4 migration occurs:
- Detect V4 migrations by checking if `pool` address is `0x0`
- Query the V4Migrator contract to get pool configuration
- Calculate pool ID from PoolKey
- Create pool entity with migration metadata
- Update asset and old pool with migration status

### 3. Event Handlers for Migrated Pools

#### PoolManager:Initialize
- Filter events by checking if hook address matches `v4MigratorHook`
- Update pool with initial price and tick data
- Only process pools created through migration

#### PoolManager:Swap
- Filter by checking if pool has `migratedFromPool` set
- Track swap amounts, prices, and volumes
- Calculate and store fee amounts (totalFee0, totalFee1)
- Update pool metrics including sqrtPrice and liquidity

#### PoolManager:ModifyLiquidity
- Track liquidity additions and removals
- Update total pool liquidity
- Foundation for position tracking (if needed later)

### 4. Schema Updates
Added migration tracking fields to pool entity:
- `migratedToPool`: Reference to new V4 pool (for old pools)
- `migratedFromPool`: Reference to original pool (for V4 pools)
- `migratedAt`: Timestamp of migration

## Files Modified

### Configuration Files
- `src/config/chains/base.ts` - Added V4Migrator and V4MigratorHook addresses
- `src/config/chains/ink.ts` - Added placeholder addresses
- `src/config/chains/unichain.ts` - Added placeholder addresses
- `src/config/chains/mainnet.ts` - Added placeholder addresses
- `src/config/contracts/v4-contracts.ts` - Added PoolManager configuration
- `src/types/v4-types/index.ts` - Added v4MigratorHook to V4Addresses interface

### Indexer Files
- `src/indexer/indexer-shared.ts` - Added V4 migration detection and pool creation
- `src/indexer/indexer-v4-migrated.ts` - New file with PoolManager event handlers
- `src/indexer/index.ts` - Exported new indexer module

### ABI Files
- `src/abis/v4-abis/V4MigratorABI.ts` - Added V4Migrator contract ABI
- `src/abis/v4-abis/index.ts` - Exported V4MigratorABI
- `src/abis/index.ts` - Re-exported V4 ABIs

### Schema
- `ponder.schema.ts` - Added migration tracking fields

## Current Capabilities

### ✅ Fully Implemented
- Migration detection and pool creation
- Pool initialization tracking
- Swap event processing with volume and fee tracking
- Liquidity change monitoring
- Proper filtering to only track migrated pools
- Migration metadata linking old and new pools

### ⚠️ Future Enhancements (Not Critical)
- Individual position tracking (NFTs created during migration)
- StreamableFeesLocker integration for beneficiary tracking
- Protocol vs LP fee separation
- Daily volume aggregation resets
- Direct PoolManager state queries for real-time data

## Usage

The indexer now automatically:
1. Detects when assets migrate from Doppler to V4 pools
2. Creates appropriate pool entities with migration metadata
3. Tracks all activity on migrated V4 pools
4. Maintains links between old and new pools for historical analysis

Migrated pools can be identified by:
- Having a 32-byte pool ID as their address
- `type: "v4"` in the pool entity
- Non-null `migratedFromPool` field
- Sharing the `v4MigratorHook` address

This implementation provides comprehensive tracking of the full asset lifecycle from Doppler auction pools through to standard Uniswap V4 pools.