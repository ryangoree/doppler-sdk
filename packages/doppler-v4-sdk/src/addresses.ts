import { Address } from 'viem';
import { DopplerV4Addresses } from './types';

export const DOPPLER_V4_ADDRESSES: { [chainId: number]: DopplerV4Addresses } = {
  // unichain sepolia
  1301: {
    poolManager: '0x00B036B58a818B1BC34d502D3fE730Db729e62AC' as Address,
    airlock: '0x651ab94B4777e2e4cdf96082d90C65bd947b73A4' as Address,
    tokenFactory: '0xC5E5a19a2ee32831Fcb8a81546979AF43936EbaA' as Address,
    dopplerDeployer: '0x8350cAd81149A9944c2fb4276955FaAA7D61e836' as Address,
    v4Initializer: '0x992375478626E67F4e639d3298EbCAaE51C3dF0b' as Address,
    v3Initializer: '0x7Fb9a622186B4660A5988C223ebb9d3690dD5007' as Address,
    governanceFactory: '0x1E4332EEfAE9e4967C2D186f7b2d439D778e81cC' as Address,
    migrator: '0x44C448E38A2C3D206c9132E7f645510dFbBC946b' as Address,
    universalRouter: '0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D' as Address,
    stateView: '0xc199F1072a74D4e905ABa1A84d9a45E2546B6222' as Address,
    v4Quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472' as Address,
  },
  84532: {
    poolManager: '0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408' as Address,
    airlock: '0xbbe45B9FE9A63a891767f0669cCA6b83c1d987C6' as Address,
    tokenFactory: '0x468430e672103207e510EAC2A38b9c3BeD86103e' as Address,
    dopplerDeployer: '0xEA32848cEe430D91aBa9d7d0F235502995a52B13' as Address,
    governanceFactory: '0xf868B7fcDfb7f2F4EC0731A36C377865EAce29Ea' as Address,
    v4Initializer: '0x8eEE9cc0445bED987E4C5b0329A298892F441B94' as Address,
    migrator: '0x92e0E12f150c0c48f3F0C5b96F6a031f46BA7944' as Address,
    v3Initializer: '0x0B2B6F7852851510f98BF18F59F8e18b065ea944' as Address,
    universalRouter: '0x492e6456d9528771018deb9e87ef7750ef184104' as Address,
    stateView: '0x571291b572ed32ce6751a2cb2486ebee8defb9b4' as Address,
    v4Quoter: '0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba' as Address,
  },
};
