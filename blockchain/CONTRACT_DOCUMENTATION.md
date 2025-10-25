# InvoiceManager Smart Contract Documentation

## Overview

The **InvoiceManager** smart contract is a comprehensive invoice management system built on Ethereum that integrates with PYUSD (PayPal USD) for payments. It features user account management, invoice generation with business metadata, and a platform fee mechanism.

## Key Features

### 1. **User Account System**
- Two user types: **USER** (payer) and **ISSUER** (business)
- Profile management via IPFS hash storage (name/bio/links)
- Verification system (managed by contract owner)
- Track created and paid bills per user

### 2. **Invoice Management**
- Create invoices with business metadata
- Enhanced invoice structure with:
  - Business name
  - Category/business type
  - IPFS hash for invoice documents
  - MSE code support
- Three invoice statuses: UNPAID, PAID, CANCELLED

### 3. **Platform Fee System**
- Automatic fee deduction on payments
- Default: 0.01% (1 basis point)
- Configurable by contract owner (max 1%)
- Fee distribution:
  - **99.99%** → Issuer wallet
  - **0.01%** → Platform wallet

### 4. **Payment Flow**

```
Customer wants to pay
         ↓
   Pay in Crypto/Token (PYUSD)
         ↓
    User pays via:
    - QR scan
    - Payment link
    - Customer app
         ↓
    ┌─────────────────────┐
    │  99.99% → Issuer    │
    │  0.01% → Platform   │
    └─────────────────────┘
```

## Data Structures

### UserAccount
```solidity
struct UserAccount {
    address wallet;              // User's wallet address
    uint256[] createdBills;      // Invoice IDs created by user
    uint256[] paidBills;         // Invoice IDs paid by user
    UserType userType;           // USER or ISSUER
    string profileIpfsHash;      // IPFS hash for profile data
    bool verified;               // Verification status
    bool exists;                 // Account existence flag
    uint256 createdAt;           // Account creation timestamp
}
```

### Invoice
```solidity
struct Invoice {
    uint256 id;                  // Unique invoice ID
    address payable from;        // Issuer wallet address
    address to;                  // Payer wallet (0x0 if unpaid)
    uint256 amount;              // Total amount in PYUSD (6 decimals)
    bool paid;                   // Payment status
    string invoiceIpfsHash;      // IPFS hash for invoice document
    string issuerBusinessName;   // Business name
    string category;             // Business category
    InvoiceStatus status;        // UNPAID, PAID, or CANCELLED
    uint256 createdAt;           // Creation timestamp
    uint256 paidAt;              // Payment timestamp
    bool exists;                 // Invoice existence flag
}
```

## Main Functions

### User Account Management

#### `createOrUpdateUserAccount(UserType _userType, string _profileIpfsHash)`
Create a new user account or update an existing one.
- **Parameters:**
  - `_userType`: USER or ISSUER
  - `_profileIpfsHash`: IPFS hash containing profile data
- **Events:** `UserAccountCreated` or `UserAccountUpdated`

#### `getUserAccount(address _wallet)`
Get user account details.
- **Returns:** UserAccount struct

#### `getUserCreatedBills(address _wallet)`
Get array of invoice IDs created by user.

#### `getUserPaidBills(address _wallet)`
Get array of invoice IDs paid by user.

#### `verifyUser(address _wallet, bool _verified)` (Owner only)
Verify or unverify a user account.

### Invoice Management

#### `createInvoice(uint256 _amount, string _invoiceIpfsHash, string _issuerBusinessName, string _category)`
Create a new invoice.
- **Parameters:**
  - `_amount`: Amount in PYUSD (6 decimals)
  - `_invoiceIpfsHash`: IPFS hash for invoice document
  - `_issuerBusinessName`: Business name
  - `_category`: Business category/type
- **Returns:** Invoice ID
- **Events:** `InvoiceCreated`

**Example:**
```javascript
// Create invoice for 100 PYUSD (100 * 10^6 because PYUSD has 6 decimals)
const amount = ethers.utils.parseUnits("100", 6);
const tx = await invoiceManager.createInvoice(
    amount,
    "Qm...", // IPFS hash
    "Acme Corp",
    "Consulting"
);
```

#### `payInvoice(uint256 _invoiceId)`
Pay an invoice with PYUSD.
- **Requirements:**
  - Invoice must be UNPAID
  - Sufficient PYUSD balance
  - Approved allowance for contract
  - Cannot pay your own invoice
- **Fee Distribution:**
  - Platform fee (0.01%) → Platform wallet
  - Remaining (99.99%) → Issuer wallet
- **Events:** `InvoicePaid`

**Example:**
```javascript
// First approve the contract to spend PYUSD
await pyusdToken.approve(invoiceManagerAddress, amount);

// Then pay the invoice
await invoiceManager.payInvoice(invoiceId);
```

#### `cancelInvoice(uint256 _invoiceId)`
Cancel an unpaid invoice (issuer only).
- **Events:** `InvoiceCancelled`

#### `getInvoice(uint256 _invoiceId)`
Get invoice details.
- **Returns:** Invoice struct

#### `getInvoicesBatch(uint256[] _invoiceIds)`
Get multiple invoices in one call (gas efficient).
- **Returns:** Array of Invoice structs

### Platform Management (Owner Only)

#### `updatePlatformFee(uint256 _newFeePercentage)`
Update platform fee percentage.
- **Range:** 0-100 basis points (0-1%)
- **Default:** 1 basis point (0.01%)

#### `updatePlatformWallet(address payable _newPlatformWallet)`
Update platform wallet address for fee collection.

#### `calculateFees(uint256 _amount)`
Calculate platform fee and issuer amount for a given invoice amount.
- **Returns:** `(platformFee, issuerAmount)`

## Events

### User Account Events
- `UserAccountCreated(address wallet, UserType userType, string profileIpfsHash, uint256 timestamp)`
- `UserAccountUpdated(address wallet, UserType userType, string profileIpfsHash)`
- `UserVerified(address wallet, bool verified)`

### Invoice Events
- `InvoiceCreated(uint256 invoiceId, address from, uint256 amount, string invoiceIpfsHash, string issuerBusinessName, string category, uint256 timestamp)`
- `InvoicePaid(uint256 invoiceId, address payer, address issuer, uint256 totalAmount, uint256 platformFee, uint256 issuerAmount, uint256 timestamp)`
- `InvoiceCancelled(uint256 invoiceId, address issuer)`

### Platform Events
- `PlatformFeeUpdated(uint256 oldFee, uint256 newFee)`
- `PlatformWalletUpdated(address oldWallet, address newWallet)`

## Deployment

The contract constructor requires two parameters:

```javascript
constructor(address _pyusdTokenAddress, address payable _platformWallet)
```

**Example deployment:**
```javascript
const InvoiceManager = await ethers.getContractFactory("InvoiceManager");
const invoiceManager = await InvoiceManager.deploy(
    PYUSD_TOKEN_ADDRESS,  // PYUSD token address on the network
    PLATFORM_WALLET       // Platform wallet for fee collection
);
```

## Usage Flow

### For Issuers (Businesses)

1. **Create Account** (optional, auto-created on first invoice)
```javascript
await invoiceManager.createOrUpdateUserAccount(
    1, // UserType.ISSUER
    "QmProfileHash..."
);
```

2. **Create Invoice**
```javascript
const amount = ethers.utils.parseUnits("100", 6); // 100 PYUSD
const invoiceId = await invoiceManager.createInvoice(
    amount,
    "QmInvoiceHash...",
    "My Business LLC",
    "Consulting Services"
);
```

3. **Share Invoice** - Share the invoice ID or payment link with customer

4. **Receive Payment** - Automatically receive 99.99% of payment amount

### For Payers (Customers)

1. **Approve PYUSD** (one-time or per-invoice)
```javascript
await pyusdToken.approve(invoiceManagerAddress, amount);
```

2. **Pay Invoice**
```javascript
await invoiceManager.payInvoice(invoiceId);
```

3. **Account Auto-Created** - User account created automatically on first payment

## Security Features

- ✅ ReentrancyGuard protection on payment function
- ✅ Ownable pattern for admin functions
- ✅ Strict access control (only issuer can cancel their invoices)
- ✅ Cannot pay your own invoice
- ✅ Balance and allowance checks before transfers
- ✅ Maximum platform fee cap (1%)

## Gas Optimization

- Batch invoice retrieval with `getInvoicesBatch()`
- Efficient array management
- Minimal storage operations

## IPFS Integration

Store off-chain data in IPFS:
- **Profile Data:** Name, bio, social links, business info
- **Invoice Documents:** PDF invoices, itemized details, terms
- **MSE Codes:** Machine-readable invoice codes

## Testing

Run the test suite:
```bash
npm run test
```

## Network Deployment

### Sepolia Testnet
```bash
npm run deploy:sepolia
```

### Local Development
```bash
# Start local node
npm run node

# Deploy to local network
npm run deploy:local
```

## Frontend Integration Example

```javascript
import { ethers } from 'ethers';

// Connect to contract
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const invoiceManager = new ethers.Contract(
    CONTRACT_ADDRESS,
    InvoiceManagerABI,
    signer
);

// Create invoice
async function createInvoice(amount, ipfsHash, businessName, category) {
    const tx = await invoiceManager.createInvoice(
        ethers.utils.parseUnits(amount, 6),
        ipfsHash,
        businessName,
        category
    );
    const receipt = await tx.wait();
    
    // Get invoice ID from event
    const event = receipt.events?.find(e => e.event === 'InvoiceCreated');
    const invoiceId = event?.args?.invoiceId;
    
    return invoiceId;
}

// Pay invoice
async function payInvoice(invoiceId, amount) {
    // First approve PYUSD
    const pyusd = new ethers.Contract(PYUSD_ADDRESS, ERC20_ABI, signer);
    await pyusd.approve(CONTRACT_ADDRESS, ethers.utils.parseUnits(amount, 6));
    
    // Then pay
    const tx = await invoiceManager.payInvoice(invoiceId);
    await tx.wait();
}

// Get user's created bills
async function getMyInvoices(userAddress) {
    const invoiceIds = await invoiceManager.getUserCreatedBills(userAddress);
    const invoices = await invoiceManager.getInvoicesBatch(invoiceIds);
    return invoices;
}
```

## License

MIT License
