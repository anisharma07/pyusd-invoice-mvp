import pinataSDK from '@pinata/sdk';

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY;
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY;

export interface IPFSUploadResult {
    success: boolean;
    ipfsHash?: string;
    error?: string;
}

/**
 * Upload spreadsheet content to IPFS via Pinata
 * @param content - The spreadsheet content to upload
 * @param fileName - Optional filename for the upload
 * @returns IPFSUploadResult with hash or error
 */
export async function uploadToIPFS(
    content: string,
    fileName?: string
): Promise<IPFSUploadResult> {
    try {
        // Check if we have either JWT or API Key/Secret
        if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET_KEY)) {
            throw new Error('Pinata credentials not configured. Please set VITE_PINATA_JWT or VITE_PINATA_API_KEY and VITE_PINATA_SECRET_KEY in .env');
        }

        // Determine which authentication method to use
        const useJWT = !!PINATA_JWT;
        const authHeaders = useJWT
            ? { 'Authorization': `Bearer ${PINATA_JWT}` }
            : {
                'pinata_api_key': PINATA_API_KEY!,
                'pinata_secret_api_key': PINATA_SECRET_KEY!,
            };

        // Use Pinata API directly with fetch since the SDK is deprecated
        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
            },
            body: JSON.stringify({
                pinataContent: {
                    content,
                    fileName: fileName || 'invoice-spreadsheet',
                    timestamp: new Date().toISOString(),
                },
                pinataMetadata: {
                    name: fileName || 'Invoice Spreadsheet',
                },
            }),
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.details || errorData.error || errorData.message || errorMessage;
            } catch (e) {
                // If response is not JSON, use status text
            }

            if (response.status === 401) {
                const authMethod = useJWT ? 'JWT token (VITE_PINATA_JWT)' : 'API Key/Secret (VITE_PINATA_API_KEY and VITE_PINATA_SECRET_KEY)';
                throw new Error(`Invalid Pinata credentials. Please check your ${authMethod} in .env file`);
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();

        return {
            success: true,
            ipfsHash: data.IpfsHash,
        };
    } catch (error: any) {
        console.error('IPFS upload error:', error);
        return {
            success: false,
            error: error.message || 'Failed to upload to IPFS',
        };
    }
}

/**
 * Get IPFS gateway URL for a hash
 * @param ipfsHash - The IPFS hash
 * @returns Full IPFS gateway URL
 */
export function getIPFSUrl(ipfsHash: string): string {
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
}
