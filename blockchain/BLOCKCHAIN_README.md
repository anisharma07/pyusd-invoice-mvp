# Blockchain Invoice System

A comprehensive blockchain-based invoice management system built with React, Ionic, and Ethereum smart contracts. This system allows organizations to create invoices on the blockchain, store data on IPFS, and accept payments in PYUSD tokens.

## 🚀 Features

- **Smart Contract Integration**: Deploy and interact with invoice contracts on Ethereum networks
- **PYUSD Token Support**: Accept payments in PayPal USD (PYUSD) stablecoin
- **IPFS Storage**: Decentralized storage for invoice data using Pinata
- **MetaMask Integration**: Seamless wallet connection and transaction signing
- **QR Code Payments**: Mobile-friendly payment QR codes for easy transactions
- **Multi-chain Ready**: Architecture supports multiple blockchain networks
- **Invoice Management**: Create, track, and manage invoice status on-chain

## 🏗️ Architecture

### Smart Contracts (`/blockchain`)
- **InvoiceManager.sol**: Main contract for invoice creation and payment processing
- **MockPYUSD.sol**: Mock PYUSD token for testing
- Hardhat development environment with Sepolia testnet support

### Frontend Integration (`/src/services/blockchain`)
- **blockchain.ts**: Core blockchain service for contract interactions
- **ipfs.ts**: IPFS integration using Pinata API
- **qrcode.ts**: QR code generation for mobile payments
- **networks.ts**: Multi-chain network configuration

### React Components (`/src/components/blockchain`)
- **WalletConnection**: MetaMask wallet integration
- **BlockchainInvoiceForm**: Create invoices on blockchain
- **BlockchainInvoiceCard**: Display and manage invoice status

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install blockchain dependencies
cd blockchain
npm install
```

### 2. Environment Configuration

Create `.env` files:

**Frontend (`.env`):**
```env
REACT_APP_PINATA_API_KEY=your_pinata_api_key
REACT_APP_PINATA_SECRET_KEY=your_pinata_secret_key
REACT_APP_PINATA_JWT=your_pinata_jwt_token
```

**Blockchain (`/blockchain/.env`):**
```env
PRIVATE_KEY=your_deployment_private_key
ALCHEMY_API_KEY=your_alchemy_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_API_KEY=your_pinata_secret_key
PYUSD_TOKEN_ADDRESS=0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9
```

### 3. Get API Keys

#### Alchemy (Ethereum Node Provider)
1. Visit [Alchemy](https://alchemy.com/)
2. Create account and new app
3. Select Ethereum Sepolia network
4. Copy API key

#### Pinata (IPFS Provider)
1. Visit [Pinata](https://pinata.cloud/)
2. Create account
3. Go to API Keys section
4. Generate new API key with pinning permissions

#### Etherscan (Contract Verification)
1. Visit [Etherscan](https://etherscan.io/)
2. Create account
3. Go to API section
4. Generate free API key

### 4. Deploy Smart Contracts

```bash
cd blockchain

# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to Sepolia testnet
npm run deploy:sepolia

# Verify contract (optional)
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> "<PYUSD_ADDRESS>"
```

### 5. Update Contract Addresses

After deployment, update the contract address in:
- `/src/services/blockchain/networks.ts`
- `/blockchain/utils/networks.js`

### 6. Start Development Server

```bash
# Start frontend
npm run dev

# Start local blockchain (optional)
cd blockchain
npm run node
```

## 🔧 Usage Guide

### For Organizations (Invoice Creators)

1. **Connect Wallet**
   - Install MetaMask browser extension
   - Switch to Sepolia testnet
   - Connect wallet to the application

2. **Create Invoice**
   - Go to "Blockchain" tab
   - Fill in company and client details
   - Add invoice items with quantities and rates
   - Click "Create Invoice on Blockchain"
   - Confirm transaction in MetaMask

3. **Share Payment**
   - Copy invoice payment link
   - Generate QR code for mobile payments
   - Send to client for payment

### For Payers (Invoice Recipients)

1. **Receive Invoice**
   - Get payment link or scan QR code
   - View invoice details

2. **Pay Invoice**
   - Connect MetaMask wallet
   - Ensure sufficient PYUSD balance
   - Click "Pay Invoice"
   - Approve PYUSD spending (first time)
   - Confirm payment transaction

### Testing with Sepolia

1. **Get Test ETH**
   - Visit [Sepolia Faucet](https://sepoliafaucet.com/)
   - Request test ETH for gas fees

2. **Get Test PYUSD**
   - Use PYUSD Sepolia contract: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`
   - Contact PayPal or use test token faucets

## 📱 Mobile Integration

### QR Code Payments
- QR codes contain payment deep links
- Compatible with MetaMask mobile
- Supports universal payment links

### MetaMask Mobile
1. Install MetaMask mobile app
2. Import wallet using seed phrase
3. Switch to Sepolia network
4. Scan QR codes to pay invoices

## 🔗 Network Support

### Currently Supported
- **Sepolia Testnet** (Primary testing network)
  - Chain ID: 11155111
  - PYUSD: `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9`

### Future Support
- Ethereum Mainnet
- Polygon
- Binance Smart Chain
- Other EVM-compatible chains

## 🧪 Testing

### Smart Contract Tests
```bash
cd blockchain
npm test
```

### Frontend Testing
```bash
npm test
```

### Manual Testing Checklist
- [ ] Wallet connection/disconnection
- [ ] Network switching
- [ ] Invoice creation
- [ ] Payment processing
- [ ] QR code generation
- [ ] IPFS data retrieval
- [ ] Error handling

## 🔐 Security Considerations

### Smart Contract Security
- ReentrancyGuard for payment functions
- Access control for sensitive operations
- Input validation and error handling
- Comprehensive test coverage

### Frontend Security
- Private key never stored locally
- Secure API key management
- HTTPS for all communications
- Input sanitization

### IPFS Security
- Encrypted sensitive data storage
- Hash verification
- Backup gateway redundancy

## 📊 Contract Functions

### Core Functions
- `createInvoice(amount, ipfsHash)`: Create new invoice
- `payInvoice(invoiceId)`: Pay existing invoice
- `getInvoice(invoiceId)`: Retrieve invoice details
- `markInvoiceAsFailed(invoiceId)`: Mark invoice as failed
- `deleteFailedInvoice(invoiceId)`: Delete failed invoice

### View Functions
- `getOrganizationInvoices(address)`: Get invoices by creator
- `getPayerInvoices(address)`: Get invoices by payer
- `getCurrentInvoiceId()`: Get latest invoice ID
- `getInvoiceStatusString(invoiceId)`: Get status as string

## 🚨 Troubleshooting

### Common Issues

1. **MetaMask Not Detected**
   - Install MetaMask browser extension
   - Refresh page after installation

2. **Wrong Network**
   - Switch to Sepolia in MetaMask
   - Use network switcher in app

3. **Insufficient Balance**
   - Get test ETH from faucet
   - Ensure PYUSD balance for payments

4. **Transaction Failed**
   - Check gas fees
   - Verify contract addresses
   - Check network congestion

5. **IPFS Upload Failed**
   - Verify Pinata API keys
   - Check internet connection
   - Try again later

### Debug Mode
Enable debug logging by setting:
```javascript
localStorage.setItem('debug', 'blockchain:*');
```

## 🚀 Deployment

### Frontend Deployment
1. Build production version: `npm run build`
2. Deploy to hosting provider (Vercel, Netlify, etc.)
3. Set environment variables

### Contract Deployment
1. Deploy to mainnet: `npm run deploy:ethereum`
2. Verify on Etherscan
3. Update frontend contract addresses

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Create GitHub issue
- Check troubleshooting section
- Review contract documentation

---

**⚠️ Disclaimer**: This is a testnet implementation. Do not use real funds or deploy to mainnet without thorough testing and security audits.