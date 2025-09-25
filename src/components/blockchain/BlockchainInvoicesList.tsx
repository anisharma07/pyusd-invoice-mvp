import React, { useState, useEffect } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonIcon,
  IonButton,
  IonSpinner,
  IonToast,
  IonItem,
  IonLabel,
  IonText,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonAlert
} from '@ionic/react';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  walletOutline,
  qrCodeOutline,
  copyOutline,
  openOutline,
  refreshOutline,
  settingsOutline
} from 'ionicons/icons';
import { blockchainService } from '../../services/blockchain/blockchain';
import { qrCodeService } from '../../services/blockchain/qrCodeService';
import { useWallet } from '../../contexts/blockchain/WalletContext';
import { useTheme } from '../../contexts/ThemeContext';
import { networkManager } from '../../utils/networkManager';
import { Invoice, InvoiceStatus } from '../../services/blockchain/types';

const BlockchainInvoicesList: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { isConnected, address } = useWallet();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<number | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'warning' | 'danger'>('success');
  const [showNetworkAlert, setShowNetworkAlert] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      loadBlockchainInvoices();
    }
  }, [isConnected, address]);

  const loadBlockchainInvoices = async () => {
    if (!isConnected || !address) return;

    try {
      setLoading(true);
      const invoiceIds = await blockchainService.getOrganizationInvoices(address);
      
      const invoiceDetails = await Promise.all(
        invoiceIds.map(async (id) => {
          try {
            return await blockchainService.getInvoice(id);
          } catch (error) {
            console.error(`Failed to load invoice ${id}:`, error);
            return null;
          }
        })
      );

      // Filter out null values and sort by creation date (newest first)
      const validInvoices = invoiceDetails
        .filter((invoice): invoice is Invoice => invoice !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      setInvoices(validInvoices);
    } catch (error) {
      console.error('Failed to load blockchain invoices:', error);
      setToastMessage('Failed to load blockchain invoices');
      setToastColor('danger');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'success';
      case InvoiceStatus.FAILED:
        return 'danger';
      case InvoiceStatus.UNPAID:
      default:
        return 'warning';
    }
  };

  const getStatusIcon = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return checkmarkCircleOutline;
      case InvoiceStatus.FAILED:
        return closeCircleOutline;
      case InvoiceStatus.UNPAID:
      default:
        return timeOutline;
    }
  };

  const getStatusText = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'PAID';
      case InvoiceStatus.FAILED:
        return 'FAILED';
      case InvoiceStatus.UNPAID:
      default:
        return 'UNPAID';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: string) => {
    const numAmount = parseFloat(amount);
    return numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const handleCopyAddress = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage(`${label} copied to clipboard!`);
      setToastColor('success');
      setShowToast(true);
    } catch (error) {
      setToastMessage(`Failed to copy ${label.toLowerCase()}`);
      setToastColor('danger');
      setShowToast(true);
    }
  };

  const handleGenerateQR = async (invoice: Invoice) => {
    try {
      setToastMessage('Generating payment QR code...');
      setToastColor('warning');
      setShowToast(true);

      // Try MetaMask Mobile QR first (best for mobile users)
      console.log('🎯 Trying MetaMask Mobile QR...');
      let qrResult = await qrCodeService.generateMetaMaskMobileQR(
        invoice.id,
        invoice.amount,
        invoice.creator
      );

      // If MetaMask mobile fails, try standard EIP-681
      if (!qrResult.success) {
        console.log('🔄 MetaMask mobile failed, trying EIP-681...');
        const eipResult = await qrCodeService.generatePYUSDPaymentQR(
          invoice.id,
          invoice.amount,
          invoice.creator
        );
        
        if (eipResult.success) {
          qrResult = {
            success: true,
            qrCodeDataUrl: eipResult.qrCodeDataUrl,
            deepLink: eipResult.uri
          };
        }
      }

      // If both fail, try structured approach
      if (!qrResult.success) {
        console.log('🔄 EIP-681 failed, trying structured approach...');
        const structuredResult = await qrCodeService.generateStructuredPaymentQR(
          invoice.id,
          invoice.amount,
          invoice.creator
        );
        
        if (structuredResult.success) {
          qrResult = {
            success: true,
            qrCodeDataUrl: structuredResult.qrCodeDataUrl,
            deepLink: JSON.stringify(structuredResult.data)
          };
        }
      }

      if (qrResult.success && qrResult.qrCodeDataUrl) {
        // Create a modal or popup to show the QR code instead of auto-downloading
        const qrModal = document.createElement('div');
        qrModal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          flex-direction: column;
          padding: 20px;
        `;
        
        qrModal.innerHTML = `
          <div style="background: white; border-radius: 12px; padding: 20px; text-align: center; max-width: 90%; max-height: 90%; overflow-y: auto;">
            <h3 style="margin: 0 0 15px 0; color: #333;">📱 Payment QR Code</h3>
            <img src="${qrResult.qrCodeDataUrl}" alt="Payment QR Code" style="max-width: 300px; width: 100%; height: auto; border: 2px solid #eee; border-radius: 8px;" />
            <p style="margin: 15px 0 5px 0; font-size: 14px; color: #666;">Invoice #${invoice.id}</p>
            <p style="margin: 5px 0 15px 0; font-size: 16px; font-weight: bold; color: #333;">${formatAmount(invoice.amount)} PYUSD</p>
            
            <div style="margin: 15px 0; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; font-size: 14px;">
              <h4 style="margin: 0 0 10px 0; color: #856404;">📋 Setup Instructions</h4>
              <p style="margin: 5px 0; color: #856404; text-align: left;">
                <strong>If you see "Network not found" error:</strong><br/>
                1. Add Sepolia network to MetaMask<br/>
                2. Switch to Sepolia testnet<br/>
                3. Scan QR code again
              </p>
              <button onclick="window.networkManager?.setupSepoliaEnvironment().then(r => r.success ? alert('✅ Network setup complete!') : alert('❌ Setup failed: ' + r.error))" 
                      style="padding: 8px 16px; background: #ffc107; color: #212529; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; margin-top: 10px;">
                🔧 Auto-Setup Sepolia Network
              </button>
            </div>
            
            <div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 11px; color: #666; word-break: break-all; max-height: 80px; overflow-y: auto;">
              <strong>QR Data:</strong><br/>${qrResult.deepLink || 'N/A'}
            </div>
            
            <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 15px;">
              <button onclick="this.closest('div').previousElementSibling.click()" style="padding: 8px 16px; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">📥 Download</button>
              <button onclick="navigator.clipboard.writeText('${(qrResult.deepLink || '').replace(/'/g, "\\'")}'); alert('📋 QR data copied!')" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">📋 Copy</button>
              <button onclick="document.body.removeChild(this.closest('div').parentElement)" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">✖️ Close</button>
            </div>
            <a href="${qrResult.qrCodeDataUrl}" download="invoice-${invoice.id}-qr.png" style="display: none;"></a>
          </div>
        `;
        
        // Close modal when clicking outside
        qrModal.addEventListener('click', (e) => {
          if (e.target === qrModal) {
            document.body.removeChild(qrModal);
          }
        });
        
        document.body.appendChild(qrModal);

        setToastMessage('QR code generated successfully!');
        setToastColor('success');
        setShowToast(true);
      } else {
        throw new Error(qrResult.error || 'Failed to generate QR code with all methods');
      }
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      setToastMessage(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setToastColor('danger');
      setShowToast(true);
    }
  };

  const handleViewOnExplorer = (invoice: Invoice) => {
    const explorerUrl = `https://sepolia.etherscan.io/address/${invoice.creator}`;
    window.open(explorerUrl, '_blank');
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    if (!isConnected || !address) {
      setToastMessage('Please connect your wallet to pay invoices');
      setToastColor('warning');
      setShowToast(true);
      return;
    }

    try {
      setPayingInvoiceId(invoice.id);
      setToastMessage('Processing payment... Please confirm in MetaMask');
      setToastColor('warning');
      setShowToast(true);

      // Call the blockchain service to pay the invoice
      const result = await blockchainService.payInvoice(invoice.id);

      if (result.success) {
        setToastMessage(`✅ Payment successful! Transaction: ${result.transactionHash?.slice(0, 8)}...`);
        setToastColor('success');
        setShowToast(true);

        // Refresh the invoices list to update the status
        setTimeout(() => {
          loadBlockchainInvoices();
        }, 2000);
      } else {
        throw new Error(result.error || 'Payment failed');
      }
    } catch (error: any) {
      console.error('Payment failed:', error);
      
      let errorMessage = 'Payment failed';
      if (error.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient PYUSD balance for payment';
      } else if (error.message?.includes('User denied')) {
        errorMessage = 'Payment cancelled by user';
      } else if (error.message?.includes('allowance')) {
        errorMessage = 'PYUSD approval required - please try again';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setToastMessage(`❌ ${errorMessage}`);
      setToastColor('danger');
      setShowToast(true);
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const handleSetupNetwork = async () => {
    try {
      setToastMessage('Setting up Sepolia network...');
      setToastColor('warning');
      setShowToast(true);

      const result = await networkManager.setupSepoliaEnvironment();
      
      if (result.success) {
        setToastMessage('✅ Sepolia network added! You can now scan QR codes.');
        setToastColor('success');
      } else {
        throw new Error(result.error || 'Failed to setup network');
      }
    } catch (error) {
      console.error('Failed to setup network:', error);
      setToastMessage(`Failed to setup network: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setToastColor('danger');
    } finally {
      setShowToast(true);
      setShowNetworkAlert(false);
    }
  };

  if (!isConnected) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--ion-color-medium)',
        }}
      >
        <IonIcon
          icon={walletOutline}
          style={{
            fontSize: '64px',
            marginBottom: '16px',
            opacity: 0.5,
          }}
        />
        <h3>Connect Your Wallet</h3>
        <p>Please connect your wallet to view blockchain invoices.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
        }}
      >
        <IonSpinner />
        <p style={{ marginTop: '16px' }}>Loading blockchain invoices...</p>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'var(--ion-color-medium)',
        }}
      >
        <IonIcon
          icon={walletOutline}
          style={{
            fontSize: '64px',
            marginBottom: '16px',
            opacity: 0.5,
          }}
        />
        <h3>No Blockchain Invoices</h3>
        <p>You haven't created any blockchain invoices yet.</p>
        <p>Save an invoice to blockchain to get started!</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: '16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
            Blockchain Invoices ({invoices.length})
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <IonButton
              fill="outline"
              size="small"
              onClick={() => setShowNetworkAlert(true)}
            >
              <IonIcon icon={settingsOutline} slot="start" />
              Setup Network
            </IonButton>
            <IonButton
              fill="outline"
              size="small"
              onClick={loadBlockchainInvoices}
              disabled={loading}
            >
              <IonIcon icon={refreshOutline} slot="start" />
              Refresh
            </IonButton>
          </div>
        </div>

        {invoices.map((invoice) => (
          <IonCard
            key={invoice.id}
            style={{
              marginBottom: '12px',
              border: `1px solid ${
                isDarkMode
                  ? 'var(--ion-color-step-200)'
                  : 'var(--ion-color-step-150)'
              }`,
            }}
          >
            <IonCardHeader style={{ paddingBottom: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <IonCardTitle style={{ fontSize: '16px', marginBottom: '4px' }}>
                    Invoice #{invoice.id}
                  </IonCardTitle>
                  <IonText color="medium" style={{ fontSize: '14px' }}>
                    {formatAmount(invoice.amount)} PYUSD
                  </IonText>
                </div>
                <IonBadge color={getStatusColor(invoice.status)}>
                  <IonIcon
                    icon={getStatusIcon(invoice.status)}
                    style={{ marginRight: '4px', fontSize: '14px' }}
                  />
                  {getStatusText(invoice.status)}
                </IonBadge>
              </div>
            </IonCardHeader>

            <IonCardContent style={{ paddingTop: '0' }}>
              <IonGrid style={{ padding: '0' }}>
                <IonRow>
                  <IonCol size="12" style={{ padding: '4px 0' }}>
                    <IonText color="medium" style={{ fontSize: '12px' }}>
                      Created: {formatDate(invoice.createdAt)}
                    </IonText>
                  </IonCol>
                  {invoice.status === InvoiceStatus.PAID && (
                    <IonCol size="12" style={{ padding: '4px 0' }}>
                      <IonText color="success" style={{ fontSize: '12px' }}>
                        Paid: {formatDate(invoice.paidAt)}
                      </IonText>
                    </IonCol>
                  )}
                  {invoice.status === InvoiceStatus.UNPAID && invoice.creator.toLowerCase() !== address?.toLowerCase() && (
                    <IonCol size="12" style={{ padding: '4px 0' }}>
                      <IonText color="warning" style={{ fontSize: '12px' }}>
                        💡 You can pay this invoice directly or scan the QR code
                      </IonText>
                    </IonCol>
                  )}
                </IonRow>

                {/* Action buttons */}
                <IonRow style={{ marginTop: '12px' }}>
                  {invoice.status === InvoiceStatus.UNPAID && (
                    <IonCol size="12" style={{ marginBottom: '8px' }}>
                      {invoice.creator.toLowerCase() === address?.toLowerCase() ? (
                        <IonButton
                          expand="block"
                          fill="outline"
                          color="medium"
                          disabled
                        >
                          <IonIcon icon={walletOutline} slot="start" />
                          Your Invoice - Cannot Pay Own Invoice
                        </IonButton>
                      ) : (
                        <IonButton
                          expand="block"
                          color="success"
                          onClick={() => handlePayInvoice(invoice)}
                          disabled={payingInvoiceId === invoice.id || loading}
                        >
                          {payingInvoiceId === invoice.id ? (
                            <>
                              <IonSpinner name="crescent" slot="start" />
                              Processing Payment...
                            </>
                          ) : (
                            <>
                              <IonIcon icon={walletOutline} slot="start" />
                              Pay Now ({formatAmount(invoice.amount)} PYUSD)
                            </>
                          )}
                        </IonButton>
                      )}
                    </IonCol>
                  )}
                  <IonCol size="auto">
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={() => handleCopyAddress(invoice.creator, 'Creator address')}
                      title="Copy Creator Address"
                    >
                      <IonIcon icon={copyOutline} slot="icon-only" />
                    </IonButton>
                  </IonCol>
                  {invoice.status === InvoiceStatus.UNPAID && (
                    <IonCol size="auto">
                      <IonButton
                        fill="clear"
                        size="small"
                        onClick={() => handleGenerateQR(invoice)}
                        title="Generate QR Code"
                      >
                        <IonIcon icon={qrCodeOutline} slot="icon-only" />
                      </IonButton>
                    </IonCol>
                  )}
                  <IonCol size="auto">
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={() => handleViewOnExplorer(invoice)}
                      title="View on Explorer"
                    >
                      <IonIcon icon={openOutline} slot="icon-only" />
                    </IonButton>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </IonCardContent>
          </IonCard>
        ))}
      </div>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        color={toastColor}
        position="top"
      />

      <IonAlert
        isOpen={showNetworkAlert}
        onDidDismiss={() => setShowNetworkAlert(false)}
        header={'🌐 Setup Sepolia Network'}
        subHeader={'Required for QR Code Payments'}
        message={
          'To use QR code payments, you need to add the Sepolia testnet to your MetaMask wallet. This will also add the PYUSD token for easy transactions.'
        }
        buttons={[
          {
            text: 'Cancel',
            role: 'cancel',
            cssClass: 'secondary',
          },
          {
            text: '🔧 Setup Network',
            handler: handleSetupNetwork,
          },
        ]}
      />
    </>
  );
};

export default BlockchainInvoicesList;