export interface Network {
  chainId: number;
  name: string;
  currency: string;
  rpcUrl: string;
  blockExplorer: string;
  pyusdAddress: string | null;
  isTestnet: boolean;
  supported: boolean;
}

export interface ContractAddresses {
  invoiceManager: string | null;
  pyusd: string | null;
}

export interface Invoice {
  id: number;
  creator: string;
  payer: string;
  amount: string;
  status: InvoiceStatus;
  ipfsHash: string;
  createdAt: number;
  paidAt: number;
  exists: boolean;
}

export enum InvoiceStatus {
  UNPAID = 0,
  PAID = 1,
  FAILED = 2
}

export interface InvoiceCreationData {
  amount: number;
  companyName: string;
  companyAddress: string;
  clientName: string;
  clientAddress: string;
  description?: string;
  items: InvoiceItem[];
  notes?: string;
  terms?: string;
  dueDate?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface BlockchainTransaction {
  hash: string;
  status: 'pending' | 'success' | 'failed';
  confirmations: number;
  gasUsed?: string;
  gasPrice?: string;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string;
  chainId: number | null;
  network: Network | null;
  isLoading: boolean;
  error: string | null;
}

export interface IPFSResult {
  success: boolean;
  ipfsHash?: string;
  pinataUrl?: string;
  publicUrl?: string;
  error?: string;
}

export interface QRCodeData {
  invoiceId: number;
  contractAddress: string;
  amount: string;
  chainId: number;
  recipient: string;
}

export interface PaymentQRData {
  type: string;
  invoiceId: number;
  contractAddress: string;
  tokenAddress: string; // Made required to prevent undefined errors
  amount: string;
  chainId: number;
  recipient: string;
  network: string;
  networkName: string;
  to: string;
  token: string;
  value: string;
  paymentUrl?: string;
  data?: string;
}

export interface IPFSUploadResponse {
  success: boolean;
  ipfsHash?: string;
  pinataUrl?: string;
  publicUrl?: string;
  error?: string;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}