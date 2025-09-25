import { IPFSUploadResponse } from './types';

export interface IPFSInvoiceData {
  metadata: {
    version: string;
    type: string;
    createdAt: string;
    network: string;
    contract: string;
  };
  invoice: {
    amount: string;
    currency: string;
    creator: string;
    description?: string;
    dueDate?: string;
    content: {
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
    };
  };
  system: {
    appVersion: string;
    platform: string;
    uploadedAt: string;
  };
}

export class IPFSService {
  private static instance: IPFSService;
  private readonly PINATA_API_URL = 'https://api.pinata.cloud';
  private readonly PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
  private readonly PUBLIC_GATEWAY = 'https://ipfs.io/ipfs/';

  private constructor() {}

  public static getInstance(): IPFSService {
    if (!IPFSService.instance) {
      IPFSService.instance = new IPFSService();
    }
    return IPFSService.instance;
  }

  /**
   * Upload invoice data to IPFS via Pinata
   * Since we're in the frontend, we'll use a proxy API or direct upload to public IPFS
   * For production, you'd want to set up a backend service to handle Pinata API keys
   */
  public async uploadInvoiceData(invoiceData: any): Promise<IPFSUploadResponse> {
    try {
      // Format the data for IPFS storage
      const formattedData = this.formatInvoiceForIPFS(invoiceData);
      
      // For now, we'll simulate the upload
      // In production, this would make an API call to your backend
      // which would then upload to Pinata with proper API keys
      
      // Mock response for development
      const mockHash = this.generateMockIPFSHash();
      
      console.log('📎 Mock IPFS upload:', {
        data: formattedData,
        hash: mockHash
      });

      return {
        success: true,
        ipfsHash: mockHash,
        pinataUrl: `${this.PINATA_GATEWAY}${mockHash}`,
        publicUrl: `${this.PUBLIC_GATEWAY}${mockHash}`
      };

    } catch (error: any) {
      console.error('❌ Failed to upload to IPFS:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload to IPFS'
      };
    }
  }

  /**
   * Upload to IPFS via backend API (recommended approach)
   */
  public async uploadViaBackend(invoiceData: any): Promise<IPFSUploadResponse> {
    try {
      const formattedData = this.formatInvoiceForIPFS(invoiceData);
      
      // This would be your backend endpoint that handles IPFS uploads
      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        ipfsHash: result.ipfsHash,
        pinataUrl: result.pinataUrl,
        publicUrl: result.publicUrl
      };

    } catch (error: any) {
      console.error('❌ Failed to upload via backend:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload via backend'
      };
    }
  }

  /**
   * Retrieve data from IPFS
   */
  public async retrieveFromIPFS(ipfsHash: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Try Pinata gateway first, then fallback to public gateway
      let response;
      
      try {
        response = await fetch(`${this.PINATA_GATEWAY}${ipfsHash}`);
      } catch (error) {
        console.log('Pinata gateway failed, trying public gateway...');
        response = await fetch(`${this.PUBLIC_GATEWAY}${ipfsHash}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        data
      };

    } catch (error: any) {
      console.error('❌ Failed to retrieve from IPFS:', error);
      return {
        success: false,
        error: error.message || 'Failed to retrieve from IPFS'
      };
    }
  }

  /**
   * Format invoice data for IPFS storage
   */
  public formatInvoiceForIPFS(invoiceData: any): IPFSInvoiceData {
    const timestamp = new Date().toISOString();
    
    return {
      metadata: {
        version: '1.0',
        type: 'blockchain-invoice',
        createdAt: timestamp,
        network: 'sepolia',
        contract: 'InvoiceManager'
      },
      
      invoice: {
        amount: invoiceData.amount || '0',
        currency: 'PYUSD',
        creator: invoiceData.creator || '',
        description: invoiceData.description || '',
        dueDate: invoiceData.dueDate || null,
        
        content: {
          companyName: invoiceData.companyName || '',
          companyAddress: invoiceData.companyAddress || '',
          clientName: invoiceData.clientName || '',
          clientAddress: invoiceData.clientAddress || '',
          items: invoiceData.items || [],
          notes: invoiceData.notes || '',
          terms: invoiceData.terms || ''
        }
      },
      
      system: {
        appVersion: '1.0.0',
        platform: 'invoice-blockchain-app',
        uploadedAt: timestamp
      }
    };
  }

  /**
   * Generate a mock IPFS hash for development
   */
  private generateMockIPFSHash(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'Qm'; // IPFS hashes typically start with Qm
    
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Validate IPFS hash format
   */
  public static isValidIPFSHash(hash: string): boolean {
    // Basic validation for IPFS hash format
    return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash);
  }

  /**
   * Get IPFS URL from hash
   */
  public static getIPFSUrl(hash: string, usePublicGateway = false): string {
    const gateway = usePublicGateway 
      ? 'https://ipfs.io/ipfs/'
      : 'https://gateway.pinata.cloud/ipfs/';
    
    return `${gateway}${hash}`;
  }
}

// Export singleton instance
export const ipfsService = IPFSService.getInstance();