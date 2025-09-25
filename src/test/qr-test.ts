// Quick test for QR code generation
import { qrCodeService } from '../services/blockchain/qrCodeService';

// Test the new PYUSD payment QR generation
async function testQRGeneration() {
  console.log('🧪 Testing QR Code Generation...');
  
  try {
    const result = await qrCodeService.generatePYUSDPaymentQR(
      123, // invoiceId
      '100.50', // amount
      '0x3BEa30431539669E94B2E79149654586F7746A16' // contract address
    );
    
    if (result.success) {
      console.log('✅ QR Code generated successfully!');
      console.log('📱 URI:', result.uri);
      console.log('🖼️ QR Code data URL length:', result.qrCodeDataUrl?.length);
      
      // Validate the URI format
      if (result.uri?.startsWith('ethereum:')) {
        console.log('✅ URI format is valid (EIP-681)');
        
        // Check if it contains the expected components
        if (result.uri.includes('@11155111')) { // Sepolia chain ID
          console.log('✅ Chain ID is correct (Sepolia)');
        }
        
        if (result.uri.includes('/transfer')) {
          console.log('✅ Function call is correct (transfer)');
        }
        
        if (result.uri.includes('address=0x3BEa30431539669E94B2E79149654586F7746A16')) {
          console.log('✅ Contract address is correct');
        }
        
        if (result.uri.includes('uint256=100500000')) { // 100.50 * 1e6
          console.log('✅ Amount is correct (converted to 6 decimals)');
        }
      }
    } else {
      console.error('❌ QR Code generation failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  testQRGeneration();
}

export { testQRGeneration };