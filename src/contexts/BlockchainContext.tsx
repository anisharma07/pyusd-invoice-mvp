import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { web3Service, Web3Service, WalletState, InvoiceData } from '../services/blockchain/web3Service';
import { ipfsService } from '../services/blockchain/ipfsService';
import { qrCodeService } from '../services/blockchain/qrCodeService';

interface BlockchainContextType {
  // Wallet state
  walletState: WalletState | null;
  isLoading: boolean;
  error: string | null;
  
  // Wallet actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  switchToSepolia: () => Promise<boolean>;
  
  // Invoice actions
  createBlockchainInvoice: (invoiceData: any) => Promise<{ success: boolean; invoiceId?: number; error?: string }>;
  payInvoice: (invoiceId: number) => Promise<{ success: boolean; error?: string }>;
  getInvoice: (invoiceId: number) => Promise<InvoiceData | null>;
  getUserInvoices: () => Promise<number[]>;
  
  // QR code actions
  generatePaymentQR: (invoiceId: number, amount: string) => Promise<{ success: boolean; qrCodeDataUrl?: string; error?: string }>;
  
  // Utility functions
  refreshWalletState: () => Promise<void>;
  clearError: () => void;
}

const BlockchainContext = createContext<BlockchainContextType | undefined>(undefined);

interface BlockchainProviderProps {
  children: ReactNode;
}

export const BlockchainProvider: React.FC<BlockchainProviderProps> = ({ children }) => {
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Web3Service
  useEffect(() => {
    const initialize = async () => {
      const initialized = await web3Service.initialize();
      if (!initialized) {
        setError('Failed to initialize Web3 service');
      }
    };
    
    initialize();
  }, []);

  // Check if wallet is already connected
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            await refreshWalletState();
          }
        } catch (error) {
          console.error('Failed to check wallet connection:', error);
        }
      }
    };
    
    checkConnection();
  }, []);

  const connectWallet = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!Web3Service.isMetaMaskInstalled()) {
        throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
      }
      
      const newWalletState = await web3Service.connectWallet();
      setWalletState(newWalletState);
      
      if (!newWalletState.isCorrectNetwork) {
        setError('Please switch to Sepolia Testnet to use blockchain features');
      }
      
    } catch (error: any) {
      setError(error.message || 'Failed to connect wallet');
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = async (): Promise<void> => {
    try {
      setIsLoading(true);
      await web3Service.disconnectWallet();
      setWalletState(null);
      setError(null);
    } catch (error: any) {
      setError(error.message || 'Failed to disconnect wallet');
      console.error('Failed to disconnect wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchToSepolia = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const success = await web3Service.switchToSepolia();
      if (success) {
        // Refresh wallet state after network switch
        setTimeout(async () => {
          await refreshWalletState();
        }, 1000);
      } else {
        setError('Failed to switch to Sepolia Testnet');
      }
      
      return success;
    } catch (error: any) {
      setError(error.message || 'Failed to switch network');
      console.error('Failed to switch to Sepolia:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshWalletState = async (): Promise<void> => {
    try {
      const newWalletState = await web3Service.getWalletState();
      setWalletState(newWalletState);
      
      if (newWalletState && !newWalletState.isCorrectNetwork) {
        setError('Please switch to Sepolia Testnet to use blockchain features');
      } else {
        setError(null);
      }
    } catch (error: any) {
      console.error('Failed to refresh wallet state:', error);
      setError('Failed to refresh wallet state');
    }
  };

  const createBlockchainInvoice = async (invoiceData: any): Promise<{ success: boolean; invoiceId?: number; error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!walletState?.isConnected) {
        throw new Error('Wallet not connected');
      }
      
      if (!walletState.isCorrectNetwork) {
        throw new Error('Please switch to Sepolia Testnet');
      }
      
      // Upload invoice data to IPFS first
      console.log('📤 Uploading invoice data to IPFS...');
      const ipfsResult = await ipfsService.uploadInvoiceData(invoiceData);
      
      if (!ipfsResult.success) {
        throw new Error(ipfsResult.error || 'Failed to upload to IPFS');
      }
      
      console.log('✅ Invoice data uploaded to IPFS:', ipfsResult.ipfsHash);
      
      // Create invoice on blockchain
      console.log('⛓️ Creating invoice on blockchain...');
      const result = await web3Service.createInvoice(invoiceData.amount, ipfsResult.ipfsHash!);
      
      if (result.success) {
        console.log('✅ Invoice created on blockchain:', result.invoiceId);
        // Refresh wallet state to update balances
        await refreshWalletState();
      }
      
      return result;
      
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create blockchain invoice';
      setError(errorMessage);
      console.error('Failed to create blockchain invoice:', error);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  const payInvoice = async (invoiceId: number): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!walletState?.isConnected) {
        throw new Error('Wallet not connected');
      }
      
      if (!walletState.isCorrectNetwork) {
        throw new Error('Please switch to Sepolia Testnet');
      }
      
      console.log('💳 Paying invoice:', invoiceId);
      const result = await web3Service.payInvoice(invoiceId);
      
      if (result.success) {
        console.log('✅ Invoice paid successfully');
        // Refresh wallet state to update balances
        await refreshWalletState();
      }
      
      return result;
      
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to pay invoice';
      setError(errorMessage);
      console.error('Failed to pay invoice:', error);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  const getInvoice = async (invoiceId: number): Promise<InvoiceData | null> => {
    try {
      if (!walletState?.isConnected || !walletState.isCorrectNetwork) {
        return null;
      }
      
      return await web3Service.getInvoice(invoiceId);
    } catch (error: any) {
      console.error('Failed to get invoice:', error);
      setError(error.message || 'Failed to get invoice');
      return null;
    }
  };

  const getUserInvoices = async (): Promise<number[]> => {
    try {
      if (!walletState?.isConnected || !walletState.isCorrectNetwork || !walletState.address) {
        return [];
      }
      
      return await web3Service.getOrganizationInvoices(walletState.address);
    } catch (error: any) {
      console.error('Failed to get user invoices:', error);
      setError(error.message || 'Failed to get user invoices');
      return [];
    }
  };

  const generatePaymentQR = async (invoiceId: number, amount: string): Promise<{ success: boolean; qrCodeDataUrl?: string; error?: string }> => {
    try {
      // This would need the actual contract address after deployment
      const contractAddress = '0x0000000000000000000000000000000000000000'; // Update after deployment
      
      return await qrCodeService.generatePaymentQR(invoiceId, amount, contractAddress);
    } catch (error: any) {
      console.error('Failed to generate payment QR:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate payment QR'
      };
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  const contextValue: BlockchainContextType = {
    walletState,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    switchToSepolia,
    createBlockchainInvoice,
    payInvoice,
    getInvoice,
    getUserInvoices,
    generatePaymentQR,
    refreshWalletState,
    clearError
  };

  return (
    <BlockchainContext.Provider value={contextValue}>
      {children}
    </BlockchainContext.Provider>
  );
};

export const useBlockchain = (): BlockchainContextType => {
  const context = useContext(BlockchainContext);
  if (context === undefined) {
    throw new Error('useBlockchain must be used within a BlockchainProvider');
  }
  return context;
};