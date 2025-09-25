import React, { useState, useEffect } from 'react';
import {
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonBadge,
  IonAlert,
  IonSpinner,
  IonButtons
} from '@ionic/react';
import {
  peopleOutline,
  checkmarkCircleOutline,
  copyOutline,
  refreshOutline,
  closeOutline
} from 'ionicons/icons';
import { useWallet } from '../../contexts/blockchain/WalletContext';

interface AccountSwitcherProps {
  isOpen: boolean;
  onDidDismiss: () => void;
}

const AccountSwitcher: React.FC<AccountSwitcherProps> = ({ isOpen, onDidDismiss }) => {
  const { address, getAccounts, requestAccountAccess } = useWallet();
  const [accounts, setAccounts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      // First get currently connected accounts
      const connectedAccounts = await getAccounts();
      setAccounts(connectedAccounts);
      
      if (connectedAccounts.length <= 1) {
        setAlertMessage('Only one account is connected. You can connect more accounts by clicking "Connect More Accounts" or switching accounts directly in MetaMask.');
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      setAlertMessage('Failed to load accounts. Please make sure MetaMask is connected.');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  const handleSwitchAccount = async () => {
    try {
      setIsLoading(true);
      await requestAccountAccess();
      // Reload accounts after requesting access
      await loadAccounts();
    } catch (error) {
      console.error('Failed to request account access:', error);
      setAlertMessage('Failed to open MetaMask. Please try again.');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectMoreAccounts = async () => {
    try {
      setIsLoading(true);
      // Request permission for additional accounts
      await requestAccountAccess();
      // Wait a bit for MetaMask to process
      setTimeout(() => {
        loadAccounts();
      }, 1000);
    } catch (error) {
      console.error('Failed to connect more accounts:', error);
      setAlertMessage('Failed to connect additional accounts. Please try again.');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onDidDismiss}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Switch Account</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={onDidDismiss}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonContent>
          <div style={{ padding: '16px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ color: 'var(--ion-color-medium)' }}>
                {accounts.length <= 1 
                  ? "Only one account is connected to this website."
                  : "Current active account is highlighted below."
                }
              </p>
              {accounts.length <= 1 && (
                <p style={{ color: 'var(--ion-color-warning)', fontSize: '0.9em', marginTop: '8px' }}>
                  ⚠️ MetaMask only shows accounts you've explicitly connected to this site.
                </p>
              )}
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <IonSpinner name="crescent" />
                <p>Loading accounts...</p>
              </div>
            ) : (
              <>
                <IonList>
                  {accounts.length === 0 ? (
                    <IonItem>
                      <IonLabel>
                        <h3>No accounts found</h3>
                        <p>Please connect to MetaMask first</p>
                      </IonLabel>
                    </IonItem>
                  ) : (
                    accounts.map((account, index) => (
                      <IonItem key={account}>
                        <IonIcon 
                          icon={account === address ? checkmarkCircleOutline : peopleOutline} 
                          slot="start"
                          color={account === address ? 'success' : 'medium'}
                        />
                        <IonLabel>
                          <h3>Account {index + 1}</h3>
                          <p>{truncateAddress(account)}</p>
                        </IonLabel>
                        
                        {account === address && (
                          <IonBadge color="success">Active</IonBadge>
                        )}
                        
                        <IonButton 
                          fill="clear" 
                          size="small"
                          onClick={() => copyToClipboard(account)}
                        >
                          <IonIcon icon={copyOutline} />
                        </IonButton>
                      </IonItem>
                    ))
                  )}
                </IonList>

                <div style={{ margin: '20px 0', textAlign: 'center' }}>
                  <IonButton 
                    expand="block" 
                    onClick={handleSwitchAccount}
                    disabled={isLoading}
                  >
                    <IonIcon icon={peopleOutline} slot="start" />
                    Open MetaMask to Switch Account
                  </IonButton>
                  
                  {accounts.length <= 1 && (
                    <IonButton 
                      expand="block" 
                      fill="outline"
                      onClick={handleConnectMoreAccounts}
                      disabled={isLoading}
                      style={{ marginTop: '10px' }}
                    >
                      <IonIcon icon={peopleOutline} slot="start" />
                      Connect More Accounts
                    </IonButton>
                  )}
                  
                  <IonButton 
                    fill="clear" 
                    expand="block" 
                    onClick={loadAccounts}
                    disabled={isLoading}
                    style={{ marginTop: '10px' }}
                  >
                    <IonIcon icon={refreshOutline} slot="start" />
                    Refresh Accounts
                  </IonButton>
                </div>

                <div style={{ 
                  background: 'var(--ion-color-light)', 
                  padding: '16px', 
                  borderRadius: '8px',
                  marginTop: '20px'
                }}>
                  <h4>How Account Switching Works:</h4>
                  {accounts.length <= 1 ? (
                    <div>
                      <p><strong>Only one account is connected.</strong></p>
                      <ol style={{ paddingLeft: '20px', margin: '10px 0' }}>
                        <li>Click "Connect More Accounts" to authorize more accounts</li>
                        <li>Or switch accounts directly in MetaMask extension</li>
                        <li>The app will automatically detect any account changes</li>
                      </ol>
                    </div>
                  ) : (
                    <ol style={{ paddingLeft: '20px', margin: '10px 0' }}>
                      <li>Click "Open MetaMask to Switch Account"</li>
                      <li>In MetaMask, click on your account icon at the top</li>
                      <li>Select a different account from the dropdown</li>
                      <li>The app will automatically update</li>
                    </ol>
                  )}
                  <p style={{ fontSize: '0.9em', color: 'var(--ion-color-medium)', marginTop: '10px' }}>
                    <strong>Note:</strong> MetaMask only shows accounts that you've explicitly connected to this website.
                  </p>
                </div>
              </>
            )}
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={showAlert}
        onDidDismiss={() => setShowAlert(false)}
        header="Account Switching"
        message={alertMessage}
        buttons={['OK']}
      />
    </>
  );
};

export default AccountSwitcher;