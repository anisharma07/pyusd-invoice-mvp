/**
 * Wallet Detection and Management Service
 * Detects available wallet providers and manages connections
 */

export interface WalletProvider {
  id: string;
  name: string;
  icon: string;
  installed: boolean;
  description: string;
  downloadUrl?: string;
  provider?: any;
}

export interface ConnectedAccount {
  address: string;
  balance: string;
  pyusdBalance: string;
  ensName?: string;
}

export interface ConnectedWallet {
  providerId: string;
  providerName: string;
  accounts: ConnectedAccount[];
  currentAccount: ConnectedAccount;
  chainId: number;
  isActive: boolean;
}

export class WalletDetectionService {
  private static instance: WalletDetectionService;
  private availableWallets: WalletProvider[] = [];

  private constructor() {
    this.initializeWalletProviders();
  }

  public static getInstance(): WalletDetectionService {
    if (!WalletDetectionService.instance) {
      WalletDetectionService.instance = new WalletDetectionService();
    }
    return WalletDetectionService.instance;
  }

  private initializeWalletProviders(): void {
    this.availableWallets = [
      {
        id: 'metamask',
        name: 'MetaMask',
        icon: '🦊',
        installed: this.isMetaMaskInstalled(),
        description: 'Most popular Ethereum wallet',
        downloadUrl: 'https://metamask.io/download/',
        provider: typeof window !== 'undefined' ? window.ethereum : null
      },
      {
        id: 'walletconnect',
        name: 'WalletConnect',
        icon: '🔗',
        installed: true, // WalletConnect is always "available" as it connects to external wallets
        description: 'Connect to mobile wallets',
        provider: null // Will be initialized when needed
      },
      {
        id: 'coinbase',
        name: 'Coinbase Wallet',
        icon: '🔵',
        installed: this.isCoinbaseWalletInstalled(),
        description: 'Coinbase self-custody wallet',
        downloadUrl: 'https://www.coinbase.com/wallet',
        provider: typeof window !== 'undefined' ? (window as any).coinbaseWalletExtension : null
      },
      {
        id: 'trust',
        name: 'Trust Wallet',
        icon: '🛡️',
        installed: this.isTrustWalletInstalled(),
        description: 'Multi-chain mobile wallet',
        downloadUrl: 'https://trustwallet.com/',
        provider: typeof window !== 'undefined' ? (window as any).trustwallet : null
      },
      {
        id: 'rainbow',
        name: 'Rainbow',
        icon: '🌈',
        installed: this.isRainbowInstalled(),
        description: 'Fun, simple, and secure',
        downloadUrl: 'https://rainbow.me/',
        provider: typeof window !== 'undefined' ? (window as any).rainbow : null
      }
    ];
  }

  private isMetaMaskInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.ethereum?.isMetaMask);
  }

  private isCoinbaseWalletInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).coinbaseWalletExtension || (window as any).ethereum?.isCoinbaseWallet);
  }

  private isTrustWalletInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).trustwallet || (window as any).ethereum?.isTrust);
  }

  private isRainbowInstalled(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).rainbow || (window as any).ethereum?.isRainbow);
  }

  public getAvailableWallets(): WalletProvider[] {
    // Refresh installation status
    this.initializeWalletProviders();
    return this.availableWallets;
  }

  public getInstalledWallets(): WalletProvider[] {
    return this.getAvailableWallets().filter(wallet => wallet.installed);
  }

  public getWalletById(id: string): WalletProvider | undefined {
    return this.availableWallets.find(wallet => wallet.id === id);
  }

  public async connectWallet(walletId: string): Promise<{
    success: boolean;
    accounts?: string[];
    chainId?: number;
    error?: string;
  }> {
    try {
      const wallet = this.getWalletById(walletId);
      if (!wallet) {
        throw new Error(`Wallet ${walletId} not found`);
      }

      if (!wallet.installed) {
        throw new Error(`${wallet.name} is not installed`);
      }

      switch (walletId) {
        case 'metamask':
          return await this.connectMetaMask();
        case 'coinbase':
          return await this.connectCoinbaseWallet();
        case 'walletconnect':
          return await this.connectWalletConnect();
        default:
          return await this.connectGenericWallet(wallet);
      }
    } catch (error: any) {
      console.error(`Failed to connect ${walletId}:`, error);
      return {
        success: false,
        error: error.message || `Failed to connect ${walletId}`
      };
    }
  }

  private async connectMetaMask(): Promise<{
    success: boolean;
    accounts?: string[];
    chainId?: number;
    error?: string;
  }> {
    if (!window.ethereum?.isMetaMask) {
      throw new Error('MetaMask is not installed');
    }

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    const chainId = await window.ethereum.request({
      method: 'eth_chainId'
    });

    // Setup listeners for account and chain changes
    this.setupAccountChangeListener();

    return {
      success: true,
      accounts,
      chainId: parseInt(chainId, 16)
    };
  }

  private async connectCoinbaseWallet(): Promise<{
    success: boolean;
    accounts?: string[];
    chainId?: number;
    error?: string;
  }> {
    const provider = (window as any).coinbaseWalletExtension || (window as any).ethereum;
    
    if (!provider?.isCoinbaseWallet) {
      throw new Error('Coinbase Wallet is not installed');
    }

    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    });

    const chainId = await provider.request({
      method: 'eth_chainId'
    });

    return {
      success: true,
      accounts,
      chainId: parseInt(chainId, 16)
    };
  }

  private async connectWalletConnect(): Promise<{
    success: boolean;
    accounts?: string[];
    chainId?: number;
    error?: string;
  }> {
    // WalletConnect implementation would go here
    // For now, we'll return a placeholder
    throw new Error('WalletConnect integration not yet implemented');
  }

  private async connectGenericWallet(wallet: WalletProvider): Promise<{
    success: boolean;
    accounts?: string[];
    chainId?: number;
    error?: string;
  }> {
    if (!wallet.provider) {
      throw new Error(`${wallet.name} provider not available`);
    }

    const accounts = await wallet.provider.request({
      method: 'eth_requestAccounts',
    });

    const chainId = await wallet.provider.request({
      method: 'eth_chainId'
    });

    return {
      success: true,
      accounts,
      chainId: parseInt(chainId, 16)
    };
  }

  public async switchAccount(walletId: string, accountAddress: string): Promise<boolean> {
    try {
      const wallet = this.getWalletById(walletId);
      if (!wallet || !wallet.provider) {
        throw new Error('Wallet not available');
      }

      // Most wallets don't support programmatic account switching
      // This would typically be done through the wallet's UI
      console.log(`Account switching for ${walletId} should be done through the wallet interface`);
      return true;
    } catch (error) {
      console.error('Failed to switch account:', error);
      return false;
    }
  }

  public formatAddress(address: string, length: number = 6): string {
    if (!address) return '';
    return `${address.slice(0, length)}...${address.slice(-4)}`;
  }

  public getWalletProvider(walletId: string): any {
    const wallet = this.getWalletById(walletId);
    return wallet?.provider || null;
  }

  private setupAccountChangeListener(): void {
    if (window.ethereum) {
      // Remove any existing listeners
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
      
      // Add new listeners
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        console.log('MetaMask accounts changed:', accounts);
        // Emit custom event for the wallet context to handle
        window.dispatchEvent(new CustomEvent('walletAccountsChanged', { 
          detail: { accounts, walletId: 'metamask' } 
        }));
      });

      window.ethereum.on('chainChanged', (chainId: string) => {
        console.log('MetaMask chain changed:', chainId);
        // Emit custom event for the wallet context to handle
        window.dispatchEvent(new CustomEvent('walletChainChanged', { 
          detail: { chainId: parseInt(chainId, 16), walletId: 'metamask' } 
        }));
      });
    }
  }

  public async getAllAccounts(walletId: string): Promise<string[]> {
    try {
      const wallet = this.getWalletById(walletId);
      if (!wallet || !wallet.provider) {
        return [];
      }

      if (walletId === 'metamask' && window.ethereum?.isMetaMask) {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts'
        });
        return accounts || [];
      }

      return [];
    } catch (error) {
      console.error('Failed to get all accounts:', error);
      return [];
    }
  }

  public async switchToAccount(walletId: string, accountAddress: string): Promise<boolean> {
    try {
      // Note: MetaMask doesn't allow programmatic account switching
      // Users need to switch accounts manually in the MetaMask interface
      // We can only request the specific account if it's available
      
      if (walletId === 'metamask' && window.ethereum?.isMetaMask) {
        // Check if the account is available
        const availableAccounts = await this.getAllAccounts(walletId);
        if (availableAccounts.includes(accountAddress)) {
          // The account switch will be handled by the accountsChanged event
          console.log(`Account ${accountAddress} is available in MetaMask`);
          return true;
        } else {
          throw new Error(`Account ${accountAddress} is not available in MetaMask`);
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to switch account:', error);
      return false;
    }
  }

  public async getAccountBalance(address: string, provider: any): Promise<string> {
    try {
      if (!provider) return '0';
      
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      
      // Convert from wei to ETH
      const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18);
      return balanceInEth.toFixed(4);
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }
}

// Export singleton instance
export const walletDetectionService = WalletDetectionService.getInstance();

// Add to window for debugging
if (typeof window !== 'undefined') {
  (window as any).walletDetectionService = walletDetectionService;
}