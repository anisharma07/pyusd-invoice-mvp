/**
 * Network Management Utility
 * Helps users add Sepolia testnet to MetaMask
 */

import { NETWORKS } from '../services/blockchain/web3Service';

export class NetworkManager {
  private static instance: NetworkManager;

  private constructor() {}

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  /**
   * Add Sepolia network to MetaMask
   */
  public async addSepoliaNetwork(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const network = NETWORKS.sepolia;
      const chainIdHex = `0x${network.chainId.toString(16)}`;

      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: chainIdHex,
          chainName: network.name,
          nativeCurrency: {
            name: network.currency,
            symbol: network.currency,
            decimals: 18,
          },
          rpcUrls: ['https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'], // Public Infura endpoint
          blockExplorerUrls: [network.blockExplorer],
        }],
      });

      console.log('✅ Sepolia network added successfully');
      return { success: true };

    } catch (error: any) {
      console.error('❌ Failed to add Sepolia network:', error);
      return {
        success: false,
        error: error.message || 'Failed to add network'
      };
    }
  }

  /**
   * Switch to Sepolia network
   */
  public async switchToSepolia(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const network = NETWORKS.sepolia;
      const chainIdHex = `0x${network.chainId.toString(16)}`;

      try {
        // Try to switch first
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });

        console.log('✅ Switched to Sepolia network');
        return { success: true };

      } catch (switchError: any) {
        // If network doesn't exist (error 4902), add it
        if (switchError.code === 4902) {
          console.log('🔄 Network not found, adding Sepolia...');
          return await this.addSepoliaNetwork();
        } else {
          throw switchError;
        }
      }

    } catch (error: any) {
      console.error('❌ Failed to switch to Sepolia:', error);
      return {
        success: false,
        error: error.message || 'Failed to switch network'
      };
    }
  }

  /**
   * Add PYUSD token to MetaMask
   */
  public async addPYUSDToken(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const network = NETWORKS.sepolia;
      if (!network.pyusdAddress) {
        throw new Error('PYUSD address not configured for Sepolia');
      }

      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: network.pyusdAddress,
            symbol: 'PYUSD',
            decimals: 6,
            image: 'https://assets.coingecko.com/coins/images/31212/small/PYUSD_Logo_%282%29.png',
          },
        },
      });

      console.log('✅ PYUSD token added to MetaMask');
      return { success: true };

    } catch (error: any) {
      console.error('❌ Failed to add PYUSD token:', error);
      return {
        success: false,
        error: error.message || 'Failed to add token'
      };
    }
  }

  /**
   * Setup complete Sepolia environment (network + token)
   */
  public async setupSepoliaEnvironment(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🚀 Setting up Sepolia environment...');

      // Step 1: Add/Switch to Sepolia network
      const networkResult = await this.switchToSepolia();
      if (!networkResult.success) {
        throw new Error(networkResult.error || 'Failed to setup network');
      }

      // Step 2: Add PYUSD token
      const tokenResult = await this.addPYUSDToken();
      if (!tokenResult.success) {
        console.warn('⚠️ Failed to add PYUSD token, but continuing...');
      }

      console.log('✅ Sepolia environment setup complete!');
      return { success: true };

    } catch (error: any) {
      console.error('❌ Failed to setup Sepolia environment:', error);
      return {
        success: false,
        error: error.message || 'Failed to setup environment'
      };
    }
  }

  /**
   * Get current network info
   */
  public async getCurrentNetwork(): Promise<{ chainId: number; networkName?: string }> {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdNumber = parseInt(chainId, 16);
      
      const networkName = Object.entries(NETWORKS).find(
        ([_, network]) => network.chainId === chainIdNumber
      )?.[1]?.name;

      return {
        chainId: chainIdNumber,
        networkName
      };

    } catch (error) {
      console.error('❌ Failed to get current network:', error);
      return { chainId: 0 };
    }
  }

  /**
   * Check if user is on Sepolia network
   */
  public async isOnSepolia(): Promise<boolean> {
    try {
      const { chainId } = await this.getCurrentNetwork();
      return chainId === NETWORKS.sepolia.chainId;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const networkManager = NetworkManager.getInstance();

// Add to window for console debugging
if (typeof window !== 'undefined') {
  (window as any).networkManager = networkManager;
}