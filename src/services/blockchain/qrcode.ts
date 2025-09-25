import QRCode from 'qrcode';
import { QRCodeData } from './types';

class QRCodeService {
  /**
   * Generate QR code for MetaMask payment
   * Format: ethereum:{contractAddress}@{chainId}/payInvoice?uint256={invoiceId}&uint256={amount}
   */
  async generatePaymentQR(qrData: QRCodeData): Promise<string> {
    try {
      // Create MetaMask-compatible deep link
      const deepLink = this.createMetaMaskDeepLink(qrData);
      
      console.log('🔗 Generated payment deep link:', deepLink);
      
      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(deepLink, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      return qrCodeDataURL;

    } catch (error) {
      console.error('❌ Failed to generate QR code:', error);
      throw new Error('Failed to generate payment QR code');
    }
  }

  /**
   * Generate QR code as SVG string
   */
  async generatePaymentQRSVG(qrData: QRCodeData): Promise<string> {
    try {
      const deepLink = this.createMetaMaskDeepLink(qrData);
      
      const qrCodeSVG = await QRCode.toString(deepLink, {
        type: 'svg',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });

      return qrCodeSVG;

    } catch (error) {
      console.error('❌ Failed to generate SVG QR code:', error);
      throw new Error('Failed to generate payment QR code');
    }
  }

  /**
   * Create MetaMask deep link for invoice payment
   * Uses EIP-681 format for Ethereum payment requests
   */
  private createMetaMaskDeepLink(qrData: QRCodeData): string {
    const { invoiceId, contractAddress, amount, chainId } = qrData;
    
    // EIP-681 format: ethereum:{address}@{chainId}/{function_name}?{parameters}
    const deepLink = `ethereum:${contractAddress}@${chainId}/payInvoice?uint256=${invoiceId}`;
    
    return deepLink;
  }

  /**
   * Create a simple payment URL that opens MetaMask
   */
  createMetaMaskPaymentURL(qrData: QRCodeData): string {
    const { invoiceId, contractAddress, chainId } = qrData;
    
    // Alternative format that some wallets support better
    const baseUrl = 'https://metamask.app.link/send/';
    const params = new URLSearchParams({
      address: contractAddress,
      chainId: chainId.toString(),
      data: this.encodePayInvoiceData(invoiceId)
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Encode the payInvoice function call data
   */
  private encodePayInvoiceData(invoiceId: number): string {
    // This is a simplified encoding - in production, use ethers.js or web3.js
    // Function signature for payInvoice(uint256): 0x8b5d1d1a
    const functionSignature = '0x8b5d1d1a';
    const paddedInvoiceId = invoiceId.toString(16).padStart(64, '0');
    
    return `${functionSignature}${paddedInvoiceId}`;
  }

  /**
   * Create a universal payment link that works across different wallets
   */
  createUniversalPaymentLink(qrData: QRCodeData): string {
    const { invoiceId, contractAddress, chainId, recipient, amount } = qrData;
    
    // Create a web URL that can detect and redirect to appropriate wallet
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      contract: contractAddress,
      invoice: invoiceId.toString(),
      chain: chainId.toString(),
      to: recipient,
      amount: amount
    });

    return `${baseUrl}/pay?${params.toString()}`;
  }

  /**
   * Generate multiple QR code formats for maximum compatibility
   */
  async generateMultiFormatQR(qrData: QRCodeData): Promise<{
    metamaskDeepLink: string;
    universalLink: string;
    qrCodeDataURL: string;
    qrCodeSVG: string;
  }> {
    try {
      const metamaskDeepLink = this.createMetaMaskDeepLink(qrData);
      const universalLink = this.createUniversalPaymentLink(qrData);
      
      // Generate QR code for the universal link (better compatibility)
      const [qrCodeDataURL, qrCodeSVG] = await Promise.all([
        QRCode.toDataURL(universalLink, {
          width: 300,
          margin: 2,
          color: {
            dark: '#1a1a1a',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        }),
        QRCode.toString(universalLink, {
          type: 'svg',
          width: 300,
          margin: 2,
          color: {
            dark: '#1a1a1a',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        })
      ]);

      return {
        metamaskDeepLink,
        universalLink,
        qrCodeDataURL,
        qrCodeSVG
      };

    } catch (error) {
      console.error('❌ Failed to generate multi-format QR:', error);
      throw new Error('Failed to generate payment QR codes');
    }
  }

  /**
   * Generate a simple QR code for any text/URL
   */
  async generateQRCode(text: string, options?: {
    width?: number;
    margin?: number;
    darkColor?: string;
    lightColor?: string;
  }): Promise<string> {
    try {
      const qrOptions = {
        width: options?.width || 300,
        margin: options?.margin || 2,
        color: {
          dark: options?.darkColor || '#000000',
          light: options?.lightColor || '#FFFFFF'
        },
        errorCorrectionLevel: 'M' as const
      };

      return await QRCode.toDataURL(text, qrOptions);

    } catch (error) {
      console.error('❌ Failed to generate QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }
}

// Export singleton instance
export const qrCodeService = new QRCodeService();