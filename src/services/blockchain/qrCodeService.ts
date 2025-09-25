import QRCode from 'qrcode';
import { ethers } from 'ethers';
import { PaymentQRData } from './types';
import { NETWORKS, CONTRACT_ADDRESSES } from './web3Service';

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export class QRCodeService {
  private static instance: QRCodeService;

  private constructor() {}

  public static getInstance(): QRCodeService {
    if (!QRCodeService.instance) {
      QRCodeService.instance = new QRCodeService();
    }
    return QRCodeService.instance;
  }

  /**
   * Generate QR code for MetaMask payment
   * Creates a deep link that can be scanned by mobile MetaMask
   */
  public async generatePaymentQR(
    invoiceId: number,
    amount: string,
    contractAddress: string,
    options: QRCodeOptions = {}
  ): Promise<{ success: boolean; qrCodeDataUrl?: string; deepLink?: string; error?: string }> {
    try {
      // Create deep link for MetaMask mobile with proper EIP-681 format
      const deepLink = this.createMetaMaskDeepLink(invoiceId, amount, contractAddress);
      
      // Default QR code options with higher error correction for mobile scanning
      const qrOptions = {
        width: options.width || 256,
        margin: options.margin || 4, // Increased margin for better scanning
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        },
        errorCorrectionLevel: options.errorCorrectionLevel || 'H' as const // High error correction
      };

      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(deepLink, qrOptions);

      return {
        success: true,
        qrCodeDataUrl,
        deepLink
      };

    } catch (error: any) {
      console.error('❌ Failed to generate QR code:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate QR code'
      };
    }
  }

  /**
   * Generate QR code for wallet connection
   */
  public async generateWalletConnectQR(options: QRCodeOptions = {}): Promise<{ success: boolean; qrCodeDataUrl?: string; error?: string }> {
    try {
      // For now, we'll create a simple deep link to MetaMask
      // In production, you might want to use WalletConnect protocol
      const connectLink = 'https://metamask.app.link/dapp/your-app-domain.com';

      const qrOptions = {
        width: options.width || 200,
        margin: options.margin || 2,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        },
        errorCorrectionLevel: options.errorCorrectionLevel || 'M' as const
      };

      const qrCodeDataUrl = await QRCode.toDataURL(connectLink, qrOptions);

      return {
        success: true,
        qrCodeDataUrl
      };

    } catch (error: any) {
      console.error('❌ Failed to generate wallet connect QR:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate wallet connect QR'
      };
    }
  }

  /**
   * Create MetaMask deep link for invoice payment
   */
  private createMetaMaskDeepLink(invoiceId: number, amount: string, contractAddress: string): string {
    try {
      // Use EIP-681 format which is widely supported
      // ethereum:contract@chainId/transfer?address=to&uint256=amount
      const chainId = NETWORKS.sepolia.chainId;
      const pyusdAddress = NETWORKS.sepolia.pyusdAddress;
      
      // For PYUSD token transfer, we need to interact with the token contract
      // Format: ethereum:tokenAddress@chainId/transfer?address=contractAddress&uint256=amount
      const uri = `ethereum:${pyusdAddress}@${chainId}/transfer?address=${contractAddress}&uint256=${amount}`;
      
      return uri;
    } catch (error) {
      console.error('Error creating MetaMask deep link:', error);
      // Fallback to simple ethereum URI
      return `ethereum:${contractAddress}@${NETWORKS.sepolia.chainId}?value=${amount}`;
    }
  }

  /**
   * Generate a compatible payment QR for PYUSD token transfer
   * Uses EIP-681 standard format that works with most wallets
   */
  public async generatePYUSDPaymentQR(
    invoiceId: number,
    amount: string,
    contractAddress: string,
    options: QRCodeOptions = {}
  ): Promise<{ success: boolean; qrCodeDataUrl?: string; uri?: string; error?: string }> {
    try {
      const chainId = NETWORKS.sepolia.chainId;
      const pyusdAddress = NETWORKS.sepolia.pyusdAddress;
      
      // Validate required data
      if (!pyusdAddress) {
        throw new Error('PYUSD token address not configured for Sepolia network');
      }
      
      if (!contractAddress || !ethers.utils.isAddress(contractAddress)) {
        throw new Error('Invalid contract address provided');
      }
      
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        throw new Error('Invalid amount provided');
      }
      
      // Convert amount to wei (PYUSD has 6 decimals)
      const amountFloat = parseFloat(amount);
      const amountInWei = Math.floor(amountFloat * 1e6).toString();
      
      // Create EIP-681 URI with network configuration
      // This helps MetaMask understand what network to use
      const uri = `ethereum:${pyusdAddress}@${chainId}/transfer?address=${contractAddress}&uint256=${amountInWei}&gas=100000`;

      console.log('🔗 Generated QR URI:', uri);
      console.log('📊 QR Data:', {
        tokenAddress: pyusdAddress,
        chainId,
        contractAddress,
        amount,
        amountInWei,
        invoiceId
      });

      const qrOptions = {
        width: options.width || 256,
        margin: options.margin || 4,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        },
        errorCorrectionLevel: options.errorCorrectionLevel || 'M' as const
      };

      const qrCodeDataUrl = await QRCode.toDataURL(uri, qrOptions);

      return {
        success: true,
        qrCodeDataUrl,
        uri
      };

    } catch (error: any) {
      console.error('❌ Failed to generate PYUSD payment QR:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate PYUSD payment QR'
      };
    }
  }

  /**
   * Generate MetaMask Mobile compatible QR with network auto-add
   * Uses MetaMask deep link format to handle network addition
   */
  public async generateMetaMaskMobileQR(
    invoiceId: number,
    amount: string,
    contractAddress: string,
    options: QRCodeOptions = {}
  ): Promise<{ success: boolean; qrCodeDataUrl?: string; deepLink?: string; error?: string }> {
    try {
      const chainId = NETWORKS.sepolia.chainId;
      const pyusdAddress = NETWORKS.sepolia.pyusdAddress;
      const network = NETWORKS.sepolia;
      
      if (!pyusdAddress) {
        throw new Error('PYUSD token address not configured');
      }
      
      // Convert amount to wei (PYUSD has 6 decimals)
      const amountInWei = Math.floor(parseFloat(amount) * 1e6).toString();
      
      // Create MetaMask deep link that includes network addition and token transfer
      const deepLinkParams = new URLSearchParams({
        // Network configuration
        chainId: `0x${chainId.toString(16)}`,
        chainName: network.name,
        nativeCurrencyName: network.currency,
        nativeCurrencySymbol: network.currency,
        nativeCurrencyDecimals: '18',
        rpcUrl: network.rpcUrl,
        blockExplorerUrl: network.blockExplorer,
        
        // Transaction details
        to: pyusdAddress,
        data: this.encodeTransferFunction(contractAddress, amountInWei),
        gas: '100000',
        value: '0x0'
      });
      
      const deepLink = `https://metamask.app.link/dapp/localhost:5174/?${deepLinkParams.toString()}`;
      
      console.log('🔗 MetaMask Deep Link:', deepLink);

      const qrOptions = {
        width: options.width || 256,
        margin: options.margin || 4,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        },
        errorCorrectionLevel: options.errorCorrectionLevel || 'L' as const // Lower for shorter URLs
      };

      const qrCodeDataUrl = await QRCode.toDataURL(deepLink, qrOptions);

      return {
        success: true,
        qrCodeDataUrl,
        deepLink
      };

    } catch (error: any) {
      console.error('❌ Failed to generate MetaMask mobile QR:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate MetaMask mobile QR'
      };
    }
  }

  /**
   * Encode ERC-20 transfer function call
   */
  private encodeTransferFunction(to: string, amount: string): string {
    // transfer(address,uint256) function signature: 0xa9059cbb
    const functionSelector = 'a9059cbb';
    
    // Encode address (remove 0x and pad to 32 bytes)
    const addressParam = to.replace('0x', '').padStart(64, '0');
    
    // Encode amount (pad to 32 bytes)
    const amountParam = parseInt(amount).toString(16).padStart(64, '0');
    
    return `0x${functionSelector}${addressParam}${amountParam}`;
  }

  /**
   * Generate QR code with structured JSON data for wallet compatibility
   * This format includes all required fields that wallets expect
   */
  public async generateStructuredPaymentQR(
    invoiceId: number,
    amount: string,
    contractAddress: string,
    options: QRCodeOptions = {}
  ): Promise<{ success: boolean; qrCodeDataUrl?: string; data?: any; error?: string }> {
    try {
      const chainId = NETWORKS.sepolia.chainId;
      const pyusdAddress = NETWORKS.sepolia.pyusdAddress;
      
      if (!pyusdAddress) {
        throw new Error('PYUSD token address not configured');
      }
      
      // Create structured data that includes all required fields
      const paymentData: PaymentQRData = {
        type: 'ethereum-payment',
        invoiceId,
        contractAddress,
        tokenAddress: pyusdAddress, // Ensure this is always present
        amount,
        chainId,
        recipient: contractAddress,
        network: 'sepolia',
        networkName: 'Sepolia Testnet',
        to: contractAddress,
        token: pyusdAddress,
        value: (parseFloat(amount) * 1e6).toString(), // Convert to wei
      };
      
      // Convert to JSON string for QR code
      const jsonData = JSON.stringify(paymentData);
      
      console.log('📦 Structured payment data:', paymentData);

      const qrOptions = {
        width: options.width || 256,
        margin: options.margin || 4,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        },
        errorCorrectionLevel: options.errorCorrectionLevel || 'M' as const
      };

      const qrCodeDataUrl = await QRCode.toDataURL(jsonData, qrOptions);

      return {
        success: true,
        qrCodeDataUrl,
        data: paymentData
      };

    } catch (error: any) {
      console.error('❌ Failed to generate structured payment QR:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate structured payment QR'
      };
    }
  }

  /**
   * Generate a generic blockchain payment QR
   * Can be used with various wallet apps
   */
  public async generateGenericPaymentQR(
    to: string,
    amount: string,
    chainId: number,
    data?: string,
    options: QRCodeOptions = {}
  ): Promise<{ success: boolean; qrCodeDataUrl?: string; uri?: string; error?: string }> {
    try {
      // Create EIP-67/681 compatible URI
      const network = Object.values(NETWORKS).find(n => n.chainId === chainId);
      if (!network) {
        throw new Error(`Unsupported network: ${chainId}`);
      }

      // Format: ethereum:address@chainId?value=amount&data=data
      let uri = `ethereum:${to}@${chainId}`;
      const params = new URLSearchParams();
      
      if (amount && amount !== '0') {
        params.append('value', amount);
      }
      
      if (data) {
        params.append('data', data);
      }

      if (params.toString()) {
        uri += `?${params.toString()}`;
      }

      const qrOptions = {
        width: options.width || 256,
        margin: options.margin || 4,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        },
        errorCorrectionLevel: options.errorCorrectionLevel || 'H' as const
      };

      const qrCodeDataUrl = await QRCode.toDataURL(uri, qrOptions);

      return {
        success: true,
        qrCodeDataUrl,
        uri
      };

    } catch (error: any) {
      console.error('❌ Failed to generate generic payment QR:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate payment QR'
      };
    }
  }

  /**
   * Generate QR code for any text/URL
   */
  public async generateQRCode(
    text: string,
    options: QRCodeOptions = {}
  ): Promise<{ success: boolean; qrCodeDataUrl?: string; error?: string }> {
    try {
      const qrOptions = {
        width: options.width || 256,
        margin: options.margin || 2,
        color: {
          dark: options.color?.dark || '#000000',
          light: options.color?.light || '#FFFFFF'
        },
        errorCorrectionLevel: options.errorCorrectionLevel || 'M' as const
      };

      const qrCodeDataUrl = await QRCode.toDataURL(text, qrOptions);

      return {
        success: true,
        qrCodeDataUrl
      };

    } catch (error: any) {
      console.error('❌ Failed to generate QR code:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate QR code'
      };
    }
  }

  /**
   * Download QR code as image
   */
  public downloadQRCode(dataUrl: string, filename: string = 'qrcode.png'): void {
    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('❌ Failed to download QR code:', error);
      throw new Error('Failed to download QR code');
    }
  }

  /**
   * Copy QR code data URL to clipboard
   */
  public async copyQRToClipboard(dataUrl: string): Promise<boolean> {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Copy to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);

      return true;
    } catch (error) {
      console.error('❌ Failed to copy QR code:', error);
      return false;
    }
  }

  /**
   * Validate QR code content
   */
  public static validatePaymentQR(qrContent: string): { isValid: boolean; type?: string; data?: any } {
    try {
      // Check if it's a MetaMask deep link
      if (qrContent.startsWith('https://metamask.app.link/')) {
        return {
          isValid: true,
          type: 'metamask-deeplink',
          data: { url: qrContent }
        };
      }

      // Check if it's an EIP-681 URI (including function calls)
      if (qrContent.startsWith('ethereum:')) {
        // Enhanced regex to handle function calls like /transfer
        const match = qrContent.match(/^ethereum:([^@\/]+)@?(\d+)?(\/\w+)?(\?.*)?$/);
        if (match) {
          const [, address, chainId, functionName, params] = match;
          return {
            isValid: true,
            type: 'eip-681',
            data: {
              address,
              chainId: chainId ? parseInt(chainId) : undefined,
              functionName: functionName?.replace('/', ''),
              params: params
            }
          };
        }
      }

      // Check if it's a generic URL
      if (qrContent.startsWith('http://') || qrContent.startsWith('https://')) {
        return {
          isValid: true,
          type: 'url',
          data: { url: qrContent }
        };
      }

      return { isValid: false };

    } catch (error) {
      return { isValid: false };
    }
  }

  /**
   * Get recommended QR code size based on content length
   */
  public static getRecommendedSize(content: string): number {
    const length = content.length;
    
    if (length < 50) return 128;
    if (length < 100) return 192;
    if (length < 200) return 256;
    if (length < 500) return 320;
    
    return 384;
  }
}

// Export singleton instance
export const qrCodeService = QRCodeService.getInstance();