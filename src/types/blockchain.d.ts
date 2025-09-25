// Extend Window interface to include ethereum
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (data: any) => void) => void;
      removeAllListeners: (event: string) => void;
      selectedAddress?: string;
      chainId?: string;
    };
  }
}

// IPFS response type
export interface IPFSUploadResponse {
  success: boolean;
  ipfsHash?: string;
  pinataUrl?: string;
  publicUrl?: string;
  error?: string;
}

// Blockchain transaction result
export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;
}

// QR Code data structure
export interface PaymentQRData {
  type: 'ethereum-payment';
  chainId: number;
  to: string;
  value?: string;
  data?: string;
  invoiceId?: number;
  amount?: string;
  token?: string;
}

export {};