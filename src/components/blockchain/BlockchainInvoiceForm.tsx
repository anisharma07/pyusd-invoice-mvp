import React, { useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSpinner,
  IonAlert,
  IonToast,
  IonIcon,
  IonText,
  IonList,
  IonCheckbox
} from '@ionic/react';
import {
  createOutline,
  linkOutline,
  checkmarkCircle,
  warningOutline
} from 'ionicons/icons';
import { useWallet } from '../../contexts/blockchain/WalletContext';
import { blockchainService } from '../../services/blockchain/blockchain';
import { InvoiceCreationData, InvoiceItem } from '../../services/blockchain/types';

interface BlockchainInvoiceFormProps {
  onInvoiceCreated?: (invoiceId: number, transactionHash: string) => void;
}

const BlockchainInvoiceForm: React.FC<BlockchainInvoiceFormProps> = ({
  onInvoiceCreated
}) => {
  const { isConnected, address, network } = useWallet();
  
  const [formData, setFormData] = useState<InvoiceCreationData>({
    amount: 0,
    companyName: '',
    companyAddress: '',
    clientName: '',
    clientAddress: '',
    description: '',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    notes: '',
    terms: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [useIPFS, setUseIPFS] = useState(true);

  const updateFormField = (field: keyof InvoiceCreationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-calculate amount for the item
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }
    
    // Update total amount
    const totalAmount = newItems.reduce((sum, item) => sum + item.amount, 0);
    
    setFormData(prev => ({ 
      ...prev, 
      items: newItems,
      amount: totalAmount
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, rate: 0, amount: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      const totalAmount = newItems.reduce((sum, item) => sum + item.amount, 0);
      
      setFormData(prev => ({
        ...prev,
        items: newItems,
        amount: totalAmount
      }));
    }
  };

  const validateForm = (): string | null => {
    if (!formData.companyName.trim()) return 'Company name is required';
    if (!formData.clientName.trim()) return 'Client name is required';
    if (formData.amount <= 0) return 'Amount must be greater than 0';
    if (formData.items.length === 0) return 'At least one item is required';
    
    for (const item of formData.items) {
      if (!item.description.trim()) return 'All items must have a description';
      if (item.quantity <= 0) return 'All items must have quantity > 0';
      if (item.rate < 0) return 'All items must have rate >= 0';
    }
    
    return null;
  };

  const handleSubmit = async () => {
    try {
      // Validate form
      const validationError = validateForm();
      if (validationError) {
        setAlertMessage(validationError);
        setShowAlert(true);
        return;
      }

      // Check wallet connection
      if (!isConnected || !address) {
        setAlertMessage('Please connect your wallet first');
        setShowAlert(true);
        return;
      }

      // Check network support
      if (!network?.supported) {
        setAlertMessage('Please switch to a supported network (Sepolia)');
        setShowAlert(true);
        return;
      }

      setIsSubmitting(true);

      // Create invoice on blockchain
      const result = await blockchainService.createInvoice(formData);

      if (result.success && result.invoiceId && result.transactionHash) {
        setToastMessage(`Invoice #${result.invoiceId} created successfully!`);
        setShowToast(true);
        
        // Reset form
        setFormData({
          amount: 0,
          companyName: '',
          companyAddress: '',
          clientName: '',
          clientAddress: '',
          description: '',
          items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
          notes: '',
          terms: ''
        });

        // Callback
        if (onInvoiceCreated) {
          onInvoiceCreated(result.invoiceId, result.transactionHash);
        }

      } else {
        setAlertMessage(result.error || 'Failed to create invoice');
        setShowAlert(true);
      }

    } catch (error: any) {
      console.error('❌ Invoice creation error:', error);
      setAlertMessage(error.message || 'Failed to create invoice');
      setShowAlert(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = (): boolean => {
    return isConnected && 
           network?.supported === true && 
           !isSubmitting && 
           formData.amount > 0 && 
           formData.companyName.trim() !== '' && 
           formData.clientName.trim() !== '';
  };

  return (
    <>
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>
            <IonIcon icon={createOutline} style={{ marginRight: '8px' }} />
            Create Blockchain Invoice
          </IonCardTitle>
        </IonCardHeader>

        <IonCardContent>
          {/* Connection Status */}
          <div style={{ marginBottom: '16px' }}>
            {isConnected ? (
              <IonText color="success">
                <p>
                  <IonIcon icon={checkmarkCircle} style={{ marginRight: '4px' }} />
                  Wallet Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </IonText>
            ) : (
              <IonText color="warning">
                <p>
                  <IonIcon icon={warningOutline} style={{ marginRight: '4px' }} />
                  Please connect your wallet to create blockchain invoices
                </p>
              </IonText>
            )}
            
            {network && (
              <IonText color={network.supported ? 'success' : 'warning'}>
                <p>Network: {network.name} {network.supported ? '✓' : '⚠️'}</p>
              </IonText>
            )}
          </div>

          {/* Company Information */}
          <IonList>
            <IonItem>
              <IonLabel position="stacked">Company Name *</IonLabel>
              <IonInput
                value={formData.companyName}
                onIonInput={(e) => updateFormField('companyName', e.detail.value!)}
                placeholder="Enter your company name"
                disabled={!isConnected}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Company Address</IonLabel>
              <IonTextarea
                value={formData.companyAddress}
                onIonInput={(e) => updateFormField('companyAddress', e.detail.value!)}
                placeholder="Enter your company address"
                disabled={!isConnected}
                rows={3}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Client Name *</IonLabel>
              <IonInput
                value={formData.clientName}
                onIonInput={(e) => updateFormField('clientName', e.detail.value!)}
                placeholder="Enter client name"
                disabled={!isConnected}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Client Address</IonLabel>
              <IonTextarea
                value={formData.clientAddress}
                onIonInput={(e) => updateFormField('clientAddress', e.detail.value!)}
                placeholder="Enter client address"
                disabled={!isConnected}
                rows={3}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Description</IonLabel>
              <IonInput
                value={formData.description}
                onIonInput={(e) => updateFormField('description', e.detail.value!)}
                placeholder="Brief description of the invoice"
                disabled={!isConnected}
              />
            </IonItem>
          </IonList>

          {/* Invoice Items */}
          <div style={{ marginTop: '20px' }}>
            <h4>Invoice Items</h4>
            {formData.items.map((item, index) => (
              <IonCard key={index} style={{ margin: '8px 0' }}>
                <IonCardContent>
                  <IonList>
                    <IonItem>
                      <IonLabel position="stacked">Description *</IonLabel>
                      <IonInput
                        value={item.description}
                        onIonInput={(e) => updateItem(index, 'description', e.detail.value!)}
                        placeholder="Item description"
                        disabled={!isConnected}
                      />
                    </IonItem>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <IonItem style={{ flex: 1 }}>
                        <IonLabel position="stacked">Quantity</IonLabel>
                        <IonInput
                          type="number"
                          value={item.quantity}
                          onIonInput={(e) => updateItem(index, 'quantity', parseInt(e.detail.value!) || 0)}
                          min={1}
                          disabled={!isConnected}
                        />
                      </IonItem>

                      <IonItem style={{ flex: 1 }}>
                        <IonLabel position="stacked">Rate (PYUSD)</IonLabel>
                        <IonInput
                          type="number"
                          value={item.rate}
                          onIonInput={(e) => updateItem(index, 'rate', parseFloat(e.detail.value!) || 0)}
                          min={0}
                          step="0.01"
                          disabled={!isConnected}
                        />
                      </IonItem>

                      <IonItem style={{ flex: 1 }}>
                        <IonLabel position="stacked">Amount</IonLabel>
                        <IonInput
                          value={item.amount.toFixed(2)}
                          readonly
                        />
                      </IonItem>
                    </div>

                    {formData.items.length > 1 && (
                      <IonButton
                        fill="clear"
                        color="danger"
                        size="small"
                        onClick={() => removeItem(index)}
                        disabled={!isConnected}
                      >
                        Remove Item
                      </IonButton>
                    )}
                  </IonList>
                </IonCardContent>
              </IonCard>
            ))}

            <IonButton
              fill="outline"
              onClick={addItem}
              disabled={!isConnected}
              style={{ margin: '8px 0' }}
            >
              Add Item
            </IonButton>
          </div>

          {/* Additional Fields */}
          <IonList style={{ marginTop: '20px' }}>
            <IonItem>
              <IonLabel position="stacked">Notes</IonLabel>
              <IonTextarea
                value={formData.notes}
                onIonInput={(e) => updateFormField('notes', e.detail.value!)}
                placeholder="Additional notes"
                disabled={!isConnected}
                rows={3}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Terms & Conditions</IonLabel>
              <IonTextarea
                value={formData.terms}
                onIonInput={(e) => updateFormField('terms', e.detail.value!)}
                placeholder="Payment terms and conditions"
                disabled={!isConnected}
                rows={3}
              />
            </IonItem>
          </IonList>

          {/* IPFS Option */}
          <IonItem>
            <IonCheckbox
              checked={useIPFS}
              onIonChange={(e) => setUseIPFS(e.detail.checked)}
              disabled={!isConnected}
            />
            <IonLabel style={{ marginLeft: '12px' }}>
              <h3>Store on IPFS</h3>
              <p>Store invoice data on decentralized storage</p>
            </IonLabel>
          </IonItem>

          {/* Total Amount */}
          <div style={{ 
            marginTop: '20px', 
            padding: '16px', 
            background: 'var(--ion-color-light)', 
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0', color: 'var(--ion-color-primary)' }}>
              Total: {formData.amount.toFixed(2)} PYUSD
            </h3>
          </div>

          {/* Submit Button */}
          <IonButton
            expand="block"
            onClick={handleSubmit}
            disabled={!canSubmit()}
            style={{ marginTop: '20px' }}
          >
            {isSubmitting ? (
              <IonSpinner name="crescent" />
            ) : (
              <>
                <IonIcon icon={createOutline} slot="start" />
                Create Invoice on Blockchain
              </>
            )}
          </IonButton>

          {/* Help Text */}
          <IonText color="medium" style={{ fontSize: '0.9em', marginTop: '12px' }}>
            <p>
              This will create an invoice on the blockchain and store the data on IPFS. 
              The invoice can be paid using PYUSD tokens.
            </p>
          </IonText>
        </IonCardContent>
      </IonCard>

      {/* Alert */}
      <IonAlert
        isOpen={showAlert}
        onDidDismiss={() => setShowAlert(false)}
        header="Invoice Creation"
        message={alertMessage}
        buttons={['OK']}
      />

      {/* Toast */}
      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={5000}
        position="top"
        color="success"
      />
    </>
  );
};

export default BlockchainInvoiceForm;