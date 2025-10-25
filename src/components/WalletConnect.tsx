import React, { useState } from 'react';
import { IonButton, IonChip, IonIcon, IonToast } from '@ionic/react';
import { wallet, checkmarkCircle, closeCircle, swapHorizontal } from 'ionicons/icons';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const WalletConnect: React.FC = () => {
    const { address, isConnected, chain } = useAccount();
    const { connect, connectors } = useConnect();
    const { disconnect } = useDisconnect();
    const { switchChain } = useSwitchChain();
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastColor, setToastColor] = useState<'success' | 'danger' | 'warning'>('success');

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const handleConnect = () => {
        // Find MetaMask connector
        const metaMaskConnector = connectors.find(
            (connector) => connector.id === 'metaMask' || connector.id === 'injected'
        );

        if (metaMaskConnector) {
            connect({ connector: metaMaskConnector });
        }
    };

    const handleSwitchToSepolia = async () => {
        try {
            await switchChain({ chainId: sepolia.id });
            setToastMessage('Successfully switched to Sepolia testnet!');
            setToastColor('success');
            setShowToast(true);
        } catch (error: any) {
            console.error('Failed to switch network:', error);
            setToastMessage(error.message || 'Failed to switch network');
            setToastColor('danger');
            setShowToast(true);
        }
    };

    if (isConnected && address) {
        const isWrongNetwork = chain && chain.id !== 11155111;

        return (
            <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IonChip
                        color={isWrongNetwork ? 'danger' : 'success'}
                        onClick={() => disconnect()}
                        style={{ cursor: 'pointer' }}
                    >
                        <IonIcon icon={isWrongNetwork ? closeCircle : checkmarkCircle} />
                        <span style={{ marginLeft: '4px', fontSize: '0.9em' }}>
                            {formatAddress(address)}
                        </span>
                    </IonChip>

                    {isWrongNetwork && (
                        <IonButton
                            fill="solid"
                            size="small"
                            color="warning"
                            onClick={handleSwitchToSepolia}
                        >
                            <IonIcon icon={swapHorizontal} slot="start" />
                            Switch to Sepolia
                        </IonButton>
                    )}
                </div>

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
    }

    return (
        <IonButton
            fill="outline"
            size="small"
            onClick={handleConnect}
            style={{ color: 'white', borderColor: 'white' }}
        >
            <IonIcon icon={wallet} slot="start" />
            Connect Wallet
        </IonButton>
    );
};

export default WalletConnect;
