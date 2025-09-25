import React, { useState, useEffect } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonIcon,
  IonChip,
  IonBadge,
  IonSpinner,
  IonText,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButtons,
  IonGrid,
  IonRow,
  IonCol,
  IonAlert
} from '@ionic/react';
import {
  walletOutline,
  checkmarkCircleOutline,
  downloadOutline,
  closeOutline,
  swapHorizontalOutline,
  copyOutline,
  openOutline
} from 'ionicons/icons';
import { walletDetectionService, WalletProvider, ConnectedWallet } from '../../services/wallet/walletDetectionService';
import { useWallet } from '../../contexts/blockchain/WalletContext';

interface WalletSelectorProps {
  isOpen: boolean;
  onDidDismiss: () => void;
}

const WalletSelector: React.FC<WalletSelectorProps> = ({ isOpen, onDidDismiss }) => {
  const { isConnected, address, disconnectWallet } = useWallet();
  const [availableWallets, setAvailableWallets] = useState<WalletProvider[]>([]);
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>([]);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [showInstallAlert, setShowInstallAlert] = useState<WalletProvider | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [currentWallet, setCurrentWallet] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadAvailableWallets();
      loadConnectedAccounts();
    }
  }, [isOpen]);

  const loadAvailableWallets = () => {
    const wallets = walletDetectionService.getAvailableWallets();
    setAvailableWallets(wallets);
  };

  const loadConnectedAccounts = async () => {
    if (isConnected && address) {
      try {
        // Get all accounts from current provider
        const provider = window.ethereum;
        if (provider) {
          const allAccounts = await provider.request({ method: 'eth_accounts' });
          setAccounts(allAccounts);
          
          // Determine current wallet type
          if (provider.isMetaMask) {
            setCurrentWallet('metamask');
          } else if (provider.isCoinbaseWallet) {
            setCurrentWallet('coinbase');
          } else {
            setCurrentWallet('unknown');
          }
        }
      } catch (error) {
        console.error('Failed to load accounts:', error);
      }
    }
  };

  const handleConnectWallet = async (walletId: string) => {
    if (!availableWallets.find(w => w.id === walletId)?.installed) {
      const wallet = availableWallets.find(w => w.id === walletId);
      if (wallet) {
        setShowInstallAlert(wallet);
      }
      return;
    }

    setIsConnecting(walletId);
    try {
      const result = await walletDetectionService.connectWallet(walletId);
      
      if (result.success) {
        // Reload the page to reinitialize with new wallet
        window.location.reload();
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (error) {
      console.error(`Failed to connect ${walletId}:`, error);
      // Show error toast or alert
    } finally {
      setIsConnecting(null);
    }
  };

  const handleSwitchAccount = async (accountAddress: string) => {
    try {
      // Request account switch (most wallets require user interaction)
      await window.ethereum?.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      
      // Reload to reinitialize with new account
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch account:', error);
    }
  };

  const handleDisconnectWallet = () => {
    disconnectWallet();
    onDidDismiss();
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      // Show success feedback
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    return num.toFixed(4);
  };

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onDidDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>💼 Wallet Manager</IonTitle>
            <IonButtons slot="end">
              <IonButton fill="clear" onClick={onDidDismiss}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {/* Current Connection Status */}
          {isConnected && (
            <IonCard style={{ margin: '16px' }}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={checkmarkCircleOutline} color="success" />
                  Connected Wallet
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>
                      {availableWallets.find(w => w.id === currentWallet)?.icon || '💼'}
                    </span>
                    <strong>{availableWallets.find(w => w.id === currentWallet)?.name || 'Unknown Wallet'}</strong>
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--ion-color-medium)' }}>
                    {walletDetectionService.formatAddress(address || '', 8)}
                  </div>
                </div>

                <IonGrid>
                  <IonRow>
                    <IonCol>
                      <IonButton
                        fill="outline"
                        size="small"
                        onClick={() => handleCopyAddress(address || '')}
                      >
                        <IonIcon icon={copyOutline} slot="start" />
                        Copy Address
                      </IonButton>
                    </IonCol>
                    <IonCol>
                      <IonButton
                        fill="outline"
                        size="small"
                        color="danger"
                        onClick={handleDisconnectWallet}
                      >
                        Disconnect
                      </IonButton>
                    </IonCol>
                  </IonRow>
                </IonGrid>
              </IonCardContent>
            </IonCard>
          )}

          {/* Account Switching */}
          {isConnected && accounts.length > 1 && (
            <IonCard style={{ margin: '16px' }}>
              <IonCardHeader>
                <IonCardTitle style={{ fontSize: '16px' }}>
                  <IonIcon icon={swapHorizontalOutline} style={{ marginRight: '8px' }} />
                  Switch Account
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonList>
                  {accounts.map((account, index) => (
                    <IonItem
                      key={account}
                      button
                      onClick={() => handleSwitchAccount(account)}
                      disabled={account === address}
                    >
                      <IonLabel>
                        <h3>Account {index + 1}</h3>
                        <p>{walletDetectionService.formatAddress(account, 8)}</p>
                      </IonLabel>
                      {account === address && (
                        <IonBadge color="success" slot="end">Current</IonBadge>
                      )}
                    </IonItem>
                  ))}
                </IonList>
              </IonCardContent>
            </IonCard>
          )}

          {/* Available Wallets */}
          <IonCard style={{ margin: '16px' }}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: '16px' }}>
                {isConnected ? 'Switch Wallet' : 'Connect Wallet'}
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                {availableWallets.map((wallet) => (
                  <IonItem
                    key={wallet.id}
                    button
                    onClick={() => handleConnectWallet(wallet.id)}
                    disabled={isConnecting === wallet.id || (isConnected && currentWallet === wallet.id)}
                  >
                    <div slot="start" style={{ fontSize: '24px', marginRight: '8px' }}>
                      {wallet.icon}
                    </div>
                    <IonLabel>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {wallet.name}
                        {!wallet.installed && (
                          <IonChip color="warning" style={{ fontSize: '12px', height: '20px' }}>
                            Not Installed
                          </IonChip>
                        )}
                        {isConnected && currentWallet === wallet.id && (
                          <IonChip color="success" style={{ fontSize: '12px', height: '20px' }}>
                            Active
                          </IonChip>
                        )}
                      </h3>
                      <p>{wallet.description}</p>
                    </IonLabel>
                    <div slot="end">
                      {isConnecting === wallet.id ? (
                        <IonSpinner name="crescent" />
                      ) : wallet.installed ? (
                        <IonIcon icon={walletOutline} color="primary" />
                      ) : (
                        <IonIcon icon={downloadOutline} color="medium" />
                      )}
                    </div>
                  </IonItem>
                ))}
              </IonList>

              {!isConnected && (
                <div style={{ textAlign: 'center', marginTop: '20px', padding: '20px' }}>
                  <IonText color="medium">
                    <p>Connect your wallet to start using blockchain features</p>
                  </IonText>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Wallet Tips */}
          <IonCard style={{ margin: '16px' }}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: '16px' }}>💡 Tips</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonText color="medium">
                <ul style={{ paddingLeft: '20px', fontSize: '14px' }}>
                  <li>Make sure you're on the Sepolia testnet for testing</li>
                  <li>You can switch between different accounts in the same wallet</li>
                  <li>Disconnecting will clear all blockchain data</li>
                  <li>Install browser extensions for desktop use</li>
                </ul>
              </IonText>
            </IonCardContent>
          </IonCard>
        </IonContent>
      </IonModal>

      {/* Install Wallet Alert */}
      <IonAlert
        isOpen={!!showInstallAlert}
        onDidDismiss={() => setShowInstallAlert(null)}
        header={`Install ${showInstallAlert?.name}`}
        subHeader="Wallet Not Found"
        message={`${showInstallAlert?.name} is not installed. Would you like to download it?`}
        buttons={[
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Download',
            handler: () => {
              if (showInstallAlert?.downloadUrl) {
                window.open(showInstallAlert.downloadUrl, '_blank');
              }
            },
          },
        ]}
      />
    </>
  );
};

export default WalletSelector;