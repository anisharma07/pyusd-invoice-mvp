import React, { useState, useEffect } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonAlert,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonText,
  IonChip,
  IonToast
} from '@ionic/react';
import {
  walletOutline,
  linkOutline,
  qrCodeOutline,
  copyOutline,
  checkmarkCircle,
  closeCircle,
  timeOutline,
  close
} from 'ionicons/icons';
import { useWallet } from '../../contexts/blockchain/WalletContext';
import { blockchainService } from '../../services/blockchain/blockchain';
import { qrCodeService } from '../../services/blockchain/qrcode';
import { NETWORKS } from '../../services/blockchain/networks';
import { Invoice, InvoiceStatus, QRCodeData } from '../../services/blockchain/types';

interface BlockchainInvoiceCardProps {
  invoice: Invoice;
  onStatusUpdate?: (invoiceId: number, status: InvoiceStatus) => void;
  showPaymentOption?: boolean;
}

const BlockchainInvoiceCard: React.FC<BlockchainInvoiceCardProps> = ({
  invoice,
  onStatusUpdate,
  showPaymentOption = true
}) => {
  const { 
    isConnected, 
    address,
    network,
    connectWallet,
    isMetaMaskInstalled 
  } = useWallet();

  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [paymentLink, setPaymentLink] = useState<string>('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const formatAmount = (amount: string): string => {
    // Convert from wei to PYUSD (6 decimals)
    const amountNumber = Number(amount) / Math.pow(10, 6);
    return amountNumber.toFixed(2);
  };

  const getStatusColor = (status: InvoiceStatus): string => {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'success';
      case InvoiceStatus.UNPAID:
        return 'warning';
      case InvoiceStatus.FAILED:
        return 'danger';
      default:
        return 'medium';
    }
  };

  const getStatusText = (status: InvoiceStatus): string => {
    switch (status) {
      case InvoiceStatus.PAID:
        return 'Paid';
      case InvoiceStatus.UNPAID:
        return 'Unpaid';
      case InvoiceStatus.FAILED:
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const getStatusIcon = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.PAID:
        return checkmarkCircle;
      case InvoiceStatus.UNPAID:
        return timeOutline;
      case InvoiceStatus.FAILED:
        return closeCircle;
      default:
        return timeOutline;
    }
  };

  const canPayInvoice = (): boolean => {
    return (
      isConnected &&
      address &&
      invoice.status === InvoiceStatus.UNPAID &&
      invoice.creator.toLowerCase() !== address.toLowerCase() &&
      showPaymentOption
    );
  };

  const canShowQR = (): boolean => {
    return invoice.status === InvoiceStatus.UNPAID;
  };

  const handlePayInvoice = async () => {
    try {
      setIsPaymentLoading(true);

      const result = await blockchainService.payInvoice(invoice.id);
      
      if (result.success) {
        setToastMessage('Payment successful!');
        setShowToast(true);
        
        // Update invoice status
        if (onStatusUpdate) {
          onStatusUpdate(invoice.id, InvoiceStatus.PAID);
        }
      } else {
        setAlertMessage(result.error || 'Payment failed');
        setShowAlert(true);
      }

    } catch (error: any) {
      console.error('❌ Payment error:', error);
      setAlertMessage(error.message || 'Payment failed');
      setShowAlert(true);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const generateQRCode = async () => {
    try {
      if (!network) {
        setAlertMessage('Network not detected');
        setShowAlert(true);
        return;
      }

      const contractAddress = blockchainService.getContractAddress();
      if (!contractAddress) {
        setAlertMessage('Contract not deployed on this network');
        setShowAlert(true);
        return;
      }

      const qrData: QRCodeData = {
        invoiceId: invoice.id,
        contractAddress,
        amount: invoice.amount,
        chainId: network.chainId,
        recipient: invoice.creator
      };

      const result = await qrCodeService.generateMultiFormatQR(qrData);
      
      setQrCodeDataURL(result.qrCodeDataURL);
      setPaymentLink(result.universalLink);
      setShowQRModal(true);

    } catch (error: any) {
      console.error('❌ QR generation error:', error);
      setAlertMessage('Failed to generate QR code');
      setShowAlert(true);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage('Copied to clipboard!');
      setShowToast(true);
    } catch (error) {
      console.error('❌ Failed to copy:', error);
    }
  };

  const formatDate = (timestamp: number): string => {
    if (timestamp === 0) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <>
      <IonCard>
        <IonCardHeader>
          <IonCardTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Invoice #{invoice.id}</span>
            <IonChip color={getStatusColor(invoice.status)}>
              <IonIcon icon={getStatusIcon(invoice.status)} />
              <IonLabel>{getStatusText(invoice.status)}</IonLabel>
            </IonChip>
          </IonCardTitle>
        </IonCardHeader>

        <IonCardContent>
          <IonItem lines="none">
            <IonLabel>
              <h2>Amount: {formatAmount(invoice.amount)} PYUSD</h2>
              <p>Creator: {truncateAddress(invoice.creator)}</p>
              <p>Created: {formatDate(invoice.createdAt)}</p>
              {invoice.paidAt > 0 && (
                <p>Paid: {formatDate(invoice.paidAt)} by {truncateAddress(invoice.payer)}</p>
              )}
            </IonLabel>
          </IonItem>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            {/* Pay Invoice Button */}
            {canPayInvoice() && (
              <IonButton
                expand="block"
                color="primary"
                onClick={handlePayInvoice}
                disabled={isPaymentLoading}
              >
                {isPaymentLoading ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <>
                    <IonIcon icon={walletOutline} slot="start" />
                    Pay Invoice
                  </>
                )}
              </IonButton>
            )}

            {/* Connect Wallet Button */}
            {!isConnected && canShowQR() && (
              <IonButton
                expand="block"
                color="secondary"
                onClick={connectWallet}
              >
                <IonIcon icon={walletOutline} slot="start" />
                Connect Wallet to Pay
              </IonButton>
            )}

            {/* QR Code Button */}
            {canShowQR() && (
              <IonButton
                fill="outline"
                onClick={generateQRCode}
              >
                <IonIcon icon={qrCodeOutline} slot="start" />
                Show QR
              </IonButton>
            )}

            {/* View on Explorer Button */}
            {network && (
              <IonButton
                fill="clear"
                size="small"
                onClick={() => {
                  const explorerUrl = `${network.blockExplorer}/address/${blockchainService.getContractAddress()}`;
                  window.open(explorerUrl, '_blank');
                }}
              >
                <IonIcon icon={linkOutline} slot="start" />
                View Contract
              </IonButton>
            )}
          </div>

          {/* Network Warning */}
          {isConnected && network && !network.supported && (
            <IonText color="warning" style={{ fontSize: '0.9em', marginTop: '8px' }}>
              <p>⚠️ This network is not fully supported. Please switch to Sepolia testnet.</p>
            </IonText>
          )}

          {/* MetaMask Not Installed Warning */}
          {!isMetaMaskInstalled() && canShowQR() && (
            <IonText color="danger" style={{ fontSize: '0.9em', marginTop: '8px' }}>
              <p>📱 MetaMask is required to pay invoices. Please install MetaMask extension.</p>
            </IonText>
          )}
        </IonCardContent>
      </IonCard>

      {/* QR Code Modal */}
      <IonModal isOpen={showQRModal} onDidDismiss={() => setShowQRModal(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Payment QR Code</IonTitle>
            <IonButtons slot="end">
              <IonButton fill="clear" onClick={() => setShowQRModal(false)}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div style={{ textAlign: 'center' }}>
            <h3>Invoice #{invoice.id}</h3>
            <p>Amount: {formatAmount(invoice.amount)} PYUSD</p>
            
            {qrCodeDataURL && (
              <div style={{ margin: '20px 0' }}>
                <img 
                  src={qrCodeDataURL} 
                  alt="Payment QR Code" 
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </div>
            )}

            <p style={{ fontSize: '0.9em', color: 'var(--ion-color-medium)' }}>
              Scan this QR code with your mobile wallet to pay the invoice
            </p>

            {paymentLink && (
              <div style={{ marginTop: '20px' }}>
                <IonButton
                  fill="outline"
                  onClick={() => copyToClipboard(paymentLink)}
                >
                  <IonIcon icon={copyOutline} slot="start" />
                  Copy Payment Link
                </IonButton>
              </div>
            )}
          </div>
        </IonContent>
      </IonModal>

      {/* Alert */}
      <IonAlert
        isOpen={showAlert}
        onDidDismiss={() => setShowAlert(false)}
        header="Info"
        message={alertMessage}
        buttons={['OK']}
      />

      {/* Toast */}
      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        position="top"
        color="success"
      />
    </>
  );
};

export default BlockchainInvoiceCard;