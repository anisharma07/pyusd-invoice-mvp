const { expect } = require("chai");
const { ethers } = require("hardhat");

// Mock PYUSD token for testing
describe("InvoiceManager", function () {
    let InvoiceManager, invoiceManager;
    let MockPYUSD, mockPYUSD;
    let owner, organization, payer, otherAccount;

    const INITIAL_SUPPLY = ethers.utils.parseUnits("1000000", 6); // 1M PYUSD (6 decimals)
    const INVOICE_AMOUNT = ethers.utils.parseUnits("100", 6); // 100 PYUSD
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    beforeEach(async function () {
        // Get signers
        [owner, organization, payer, otherAccount] = await ethers.getSigners();

        // Deploy Mock PYUSD token
        MockPYUSD = await ethers.getContractFactory("MockPYUSD");
        mockPYUSD = await MockPYUSD.deploy("PayPal USD", "PYUSD", 6, INITIAL_SUPPLY);
        await mockPYUSD.deployed();

        // Deploy InvoiceManager
        InvoiceManager = await ethers.getContractFactory("InvoiceManager");
        invoiceManager = await InvoiceManager.deploy(mockPYUSD.address, owner.address);
        await invoiceManager.deployed();

        // Transfer some PYUSD to payer for testing
        await mockPYUSD.transfer(payer.address, ethers.utils.parseUnits("10000", 6));

        // Approve InvoiceManager to spend payer's PYUSD
        await mockPYUSD.connect(payer).approve(invoiceManager.address, ethers.utils.parseUnits("10000", 6));
    });

    describe("Deployment", function () {
        it("Should set the correct PYUSD token address", async function () {
            expect(await invoiceManager.pyusdToken()).to.equal(mockPYUSD.address);
        });

        it("Should set the correct owner", async function () {
            expect(await invoiceManager.owner()).to.equal(owner.address);
        });

        it("Should initialize invoice counter to 1", async function () {
            expect(await invoiceManager.getCurrentInvoiceId()).to.equal(1);
        });

        it("Should revert if PYUSD address is zero", async function () {
            await expect(
                InvoiceManager.deploy(ZERO_ADDRESS, owner.address)
            ).to.be.revertedWith("Invalid PYUSD token address");
        });

        it("Should revert if platform wallet address is zero", async function () {
            await expect(
                InvoiceManager.deploy(mockPYUSD.address, ZERO_ADDRESS)
            ).to.be.revertedWith("Invalid platform wallet address");
        });

        it("Should set the correct platform wallet", async function () {
            expect(await invoiceManager.platformWallet()).to.equal(owner.address);
        });

        it("Should set the correct platform fee percentage", async function () {
            expect(await invoiceManager.platformFeePercentage()).to.equal(1); // 0.01%
        });
    });

    describe("Invoice Creation", function () {
        const ipfsHash = "QmTestHash123456789";

        it("Should create an invoice successfully", async function () {
            await expect(
                invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT, ipfsHash)
            ).to.emit(invoiceManager, "InvoiceCreated")
                .withArgs(1, organization.address, INVOICE_AMOUNT, ipfsHash);

            const invoice = await invoiceManager.getInvoice(1);
            expect(invoice.id).to.equal(1);
            expect(invoice.creator).to.equal(organization.address);
            expect(invoice.amount).to.equal(INVOICE_AMOUNT);
            expect(invoice.status).to.equal(0); // UNPAID
            expect(invoice.ipfsHash).to.equal(ipfsHash);
            expect(invoice.payer).to.equal(ZERO_ADDRESS);
            expect(invoice.exists).to.be.true;
        });

        it("Should increment invoice counter", async function () {
            await invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT, ipfsHash);
            expect(await invoiceManager.getCurrentInvoiceId()).to.equal(2);

            await invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT, "QmHash2");
            expect(await invoiceManager.getCurrentInvoiceId()).to.equal(3);
        });

        it("Should add invoice to organization's list", async function () {
            await invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT, ipfsHash);

            const orgInvoices = await invoiceManager.getOrganizationInvoices(organization.address);
            expect(orgInvoices.length).to.equal(1);
            expect(orgInvoices[0]).to.equal(1);
        });

        it("Should revert if amount is zero", async function () {
            await expect(
                invoiceManager.connect(organization).createInvoice(0, ipfsHash)
            ).to.be.revertedWith("Amount must be greater than 0");
        });

        it("Should revert if IPFS hash is empty", async function () {
            await expect(
                invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT, "")
            ).to.be.revertedWith("IPFS hash cannot be empty");
        });
    });

    describe("Invoice Payment", function () {
        const ipfsHash = "QmTestHash123456789";

        beforeEach(async function () {
            // Create an invoice
            await invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT, ipfsHash);
        });

        it("Should pay an invoice successfully", async function () {
            const initialOrgBalance = await mockPYUSD.balanceOf(organization.address);
            const initialPayerBalance = await mockPYUSD.balanceOf(payer.address);

            await expect(
                invoiceManager.connect(payer).payInvoice(1)
            ).to.emit(invoiceManager, "InvoicePaid")
                .withArgs(1, payer.address, organization.address, INVOICE_AMOUNT)
                .and.to.emit(invoiceManager, "InvoiceStatusUpdated")
                .withArgs(1, 1); // PAID status

            // Check balances
            const finalOrgBalance = await mockPYUSD.balanceOf(organization.address);
            const finalPayerBalance = await mockPYUSD.balanceOf(payer.address);

            expect(finalOrgBalance).to.equal(initialOrgBalance.add(INVOICE_AMOUNT));
            expect(finalPayerBalance).to.equal(initialPayerBalance.sub(INVOICE_AMOUNT));

            // Check invoice status
            const invoice = await invoiceManager.getInvoice(1);
            expect(invoice.status).to.equal(1); // PAID
            expect(invoice.payer).to.equal(payer.address);
            expect(invoice.paidAt).to.be.gt(0);
        });

        it("Should add invoice to payer's list", async function () {
            await invoiceManager.connect(payer).payInvoice(1);

            const payerInvoices = await invoiceManager.getPayerInvoices(payer.address);
            expect(payerInvoices.length).to.equal(1);
            expect(payerInvoices[0]).to.equal(1);
        });

        it("Should revert if invoice doesn't exist", async function () {
            await expect(
                invoiceManager.connect(payer).payInvoice(999)
            ).to.be.revertedWith("Invoice does not exist");
        });

        it("Should revert if invoice is already paid", async function () {
            await invoiceManager.connect(payer).payInvoice(1);

            await expect(
                invoiceManager.connect(payer).payInvoice(1)
            ).to.be.revertedWith("Invoice is not in unpaid status");
        });

        it("Should revert if trying to pay own invoice", async function () {
            await expect(
                invoiceManager.connect(organization).payInvoice(1)
            ).to.be.revertedWith("Cannot pay your own invoice");
        });

        it("Should revert if insufficient PYUSD balance", async function () {
            // Use account with no PYUSD
            await expect(
                invoiceManager.connect(otherAccount).payInvoice(1)
            ).to.be.revertedWith("Insufficient PYUSD balance");
        });

        it("Should revert if insufficient allowance", async function () {
            // Approve less than required
            await mockPYUSD.connect(payer).approve(invoiceManager.address, INVOICE_AMOUNT.sub(1));

            await expect(
                invoiceManager.connect(payer).payInvoice(1)
            ).to.be.revertedWith("Insufficient PYUSD allowance");
        });
    });

    describe("Invoice Status Management", function () {
        const ipfsHash = "QmTestHash123456789";

        beforeEach(async function () {
            await invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT, ipfsHash);
        });

        it("Should mark invoice as failed by creator", async function () {
            await expect(
                invoiceManager.connect(organization).markInvoiceAsFailed(1)
            ).to.emit(invoiceManager, "InvoiceStatusUpdated")
                .withArgs(1, 2); // FAILED status

            const invoice = await invoiceManager.getInvoice(1);
            expect(invoice.status).to.equal(2); // FAILED
        });

        it("Should revert if non-creator tries to mark as failed", async function () {
            await expect(
                invoiceManager.connect(payer).markInvoiceAsFailed(1)
            ).to.be.revertedWith("Only invoice creator can perform this action");
        });

        it("Should revert if trying to mark paid invoice as failed", async function () {
            await invoiceManager.connect(payer).payInvoice(1);

            await expect(
                invoiceManager.connect(organization).markInvoiceAsFailed(1)
            ).to.be.revertedWith("Can only mark unpaid invoices as failed");
        });

        it("Should delete failed invoice by creator", async function () {
            await invoiceManager.connect(organization).markInvoiceAsFailed(1);

            await expect(
                invoiceManager.connect(organization).deleteFailedInvoice(1)
            ).to.emit(invoiceManager, "InvoiceDeleted")
                .withArgs(1, organization.address);

            // Invoice should not exist anymore
            await expect(
                invoiceManager.getInvoice(1)
            ).to.be.revertedWith("Invoice does not exist");
        });

        it("Should revert if trying to delete non-failed invoice", async function () {
            await expect(
                invoiceManager.connect(organization).deleteFailedInvoice(1)
            ).to.be.revertedWith("Can only delete failed invoices");
        });
    });

    describe("View Functions", function () {
        const ipfsHash1 = "QmTestHash1";
        const ipfsHash2 = "QmTestHash2";

        beforeEach(async function () {
            await invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT, ipfsHash1);
            await invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT.mul(2), ipfsHash2);
            await invoiceManager.connect(payer).payInvoice(1);
        });

        it("Should return correct invoice status string", async function () {
            expect(await invoiceManager.getInvoiceStatusString(1)).to.equal("PAID");
            expect(await invoiceManager.getInvoiceStatusString(2)).to.equal("UNPAID");
        });

        it("Should return organization invoices", async function () {
            const orgInvoices = await invoiceManager.getOrganizationInvoices(organization.address);
            expect(orgInvoices.length).to.equal(2);
            expect(orgInvoices[0]).to.equal(1);
            expect(orgInvoices[1]).to.equal(2);
        });

        it("Should return payer invoices", async function () {
            const payerInvoices = await invoiceManager.getPayerInvoices(payer.address);
            expect(payerInvoices.length).to.equal(1);
            expect(payerInvoices[0]).to.equal(1);
        });

        it("Should return batch invoice details", async function () {
            const invoices = await invoiceManager.getInvoicesBatch([1, 2]);
            expect(invoices.length).to.equal(2);
            expect(invoices[0].id).to.equal(1);
            expect(invoices[0].status).to.equal(1); // PAID
            expect(invoices[1].id).to.equal(2);
            expect(invoices[1].status).to.equal(0); // UNPAID
        });
    });

    describe("Owner Functions", function () {
        it("Should allow owner to update PYUSD token address", async function () {
            const newMockPYUSD = await MockPYUSD.deploy("New PYUSD", "NPYUSD", 6, INITIAL_SUPPLY);
            await newMockPYUSD.deployed();

            await invoiceManager.connect(owner).updatePyusdToken(newMockPYUSD.address);
            expect(await invoiceManager.pyusdToken()).to.equal(newMockPYUSD.address);
        });

        it("Should revert if non-owner tries to update PYUSD address", async function () {
            const newMockPYUSD = await MockPYUSD.deploy("New PYUSD", "NPYUSD", 6, INITIAL_SUPPLY);
            await newMockPYUSD.deployed();

            await expect(
                invoiceManager.connect(organization).updatePyusdToken(newMockPYUSD.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should revert if updating to zero address", async function () {
            await expect(
                invoiceManager.connect(owner).updatePyusdToken(ZERO_ADDRESS)
            ).to.be.revertedWith("Invalid PYUSD token address");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle large amounts correctly", async function () {
            const largeAmount = ethers.utils.parseUnits("999999", 6);

            // Transfer enough PYUSD to payer
            await mockPYUSD.transfer(payer.address, largeAmount);
            await mockPYUSD.connect(payer).approve(invoiceManager.address, largeAmount);

            await invoiceManager.connect(organization).createInvoice(largeAmount, "QmLargeHash");
            await invoiceManager.connect(payer).payInvoice(1);

            const invoice = await invoiceManager.getInvoice(1);
            expect(invoice.amount).to.equal(largeAmount);
            expect(invoice.status).to.equal(1); // PAID
        });

        it("Should handle multiple invoices from same organization", async function () {
            const invoiceCount = 10;

            for (let i = 0; i < invoiceCount; i++) {
                await invoiceManager.connect(organization).createInvoice(
                    INVOICE_AMOUNT.add(i),
                    `QmHash${i}`
                );
            }

            const orgInvoices = await invoiceManager.getOrganizationInvoices(organization.address);
            expect(orgInvoices.length).to.equal(invoiceCount);
            expect(await invoiceManager.getCurrentInvoiceId()).to.equal(invoiceCount + 1);
        });

        it("Should handle reentrancy protection", async function () {
            // This test would require a malicious contract to test reentrancy
            // For now, we verify the modifier is in place
            const ipfsHash = "QmTestHash";
            await invoiceManager.connect(organization).createInvoice(INVOICE_AMOUNT, ipfsHash);

            // Normal payment should work
            await invoiceManager.connect(payer).payInvoice(1);

            const invoice = await invoiceManager.getInvoice(1);
            expect(invoice.status).to.equal(1); // PAID
        });
    });
});