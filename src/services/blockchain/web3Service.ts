import { ethers } from 'ethers';

// Network configurations
export const NETWORKS = {
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
  }
};

// Contract addresses updated with deployed contracts
export const CONTRACT_ADDRESSES = {
  sepolia: {
    invoiceManager: '0x66bCb1F1cdf4f0338E79E3685CEe1144954B5a2b',
    pyusd: '0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9'
  }
};

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string;
  pyusdBalance: string;
  isCorrectNetwork: boolean;
}

export interface InvoiceData {
  id?: number;
  amount: string;
  creator: string;
  payer?: string;
  status: 'UNPAID' | 'PAID' | 'FAILED';
  ipfsHash: string;
  createdAt?: number;
  paidAt?: number;
  description?: string;
  companyName?: string;
  companyAddress?: string;
  clientName?: string;
  clientAddress?: string;
  items?: Array<{
    description: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  notes?: string;
  terms?: string;
}

export class Web3Service {
  private static instance: Web3Service;
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private invoiceContract: ethers.Contract | null = null;
  private pyusdContract: ethers.Contract | null = null;
  
  // Contract ABIs (simplified - only needed functions)
  private readonly INVOICE_ABI = [
    "function createInvoice(uint256 amount, string memory ipfsHash) external returns (uint256)",
    "function payInvoice(uint256 invoiceId) external",
    "function getInvoice(uint256 invoiceId) external view returns (tuple(uint256 id, address creator, address payer, uint256 amount, uint8 status, string ipfsHash, uint256 createdAt, uint256 paidAt, bool exists))",
    "function getOrganizationInvoices(address organization) external view returns (uint256[] memory)",
    "function getPayerInvoices(address payer) external view returns (uint256[] memory)",
    "function markInvoiceAsFailed(uint256 invoiceId) external",
    "function deleteFailedInvoice(uint256 invoiceId) external",
    "function getCurrentInvoiceId() external view returns (uint256)",
    "function getInvoiceStatusString(uint256 invoiceId) external view returns (string memory)",
    "event InvoiceCreated(uint256 indexed invoiceId, address indexed creator, uint256 amount, string ipfsHash)",
    "event InvoicePaid(uint256 indexed invoiceId, address indexed payer, address indexed creator, uint256 amount)"
  ];
  
  private readonly PYUSD_ABI = [
    "function balanceOf(address owner) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)",
    "function name() external view returns (string)"
  ];

  private constructor() {}

  public static getInstance(): Web3Service {
    if (!Web3Service.instance) {
      Web3Service.instance = new Web3Service();
    }
    return Web3Service.instance;
  }

  // Initialize Web3 connection
  public async initialize(): Promise<boolean> {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask is not installed');
      }

      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      return true;
    } catch (error) {
      console.error('Failed to initialize Web3:', error);
      return false;
    }
  }

  // Connect wallet
  public async connectWallet(): Promise<WalletState> {
    try {
      if (!this.provider) {
        throw new Error('Web3 not initialized');
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      this.signer = this.provider.getSigner();
      const address = await this.signer.getAddress();
      const network = await this.provider.getNetwork();
      
      // Check if we're on the correct network (Sepolia for now)
      const isCorrectNetwork = network.chainId === NETWORKS.sepolia.chainId;
      
      // Get balances
      const balance = await this.provider.getBalance(address);
      let pyusdBalance = '0';
      
      if (isCorrectNetwork) {
        await this.initializeContracts();
        if (this.pyusdContract) {
          const pyusdBal = await this.pyusdContract.balanceOf(address);
          pyusdBalance = ethers.utils.formatUnits(pyusdBal, 6); // PYUSD has 6 decimals
        }
      }

      const walletState: WalletState = {
        isConnected: true,
        address,
        chainId: network.chainId,
        balance: ethers.utils.formatEther(balance),
        pyusdBalance,
        isCorrectNetwork
      };

      // Listen for account changes
      window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
      window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));

      return walletState;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  // Disconnect wallet
  public async disconnectWallet(): Promise<void> {
    this.provider = null;
    this.signer = null;
    this.invoiceContract = null;
    this.pyusdContract = null;
    
    // Remove event listeners
    if (window.ethereum) {
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
    }
  }

  // Switch to Sepolia network
  public async switchToSepolia(): Promise<boolean> {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID in hex
      });
      return true;
    } catch (switchError: any) {
      // If network is not added, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia Testnet',
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['https://sepolia.infura.io/v3/'],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
          return true;
        } catch (addError) {
          console.error('Failed to add Sepolia network:', addError);
          return false;
        }
      }
      console.error('Failed to switch to Sepolia:', switchError);
      return false;
    }
  }

  // Initialize contracts
  private async initializeContracts(): Promise<void> {
    if (!this.signer) {
      throw new Error('Signer not available');
    }

    const network = await this.provider!.getNetwork();
    const networkConfig = Object.values(NETWORKS).find(n => n.chainId === network.chainId);
    
    if (!networkConfig) {
      throw new Error(`Unsupported network: ${network.chainId}`);
    }

    // Initialize PYUSD contract
    this.pyusdContract = new ethers.Contract(
      networkConfig.pyusdAddress,
      this.PYUSD_ABI,
      this.signer
    );

    // Initialize Invoice Manager contract
    const contractAddress = CONTRACT_ADDRESSES[network.chainId === 11155111 ? 'sepolia' : 'ethereum'];
    if (contractAddress && contractAddress.invoiceManager !== '0x0000000000000000000000000000000000000000') {
      this.invoiceContract = new ethers.Contract(
        contractAddress.invoiceManager,
        this.INVOICE_ABI,
        this.signer
      );
    }
  }

  // Get wallet state
  public async getWalletState(): Promise<WalletState | null> {
    try {
      if (!this.provider || !this.signer) {
        return null;
      }

      const address = await this.signer.getAddress();
      const network = await this.provider.getNetwork();
      const balance = await this.provider.getBalance(address);
      
      let pyusdBalance = '0';
      if (this.pyusdContract) {
        const pyusdBal = await this.pyusdContract.balanceOf(address);
        pyusdBalance = ethers.utils.formatUnits(pyusdBal, 6);
      }

      return {
        isConnected: true,
        address,
        chainId: network.chainId,
        balance: ethers.utils.formatEther(balance),
        pyusdBalance,
        isCorrectNetwork: network.chainId === NETWORKS.sepolia.chainId
      };
    } catch (error) {
      console.error('Failed to get wallet state:', error);
      return null;
    }
  }

  // Create invoice on blockchain
  public async createInvoice(amount: string, ipfsHash: string): Promise<{ success: boolean; invoiceId?: number; transactionHash?: string; error?: string }> {
    try {
      if (!this.invoiceContract) {
        throw new Error('Invoice contract not initialized');
      }

      // Convert amount to PYUSD format (6 decimals)
      const amountWei = ethers.utils.parseUnits(amount, 6);
      
      // Estimate gas
      const gasEstimate = await this.invoiceContract.estimateGas.createInvoice(amountWei, ipfsHash);
      const gasLimit = gasEstimate.mul(120).div(100); // 20% buffer

      // Send transaction
      const tx = await this.invoiceContract.createInvoice(amountWei, ipfsHash, {
        gasLimit
      });

      console.log('Invoice creation transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      // Get invoice ID from events
      const event = receipt.events?.find((e: any) => e.event === 'InvoiceCreated');
      const invoiceId = event?.args?.invoiceId?.toNumber();

      return {
        success: true,
        invoiceId,
        transactionHash: tx.hash
      };
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      return {
        success: false,
        error: error.message || 'Failed to create invoice'
      };
    }
  }

  // Pay invoice
  public async payInvoice(invoiceId: number): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!this.invoiceContract || !this.pyusdContract) {
        throw new Error('Contracts not initialized');
      }

      // Get invoice details first
      const invoice = await this.invoiceContract.getInvoice(invoiceId);
      const amount = invoice.amount;

      // Check PYUSD balance
      const address = await this.signer!.getAddress();
      const balance = await this.pyusdContract.balanceOf(address);
      
      if (balance.lt(amount)) {
        throw new Error('Insufficient PYUSD balance');
      }

      // Check and set allowance if needed
      const allowance = await this.pyusdContract.allowance(address, this.invoiceContract.address);
      if (allowance.lt(amount)) {
        console.log('Approving PYUSD spend...');
        const approveTx = await this.pyusdContract.approve(this.invoiceContract.address, amount);
        await approveTx.wait();
        console.log('PYUSD approved');
      }

      // Pay invoice
      const gasEstimate = await this.invoiceContract.estimateGas.payInvoice(invoiceId);
      const gasLimit = gasEstimate.mul(120).div(100);

      const tx = await this.invoiceContract.payInvoice(invoiceId, {
        gasLimit
      });

      console.log('Payment transaction sent:', tx.hash);
      await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash
      };
    } catch (error: any) {
      console.error('Failed to pay invoice:', error);
      return {
        success: false,
        error: error.message || 'Failed to pay invoice'
      };
    }
  }

  // Get invoice details
  public async getInvoice(invoiceId: number): Promise<InvoiceData | null> {
    try {
      if (!this.invoiceContract) {
        throw new Error('Invoice contract not initialized');
      }

      const invoice = await this.invoiceContract.getInvoice(invoiceId);
      
      if (!invoice.exists) {
        return null;
      }

      // Convert status number to string
      const statusMap = ['UNPAID', 'PAID', 'FAILED'];
      const status = statusMap[invoice.status] as 'UNPAID' | 'PAID' | 'FAILED';

      return {
        id: invoice.id.toNumber(),
        amount: ethers.utils.formatUnits(invoice.amount, 6),
        creator: invoice.creator,
        payer: invoice.payer === '0x0000000000000000000000000000000000000000' ? undefined : invoice.payer,
        status,
        ipfsHash: invoice.ipfsHash,
        createdAt: invoice.createdAt.toNumber(),
        paidAt: invoice.paidAt.toNumber() || undefined
      };
    } catch (error) {
      console.error('Failed to get invoice:', error);
      return null;
    }
  }

  // Get organization invoices
  public async getOrganizationInvoices(address: string): Promise<number[]> {
    try {
      if (!this.invoiceContract) {
        throw new Error('Invoice contract not initialized');
      }

      const invoiceIds = await this.invoiceContract.getOrganizationInvoices(address);
      return invoiceIds.map((id: any) => id.toNumber());
    } catch (error) {
      console.error('Failed to get organization invoices:', error);
      return [];
    }
  }

  // Event handlers
  private handleAccountsChanged(accounts: string[]): void {
    if (accounts.length === 0) {
      // User disconnected
      this.disconnectWallet();
    } else {
      // User switched accounts
      window.location.reload();
    }
  }

  private handleChainChanged(chainId: string): void {
    // Reload the page when chain changes
    window.location.reload();
  }

  // Check if MetaMask is installed
  public static isMetaMaskInstalled(): boolean {
    return typeof window.ethereum !== 'undefined';
  }

  // Format PYUSD amount for display
  public static formatPYUSD(amount: string): string {
    const num = parseFloat(amount);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  }

  // Validate address
  public static isValidAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
  }
}

// Export singleton instance
export const web3Service = Web3Service.getInstance();