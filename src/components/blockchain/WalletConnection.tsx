import React, { useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonAlert,
  IonChip,
  IonText,
  IonSelect,
  IonSelectOption,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import {
  walletOutline,
  linkOutline,
  refreshOutline,
  swapHorizontalOutline,
  checkmarkCircle,
  closeCircle,
  warningOutline,
  peopleOutline
} from 'ionicons/icons';
import { useWallet } from '../../contexts/blockchain/WalletContext';
import { NETWORKS, getSupportedNetworks } from '../../services/blockchain/networks';
import AccountSwitcher from '../wallet/AccountSwitcher';

interface WalletConnectionProps {
  onConnectionChange?: (isConnected: boolean) => void;
  showNetworkSelector?: boolean;
  compact?: boolean;
}

const WalletConnection: React.FC<WalletConnectionProps> = ({
  onConnectionChange,
  showNetworkSelector = true,
  compact = false
}) => {
  const {
    isConnected,
    address,
    balance,
    network,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    refreshBalance,
    isMetaMaskInstalled,
    requestAccountAccess
  } = useWallet();

  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  const handleConnect = async () => {
    if (!isMetaMaskInstalled()) {
      setAlertMessage('MetaMask is not installed. Please install MetaMask extension to connect your wallet.');
      setShowAlert(true);
      return;
    }

    const success = await connectWallet();
    if (onConnectionChange) {
      onConnectionChange(success);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    if (onConnectionChange) {
      onConnectionChange(false);
    }
  };

  const handleNetworkSwitch = async (networkName: string) => {
    setIsSwitchingNetwork(true);
    const success = await switchNetwork(networkName);
    
    if (!success) {
      setAlertMessage('Failed to switch network. Please try again or switch manually in MetaMask.');
      setShowAlert(true);
    }
    
    setIsSwitchingNetwork(false);
  };

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getNetworkStatusColor = () => {
    if (!network) return 'medium';
    return network.supported ? 'success' : 'warning';
  };

  const getNetworkStatusIcon = () => {
    if (!network) return warningOutline;
    return network.supported ? checkmarkCircle : warningOutline;
  };

  const openMetaMaskDownload = () => {
    window.open('https://metamask.io/download/', '_blank');
  };

  const doRefresh = async (event: CustomEvent) => {
    await refreshBalance();
    event.detail.complete();
  };

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isConnected ? (
          <>
            <IonChip color="success">
              <IonIcon icon={checkmarkCircle} />
              <IonLabel>{truncateAddress(address!)}</IonLabel>
            </IonChip>
            <IonText style={{ fontSize: '0.9em' }}>
              {balance} PYUSD
            </IonText>
          </>
        ) : (
          <IonButton size="small" onClick={handleConnect} disabled={isLoading}>
            {isLoading ? <IonSpinner name="crescent" /> : 'Connect Wallet'}
          </IonButton>
        )}
      </div>
    );
  }

  return (
    <>
      <IonCard>
        <IonCardContent>
          <IonRefresher slot="fixed" onIonRefresh={doRefresh}>
            <IonRefresherContent />
          </IonRefresher>

          {/* MetaMask Not Installed */}
          {!isMetaMaskInstalled() && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <IonIcon 
                icon={walletOutline} 
                style={{ fontSize: '48px', color: 'var(--ion-color-medium)' }}
              />
              <h3>MetaMask Required</h3>
              <p>Please install MetaMask to connect your wallet and use blockchain features.</p>
              <IonButton onClick={openMetaMaskDownload}>
                <IonIcon icon={linkOutline} slot="start" />
                Install MetaMask
              </IonButton>
            </div>
          )}

          {/* Not Connected */}
          {isMetaMaskInstalled() && !isConnected && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <IonIcon 
                icon={walletOutline} 
                style={{ fontSize: '48px', color: 'var(--ion-color-primary)' }}
              />
              <h3>Connect Your Wallet</h3>
              <p>Connect your MetaMask wallet to create and pay invoices on the blockchain.</p>
              
              {error && (
                <IonText color="danger">
                  <p>{error}</p>
                </IonText>
              )}

              <IonButton 
                expand="block" 
                onClick={handleConnect} 
                disabled={isLoading}
                style={{ maxWidth: '300px', margin: '0 auto' }}
              >
                {isLoading ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <>
                    <IonIcon icon={walletOutline} slot="start" />
                    Connect Wallet
                  </>
                )}
              </IonButton>
            </div>
          )}

          {/* Connected */}
          {isConnected && address && (
            <div>
              <h3>Wallet Connected</h3>
              
              <IonItem lines="none">
                <IonIcon icon={walletOutline} slot="start" />
                <IonLabel>
                  <h4>Address</h4>
                  <p>{truncateAddress(address)}</p>
                </IonLabel>
                <IonButton 
                  fill="clear" 
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                  }}
                >
                  Copy
                </IonButton>
              </IonItem>

              <IonItem lines="none">
                <IonIcon icon={peopleOutline} slot="start" />
                <IonLabel>
                  <h4>Account Management</h4>
                  <p>View all accounts and switch between them</p>
                </IonLabel>
                <IonButton 
                  fill="clear" 
                  size="small"
                  onClick={() => setShowAccountSwitcher(true)}
                >
                  Manage Accounts
                </IonButton>
              </IonItem>

              <IonItem lines="none">
                <IonIcon icon={refreshOutline} slot="start" />
                <IonLabel>
                  <h4>PYUSD Balance</h4>
                  <p>{balance} PYUSD</p>
                </IonLabel>
                <IonButton 
                  fill="clear" 
                  size="small"
                  onClick={refreshBalance}
                >
                  <IonIcon icon={refreshOutline} />
                </IonButton>
              </IonItem>

              {network && (
                <IonItem lines="none">
                  <IonIcon icon={getNetworkStatusIcon()} slot="start" />
                  <IonLabel>
                    <h4>Network</h4>
                    <p>{network.name}</p>
                    {!network.supported && (
                      <IonText color="warning">
                        <small>⚠️ Network not fully supported</small>
                      </IonText>
                    )}
                  </IonLabel>
                  <IonChip color={getNetworkStatusColor()}>
                    {network.isTestnet ? 'Testnet' : 'Mainnet'}
                  </IonChip>
                </IonItem>
              )}

              {/* Network Selector */}
              {showNetworkSelector && (
                <IonItem>
                  <IonIcon icon={swapHorizontalOutline} slot="start" />
                  <IonLabel>Switch Network</IonLabel>
                  <IonSelect
                    value={network?.name}
                    placeholder="Select Network"
                    onIonChange={(e) => {
                      const selectedNetwork = Object.entries(NETWORKS).find(
                        ([_, net]) => net.name === e.detail.value
                      );
                      if (selectedNetwork) {
                        handleNetworkSwitch(selectedNetwork[0]);
                      }
                    }}
                    disabled={isSwitchingNetwork}
                  >
                    {getSupportedNetworks().map((net) => (
                      <IonSelectOption key={net.chainId} value={net.name}>
                        {net.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                  {isSwitchingNetwork && <IonSpinner name="crescent" />}
                </IonItem>
              )}

              {/* Disconnect Button */}
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <IonButton 
                  fill="outline" 
                  color="medium"
                  onClick={handleDisconnect}
                >
                  Disconnect Wallet
                </IonButton>
              </div>
            </div>
          )}
        </IonCardContent>
      </IonCard>

      {/* Alert */}
      <IonAlert
        isOpen={showAlert}
        onDidDismiss={() => setShowAlert(false)}
        header="Wallet Connection"
        message={alertMessage}
        buttons={['OK']}
      />

      {/* Account Switcher Modal */}
      <AccountSwitcher
        isOpen={showAccountSwitcher}
        onDidDismiss={() => setShowAccountSwitcher(false)}
      />
    </>
  );
};

export default WalletConnection;