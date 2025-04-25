import {
  ReadContract,
  ReadAdapter,
  Drift,
  createDrift,
  FunctionReturn,
} from '@delvtech/drift';
import { Address } from 'abitype';
import { dopplerAbi, stateViewAbi } from '@/abis';
import { encodePacked, Hex, keccak256 } from 'viem';
import { PoolKey } from '@/types';
import { ReadDerc20 } from '../token/derc20/ReadDerc20';
import { ReadEth } from '../token/eth/ReadEth';
import { ETH_ADDRESS } from '@/constants';

type DopplerABI = typeof dopplerAbi;
type StateViewABI = typeof stateViewAbi;

export class ReadDoppler {
  drift: Drift<ReadAdapter>;
  address: Address;
  doppler: ReadContract<DopplerABI>;
  stateView: ReadContract<StateViewABI>;
  poolId: Hex;

  constructor(
    dopplerAddress: Hex,
    stateViewAddress: Hex,
    drift: Drift<ReadAdapter> = createDrift(),
    poolId: Hex
  ) {
    this.address = dopplerAddress;
    this.doppler = drift.contract({
      abi: dopplerAbi,
      address: dopplerAddress,
    });
    this.stateView = drift.contract({
      abi: stateViewAbi,
      address: stateViewAddress,
    });
    this.poolId = poolId;
    this.drift = drift;
  }

  public async getPosition(
    salt: Hex
  ): Promise<FunctionReturn<DopplerABI, 'positions'>> {
    return this.doppler.read('positions', { salt });
  }

  public async getSlot0(
    id: Hex
  ): Promise<FunctionReturn<StateViewABI, 'getSlot0'>> {
    return this.stateView.read('getSlot0', { poolId: id });
  }

  public async getCurrentPrice(): Promise<bigint> {
    const { sqrtPriceX96 } = await this.getSlot0(this.poolId);
    return (sqrtPriceX96 * sqrtPriceX96) / BigInt(2 ** 192);
  }

  public async getPoolKey(): Promise<PoolKey> {
    return this.doppler.read('poolKey');
  }

  public async getPoolId(): Promise<Hex> {
    const poolKey = await this.getPoolKey();
    const tokenA =
      poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase()
        ? poolKey.currency1
        : poolKey.currency0;
    const tokenB =
      poolKey.currency0.toLowerCase() > poolKey.currency1.toLowerCase()
        ? poolKey.currency0
        : poolKey.currency1;

    const poolId = keccak256(
      encodePacked(
        ['address', 'address', 'uint24', 'uint24', 'address'],
        [tokenA, tokenB, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
      )
    );

    return poolId;
  }

  public async getAssetToken(): Promise<ReadDerc20> {
    const poolKey = await this.getPoolKey();
    return new ReadDerc20(poolKey.currency1, this.drift);
  }

  public async getQuoteToken(): Promise<ReadDerc20 | ReadEth> {
    const poolKey = await this.getPoolKey();
    return poolKey.currency0.toLowerCase() === ETH_ADDRESS.toLowerCase()
      ? new ReadEth(this.drift)
      : new ReadDerc20(poolKey.currency0, this.drift);
  }

  public async getState(): Promise<FunctionReturn<DopplerABI, 'state'>> {
    return this.doppler.read('state');
  }

  public async getInsufficientProceeds(): Promise<boolean> {
    return this.doppler.read('insufficientProceeds');
  }

  public async getEarlyExit(): Promise<boolean> {
    return this.doppler.read('earlyExit');
  }

  public async getNumTokensToSell(): Promise<bigint> {
    return this.doppler.read('numTokensToSell');
  }

  public async getMinimumProceeds(): Promise<bigint> {
    return this.doppler.read('minimumProceeds');
  }

  public async getMaximumProceeds(): Promise<bigint> {
    return this.doppler.read('maximumProceeds');
  }

  public async getStartingTime(): Promise<bigint> {
    return this.doppler.read('startingTime');
  }

  public async getEndingTime(): Promise<bigint> {
    return this.doppler.read('endingTime');
  }

  public async getStartingTick(): Promise<number> {
    return this.doppler.read('startingTick');
  }

  public async getEndingTick(): Promise<number> {
    return this.doppler.read('endingTick');
  }

  public async getEpochLength(): Promise<bigint> {
    return this.doppler.read('epochLength');
  }

  public async getGamma(): Promise<number> {
    return this.doppler.read('gamma');
  }

  public async getIsToken0(): Promise<boolean> {
    return this.doppler.read('isToken0');
  }

  public async getNumPDSlugs(): Promise<bigint> {
    return this.doppler.read('numPDSlugs');
  }
}
