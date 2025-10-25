import React, { useState } from 'react';
import {
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonText,
    IonSpinner,
    IonIcon,
    IonToast,
} from '@ionic/react';
import { close, checkmarkCircle, alertCircle } from 'ionicons/icons';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, decodeEventLog } from 'viem';
import { invoiceManager } from '../abi/invoiceManage';
import { INVOICE_MANAGER_ADDRESS } from '../abi/contracts';
import { uploadToIPFS, getIPFSUrl } from '../utils/ipfsUpload';
import * as AppGeneral from '../components/socialcalc/index.js';
import { useHistory } from 'react-router-dom';

interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({ isOpen, onClose }) => {
    const [amount, setAmount] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastColor, setToastColor] = useState<'success' | 'danger' | 'warning'>('success');

    const { address, isConnected, chain } = useAccount();
    const { data: hash, writeContract, isPending, error } = useWriteContract();
    const history = useHistory();

    const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({
        hash,
    });

    const handleCreateInvoice = async () => {
        // Validation
        if (!isConnected) {
            setToastMessage('Please connect your wallet first');
            setToastColor('warning');
            setShowToast(true);
            return;
        }

        if (chain?.id !== 11155111) {
            setToastMessage('Please switch to Sepolia testnet');
            setToastColor('warning');
            setShowToast(true);
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            setToastMessage('Please enter a valid amount');
            setToastColor('warning');
            setShowToast(true);
            return;
        }

        try {
            setIsUploading(true);

            // Get spreadsheet content
            const socialCalc = (window as any).SocialCalc;
            if (!socialCalc || !socialCalc.GetCurrentWorkBookControl) {
                setToastMessage('Spreadsheet not ready. Please wait and try again.');
                setToastColor('warning');
                setShowToast(true);
                setIsUploading(false);
                return;
            }

            const control = socialCalc.GetCurrentWorkBookControl();
            if (!control || !control.workbook || !control.workbook.spreadsheet) {
                setToastMessage('Spreadsheet not ready. Please wait and try again.');
                setToastColor('warning');
                setShowToast(true);
                setIsUploading(false);
                return;
            }

            const spreadsheetContent = AppGeneral.getSpreadsheetContent();

            // Upload to IPFS
            setToastMessage('Uploading to IPFS...');
            setToastColor('warning');
            setShowToast(true);

            const uploadResult = await uploadToIPFS(spreadsheetContent, `invoice-${Date.now()}`);

            if (!uploadResult.success || !uploadResult.ipfsHash) {
                setToastMessage(uploadResult.error || 'Failed to upload to IPFS');
                setToastColor('danger');
                setShowToast(true);
                setIsUploading(false);
                return;
            }

            setIsUploading(false);

            // Convert amount to proper units (assuming PYUSD has 6 decimals like USDC)
            const amountInWei = parseUnits(amount, 6);

            // Call contract
            setToastMessage('Creating invoice on blockchain...');
            setToastColor('warning');
            setShowToast(true);

            writeContract({
                address: INVOICE_MANAGER_ADDRESS,
                abi: invoiceManager as any,
                functionName: 'createInvoice',
                args: [amountInWei, uploadResult.ipfsHash],
                account: address,
                chain: chain,
            });

        } catch (err: any) {
            console.error('Error creating invoice:', err);
            setToastMessage(err.message || 'Failed to create invoice');
            setToastColor('danger');
            setShowToast(true);
            setIsUploading(false);
        }
    };

    // Handle transaction confirmation
    React.useEffect(() => {
        if (isConfirmed && receipt) {
            setToastMessage('Invoice created successfully! 🎉');
            setToastColor('success');
            setShowToast(true);

            // Extract invoice ID from transaction logs
            try {
                // Find the InvoiceCreated event in the logs
                const invoiceCreatedLog = receipt.logs.find((log: any) => {
                    try {
                        const decodedLog = decodeEventLog({
                            abi: invoiceManager,
                            data: log.data,
                            topics: log.topics,
                        });
                        return decodedLog.eventName === 'InvoiceCreated';
                    } catch {
                        return false;
                    }
                });

                if (invoiceCreatedLog) {
                    const decodedLog = decodeEventLog({
                        abi: invoiceManager,
                        data: invoiceCreatedLog.data,
                        topics: invoiceCreatedLog.topics,
                    }) as any;

                    const invoiceId = decodedLog.args.invoiceId;
                    console.log('📋 Invoice created with ID:', invoiceId);

                    // Navigate to invoice page after a short delay
                    setTimeout(() => {
                        setAmount('');
                        onClose();
                        history.push(`/app/invoice/${invoiceId}`);
                    }, 1500);
                } else {
                    console.error('InvoiceCreated event not found in transaction logs');
                    // Fallback: just close the modal
                    setTimeout(() => {
                        setAmount('');
                        onClose();
                    }, 2000);
                }
            } catch (error) {
                console.error('Error extracting invoice ID:', error);
                // Fallback: just close the modal
                setTimeout(() => {
                    setAmount('');
                    onClose();
                }, 2000);
            }
        }
    }, [isConfirmed, receipt, onClose, history]);

    // Handle transaction error
    React.useEffect(() => {
        if (error) {
            setToastMessage(error.message || 'Transaction failed');
            setToastColor('danger');
            setShowToast(true);
        }
    }, [error]);

    const handleClose = () => {
        if (!isPending && !isConfirming && !isUploading) {
            setAmount('');
            onClose();
        }
    };

    return (
        <>
            <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
                <IonHeader>
                    <IonToolbar color="primary">
                        <IonTitle>Create Invoice</IonTitle>
                        <IonButtons slot="end">
                            <IonButton onClick={handleClose} disabled={isPending || isConfirming || isUploading}>
                                <IonIcon icon={close} />
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>

                <IonContent className="ion-padding">
                    <IonText color="medium">
                        <p>
                            Create an on-chain invoice by uploading your spreadsheet to IPFS and storing
                            the reference on the Sepolia blockchain.
                        </p>
                    </IonText>

                    {!isConnected && (
                        <IonText color="warning">
                            <p>
                                <IonIcon icon={alertCircle} /> Please connect your wallet to continue
                            </p>
                        </IonText>
                    )}

                    {isConnected && chain?.id !== 11155111 && (
                        <IonText color="danger">
                            <p style={{
                                padding: '12px',
                                backgroundColor: 'rgba(var(--ion-color-danger-rgb), 0.1)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <IonIcon icon={alertCircle} style={{ fontSize: '24px' }} />
                                <strong>Please switch to Sepolia testnet</strong>
                            </p>
                        </IonText>
                    )}

                    <IonItem className="ion-margin-top">
                        <IonLabel position="stacked">
                            Invoice Amount (PYUSD) <span style={{ color: 'red' }}>*</span>
                        </IonLabel>
                        <IonInput
                            type="number"
                            placeholder="Enter amount (e.g., 100.00)"
                            value={amount}
                            onIonInput={(e) => setAmount(e.detail.value!)}
                            disabled={isPending || isConfirming || isUploading}
                            step="0.01"
                            min="0"
                        />
                    </IonItem>

                    <IonText color="medium">
                        <p style={{ fontSize: '0.85em', marginTop: '8px', marginLeft: '16px' }}>
                            Amount will be charged in PYUSD tokens on Sepolia testnet
                        </p>
                    </IonText>

                    <div className="ion-margin-top ion-padding-top">
                        <IonButton
                            expand="block"
                            onClick={handleCreateInvoice}
                            disabled={!isConnected || chain?.id !== 11155111 || isPending || isConfirming || isUploading || !amount}
                        >
                            {isUploading && <IonSpinner name="crescent" style={{ marginRight: '8px' }} />}
                            {isPending && <IonSpinner name="crescent" style={{ marginRight: '8px' }} />}
                            {isConfirming && <IonSpinner name="crescent" style={{ marginRight: '8px' }} />}
                            {isConfirmed && <IonIcon icon={checkmarkCircle} style={{ marginRight: '8px' }} />}

                            {isUploading
                                ? 'Uploading to IPFS...'
                                : isPending
                                    ? 'Confirm in Wallet...'
                                    : isConfirming
                                        ? 'Creating Invoice...'
                                        : isConfirmed
                                            ? 'Invoice Created!'
                                            : 'Create Invoice'}
                        </IonButton>
                    </div>

                    {hash && (
                        <IonText color="medium">
                            <p style={{ fontSize: '0.85em', marginTop: '16px', textAlign: 'center' }}>
                                Transaction hash:{' '}
                                <a
                                    href={`https://sepolia.etherscan.io/tx/${hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--ion-color-primary)' }}
                                >
                                    {hash.slice(0, 10)}...{hash.slice(-8)}
                                </a>
                            </p>
                        </IonText>
                    )}
                </IonContent>
            </IonModal>

            <IonToast
                isOpen={showToast}
                onDidDismiss={() => setShowToast(false)}
                message={toastMessage}
                duration={3000}
                color={toastColor}
                position="top"
            />
        </>
    );
};

export default CreateInvoiceModal;
