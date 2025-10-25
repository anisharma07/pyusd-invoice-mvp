// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract InvoiceManager is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    enum InvoiceStatus {
        UNPAID, // Invoice created but not paid
        PAID, // Invoice paid successfully
        CANCELLED // Invoice cancelled by issuer
    }

    // ============ Structs ============

    struct bills {
        uint256[] created; // Invoice IDs created by this user
        uint256[] issued; // Invoice IDs paid/issued to this user
        bool exists; // Flag to check if account exists
    }

    struct Invoice {
        uint256 id;
        address payable from; // Issuer wallet address
        address to; // Payer wallet address (0x0 if unpaid)
        uint256 amount; // Total amount in PYUSD (6 decimals)
        bool paid; // Payment status
        string invoiceIpfsHash; // IPFS hash for invoice document/MSE code
        InvoiceStatus status;
        uint256 createdAt;
        uint256 paidAt;
        bool exists;
    }

    // ============ State Variables ============

    Counters.Counter private _invoiceIdCounter;
    IERC20 public pyusdToken;
    address payable public platformWallet;
    uint256 public platformFeePercentage; // Fee in basis points (1 = 0.01%)

    // Mappings
    mapping(uint256 => Invoice) public invoices;
    mapping(address => bills) private userAccounts;

    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed from,
        uint256 amount,
        string invoiceIpfsHash,
        uint256 timestamp
    );

    event InvoicePaid(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed issuer,
        uint256 totalAmount,
        uint256 platformFee,
        uint256 issuerAmount,
        uint256 timestamp
    );

    event InvoiceCancelled(uint256 indexed invoiceId, address indexed issuer);

    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    event PlatformWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet
    );

    event UserAccountCreated(address indexed user, uint256 timestamp);

    event InvoicePaidWithCash(
        uint256 indexed invoiceId,
        address indexed issuer,
        address indexed customer,
        uint256 totalAmount,
        uint256 platformFee,
        uint256 timestamp
    );

    // ============ Modifiers ============

    modifier invoiceExists(uint256 _invoiceId) {
        require(invoices[_invoiceId].exists, "Invoice does not exist");
        _;
    }

    modifier onlyInvoiceIssuer(uint256 _invoiceId) {
        require(
            invoices[_invoiceId].from == msg.sender,
            "Only invoice issuer can perform this action"
        );
        _;
    }

    modifier userAccountExists(address _wallet) {
        require(userAccounts[_wallet].exists, "User account does not exist");
        _;
    }

    // ============ Constructor ============

    constructor(address _pyusdTokenAddress, address payable _platformWallet) {
        require(
            _pyusdTokenAddress != address(0),
            "Invalid PYUSD token address"
        );
        require(
            _platformWallet != address(0),
            "Invalid platform wallet address"
        );

        pyusdToken = IERC20(_pyusdTokenAddress);
        platformWallet = _platformWallet;
        platformFeePercentage = 1; // 0.01% (1 basis point)
        _invoiceIdCounter.increment(); // Start IDs from 1
    }

    // ============ User Account Functions ============

    function getUserAccount(
        address _wallet
    ) external view returns (bills memory) {
        require(userAccounts[_wallet].exists, "User account does not exist");
        return userAccounts[_wallet];
    }

    function doesUserAccountExist(
        address _wallet
    ) external view returns (bool) {
        return userAccounts[_wallet].exists;
    }

    function getUserCreatedBills(
        address _wallet
    ) external view returns (uint256[] memory) {
        require(userAccounts[_wallet].exists, "User account does not exist");
        return userAccounts[_wallet].created;
    }

    function getUserPaidBills(
        address _wallet
    ) external view returns (uint256[] memory) {
        require(userAccounts[_wallet].exists, "User account does not exist");
        return userAccounts[_wallet].issued;
    }

    // ============ Invoice Functions ============

    function createInvoice(
        uint256 _amount,
        string memory _invoiceIpfsHash
    ) external returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        require(
            bytes(_invoiceIpfsHash).length > 0,
            "IPFS hash cannot be empty"
        );

        // Create user account if it doesn't exist
        if (!userAccounts[msg.sender].exists) {
            userAccounts[msg.sender] = bills({
                created: new uint256[](0),
                issued: new uint256[](0),
                exists: true
            });
            emit UserAccountCreated(msg.sender, block.timestamp);
        }

        uint256 invoiceId = _invoiceIdCounter.current();
        _invoiceIdCounter.increment();

        invoices[invoiceId] = Invoice({
            id: invoiceId,
            from: payable(msg.sender),
            to: address(0),
            amount: _amount,
            paid: false,
            invoiceIpfsHash: _invoiceIpfsHash,
            status: InvoiceStatus.UNPAID,
            createdAt: block.timestamp,
            paidAt: 0,
            exists: true
        });

        userAccounts[msg.sender].created.push(invoiceId);

        emit InvoiceCreated(
            invoiceId,
            msg.sender,
            _amount,
            _invoiceIpfsHash,
            block.timestamp
        );

        return invoiceId;
    }

    function payInvoice(
        uint256 _invoiceId
    ) external nonReentrant invoiceExists(_invoiceId) {
        Invoice storage invoice = invoices[_invoiceId];

        require(
            invoice.status == InvoiceStatus.UNPAID,
            "Invoice is not in unpaid status"
        );
        require(!invoice.paid, "Invoice already paid");
        require(invoice.from != msg.sender, "Cannot pay your own invoice");

        // Calculate platform fee (0.01% = 1 basis point)
        // Example: 1000 PYUSD * 1 / 10000 = 0.1 PYUSD fee
        uint256 platformFee = (invoice.amount * platformFeePercentage) / 10000;
        uint256 issuerAmount = invoice.amount - platformFee;

        // Check if payer has sufficient PYUSD balance
        require(
            pyusdToken.balanceOf(msg.sender) >= invoice.amount,
            "Insufficient PYUSD balance"
        );

        // Check if payer has approved sufficient amount
        require(
            pyusdToken.allowance(msg.sender, address(this)) >= invoice.amount,
            "Insufficient PYUSD allowance. Please approve the contract to spend PYUSD"
        );

        // Transfer platform fee to platform wallet (if fee > 0)
        if (platformFee > 0) {
            bool feeSuccess = pyusdToken.transferFrom(
                msg.sender,
                platformWallet,
                platformFee
            );
            require(feeSuccess, "Platform fee transfer failed");
        }

        // Transfer remaining amount to issuer
        bool issuerSuccess = pyusdToken.transferFrom(
            msg.sender,
            invoice.from,
            issuerAmount
        );
        require(issuerSuccess, "Issuer payment transfer failed");

        // Update invoice
        invoice.status = InvoiceStatus.PAID;
        invoice.paid = true;
        invoice.to = msg.sender;
        invoice.paidAt = block.timestamp;

        // Create payer account if doesn't exist
        if (!userAccounts[msg.sender].exists) {
            userAccounts[msg.sender] = bills({
                created: new uint256[](0),
                issued: new uint256[](0),
                exists: true
            });
            emit UserAccountCreated(msg.sender, block.timestamp);
        }

        // Add to payer's paid bills list
        userAccounts[msg.sender].issued.push(_invoiceId);

        emit InvoicePaid(
            _invoiceId,
            msg.sender,
            invoice.from,
            invoice.amount,
            platformFee,
            issuerAmount,
            block.timestamp
        );
    }

    function payInvoiceWithCash(
        uint256 _invoiceId,
        address _customerAddress
    )
        external
        nonReentrant
        invoiceExists(_invoiceId)
        onlyInvoiceIssuer(_invoiceId)
    {
        Invoice storage invoice = invoices[_invoiceId];

        require(
            invoice.status == InvoiceStatus.UNPAID,
            "Invoice is not in unpaid status"
        );
        require(!invoice.paid, "Invoice already paid");

        // Calculate platform fee (0.01% = 1 basis point)
        // Issuer pays the platform fee when customer pays in cash
        uint256 platformFee = (invoice.amount * platformFeePercentage) / 10000;

        // Check if issuer has sufficient PYUSD balance for the fee
        require(
            pyusdToken.balanceOf(msg.sender) >= platformFee,
            "Insufficient PYUSD balance to pay platform fee"
        );

        // Check if issuer has approved sufficient amount for the fee
        require(
            pyusdToken.allowance(msg.sender, address(this)) >= platformFee,
            "Insufficient PYUSD allowance. Please approve the contract to spend PYUSD for platform fee"
        );

        // Transfer platform fee from issuer to platform wallet (if fee > 0)
        if (platformFee > 0) {
            bool feeSuccess = pyusdToken.transferFrom(
                msg.sender,
                platformWallet,
                platformFee
            );
            require(feeSuccess, "Platform fee transfer failed");
        }

        // Update invoice
        invoice.status = InvoiceStatus.PAID;
        invoice.paid = true;
        invoice.to = _customerAddress; // Use provided customer address or 0x0 if not provided
        invoice.paidAt = block.timestamp;

        // If customer address is provided and account doesn't exist, create it
        if (
            _customerAddress != address(0) &&
            !userAccounts[_customerAddress].exists
        ) {
            userAccounts[_customerAddress] = bills({
                created: new uint256[](0),
                issued: new uint256[](0),
                exists: true
            });
            emit UserAccountCreated(_customerAddress, block.timestamp);
        }

        // Add to customer's paid bills list if address provided
        if (_customerAddress != address(0)) {
            userAccounts[_customerAddress].issued.push(_invoiceId);
        }

        emit InvoicePaidWithCash(
            _invoiceId,
            msg.sender,
            _customerAddress,
            invoice.amount,
            platformFee,
            block.timestamp
        );
    }

    function cancelInvoice(
        uint256 _invoiceId
    ) external invoiceExists(_invoiceId) onlyInvoiceIssuer(_invoiceId) {
        Invoice storage invoice = invoices[_invoiceId];
        require(
            invoice.status == InvoiceStatus.UNPAID,
            "Can only cancel unpaid invoices"
        );
        require(!invoice.paid, "Cannot cancel paid invoice");

        invoice.status = InvoiceStatus.CANCELLED;

        emit InvoiceCancelled(_invoiceId, msg.sender);
    }

    function getInvoice(
        uint256 _invoiceId
    ) external view invoiceExists(_invoiceId) returns (Invoice memory) {
        return invoices[_invoiceId];
    }

    function getInvoiceSafe(
        uint256 _invoiceId
    ) external view returns (Invoice memory, bool) {
        return (invoices[_invoiceId], invoices[_invoiceId].exists);
    }

    function getCurrentInvoiceId() external view returns (uint256) {
        return _invoiceIdCounter.current();
    }

    function getInvoicesBatch(
        uint256[] memory _invoiceIds
    ) external view returns (Invoice[] memory) {
        Invoice[] memory result = new Invoice[](_invoiceIds.length);

        for (uint256 i = 0; i < _invoiceIds.length; i++) {
            if (invoices[_invoiceIds[i]].exists) {
                result[i] = invoices[_invoiceIds[i]];
            }
        }

        return result;
    }

    function getInvoiceStatusString(
        uint256 _invoiceId
    ) external view invoiceExists(_invoiceId) returns (string memory) {
        InvoiceStatus status = invoices[_invoiceId].status;

        if (status == InvoiceStatus.UNPAID) return "UNPAID";
        if (status == InvoiceStatus.PAID) return "PAID";
        if (status == InvoiceStatus.CANCELLED) return "CANCELLED";

        return "UNKNOWN";
    }

    // ============ Fee and Platform Functions ============

    function calculateFees(
        uint256 _amount
    ) external view returns (uint256 fee, uint256 issuerAmount) {
        fee = (_amount * platformFeePercentage) / 10000;
        issuerAmount = _amount - fee;
        return (fee, issuerAmount);
    }

    function updatePlatformFee(uint256 _newFeePercentage) external onlyOwner {
        require(_newFeePercentage <= 100, "Fee cannot exceed 1%"); // Max 1%
        uint256 oldFee = platformFeePercentage;
        platformFeePercentage = _newFeePercentage;
        emit PlatformFeeUpdated(oldFee, _newFeePercentage);
    }

    function updatePlatformWallet(
        address payable _newPlatformWallet
    ) external onlyOwner {
        require(
            _newPlatformWallet != address(0),
            "Invalid platform wallet address"
        );
        address oldWallet = platformWallet;
        platformWallet = _newPlatformWallet;
        emit PlatformWalletUpdated(oldWallet, _newPlatformWallet);
    }

    function updatePyusdToken(address _newPyusdAddress) external onlyOwner {
        require(_newPyusdAddress != address(0), "Invalid PYUSD token address");
        pyusdToken = IERC20(_newPyusdAddress);
    }
}
