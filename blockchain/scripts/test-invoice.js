const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Testing Invoice Creation and Retrieval...\n");

    // Get the deployed contract address from deployment file
    const fs = require('fs');
    const deploymentFile = './deployments/sepolia-deployment.json';

    if (!fs.existsSync(deploymentFile)) {
        console.error("❌ Deployment file not found. Please deploy the contract first.");
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    const contractAddress = deployment.contractAddress;

    console.log("📍 Using contract at:", contractAddress);

    // Connect to the deployed contract
    const InvoiceManager = await ethers.getContractFactory("InvoiceManager");
    const invoiceManager = InvoiceManager.attach(contractAddress);

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("👤 Using account:", signer.address);

    // Get current invoice ID
    const currentId = await invoiceManager.getCurrentInvoiceId();
    console.log("📊 Current Invoice ID:", currentId.toString());

    // Check if we have any invoices created by this user
    const accountExists = await invoiceManager.doesUserAccountExist(signer.address);
    console.log("👥 User account exists:", accountExists);

    if (accountExists) {
        try {
            const createdBills = await invoiceManager.getUserCreatedBills(signer.address);
            console.log("📝 Created invoices count:", createdBills.length);
            console.log("📝 Created invoice IDs:", createdBills.map(id => id.toString()));

            // Try to retrieve each invoice
            for (let i = 0; i < createdBills.length; i++) {
                const invoiceId = createdBills[i];
                try {
                    const invoice = await invoiceManager.getInvoice(invoiceId);
                    console.log(`\n📄 Invoice #${invoiceId}:`);
                    console.log("   - From:", invoice.from);
                    console.log("   - To:", invoice.to);
                    console.log("   - Amount:", ethers.utils.formatUnits(invoice.amount, 6), "PYUSD");
                    console.log("   - Status:", invoice.status);
                    console.log("   - Paid:", invoice.paid);
                    console.log("   - IPFS Hash:", invoice.invoiceIpfsHash);
                    console.log("   - Created At:", new Date(invoice.createdAt * 1000).toISOString());
                    console.log("   - Exists:", invoice.exists);
                } catch (error) {
                    console.error(`   ❌ Error retrieving invoice #${invoiceId}:`, error.message);
                }
            }
        } catch (error) {
            console.error("❌ Error getting created bills:", error.message);
        }
    } else {
        console.log("ℹ️  No user account found. Create an invoice first.");
    }

    // Test creating a new invoice
    console.log("\n🆕 Testing invoice creation...");
    const testAmount = ethers.utils.parseUnits("10", 6); // 10 PYUSD
    const testIpfsHash = "QmTestHash" + Date.now();

    try {
        const tx = await invoiceManager.createInvoice(testAmount, testIpfsHash);
        console.log("⏳ Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);

        // Get the new invoice ID from the event
        const event = receipt.events.find(e => e.event === 'InvoiceCreated');
        if (event) {
            const newInvoiceId = event.args.invoiceId;
            console.log("🎉 New invoice created with ID:", newInvoiceId.toString());

            // Try to retrieve it immediately
            const newInvoice = await invoiceManager.getInvoice(newInvoiceId);
            console.log("\n📄 Retrieved new invoice:");
            console.log("   - ID:", newInvoice.id.toString());
            console.log("   - From:", newInvoice.from);
            console.log("   - Amount:", ethers.utils.formatUnits(newInvoice.amount, 6), "PYUSD");
            console.log("   - IPFS Hash:", newInvoice.invoiceIpfsHash);
            console.log("   - Exists:", newInvoice.exists);
            console.log("   - Status:", newInvoice.status);
        }
    } catch (error) {
        console.error("❌ Error creating invoice:", error.message);
        if (error.reason) console.error("   Reason:", error.reason);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Test failed:");
        console.error(error);
        process.exit(1);
    });
