import { ethers } from 'ethers';
import { Invoice, InvoiceCreationData, InvoiceStatus, BlockchainTransaction } from './types';
import { NETWORKS, CONTRACT_ADDRESSES, formatTokenAmount, parseTokenAmount } from './networks';
import { ipfsService } from './ipfsService';

// Contract ABI - Essential functions only
const INVOICE_MANAGER_ABI = [
  "function createInvoice(uint256 _amount, string memory _ipfsHash) external returns (uint256)",
  "function payInvoice(uint256 _invoiceId) external",
  "function getInvoice(uint256 _invoiceId) external view returns (tuple(uint256 id, address creator, address payer, uint256 amount, uint8 status, string ipfsHash, uint256 createdAt, uint256 paidAt, bool exists))",
  "function getOrganizationInvoices(address _organization) external view returns (uint256[])",
  "function getPayerInvoices(address _payer) external view returns (uint256[])",
  "function getCurrentInvoiceId() external view returns (uint256)",
  "function markInvoiceAsFailed(uint256 _invoiceId) external",
  "function deleteFailedInvoice(uint256 _invoiceId) external",
  "function getInvoiceStatusString(uint256 _invoiceId) external view returns (string)",
  "event InvoiceCreated(uint256 indexed invoiceId, address indexed creator, uint256 amount, string ipfsHash)",
  "event InvoicePaid(uint256 indexed invoiceId, address indexed payer, address indexed creator, uint256 amount)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

class BlockchainService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private invoiceContract: ethers.Contract | null = null;
  private pyusdContract: ethers.Contract | null = null;
  private currentNetwork: string = 'sepolia';
  private eventListeners: { [key: string]: () => void } = {};
  private listenerSetup = false;

  private detectProvider(): any {
    // MetaMask
    if (window.ethereum?.isMetaMask) {
      return window.ethereum;
    }
    
    // Coinbase Wallet
    if (window.ethereum?.isCoinbaseWallet) {
      return window.ethereum;
    }
    
    // Trust Wallet
    if (window.ethereum?.isTrust) {
      return window.ethereum;
    }
    
    // Rainbow Wallet
    if (window.ethereum?.isRainbow) {
      return window.ethereum;
    }
    
    // Generic ethereum provider
    if (window.ethereum) {
      return window.ethereum;
    }
    
    return null;
  }

  async initialize(customProvider?: any): Promise<boolean> {
    try {
      // Use custom provider or detect available provider
      const provider = customProvider || this.detectProvider();
      
      if (!provider) {
        throw new Error('No wallet provider found');
      }

      this.provider = new ethers.providers.Web3Provider(provider);
      await this.provider.send("eth_requestAccounts", []);
      
      this.signer = this.provider.getSigner();
      
      // Get current network
      const network = await this.provider.getNetwork();
      const networkConfig = Object.entries(NETWORKS).find(([_, config]) => config.chainId === network.chainId);
      
      if (!networkConfig) {
        throw new Error(`Unsupported network: ${network.name}`);
      }
      
      this.currentNetwork = networkConfig[0];
      
      // Initialize contracts
      await this.initializeContracts();
      
      console.log('✅ Blockchain service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      return false;
    }
  }

  private async initializeContracts(): Promise<void> {
    const contractAddresses = CONTRACT_ADDRESSES[this.currentNetwork];
    const networkConfig = NETWORKS[this.currentNetwork];
    
    if (!contractAddresses.invoiceManager) {
      throw new Error(`Invoice Manager contract not deployed on ${this.currentNetwork}`);
    }
    
    if (!networkConfig.pyusdAddress) {
      throw new Error(`PYUSD not available on ${this.currentNetwork}`);
    }

    this.invoiceContract = new ethers.Contract(
      contractAddresses.invoiceManager,
      INVOICE_MANAGER_ABI,
      this.signer
    );

    this.pyusdContract = new ethers.Contract(
      networkConfig.pyusdAddress,
      ERC20_ABI,
      this.signer
    );
  }

  async switchNetwork(networkName: string): Promise<boolean> {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed');
      }

      const network = NETWORKS[networkName];
      if (!network) {
        throw new Error(`Unknown network: ${networkName}`);
      }

      const chainIdHex = `0x${network.chainId.toString(16)}`;

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: chainIdHex }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
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
              rpcUrls: [network.rpcUrl],
              blockExplorerUrls: [network.blockExplorer],
            }],
          });
        } else {
          throw switchError;
        }
      }

      this.currentNetwork = networkName;
      await this.initializeContracts();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to switch network:', error);
      return false;
    }
  }

  async switchWalletProvider(provider: any): Promise<boolean> {
    try {
      if (!provider) {
        throw new Error('No provider specified');
      }

      // Clear existing listeners
      this.cleanup();

      // Initialize with new provider
      const success = await this.initialize(provider);
      
      if (success) {
        console.log('✅ Wallet provider switched successfully');
      }
      
      return success;
    } catch (error) {
      console.error('❌ Failed to switch wallet provider:', error);
      return false;
    }
  }

  async createInvoice(invoiceData: InvoiceCreationData): Promise<{ success: boolean; invoiceId?: number; transactionHash?: string; error?: string }> {
    try {
      if (!this.invoiceContract || !this.signer) {
        throw new Error('Blockchain service not initialized');
      }

      // Upload invoice data to IPFS
      console.log('📎 Uploading invoice data to IPFS...');
      const ipfsResult = await ipfsService.uploadInvoiceData(invoiceData);
      
      if (!ipfsResult.success || !ipfsResult.ipfsHash) {
        throw new Error(ipfsResult.error || 'Failed to upload to IPFS');
      }

      // Format amount for contract (6 decimals for PYUSD)
      const formattedAmount = formatTokenAmount(invoiceData.amount, 6);

      console.log('📝 Creating invoice on blockchain...');
      console.log(`Amount: ${invoiceData.amount} PYUSD (${formattedAmount} wei)`);
      console.log(`IPFS Hash: ${ipfsResult.ipfsHash}`);

      // Create invoice on blockchain
      const tx = await this.invoiceContract.createInvoice(formattedAmount, ipfsResult.ipfsHash);
      
      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      // Extract invoice ID from events
      const invoiceCreatedEvent = receipt.events?.find((event: any) => event.event === 'InvoiceCreated');
      const invoiceId = invoiceCreatedEvent?.args?.invoiceId?.toNumber();

      console.log('✅ Invoice created successfully!');
      console.log(`Invoice ID: ${invoiceId}`);
      console.log(`Transaction Hash: ${tx.hash}`);

      return {
        success: true,
        invoiceId,
        transactionHash: tx.hash
      };

    } catch (error: any) {
      console.error('❌ Failed to create invoice:', error);
      return {
        success: false,
        error: error.message || 'Failed to create invoice'
      };
    }
  }

  async payInvoice(invoiceId: number): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!this.invoiceContract || !this.pyusdContract || !this.signer) {
        throw new Error('Blockchain service not initialized');
      }

      // Get invoice details
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.UNPAID) {
        throw new Error('Invoice is not in unpaid status');
      }

      const userAddress = await this.signer.getAddress();
      if (invoice.creator.toLowerCase() === userAddress.toLowerCase()) {
        throw new Error('Cannot pay your own invoice');
      }

      // Check PYUSD balance
      const balance = await this.pyusdContract.balanceOf(userAddress);
      if (balance.lt(invoice.amount)) {
        throw new Error('Insufficient PYUSD balance');
      }

      // Check allowance
      const contractAddress = this.invoiceContract.address;
      const allowance = await this.pyusdContract.allowance(userAddress, contractAddress);
      
      if (allowance.lt(invoice.amount)) {
        console.log('💰 Approving PYUSD spending...');
        const approveTx = await this.pyusdContract.approve(contractAddress, invoice.amount);
        await approveTx.wait();
        console.log('✅ PYUSD approval confirmed');
      }

      console.log('💸 Processing payment...');
      const payTx = await this.invoiceContract.payInvoice(invoiceId);
      
      console.log('⏳ Waiting for payment confirmation...');
      await payTx.wait();

      console.log('✅ Payment completed successfully!');
      console.log(`Transaction Hash: ${payTx.hash}`);

      return {
        success: true,
        transactionHash: payTx.hash
      };

    } catch (error: any) {
      console.error('❌ Failed to pay invoice:', error);
      return {
        success: false,
        error: error.message || 'Failed to pay invoice'
      };
    }
  }

  async getInvoice(invoiceId: number): Promise<Invoice | null> {
    try {
      if (!this.invoiceContract) {
        throw new Error('Contract not initialized');
      }

      const invoiceData = await this.invoiceContract.getInvoice(invoiceId);
      
      return {
        id: invoiceData.id.toNumber(),
        creator: invoiceData.creator,
        payer: invoiceData.payer,
        amount: invoiceData.amount.toString(),
        status: invoiceData.status,
        ipfsHash: invoiceData.ipfsHash,
        createdAt: invoiceData.createdAt.toNumber(),
        paidAt: invoiceData.paidAt.toNumber(),
        exists: invoiceData.exists
      };

    } catch (error) {
      console.error('❌ Failed to get invoice:', error);
      return null;
    }
  }

  async getOrganizationInvoices(address: string): Promise<number[]> {
    try {
      if (!this.invoiceContract) {
        throw new Error('Contract not initialized');
      }

      const invoiceIds = await this.invoiceContract.getOrganizationInvoices(address);
      return invoiceIds.map((id: ethers.BigNumber) => id.toNumber());

    } catch (error) {
      console.error('❌ Failed to get organization invoices:', error);
      return [];
    }
  }

  async getPYUSDBalance(address: string): Promise<string> {
    try {
      if (!this.pyusdContract) {
        throw new Error('PYUSD contract not initialized');
      }

      const balance = await this.pyusdContract.balanceOf(address);
      return parseTokenAmount(balance.toString(), 6).toString();

    } catch (error) {
      console.error('❌ Failed to get PYUSD balance:', error);
      return '0';
    }
  }

  async markInvoiceAsFailed(invoiceId: number): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      if (!this.invoiceContract) {
        throw new Error('Contract not initialized');
      }

      const tx = await this.invoiceContract.markInvoiceAsFailed(invoiceId);
      await tx.wait();

      return {
        success: true,
        transactionHash: tx.hash
      };

    } catch (error: any) {
      console.error('❌ Failed to mark invoice as failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark invoice as failed'
      };
    }
  }

  getCurrentNetwork(): string {
    return this.currentNetwork;
  }

  getContractAddress(): string | null {
    return CONTRACT_ADDRESSES[this.currentNetwork]?.invoiceManager || null;
  }

  isInitialized(): boolean {
    return this.provider !== null && this.signer !== null && this.invoiceContract !== null;
  }

  private cleanup(): void {
    // Remove event listeners
    Object.keys(this.eventListeners).forEach(key => {
      if (this.eventListeners[key]) {
        this.eventListeners[key]();
        delete this.eventListeners[key];
      }
    });

    // Reset state
    this.provider = null;
    this.signer = null;
    this.invoiceContract = null;
    this.pyusdContract = null;
    this.listenerSetup = false;
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();