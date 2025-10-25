const pinataSDK = require('pinata-sdk');
require('dotenv').config();

class IPFSManager {
    constructor() {
        this.pinata = pinataSDK(
            process.env.PINATA_API_KEY,
            process.env.PINATA_SECRET_API_KEY
        );
        this.initialized = false;
    }

    /**
     * Initialize and test Pinata connection
     */
    async initialize() {
        try {
            await this.pinata.testAuthentication();
            this.initialized = true;
            console.log('✅ Pinata connection established successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to Pinata:', error);
            return false;
        }
    }

    /**
     * Upload invoice data to IPFS via Pinata
     * @param {Object} invoiceData - The invoice data to upload
     * @param {string} fileName - Name for the file (optional)
     * @returns {Promise<Object>} - Result containing IPFS hash and Pinata URL
     */
    async uploadInvoiceData(invoiceData, fileName = 'invoice-data') {
        if (!this.initialized) {
            const connected = await this.initialize();
            if (!connected) {
                throw new Error('Failed to initialize IPFS connection');
            }
        }

        try {
            // Prepare metadata
            const metadata = {
                name: fileName,
                keyvalues: {
                    type: 'invoice',
                    timestamp: new Date().toISOString(),
                    version: '1.0'
                }
            };

            // Upload JSON data
            const result = await this.pinata.pinJSONToIPFS(invoiceData, metadata);
            
            console.log('📎 Invoice data uploaded to IPFS:', {
                hash: result.IpfsHash,
                size: result.PinSize,
                timestamp: result.Timestamp
            });

            return {
                success: true,
                ipfsHash: result.IpfsHash,
                pinataUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
                publicUrl: `https://ipfs.io/ipfs/${result.IpfsHash}`,
                size: result.PinSize,
                timestamp: result.Timestamp
            };

        } catch (error) {
            console.error('❌ Failed to upload to IPFS:', error);
            throw new Error(`IPFS upload failed: ${error.message}`);
        }
    }

    /**
     * Upload file to IPFS via Pinata
     * @param {Buffer|ReadableStream} fileData - The file data to upload
     * @param {string} fileName - Name for the file
     * @returns {Promise<Object>} - Result containing IPFS hash and Pinata URL
     */
    async uploadFile(fileData, fileName) {
        if (!this.initialized) {
            const connected = await this.initialize();
            if (!connected) {
                throw new Error('Failed to initialize IPFS connection');
            }
        }

        try {
            const metadata = {
                name: fileName,
                keyvalues: {
                    type: 'file',
                    timestamp: new Date().toISOString()
                }
            };

            const result = await this.pinata.pinFileToIPFS(fileData, metadata);
            
            console.log('📁 File uploaded to IPFS:', {
                hash: result.IpfsHash,
                size: result.PinSize
            });

            return {
                success: true,
                ipfsHash: result.IpfsHash,
                pinataUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
                publicUrl: `https://ipfs.io/ipfs/${result.IpfsHash}`,
                size: result.PinSize,
                timestamp: result.Timestamp
            };

        } catch (error) {
            console.error('❌ Failed to upload file to IPFS:', error);
            throw new Error(`File upload failed: ${error.message}`);
        }
    }

    /**
     * Retrieve data from IPFS
     * @param {string} ipfsHash - The IPFS hash to retrieve
     * @returns {Promise<Object>} - The retrieved data
     */
    async retrieveData(ipfsHash) {
        try {
            const response = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📥 Data retrieved from IPFS:', ipfsHash);
            
            return {
                success: true,
                data: data,
                hash: ipfsHash
            };

        } catch (error) {
            console.error('❌ Failed to retrieve from IPFS:', error);
            
            // Try alternative gateway
            try {
                const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                return {
                    success: true,
                    data: data,
                    hash: ipfsHash
                };
            } catch (altError) {
                throw new Error(`Failed to retrieve from IPFS: ${error.message}`);
            }
        }
    }

    /**
     * Pin existing IPFS hash to Pinata
     * @param {string} ipfsHash - The IPFS hash to pin
     * @param {Object} metadata - Optional metadata
     * @returns {Promise<Object>} - Result of pinning operation
     */
    async pinByHash(ipfsHash, metadata = {}) {
        if (!this.initialized) {
            const connected = await this.initialize();
            if (!connected) {
                throw new Error('Failed to initialize IPFS connection');
            }
        }

        try {
            const result = await this.pinata.pinByHash(ipfsHash, metadata);
            console.log('📌 Hash pinned to Pinata:', ipfsHash);
            
            return {
                success: true,
                ipfsHash: result.IpfsHash,
                pinSize: result.PinSize,
                timestamp: result.Timestamp
            };

        } catch (error) {
            console.error('❌ Failed to pin hash:', error);
            throw new Error(`Pin operation failed: ${error.message}`);
        }
    }

    /**
     * Unpin content from Pinata
     * @param {string} ipfsHash - The IPFS hash to unpin
     * @returns {Promise<boolean>} - Success status
     */
    async unpin(ipfsHash) {
        if (!this.initialized) {
            const connected = await this.initialize();
            if (!connected) {
                throw new Error('Failed to initialize IPFS connection');
            }
        }

        try {
            await this.pinata.unpin(ipfsHash);
            console.log('📌 Hash unpinned from Pinata:', ipfsHash);
            return true;

        } catch (error) {
            console.error('❌ Failed to unpin hash:', error);
            throw new Error(`Unpin operation failed: ${error.message}`);
        }
    }

    /**
     * List pinned files
     * @param {Object} filters - Optional filters for listing
     * @returns {Promise<Array>} - List of pinned files
     */
    async listPinnedFiles(filters = {}) {
        if (!this.initialized) {
            const connected = await this.initialize();
            if (!connected) {
                throw new Error('Failed to initialize IPFS connection');
            }
        }

        try {
            const result = await this.pinata.pinList(filters);
            console.log(`📋 Found ${result.count} pinned files`);
            
            return {
                success: true,
                count: result.count,
                files: result.rows
            };

        } catch (error) {
            console.error('❌ Failed to list pinned files:', error);
            throw new Error(`List operation failed: ${error.message}`);
        }
    }

    /**
     * Format invoice data for IPFS storage
     * @param {Object} invoiceData - Raw invoice data from frontend
     * @returns {Object} - Formatted data for IPFS
     */
    formatInvoiceForIPFS(invoiceData) {
        const timestamp = new Date().toISOString();
        
        return {
            // Invoice metadata
            metadata: {
                version: '1.0',
                type: 'blockchain-invoice',
                createdAt: timestamp,
                network: 'sepolia',
                contract: 'InvoiceManager'
            },
            
            // Invoice details
            invoice: {
                amount: invoiceData.amount,
                currency: 'PYUSD',
                creator: invoiceData.creator,
                description: invoiceData.description || '',
                dueDate: invoiceData.dueDate || null,
                
                // Invoice content from the form
                content: {
                    companyName: invoiceData.companyName,
                    companyAddress: invoiceData.companyAddress,
                    clientName: invoiceData.clientName,
                    clientAddress: invoiceData.clientAddress,
                    items: invoiceData.items || [],
                    notes: invoiceData.notes || '',
                    terms: invoiceData.terms || ''
                }
            },
            
            // System information
            system: {
                appVersion: '1.0.0',
                platform: 'invoice-blockchain-app',
                uploadedAt: timestamp
            }
        };
    }
}

// Create singleton instance
const ipfsManager = new IPFSManager();

module.exports = {
    IPFSManager,
    ipfsManager
};