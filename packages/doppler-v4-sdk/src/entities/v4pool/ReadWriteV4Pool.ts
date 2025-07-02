import {
  WriteContract,
  ReadContract,
  WriteAdapter,
  Drift,
  createDrift,
  WriteFunction,
  AdapterWriteMethod,
} from '@delvtech/drift';
import { Address, Hex, TransactionReceipt } from 'viem';
import { poolManagerAbi, stateViewAbi } from '@/abis';
import { PoolKey } from '@/types';
import { ReadV4Pool } from './ReadV4Pool';

type PoolManagerABI = typeof poolManagerAbi;
type StateViewABI = typeof stateViewAbi;

export interface SwapParams {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96?: bigint;
  recipient?: Address;
  hookData?: Hex;
}

export interface ModifyLiquidityParams {
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;
  salt?: Hex;
}

export interface DonateParams {
  amount0: bigint;
  amount1: bigint;
}

/**
 * A read-write interface for interacting with standard Uniswap V4 pools.
 *
 * The ReadWriteV4Pool class extends ReadV4Pool to provide methods for executing
 * swaps, managing liquidity, and performing other write operations on V4 pools.
 *
 * @example
 * ```typescript
 * const pool = new ReadWriteV4Pool(
 *   poolManagerContract,
 *   stateViewContract,
 *   poolKey
 * );
 * 
 * // Execute a swap
 * await pool.swap({
 *   zeroForOne: true,
 *   amountSpecified: parseEther('1'),
 *   sqrtPriceLimitX96: 0n
 * });
 * 
 * // Add liquidity
 * await pool.modifyLiquidity({
 *   tickLower: -60,
 *   tickUpper: 60,
 *   liquidityDelta: parseEther('100')
 * });
 * ```
 */
export class ReadWriteV4Pool extends ReadV4Pool {
  poolManagerWrite: WriteContract<PoolManagerABI>;
  driftWrite: Drift<WriteAdapter>;

  constructor(
    poolManager: WriteContract<PoolManagerABI>,
    stateView: ReadContract<StateViewABI>,
    poolKey: PoolKey,
    drift?: Drift<WriteAdapter>
  ) {
    // Pass the poolManager as ReadContract to parent class
    super(poolManager as any, stateView, poolKey, drift as any);
    
    this.poolManagerWrite = poolManager;
    this.driftWrite = drift || createDrift({ rpcUrl: poolManager.rpcUrl });
  }

  /**
   * Executes a swap on the V4 pool.
   * 
   * @param params Swap parameters
   * @returns Transaction receipt
   */
  async swap(params: SwapParams): Promise<TransactionReceipt> {
    const swapParams = {
      zeroForOne: params.zeroForOne,
      amountSpecified: params.amountSpecified,
      sqrtPriceLimitX96: params.sqrtPriceLimitX96 || 0n,
    };

    // V4 swaps are executed through the PoolManager's swap function
    const txHash = await this.poolManagerWrite.write({
      functionName: 'swap',
      args: [
        this.poolKey,
        swapParams,
        params.hookData || '0x', // Empty hook data for standard pools
      ],
    });

    return this.driftWrite.waitForTransaction({ txHash });
  }

  /**
   * Modifies liquidity in the pool (add or remove).
   * 
   * @param params Liquidity modification parameters
   * @returns Transaction receipt
   */
  async modifyLiquidity(params: ModifyLiquidityParams): Promise<TransactionReceipt> {
    const modifyLiquidityParams = {
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
      liquidityDelta: params.liquidityDelta,
      salt: params.salt || '0x0000000000000000000000000000000000000000000000000000000000000000',
    };

    // V4 liquidity modifications go through the PoolManager
    const txHash = await this.poolManagerWrite.write({
      functionName: 'modifyLiquidity',
      args: [
        this.poolKey,
        modifyLiquidityParams,
        '0x', // Hook data
      ],
    });

    return this.driftWrite.waitForTransaction({ txHash });
  }

  /**
   * Adds liquidity to the pool.
   * This is a convenience method that calls modifyLiquidity with positive delta.
   * 
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to add
   * @param salt Optional salt for position identification
   * @returns Transaction receipt
   */
  async addLiquidity(
    tickLower: number,
    tickUpper: number,
    liquidity: bigint,
    salt?: Hex
  ): Promise<TransactionReceipt> {
    return this.modifyLiquidity({
      tickLower,
      tickUpper,
      liquidityDelta: liquidity,
      salt,
    });
  }

  /**
   * Removes liquidity from the pool.
   * This is a convenience method that calls modifyLiquidity with negative delta.
   * 
   * @param tickLower Lower tick of the position
   * @param tickUpper Upper tick of the position
   * @param liquidity Amount of liquidity to remove
   * @param salt Optional salt for position identification
   * @returns Transaction receipt
   */
  async removeLiquidity(
    tickLower: number,
    tickUpper: number,
    liquidity: bigint,
    salt?: Hex
  ): Promise<TransactionReceipt> {
    return this.modifyLiquidity({
      tickLower,
      tickUpper,
      liquidityDelta: -liquidity,
      salt,
    });
  }

  /**
   * Donates tokens to the pool.
   * This increases the pool's liquidity without minting positions.
   * 
   * @param params Donation parameters
   * @returns Transaction receipt
   */
  async donate(params: DonateParams): Promise<TransactionReceipt> {
    const txHash = await this.poolManagerWrite.write({
      functionName: 'donate',
      args: [
        this.poolKey,
        params.amount0,
        params.amount1,
        '0x', // Hook data
      ],
    });

    return this.driftWrite.waitForTransaction({ txHash });
  }

  /**
   * Initializes a new V4 pool with the given sqrt price.
   * This can only be called once per pool.
   * 
   * @param sqrtPriceX96 Initial sqrt price in X96 format
   * @param hookData Optional data to pass to hooks
   * @returns Transaction receipt
   */
  async initialize(
    sqrtPriceX96: bigint,
    hookData?: Hex
  ): Promise<TransactionReceipt> {
    const txHash = await this.poolManagerWrite.write({
      functionName: 'initialize',
      args: [
        this.poolKey,
        sqrtPriceX96,
        hookData || '0x',
      ],
    });

    return this.driftWrite.waitForTransaction({ txHash });
  }

  /**
   * Takes tokens from the pool (requires permission).
   * This is typically used by hooks or other authorized contracts.
   * 
   * @param currency Address of the currency to take
   * @param recipient Address to receive the tokens
   * @param amount Amount to take
   * @returns Transaction receipt
   */
  async take(
    currency: Address,
    recipient: Address,
    amount: bigint
  ): Promise<TransactionReceipt> {
    const txHash = await this.poolManagerWrite.write({
      functionName: 'take',
      args: [currency, recipient, amount],
    });

    return this.driftWrite.waitForTransaction({ txHash });
  }

  /**
   * Settles tokens with the pool.
   * This is typically used after take operations.
   * 
   * @returns Transaction receipt
   */
  async settle(): Promise<TransactionReceipt> {
    const txHash = await this.poolManagerWrite.write({
      functionName: 'settle',
      args: [],
    });

    return this.driftWrite.waitForTransaction({ txHash });
  }
}