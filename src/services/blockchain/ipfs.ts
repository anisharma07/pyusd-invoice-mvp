import { InvoiceCreationData, IPFSResult } from './types';

// IPFS upload service using Pinata API
class IPFSService {
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private pinataJWT: string;

  constructor() {
    // These should be set from environment variables in production
    this.pinataApiKey = process.env.REACT_APP_PINATA_API_KEY || '';
    this.pinataSecretKey = process.env.REACT_APP_PINATA_SECRET_KEY || '';
    this.pinataJWT = process.env.REACT_APP_PINATA_JWT || '';
  }

  async uploadInvoiceData(invoiceData: InvoiceCreationData): Promise<IPFSResult> {
    try {
      // Format invoice data for IPFS storage
      const formattedData = this.formatInvoiceForIPFS(invoiceData);
      
      // Use Pinata API to upload JSON data
      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey,
        },
        body: JSON.stringify({
          pinataContent: formattedData,
          pinataMetadata: {
            name: `invoice-${Date.now()}`,
            keyvalues: {
              type: 'invoice',
              timestamp: new Date().toISOString(),
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Pinata API error: ${response.status}`);
      }

      const result = await response.json();
      
      console.log('📎 Invoice data uploaded to IPFS:', result.IpfsHash);

      return {
        success: true,
        ipfsHash: result.IpfsHash,
        pinataUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
        publicUrl: `https://ipfs.io/ipfs/${result.IpfsHash}`
      };

    } catch (error: any) {
      console.error('❌ Failed to upload to IPFS:', error);
      
      // Fallback: use local IPFS simulation for development
      if (this.isDevelopment()) {
        return this.simulateIPFSUpload(invoiceData);
      }

      return {
        success: false,
        error: error.message || 'Failed to upload to IPFS'
      };
    }
  }

  private formatInvoiceForIPFS(invoiceData: InvoiceCreationData) {
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
        amount: invoiceData.amount,
        currency: 'PYUSD',
        description: invoiceData.description || '',
        dueDate: invoiceData.dueDate || null,
        
        content: {
          companyName: invoiceData.companyName,
          companyAddress: invoiceData.companyAddress,
          clientName: invoiceData.clientName,
          clientAddress: invoiceData.clientAddress,
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

  private isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' || !this.pinataApiKey;
  }

  private simulateIPFSUpload(invoiceData: InvoiceCreationData): IPFSResult {
    // Generate a fake IPFS hash for development
    const fakeHash = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    console.log('🔧 Development mode: Simulating IPFS upload with hash:', fakeHash);
    
    return {
      success: true,
      ipfsHash: fakeHash,
      pinataUrl: `https://gateway.pinata.cloud/ipfs/${fakeHash}`,
      publicUrl: `https://ipfs.io/ipfs/${fakeHash}`
    };
  }

  async retrieveInvoiceData(ipfsHash: string): Promise<any> {
    try {
      // Try Pinata gateway first
      let response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
      
      if (!response.ok) {
        // Fallback to public IPFS gateway
        response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
      }

      if (!response.ok) {
        throw new Error(`Failed to retrieve data: ${response.status}`);
      }

      const data = await response.json();
      console.log('📥 Retrieved invoice data from IPFS:', ipfsHash);
      
      return data;

    } catch (error) {
      console.error('❌ Failed to retrieve from IPFS:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const ipfsService = new IPFSService();

// Export helper function
export const uploadInvoiceToIPFS = (invoiceData: InvoiceCreationData): Promise<IPFSResult> => {
  return ipfsService.uploadInvoiceData(invoiceData);
};