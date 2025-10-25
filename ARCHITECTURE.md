# Architecture Diagram - Blockchain Invoice System

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Interface (React)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────┐              ┌───────────────────────┐    │
│  │  Home.tsx      │              │  CreateInvoiceModal   │    │
│  │                │              │                       │    │
│  │  - Editor Page │◄─────────────┤  - Amount Input       │    │
│  │  - Navbar      │   Opens      │  - IPFS Upload        │    │
│  │  - Buttons     │              │  - Contract Call      │    │
│  └────────┬───────┘              └───────────┬───────────┘    │
│           │                                   │                │
│           │                                   │                │
│  ┌────────▼───────┐                          │                │
│  │ WalletConnect  │                          │                │
│  │                │                          │                │
│  │ - Connect      │                          │                │
│  │ - Disconnect   │                          │                │
│  │ - Address      │                          │                │
│  └────────┬───────┘                          │                │
│           │                                   │                │
└───────────┼───────────────────────────────────┼────────────────┘
            │                                   │
            │                                   │
┌───────────▼───────────────────────────────────▼────────────────┐
│                      Wagmi Provider                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐       ┌──────────────────────────────┐  │
│  │  useAccount()    │       │  useWriteContract()          │  │
│  │  useConnect()    │       │  useWaitForTransaction()     │  │
│  │  useDisconnect() │       │                              │  │
│  └──────────────────┘       └──────────────────────────────┘  │
│                                                                 │
└────────────┬────────────────────────────────┬───────────────────┘
             │                                │
             │                                │
    ┌────────▼────────┐            ┌─────────▼──────────┐
    │   MetaMask      │            │  Contract Calls    │
    │   Extension     │            │                    │
    │                 │            │  - createInvoice() │
    │  - Sign Tx      │            │  - Read State      │
    │  - Send Tx      │            │                    │
    └────────┬────────┘            └─────────┬──────────┘
             │                               │
             │                               │
             └───────────┬───────────────────┘
                         │
                         │
              ┌──────────▼──────────┐
              │  Sepolia Testnet    │
              │  Chain ID: 11155111 │
              └──────────┬──────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼────────┐  ┌───▼──────────┐  ┌─▼─────────────┐
│ Invoice Manager│  │ PYUSD Token  │  │  Blockchain   │
│   Contract     │  │   Contract   │  │   Network     │
│                │  │              │  │               │
│ 0xEec9b389... │  │ 0xCaC524B... │  │ - Validators  │
│                │  │              │  │ - Consensus   │
│ Functions:     │  │ ERC20        │  │ - Storage     │
│ - createInv()  │  │ - transfer() │  │               │
│ - payInv()     │  │ - approve()  │  │               │
│ - cancelInv()  │  │ - balanceOf()│  │               │
└────────────────┘  └──────────────┘  └───────────────┘
```

## Data Flow - Creating an Invoice

```
┌──────────┐
│  User    │
│ Actions  │
└────┬─────┘
     │
     │ 1. Click "Generate Invoice"
     ▼
┌──────────────────┐
│ CreateInvoice    │
│    Modal         │
└────┬─────────────┘
     │
     │ 2. Enter Amount (PYUSD)
     │ 3. Click "Create"
     ▼
┌──────────────────┐
│ Get Spreadsheet  │
│    Content       │◄─── SocialCalc
└────┬─────────────┘
     │
     │ 4. Spreadsheet Data
     ▼
┌──────────────────┐
│ Upload to IPFS   │
│   (Pinata API)   │◄─── VITE_PINATA_JWT
└────┬─────────────┘
     │
     │ 5. IPFS Hash (QmXx...)
     ▼
┌──────────────────┐
│ Call Contract    │
│ writeContract()  │
└────┬─────────────┘
     │
     │ 6. Transaction Request
     ▼
┌──────────────────┐
│    MetaMask      │
│  Confirmation    │
└────┬─────────────┘
     │
     │ 7. User Signs Transaction
     ▼
┌──────────────────┐
│  Submit to       │
│  Blockchain      │
└────┬─────────────┘
     │
     │ 8. Transaction Hash
     │ 9. Wait for Confirmation
     ▼
┌──────────────────┐
│  Invoice Created │
│  Event Emitted   │
└────┬─────────────┘
     │
     │ 10. Invoice ID Returned
     ▼
┌──────────────────┐
│  Success Toast   │
│  Etherscan Link  │
└──────────────────┘
```

## Component Hierarchy

```
App.tsx
├── WagmiProvider
│   ├── QueryClientProvider
│   │   └── ThemeProvider
│   │       └── AppContent
│   │           └── InvoiceProvider
│   │               └── IonReactRouter
│   │                   └── Routes
│   │                       ├── LandingPage
│   │                       ├── FilesPage
│   │                       ├── SettingsPage
│   │                       └── Home (Invoice Editor)
│   │                           ├── IonHeader
│   │                           │   ├── IonToolbar (Primary)
│   │                           │   │   ├── Back Button
│   │                           │   │   ├── File Name
│   │                           │   │   ├── Save Button
│   │                           │   │   └── End Buttons
│   │                           │   │       ├── WalletConnect ★
│   │                           │   │       ├── Generate Invoice Button ★
│   │                           │   │       ├── Format Button
│   │                           │   │       ├── Share Button
│   │                           │   │       └── Actions Menu
│   │                           │   └── IonToolbar (Secondary)
│   │                           │       └── Footer Buttons
│   │                           ├── IonContent
│   │                           │   ├── SocialCalc Spreadsheet
│   │                           │   ├── FileOptions Popover
│   │                           │   ├── ColorPicker Modal
│   │                           │   ├── DynamicInvoiceForm
│   │                           │   ├── CreateInvoiceModal ★
│   │                           │   └── Menu
│   │                           └── IonToast (Notifications)
```

★ = New blockchain components

## State Management

```
┌─────────────────────────────────────────────┐
│           Application State                 │
├─────────────────────────────────────────────┤
│                                             │
│  React Context                              │
│  ├── ThemeContext                           │
│  │   └── isDarkMode                         │
│  │                                          │
│  ├── InvoiceContext                         │
│  │   ├── selectedFile                       │
│  │   ├── billType                           │
│  │   ├── activeTemplateData                 │
│  │   └── currentSheetId                     │
│  │                                          │
│  └── WagmiConfig ★                          │
│      ├── Account State                      │
│      │   ├── address                        │
│      │   ├── isConnected                    │
│      │   └── chain                          │
│      │                                      │
│      ├── Contract State                     │
│      │   ├── writeContract                  │
│      │   ├── isPending                      │
│      │   └── transactionHash               │
│      │                                      │
│      └── Transaction State                  │
│          ├── isConfirming                   │
│          └── isConfirmed                    │
│                                             │
│  Local State (Home.tsx)                     │
│  ├── showCreateInvoiceModal ★              │
│  ├── showInvoiceForm                        │
│  ├── showMenu                               │
│  ├── showToast                              │
│  ├── fileNotFound                           │
│  └── templateNotFound                       │
│                                             │
└─────────────────────────────────────────────┘

★ = New blockchain state
```

## API Integration Points

```
┌────────────────────────────────────────────────────┐
│                External Services                   │
├────────────────────────────────────────────────────┤
│                                                    │
│  1. Pinata IPFS API                                │
│     ├── Endpoint: https://api.pinata.cloud/...    │
│     ├── Auth: Bearer Token (JWT)                   │
│     ├── Method: POST /pinning/pinJSONToIPFS        │
│     └── Returns: { IpfsHash: "QmXx..." }          │
│                                                    │
│  2. Sepolia RPC (via Wagmi)                        │
│     ├── Endpoint: Default public RPC               │
│     ├── Chain ID: 11155111                         │
│     ├── Methods:                                   │
│     │   ├── eth_sendTransaction                    │
│     │   ├── eth_call                               │
│     │   └── eth_getTransactionReceipt             │
│     └── Gas: Paid in Sepolia ETH                  │
│                                                    │
│  3. Smart Contracts                                │
│     ├── Invoice Manager                            │
│     │   ├── Address: 0xEec9b38938E...             │
│     │   └── Function: createInvoice()             │
│     │                                              │
│     └── PYUSD Token                                │
│         ├── Address: 0xCaC524BcA...               │
│         └── Standard: ERC20                        │
│                                                    │
│  4. Etherscan API                                  │
│     ├── Endpoint: https://sepolia.etherscan.io/   │
│     ├── Purpose: Transaction viewing               │
│     └── No API key required for viewing            │
│                                                    │
└────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────┐
│          Error Handling Chain               │
├─────────────────────────────────────────────┤
│                                             │
│  Component Level                            │
│  ├── Input Validation                       │
│  │   ├── Amount > 0                         │
│  │   ├── Wallet Connected                   │
│  │   └── Correct Network                    │
│  │                                          │
│  ├── Try-Catch Blocks                       │
│  │   ├── IPFS Upload                        │
│  │   ├── Contract Call                      │
│  │   └── Transaction Wait                   │
│  │                                          │
│  └── User Notifications                     │
│      ├── Toast Messages                     │
│      ├── Modal Status                       │
│      └── Console Logs                       │
│                                             │
│  Service Level                              │
│  ├── IPFS Upload (ipfsUpload.ts)           │
│  │   ├── Check JWT exists                   │
│  │   ├── Fetch error handling               │
│  │   └── Return error object                │
│  │                                          │
│  └── Contract Interaction (Wagmi)          │
│      ├── Network validation                 │
│      ├── Gas estimation                     │
│      └── Revert messages                    │
│                                             │
└─────────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────┐
│            Security Layers                  │
├─────────────────────────────────────────────┤
│                                             │
│  Frontend (Client-Side)                     │
│  ├── Environment Variables                  │
│  │   └── VITE_PINATA_JWT (build-time)      │
│  │                                          │
│  ├── Input Validation                       │
│  │   ├── Type checking                      │
│  │   ├── Range validation                   │
│  │   └── Format verification                │
│  │                                          │
│  ├── User Confirmation                      │
│  │   └── MetaMask signature required        │
│  │                                          │
│  └── Network Isolation                      │
│      └── Testnet only (no mainnet)         │
│                                             │
│  Blockchain Layer                           │
│  ├── Smart Contract                         │
│  │   ├── Access control                     │
│  │   ├── State validation                   │
│  │   └── Reentrancy guards                  │
│  │                                          │
│  ├── Transaction Signing                    │
│  │   └── User's private key (MetaMask)     │
│  │                                          │
│  └── Immutable Storage                      │
│      └── Blockchain records                 │
│                                             │
│  IPFS Layer                                 │
│  ├── Content Addressing                     │
│  │   └── Hash-based retrieval               │
│  │                                          │
│  ├── Public Access                          │
│  │   └── All content is public              │
│  │                                          │
│  └── Pinning Service                        │
│      └── Authenticated API access           │
│                                             │
└─────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│         Application Deployment              │
├─────────────────────────────────────────────┤
│                                             │
│  Development                                │
│  ├── Local Server (Vite)                    │
│  ├── Port: 5174                             │
│  ├── Hot Module Replacement                 │
│  └── Source Maps                            │
│                                             │
│  Production Build                           │
│  ├── npm run build                          │
│  ├── Static Files (dist/)                   │
│  ├── Optimized Bundle                       │
│  └── Environment Variables Baked In         │
│                                             │
│  Hosting Options                            │
│  ├── Vercel                                 │
│  ├── Netlify                                │
│  ├── GitHub Pages                           │
│  └── IPFS (decentralized)                   │
│                                             │
│  External Dependencies                      │
│  ├── Pinata (IPFS)                          │
│  ├── Sepolia RPC (Blockchain)               │
│  ├── MetaMask (User's browser)              │
│  └── Etherscan (Viewing only)               │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Modular Architecture**: Each component has a single responsibility
2. **Provider Pattern**: Wagmi & React Query manage blockchain state
3. **Error Boundaries**: Multiple layers of error handling
4. **Type Safety**: Full TypeScript coverage
5. **User Control**: All transactions require explicit user approval
6. **Decentralized Storage**: IPFS for permanent, censorship-resistant storage
7. **Testnet First**: Safe development on Sepolia before mainnet
8. **Progressive Enhancement**: Works with or without blockchain features
