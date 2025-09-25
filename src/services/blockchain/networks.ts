import { Network } from './types';

export const NETWORKS: Record<string, Network> = {
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    currency: 'ETH',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
    pyusdAddress: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9',
    isTestnet: true,
    supported: true
  },
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    currency: 'ETH',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io',
    pyusdAddress: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    isTestnet: false,
    supported: false
  },
  polygon: {
    chainId: 137,
    name: 'Polygon Mainnet',
    currency: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com/',
    blockExplorer: 'https://polygonscan.com',
    pyusdAddress: null,
    isTestnet: false,
    supported: false
  }
};

// Contract addresses updated with deployed contracts
export const CONTRACT_ADDRESSES: Record<string, { invoiceManager: string | null; pyusd: string | null }> = {
  sepolia: {
    invoiceManager: '0x66bCb1F1cdf4f0338E79E3685CEe1144954B5a2b',
    pyusd: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'
  },
  ethereum: {
    invoiceManager: null,
    pyusd: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8'
  }
};

export const getNetworkByChainId = (chainId: number): Network | undefined => {
  return Object.values(NETWORKS).find(network => network.chainId === chainId);
};

export const getDefaultNetwork = (): Network => {
  return NETWORKS.sepolia;
};

export const getSupportedNetworks = (): Network[] => {
  return Object.values(NETWORKS).filter(network => network.supported);
};

export const formatTokenAmount = (amount: number, decimals: number = 6): string => {
  const factor = Math.pow(10, decimals);
  return Math.floor(amount * factor).toString();
};

export const parseTokenAmount = (amount: string, decimals: number = 6): number => {
  const factor = Math.pow(10, decimals);
  return Number(amount) / factor;
};