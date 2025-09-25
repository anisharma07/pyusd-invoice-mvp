/**
 * QR Code Debug Helper
 * Use this in browser console to test QR code generation
 */

export const debugQRCode = async () => {
  console.log('🔍 QR Code Debug Helper Starting...');
  
  try {
    // Import the QR service
    const { qrCodeService } = await import('../services/blockchain/qrCodeService');
    const { NETWORKS } = await import('../services/blockchain/web3Service');
    
    console.log('📡 Network Configuration:', NETWORKS.sepolia);
    
    // Test data
    const testData = {
      invoiceId: 123,
      amount: '100.50',
      contractAddress: '0x3BEa30431539669E94B2E79149654586F7746A16'
    };
    
    console.log('🧪 Test Data:', testData);
    
    // Test method 1: PYUSD Payment QR
    console.log('\n🎯 Testing Method 1: generatePYUSDPaymentQR');
    const result1 = await qrCodeService.generatePYUSDPaymentQR(
      testData.invoiceId,
      testData.amount,
      testData.contractAddress
    );
    
    console.log('📊 Method 1 Result:', {
      success: result1.success,
      uri: result1.uri,
      error: result1.error,
      hasQRCode: !!result1.qrCodeDataUrl
    });
    
    // Test method 2: Structured Payment QR
    console.log('\n🎯 Testing Method 2: generateStructuredPaymentQR');
    const result2 = await qrCodeService.generateStructuredPaymentQR(
      testData.invoiceId,
      testData.amount,
      testData.contractAddress
    );
    
    console.log('📊 Method 2 Result:', {
      success: result2.success,
      data: result2.data,
      error: result2.error,
      hasQRCode: !!result2.qrCodeDataUrl
    });
    
    // Test method 3: Generic Payment QR
    console.log('\n🎯 Testing Method 3: generateGenericPaymentQR');
    const result3 = await qrCodeService.generateGenericPaymentQR(
      testData.contractAddress,
      testData.amount,
      NETWORKS.sepolia.chainId
    );
    
    console.log('📊 Method 3 Result:', {
      success: result3.success,
      uri: result3.uri,
      error: result3.error,
      hasQRCode: !!result3.qrCodeDataUrl
    });
    
    // Display QR codes if successful
    if (result1.success && result1.qrCodeDataUrl) {
      console.log('\n🖼️ Displaying Method 1 QR Code...');
      displayQRCode('Method 1 - PYUSD Payment', result1.qrCodeDataUrl, result1.uri);
    }
    
    if (result2.success && result2.qrCodeDataUrl) {
      console.log('\n🖼️ Displaying Method 2 QR Code...');
      displayQRCode('Method 2 - Structured Data', result2.qrCodeDataUrl, JSON.stringify(result2.data, null, 2));
    }
    
    if (result3.success && result3.qrCodeDataUrl) {
      console.log('\n🖼️ Displaying Method 3 QR Code...');
      displayQRCode('Method 3 - Generic Payment', result3.qrCodeDataUrl, result3.uri);
    }
    
    console.log('\n✅ QR Code Debug Complete!');
    
  } catch (error) {
    console.error('❌ Debug Failed:', error);
  }
};

function displayQRCode(title: string, dataUrl: string, data?: string) {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 2px solid #333;
    border-radius: 8px;
    padding: 15px;
    z-index: 10000;
    max-width: 300px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  `;
  
  container.innerHTML = `
    <h4 style="margin: 0 0 10px 0; color: #333;">${title}</h4>
    <img src="${dataUrl}" alt="${title}" style="max-width: 200px; width: 100%;" />
    ${data ? `
      <details style="margin-top: 10px;">
        <summary style="cursor: pointer; color: #666;">View Data</summary>
        <pre style="font-size: 10px; color: #333; margin: 5px 0; white-space: pre-wrap; word-break: break-all;">${data}</pre>
      </details>
    ` : ''}
    <button onclick="document.body.removeChild(this.parentElement)" style="
      margin-top: 10px; 
      padding: 5px 10px; 
      background: #dc3545; 
      color: white; 
      border: none; 
      border-radius: 4px; 
      cursor: pointer;
      width: 100%;
    ">Close</button>
  `;
  
  document.body.appendChild(container);
  
  // Auto-remove after 30 seconds
  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 30000);
}

// Add to window object for easy console access
if (typeof window !== 'undefined') {
  (window as any).debugQRCode = debugQRCode;
}

console.log('🔧 QR Debug Helper loaded! Run debugQRCode() in console to test.');