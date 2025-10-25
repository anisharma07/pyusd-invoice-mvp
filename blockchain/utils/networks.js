/**
 * Network configuration for different blockchains
 * Supports multichain architecture for future expansion
 */

const NETWORKS = {
    // Ethereum Sepolia Testnet
    sepolia: {
        chainId: 11155111,
        name: 'Sepolia Testnet',
        currency: 'ETH',
        rpcUrl: 'https://sepolia.infura.io/v3/',
        blockExplorer: 'https://sepolia.etherscan.io',
        pyusdAddress: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9', // PYUSD on Sepolia
        isTestnet: true,
        supported: true
    },
    
    // Ethereum Mainnet
    ethereum: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        currency: 'ETH',
        rpcUrl: 'https://mainnet.infura.io/v3/',
        blockExplorer: 'https://etherscan.io',
        pyusdAddress: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8', // PYUSD on Mainnet
        isTestnet: false,
        supported: false // Will be enabled later
    },
    
    // Polygon Mumbai Testnet
    mumbai: {
        chainId: 80001,
        name: 'Polygon Mumbai',
        currency: 'MATIC',
        rpcUrl: 'https://rpc-mumbai.maticvigil.com/',
        blockExplorer: 'https://mumbai.polygonscan.com',
        pyusdAddress: null, // PYUSD not deployed on Mumbai
        isTestnet: true,
        supported: false // Future support
    },
    
    // Polygon Mainnet
    polygon: {
        chainId: 137,
        name: 'Polygon Mainnet',
        currency: 'MATIC',
        rpcUrl: 'https://polygon-rpc.com/',
        blockExplorer: 'https://polygonscan.com',
        pyusdAddress: null, // PYUSD not available on Polygon yet
        isTestnet: false,
        supported: false // Future support
    },
    
    // BSC Testnet
    bscTestnet: {
        chainId: 97,
        name: 'BSC Testnet',
        currency: 'BNB',
        rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        blockExplorer: 'https://testnet.bscscan.com',
        pyusdAddress: null, // PYUSD not available on BSC
        isTestnet: true,
        supported: false // Future support
    },
    
    // BSC Mainnet
    bsc: {
        chainId: 56,
        name: 'BSC Mainnet',
        currency: 'BNB',
        rpcUrl: 'https://bsc-dataseed.binance.org/',
        blockExplorer: 'https://bscscan.com',
        pyusdAddress: null, // PYUSD not available on BSC
        isTestnet: false,
        supported: false // Future support
    }
};

/**
 * Get network configuration by chain ID
 */
function getNetworkByChainId(chainId) {
    return Object.values(NETWORKS).find(network => network.chainId === chainId);
}

/**
 * Get network configuration by name
 */
function getNetworkByName(name) {
    return NETWORKS[name];
}

/**
 * Get all supported networks
 */
function getSupportedNetworks() {
    return Object.entries(NETWORKS)
        .filter(([_, network]) => network.supported)
        .reduce((acc, [key, network]) => {
            acc[key] = network;
            return acc;
        }, {});
}

/**
 * Get default network (Sepolia for now)
 */
function getDefaultNetwork() {
    return NETWORKS.sepolia;
}

/**
 * Check if a network supports PYUSD
 */
function supportsPYUSD(networkName) {
    const network = NETWORKS[networkName];
    return network && network.pyusdAddress !== null;
}

/**
 * Contract addresses for different networks
 * Updated with deployed contract addresses
 */
const CONTRACT_ADDRESSES = {
    sepolia: {
        invoiceManager: '0x66bCb1F1cdf4f0338E79E3685CEe1144954B5a2b',
        pyusd: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'
    },
    ethereum: {
        invoiceManager: null,
        pyusd: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8'
    },
    // Future networks will be added here
};

/**
 * Update contract address after deployment
 */
function setContractAddress(networkName, contractName, address) {
    if (CONTRACT_ADDRESSES[networkName]) {
        CONTRACT_ADDRESSES[networkName][contractName] = address;
    }
}

/**
 * Get contract address for a network
 */
function getContractAddress(networkName, contractName) {
    return CONTRACT_ADDRESSES[networkName]?.[contractName];
}

/**
 * Network switching helper for MetaMask
 */
async function switchToNetwork(networkName) {
    const network = NETWORKS[networkName];
    if (!network) {
        throw new Error(`Unsupported network: ${networkName}`);
    }

    if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
    }

    try {
        // Try to switch to the network
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${network.chainId.toString(16)}` }],
        });
    } catch (switchError) {
        // If the network is not added to MetaMask, add it
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: `0x${network.chainId.toString(16)}`,
                        chainName: network.name,
                        nativeCurrency: {
                            name: network.currency,
                            symbol: network.currency,
                            decimals: 18,
                        },
                        rpcUrls: [network.rpcUrl],
                        blockExplorerUrls: [network.blockExplorer],
                    }],
                });
            } catch (addError) {
                throw new Error(`Failed to add network: ${addError.message}`);
            }
        } else {
            throw new Error(`Failed to switch network: ${switchError.message}`);
        }
    }
}

/**
 * Format amount based on token decimals
 */
function formatTokenAmount(amount, decimals = 6) {
    const factor = Math.pow(10, decimals);
    return Math.floor(amount * factor);
}

/**
 * Parse token amount from contract format
 */
function parseTokenAmount(amount, decimals = 6) {
    const factor = Math.pow(10, decimals);
    return Number(amount) / factor;
}

module.exports = {
    NETWORKS,
    CONTRACT_ADDRESSES,
    getNetworkByChainId,
    getNetworkByName,
    getSupportedNetworks,
    getDefaultNetwork,
    supportsPYUSD,
    setContractAddress,
    getContractAddress,
    switchToNetwork,
    formatTokenAmount,
    parseTokenAmount
};