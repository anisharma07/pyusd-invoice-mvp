import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletState, Network } from '../../services/blockchain/types';
import { getNetworkByChainId, getDefaultNetwork } from '../../services/blockchain/networks';
import { blockchainService } from '../../services/blockchain/blockchain';
import { walletDetectionService, WalletProvider as WalletProviderType } from '../../services/wallet/walletDetectionService';

interface WalletContextType extends WalletState {
  connectWallet: (walletId?: string) => Promise<boolean>;
  disconnectWallet: () => void;
  switchNetwork: (networkName: string) => Promise<boolean>;
  switchWallet: (walletId: string) => Promise<boolean>;
  refreshBalance: () => Promise<void>;
  isMetaMaskInstalled: () => boolean;
  getAvailableWallets: () => WalletProviderType[];
  getCurrentWalletType: () => string;
  getAccounts: () => Promise<string[]>;
  requestAccountAccess: () => Promise<boolean>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: '0',
    chainId: null,
    network: null,
    isLoading: false,
    error: null
  });

  const isMetaMaskInstalled = (): boolean => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  };

  const connectWallet = async (): Promise<boolean> => {
    try {
      setWalletState(prev => ({ ...prev, isLoading: true, error: null }));

      if (!isMetaMaskInstalled()) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.');
      }

      // Get network info
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdNumber = parseInt(chainId, 16);
      const network = getNetworkByChainId(chainIdNumber);

      if (!network) {
        console.warn(`Unknown network: ${chainIdNumber}. Using default network.`);
      }

      // Initialize blockchain service
      const initialized = await blockchainService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize blockchain service');
      }

      // Get balance
      const balance = await blockchainService.getPYUSDBalance(accounts[0]);

      setWalletState({
        isConnected: true,
        address: accounts[0],
        balance,
        chainId: chainIdNumber,
        network: network || getDefaultNetwork(),
        isLoading: false,
        error: null
      });

      // Set up event listeners
      setupEventListeners();

      console.log('✅ Wallet connected successfully');
      return true;

    } catch (error: any) {
      console.error('❌ Failed to connect wallet:', error);
      setWalletState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to connect wallet'
      }));
      return false;
    }
  };

  const disconnectWallet = (): void => {
    setWalletState({
      isConnected: false,
      address: null,
      balance: '0',
      chainId: null,
      network: null,
      isLoading: false,
      error: null
    });

    // Remove event listeners
    removeEventListeners();

    console.log('🔌 Wallet disconnected');
  };

  const switchNetwork = async (networkName: string): Promise<boolean> => {
    try {
      setWalletState(prev => ({ ...prev, isLoading: true, error: null }));

      const success = await blockchainService.switchNetwork(networkName);
      
      if (success) {
        // Refresh wallet state after network switch
        await refreshWalletState();
      }

      setWalletState(prev => ({ ...prev, isLoading: false }));
      return success;

    } catch (error: any) {
      console.error('❌ Failed to switch network:', error);
      setWalletState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to switch network'
      }));
      return false;
    }
  };

  const refreshBalance = async (): Promise<void> => {
    try {
      if (!walletState.address) return;

      const balance = await blockchainService.getPYUSDBalance(walletState.address);
      setWalletState(prev => ({ ...prev, balance }));

    } catch (error) {
      console.error('❌ Failed to refresh balance:', error);
    }
  };

  const refreshWalletState = async (): Promise<void> => {
    try {
      if (!window.ethereum) return;

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (!accounts || accounts.length === 0) {
        disconnectWallet();
        return;
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdNumber = parseInt(chainId, 16);
      const network = getNetworkByChainId(chainIdNumber);
      const balance = await blockchainService.getPYUSDBalance(accounts[0]);

      setWalletState(prev => ({
        ...prev,
        address: accounts[0],
        chainId: chainIdNumber,
        network: network || getDefaultNetwork(),
        balance
      }));

    } catch (error) {
      console.error('❌ Failed to refresh wallet state:', error);
    }
  };

  const setupEventListeners = (): void => {
    if (!window.ethereum) return;

    // Remove existing listeners first
    window.ethereum.removeAllListeners('accountsChanged');
    window.ethereum.removeAllListeners('chainChanged');

    // Account changed
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      console.log('🔄 Accounts changed:', accounts);
      if (!accounts || accounts.length === 0) {
        console.log('No accounts available, disconnecting...');
        disconnectWallet();
      } else if (accounts[0] !== walletState.address) {
        console.log(`Account switched from ${walletState.address} to ${accounts[0]}`);
        setWalletState(prev => ({ 
          ...prev, 
          address: accounts[0],
          balance: '0' // Reset balance for new account
        }));
        // Refresh balance for new account
        setTimeout(() => refreshBalance(), 100);
      }
    });

    // Chain changed
    window.ethereum.on('chainChanged', (chainId: string) => {
      console.log('🔄 Chain changed:', chainId);
      const chainIdNumber = parseInt(chainId, 16);
      const network = getNetworkByChainId(chainIdNumber);
      
      setWalletState(prev => ({
        ...prev,
        chainId: chainIdNumber,
        network: network || getDefaultNetwork()
      }));

      // Reinitialize blockchain service with new network
      blockchainService.initialize().then(() => {
        refreshBalance();
      });
    });

    // Connection status
    window.ethereum.on('connect', (connectInfo: { chainId: string }) => {
      console.log('🔗 MetaMask connected:', connectInfo);
    });

    window.ethereum.on('disconnect', (error: any) => {
      console.log('🔌 MetaMask disconnected:', error);
      disconnectWallet();
    });
  };

  const removeEventListeners = (): void => {
    if (!window.ethereum) return;

    window.ethereum.removeAllListeners('accountsChanged');
    window.ethereum.removeAllListeners('chainChanged');
    window.ethereum.removeAllListeners('connect');
    window.ethereum.removeAllListeners('disconnect');
  };

  // Check for existing connection on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (!isMetaMaskInstalled()) return;

      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        
        if (accounts && accounts.length > 0) {
          // Auto-connect if already authorized
          await connectWallet();
        }
      } catch (error) {
        console.error('❌ Failed to check existing connection:', error);
      }
    };

    checkExistingConnection();
  }, []);

  // Cleanup event listeners on unmount
  useEffect(() => {
    return () => {
      removeEventListeners();
    };
  }, []);

  // New wallet switching methods
  const switchWallet = async (walletId: string): Promise<boolean> => {
    try {
      setWalletState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Disconnect current wallet
      if (walletState.isConnected) {
        disconnectWallet();
      }
      
      // Connect to new wallet
      const connectionResult = await walletDetectionService.connectWallet(walletId);
      if (connectionResult.success && connectionResult.accounts && connectionResult.accounts.length > 0) {
        const address = connectionResult.accounts[0];
        const chainId = connectionResult.chainId || 1;
        
        // Get network info
        const network = getNetworkByChainId(chainId) || getDefaultNetwork();
        
        // Get balance
        let balance = '0';
        try {
          const balanceWei = await window.ethereum?.request({
            method: 'eth_getBalance',
            params: [address, 'latest']
          });
          if (balanceWei) {
            balance = (parseInt(balanceWei, 16) / 1e18).toString();
          }
        } catch (e) {
          console.warn('Failed to get balance:', e);
        }
        
        setWalletState({
          isConnected: true,
          address: address,
          balance: balance,
          chainId: chainId,
          network: network,
          isLoading: false,
          error: null
        });
        
        // Switch blockchain service to new provider
        const availableWallets = walletDetectionService.getAvailableWallets();
        const wallet = availableWallets.find(w => w.id === walletId);
        if (wallet?.provider) {
          await blockchainService.switchWalletProvider(wallet.provider);
        }
        
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Failed to switch wallet:', error);
      setWalletState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error.message || 'Failed to switch wallet'
      }));
      return false;
    }
  };

  const getAvailableWallets = (): WalletProviderType[] => {
    return walletDetectionService.getAvailableWallets();
  };

  const getCurrentWalletType = (): string => {
    if (!window.ethereum) return 'none';
    
    if (window.ethereum.isMetaMask) return 'metamask';
    if (window.ethereum.isCoinbaseWallet) return 'coinbase';
    if (window.ethereum.isTrust) return 'trust';
    if (window.ethereum.isRainbow) return 'rainbow';
    
    return 'unknown';
  };

  const getAccounts = async (): Promise<string[]> => {
    try {
      if (!window.ethereum) return [];
      
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts || [];
    } catch (error) {
      console.error('❌ Failed to get accounts:', error);
      return [];
    }
  };

  const requestAccountAccess = async (): Promise<boolean> => {
    try {
      if (!window.ethereum) return false;
      
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      if (accounts && accounts.length > 0) {
        // This will trigger the accountsChanged event if user switches account
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to request account access:', error);
      return false;
    }
  };

  const contextValue: WalletContextType = {
    ...walletState,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    switchWallet,
    refreshBalance,
    isMetaMaskInstalled,
    getAvailableWallets,
    getCurrentWalletType,
    getAccounts,
    requestAccountAccess
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};