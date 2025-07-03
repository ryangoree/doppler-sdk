import { Address } from "viem";
import { DopplerV3Addresses } from "./types";

export const DOPPLER_V3_ADDRESSES: { [chainId: number]: DopplerV3Addresses } = {
  // unichain sepolia
  1301: {
    airlock: "0x651ab94B4777e2e4cdf96082d90C65bd947b73A4" as Address,
    tokenFactory: "0xC5E5a19a2ee32831Fcb8a81546979AF43936EbaA" as Address,
    v3Initializer: "0x7Fb9a622186B4660A5988C223ebb9d3690dD5007" as Address,
    governanceFactory: "0x1E4332EEfAE9e4967C2D186f7b2d439D778e81cC" as Address,
    liquidityMigrator: "0x44C448E38A2C3D206c9132E7f645510dFbBC946b" as Address,
    universalRouter: "0xf70536B3bcC1bD1a972dc186A2cf84cC6da6Be5D" as Address,
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    quoterV2: "0x6Dd37329A1A225a6Fca658265D460423DCafBF89" as Address,
    univ2Router02: "0x284f11109359a7e1306c3e447ef14d38400063ff" as Address,
    bundler: "0x63f8C8F9beFaab2FaCD7Ece0b0242f78B920Ee90" as Address,
  },
  // unichain
  130: {
    airlock: "0x77EbfBAE15AD200758E9E2E61597c0B07d731254" as Address,
    tokenFactory: "0x43d0D97EC9241A8F05A264f94B82A1d2E600f2B3" as Address,
    v3Initializer: "0x9F4e56be80f08ba1A2445645EFa6d231E27b43ec" as Address,
    governanceFactory: "0x99C94B9Df930E1E21a4E4a2c105dBff21bF5c5aE" as Address,
    liquidityMigrator: "0xf6023127f6E937091D5B605680056A6D27524bad" as Address,
    universalRouter: "0xef740bf23acae26f6492b10de645d6b98dc8eaf3" as Address,
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    quoterV2: "0x385A5cf5F83e99f7BB2852b6A19C3538b9FA7658" as Address,
    univ2Router02: "0x284f11109359a7e1306c3e447ef14d38400063ff" as Address,
    bundler: "0x91231cDdD8d6C86Df602070a3081478e074b97b7" as Address,
  },
  // base sepolia
  84532: {
    airlock: '0xbe5ad4efe4085af00fd4a9e30b754cdcefe9c6ad' as Address,
    tokenFactory: '0xf140987e88208b1ef48cf5d39448cc82edf1f51e' as Address,
    v3Initializer: "0xb5e6ee3baa67004259846ad151bb0a2d2836f12d" as Address,
    governanceFactory: '0x482055c3a704610b22e77acc29863f92bcfd4298' as Address,
    noOpGovernanceFactory: '0x916b8987e4ad325c10d58ed8dc2036a6ff5eb228' as Address,
    liquidityMigrator: '0xd797e6af3211ae124b8edff69db21ffe6c659104' as Address,
    v4Migrator: '0xb2ec6559704467306d04322a5dc082b2af4562dd' as Address,
    streamableFeesLocker: '0x3345e557c5c0b474be1eb4693264008b8562aa9c' as Address,
    universalRouter: "0x492E6456D9528771018DeB9E87ef7750EF184104" as Address,
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    quoterV2: "0xC5290058841028F1614F3A6F0F5816cAd0df5E27" as Address,
    univ2Router02: "0x1689E7B1F10000AE47eBfE339a4f69dECd19F602" as Address,
    bundler: "0x8f4de9a41af4593ff34fd10892e51981e30acaf4" as Address,
  },
  // ink
  57073: {
    airlock: "0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12" as Address,
    tokenFactory: "0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45" as Address,
    v3Initializer: "0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5" as Address,
    governanceFactory: "0xb4deE32EB70A5E55f3D2d861F49Fb3D79f7a14d9" as Address,
    liquidityMigrator: "0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731" as Address,
    universalRouter: "0x112908dac86e20e7241b0927479ea3bf935d1fa0" as Address,
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    quoterV2: "0x96b572D2d880cf2Fa2563651BD23ADE6f5516652" as Address,
    univ2Router02: "0xB3FB126ACDd5AdCA2f50Ac644a7a2303745f18b4" as Address,
    bundler: "0x136191B46478cAB023cbC01a36160C4Aad81677a" as Address,
  },
  // base
  8453: {
    airlock: "0x660eAaEdEBc968f8f3694354FA8EC0b4c5Ba8D12" as Address,
    tokenFactory: "0xFAafdE6a5b658684cC5eb0C5c2c755B00A246F45" as Address,
    v3Initializer: "0xaA47D2977d622DBdFD33eeF6a8276727c52EB4e5" as Address,
    governanceFactory: "0xa82c66b6ddeb92089015c3565e05b5c9750b2d4b" as Address,
    liquidityMigrator: "0x5F3bA43D44375286296Cb85F1EA2EBfa25dde731" as Address,
    universalRouter: "0x6ff5693b99212da76ad316178a184ab56d299b43" as Address,
    permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
    quoterV2: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as Address,
    univ2Router02: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24" as Address,
    bundler: "0x136191B46478cAB023cbC01a36160C4Aad81677a" as Address,
    noOpGovernanceFactory: "0xe7dfbd5b0a2c3b4464653a9becdc489229ef090e" as Address,
    streamableFeesLocker: "0x0a00775d71a42cd33d62780003035e7f5b47bd3a" as Address,
    v4Migrator: "0x5328a67747c9db61457eb1a23be16bd73d1659c6" as Address,
  },
};
