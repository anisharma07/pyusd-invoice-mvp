const { ethers } = require("hardhat");
const { setContractAddress } = require("../utils/networks");

async function main() {
    console.log("🚀 Starting InvoiceManager deployment...");

    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log(`📡 Deploying to network: ${network.name} (Chain ID: ${network.chainId})`);

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("👤 Deploying contracts with account:", deployer.address);

    // Check deployer balance
    const balance = await deployer.getBalance();
    console.log("💰 Account balance:", ethers.utils.formatEther(balance), "ETH");

    if (balance.lt(ethers.utils.parseEther("0.01"))) {
        console.warn("⚠️  Low balance! Make sure you have enough ETH for deployment.");
    }

    // PYUSD token address for Sepolia
    const PYUSD_SEPOLIA = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

    // Get network-specific PYUSD address
    let pyusdAddress;
    if (network.chainId === 11155111) { // Sepolia
        pyusdAddress = PYUSD_SEPOLIA;
    } else if (network.chainId === 1) { // Mainnet
        pyusdAddress = "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8";
    } else {
        throw new Error(`❌ Unsupported network for PYUSD: ${network.name}`);
    }

    console.log("🪙 Using PYUSD token address:", pyusdAddress);

    // Set platform wallet (deployer address for MVP)
    const platformWallet = deployer.address;
    console.log("💼 Platform wallet address:", platformWallet);

    // Deploy InvoiceManager contract
    console.log("📝 Deploying InvoiceManager contract...");
    const InvoiceManager = await ethers.getContractFactory("InvoiceManager");

    // Estimate deployment gas
    const deploymentData = InvoiceManager.getDeployTransaction(pyusdAddress, platformWallet);
    const estimatedGas = await ethers.provider.estimateGas(deploymentData);
    const gasPrice = await ethers.provider.getGasPrice();
    const estimatedCost = estimatedGas.mul(gasPrice);

    console.log("⛽ Estimated deployment gas:", estimatedGas.toString());
    console.log("💸 Estimated deployment cost:", ethers.utils.formatEther(estimatedCost), "ETH");

    // Deploy with a bit more gas limit for safety
    const invoiceManager = await InvoiceManager.deploy(pyusdAddress, platformWallet, {
        gasLimit: estimatedGas.mul(120).div(100) // 20% buffer
    });

    console.log("⏳ Waiting for deployment transaction...");
    await invoiceManager.deployed();

    console.log("✅ InvoiceManager deployed successfully!");
    console.log("📍 Contract address:", invoiceManager.address);
    console.log("🔍 Transaction hash:", invoiceManager.deployTransaction.hash);

    // Wait for a few confirmations
    console.log("⏳ Waiting for confirmations...");
    await invoiceManager.deployTransaction.wait(3);
    console.log("✅ Contract confirmed with 3 blocks");

    // Save contract address to networks config
    const networkName = network.chainId === 11155111 ? 'sepolia' : 'ethereum';
    setContractAddress(networkName, 'invoiceManager', invoiceManager.address);

    // Verify contract constructor arguments
    console.log("\n📋 Contract Details:");
    console.log("- Contract Address:", invoiceManager.address);
    console.log("- PYUSD Token Address:", pyusdAddress);
    console.log("- Platform Wallet Address:", platformWallet);
    console.log("- Network:", network.name);
    console.log("- Chain ID:", network.chainId);
    console.log("- Deployer:", deployer.address);
    console.log("- Block Number:", invoiceManager.deployTransaction.blockNumber);

    // Test basic contract functionality
    console.log("\n🧪 Testing basic contract functionality...");
    try {
        const currentInvoiceId = await invoiceManager.getCurrentInvoiceId();
        console.log("✅ Current invoice ID:", currentInvoiceId.toString());

        const pyusdTokenAddress = await invoiceManager.pyusdToken();
        console.log("✅ PYUSD token address in contract:", pyusdTokenAddress);

        const owner = await invoiceManager.owner();
        console.log("✅ Contract owner:", owner);

        const platformWalletAddress = await invoiceManager.platformWallet();
        console.log("✅ Platform wallet in contract:", platformWalletAddress);

        const platformFee = await invoiceManager.platformFeePercentage();
        console.log("✅ Platform fee percentage:", platformFee.toString(), "basis points (0.01%)");

        console.log("🎉 All basic tests passed!");

    } catch (error) {
        console.error("❌ Basic functionality test failed:", error.message);
    }

    // Save deployment info to file
    const deploymentInfo = {
        network: network.name,
        chainId: network.chainId,
        contractAddress: invoiceManager.address,
        pyusdAddress: pyusdAddress,
        platformWallet: platformWallet,
        deployer: deployer.address,
        transactionHash: invoiceManager.deployTransaction.hash,
        blockNumber: invoiceManager.deployTransaction.blockNumber,
        deployedAt: new Date().toISOString(),
        gasUsed: estimatedGas.toString(),
        gasCost: ethers.utils.formatEther(estimatedCost)
    };

    const fs = require('fs');
    const path = require('path');

    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }

    // Save deployment info
    const deploymentFile = path.join(deploymentsDir, `${networkName}-deployment.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 Deployment info saved to: ${deploymentFile}`);

    // Output contract verification command
    console.log("\n🔍 To verify the contract on Etherscan, run:");
    console.log(`npx hardhat verify --network ${network.name === 'sepolia' ? 'sepolia' : 'mainnet'} ${invoiceManager.address} "${pyusdAddress}" "${platformWallet}"`);

    console.log("\n🎉 Deployment completed successfully!");
    console.log("🔗 Contract Address:", invoiceManager.address);

    return {
        contractAddress: invoiceManager.address,
        network: network.name,
        chainId: network.chainId
    };
}

// Handle errors and run deployment
main()
    .then((result) => {
        console.log("\n✅ Deployment completed successfully!");
        console.log("Contract Address:", result.contractAddress);
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });