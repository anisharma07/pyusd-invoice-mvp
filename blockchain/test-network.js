const { ethers } = require("hardhat");

async function main() {
    try {
        console.log("Testing network connection...");
        const network = await ethers.provider.getNetwork();
        console.log("✅ Connected to network:", network.name);
        console.log("Chain ID:", network.chainId);

        const blockNumber = await ethers.provider.getBlockNumber();
        console.log("Current block number:", blockNumber);

        const [deployer] = await ethers.getSigners();
        console.log("Deployer address:", deployer.address);

        const balance = await deployer.getBalance();
        console.log("Balance:", ethers.utils.formatEther(balance), "ETH");

    } catch (error) {
        console.error("❌ Network test failed:");
        console.error(error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
