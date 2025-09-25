// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title InvoiceManager
 * @dev Smart contract for managing invoices with PYUSD payments and IPFS storage
 */
contract InvoiceManager is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    
    // Invoice status enum
    enum InvoiceStatus { 
        UNPAID,     // 0 - Invoice created but not paid
        PAID,       // 1 - Invoice paid successfully
        FAILED      // 2 - Invoice failed (can be deleted by owner)
    }
    
    // Invoice structure
    struct Invoice {
        uint256 id;
        address payable creator;        // Organization wallet that created the invoice
        address payer;                  // Wallet that paid (0x0 if unpaid)
        uint256 amount;                 // Amount in PYUSD (6 decimals)
        InvoiceStatus status;
        string ipfsHash;                // Pinata IPFS hash for invoice data
        uint256 createdAt;
        uint256 paidAt;
        bool exists;
    }
    
    // State variables
    Counters.Counter private _invoiceIdCounter;
    IERC20 public pyusdToken;
    
    // Mappings
    mapping(uint256 => Invoice) public invoices;
    mapping(address => uint256[]) public organizationInvoices;  // Organization -> Invoice IDs
    mapping(address => uint256[]) public payerInvoices;        // Payer -> Invoice IDs
    
    // Events
    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed creator,
        uint256 amount,
        string ipfsHash
    );
    
    event InvoicePaid(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed creator,
        uint256 amount
    );
    
    event InvoiceDeleted(
        uint256 indexed invoiceId,
        address indexed creator
    );
    
    event InvoiceStatusUpdated(
        uint256 indexed invoiceId,
        InvoiceStatus newStatus
    );
    
    // Modifiers
    modifier invoiceExists(uint256 _invoiceId) {
        require(invoices[_invoiceId].exists, "Invoice does not exist");
        _;
    }
    
    modifier onlyInvoiceCreator(uint256 _invoiceId) {
        require(
            invoices[_invoiceId].creator == msg.sender,
            "Only invoice creator can perform this action"
        );
        _;
    }
    
    /**
     * @dev Constructor sets the PYUSD token address
     * @param _pyusdTokenAddress Address of PYUSD token contract on Sepolia
     */
    constructor(address _pyusdTokenAddress) {
        require(_pyusdTokenAddress != address(0), "Invalid PYUSD token address");
        pyusdToken = IERC20(_pyusdTokenAddress);
        _invoiceIdCounter.increment(); // Start IDs from 1
    }
    
    /**
     * @dev Create a new invoice
     * @param _amount Amount in PYUSD (considering 6 decimals)
     * @param _ipfsHash IPFS hash containing invoice metadata
     * @return invoiceId The ID of the created invoice
     */
    function createInvoice(
        uint256 _amount,
        string memory _ipfsHash
    ) external returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        require(bytes(_ipfsHash).length > 0, "IPFS hash cannot be empty");
        
        uint256 invoiceId = _invoiceIdCounter.current();
        _invoiceIdCounter.increment();
        
        invoices[invoiceId] = Invoice({
            id: invoiceId,
            creator: payable(msg.sender),
            payer: address(0),
            amount: _amount,
            status: InvoiceStatus.UNPAID,
            ipfsHash: _ipfsHash,
            createdAt: block.timestamp,
            paidAt: 0,
            exists: true
        });
        
        organizationInvoices[msg.sender].push(invoiceId);
        
        emit InvoiceCreated(invoiceId, msg.sender, _amount, _ipfsHash);
        
        return invoiceId;
    }
    
    /**
     * @dev Pay an invoice with PYUSD tokens
     * @param _invoiceId ID of the invoice to pay
     */
    function payInvoice(uint256 _invoiceId) 
        external 
        nonReentrant 
        invoiceExists(_invoiceId) 
    {
        Invoice storage invoice = invoices[_invoiceId];
        
        require(invoice.status == InvoiceStatus.UNPAID, "Invoice is not in unpaid status");
        require(invoice.creator != msg.sender, "Cannot pay your own invoice");
        
        // Check if payer has sufficient PYUSD balance
        require(
            pyusdToken.balanceOf(msg.sender) >= invoice.amount,
            "Insufficient PYUSD balance"
        );
        
        // Check if payer has approved sufficient amount
        require(
            pyusdToken.allowance(msg.sender, address(this)) >= invoice.amount,
            "Insufficient PYUSD allowance"
        );
        
        // Transfer PYUSD from payer to invoice creator
        bool success = pyusdToken.transferFrom(
            msg.sender,
            invoice.creator,
            invoice.amount
        );
        require(success, "PYUSD transfer failed");
        
        // Update invoice
        invoice.status = InvoiceStatus.PAID;
        invoice.payer = msg.sender;
        invoice.paidAt = block.timestamp;
        
        // Add to payer's invoice list
        payerInvoices[msg.sender].push(_invoiceId);
        
        emit InvoicePaid(_invoiceId, msg.sender, invoice.creator, invoice.amount);
        emit InvoiceStatusUpdated(_invoiceId, InvoiceStatus.PAID);
    }
    
    /**
     * @dev Mark invoice as failed (only by creator)
     * @param _invoiceId ID of the invoice to mark as failed
     */
    function markInvoiceAsFailed(uint256 _invoiceId)
        external
        invoiceExists(_invoiceId)
        onlyInvoiceCreator(_invoiceId)
    {
        Invoice storage invoice = invoices[_invoiceId];
        require(invoice.status == InvoiceStatus.UNPAID, "Can only mark unpaid invoices as failed");
        
        invoice.status = InvoiceStatus.FAILED;
        
        emit InvoiceStatusUpdated(_invoiceId, InvoiceStatus.FAILED);
    }
    
    /**
     * @dev Delete a failed invoice (only by creator)
     * @param _invoiceId ID of the invoice to delete
     */
    function deleteFailedInvoice(uint256 _invoiceId)
        external
        invoiceExists(_invoiceId)
        onlyInvoiceCreator(_invoiceId)
    {
        Invoice storage invoice = invoices[_invoiceId];
        require(invoice.status == InvoiceStatus.FAILED, "Can only delete failed invoices");
        
        // Remove from organization's invoice list
        _removeInvoiceFromList(organizationInvoices[msg.sender], _invoiceId);
        
        // Delete the invoice
        delete invoices[_invoiceId];
        
        emit InvoiceDeleted(_invoiceId, msg.sender);
    }
    
    /**
     * @dev Get invoice details
     * @param _invoiceId ID of the invoice
     * @return Invoice struct
     */
    function getInvoice(uint256 _invoiceId) 
        external 
        view 
        invoiceExists(_invoiceId) 
        returns (Invoice memory) 
    {
        return invoices[_invoiceId];
    }
    
    /**
     * @dev Get invoices created by an organization
     * @param _organization Address of the organization
     * @return Array of invoice IDs
     */
    function getOrganizationInvoices(address _organization) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return organizationInvoices[_organization];
    }
    
    /**
     * @dev Get invoices paid by a payer
     * @param _payer Address of the payer
     * @return Array of invoice IDs
     */
    function getPayerInvoices(address _payer) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return payerInvoices[_payer];
    }
    
    /**
     * @dev Get current invoice counter
     * @return Current invoice ID counter
     */
    function getCurrentInvoiceId() external view returns (uint256) {
        return _invoiceIdCounter.current();
    }
    
    /**
     * @dev Update PYUSD token address (only owner)
     * @param _newPyusdAddress New PYUSD token address
     */
    function updatePyusdToken(address _newPyusdAddress) external onlyOwner {
        require(_newPyusdAddress != address(0), "Invalid PYUSD token address");
        pyusdToken = IERC20(_newPyusdAddress);
    }
    
    /**
     * @dev Emergency function to pause/unpause contract (can be added with Pausable)
     * For now, owner can update critical parameters
     */
    
    // Internal helper functions
    function _removeInvoiceFromList(uint256[] storage list, uint256 invoiceId) internal {
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == invoiceId) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Get invoice status as string (for frontend convenience)
     * @param _invoiceId ID of the invoice
     * @return Status as string
     */
    function getInvoiceStatusString(uint256 _invoiceId) 
        external 
        view 
        invoiceExists(_invoiceId) 
        returns (string memory) 
    {
        InvoiceStatus status = invoices[_invoiceId].status;
        
        if (status == InvoiceStatus.UNPAID) return "UNPAID";
        if (status == InvoiceStatus.PAID) return "PAID";
        if (status == InvoiceStatus.FAILED) return "FAILED";
        
        return "UNKNOWN";
    }
    
    /**
     * @dev Batch get invoice details (gas efficient for frontend)
     * @param _invoiceIds Array of invoice IDs
     * @return Array of Invoice structs
     */
    function getInvoicesBatch(uint256[] memory _invoiceIds) 
        external 
        view 
        returns (Invoice[] memory) 
    {
        Invoice[] memory result = new Invoice[](_invoiceIds.length);
        
        for (uint256 i = 0; i < _invoiceIds.length; i++) {
            if (invoices[_invoiceIds[i]].exists) {
                result[i] = invoices[_invoiceIds[i]];
            }
        }
        
        return result;
    }
}