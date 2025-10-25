import {
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonPage,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonToast,
    IonAlert,
    IonLabel,
    IonInput,
    IonItemDivider,
    IonModal,
    IonGrid,
    IonRow,
    IonCol,
    IonSegment,
    IonSegmentButton,
    IonFab,
    IonFabButton,
    IonPopover,
    IonList,
    IonItem,
    IonCheckbox,
    isPlatform,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
} from "@ionic/react";
import { DATA } from "../templates";
import * as AppGeneral from "../components/socialcalc/index.js";
import { useEffect, useState, useRef } from "react";
import { File } from "../components/Storage/LocalStorage";
import {
    checkmarkCircle,
    syncOutline,
    closeOutline,
    textOutline,
    ellipsisVertical,
    shareSharp,
    downloadOutline,
    createOutline,
    arrowBack,
    documentText,
    folder,
    saveOutline,
    toggleOutline,
    saveSharp,
    alertCircle,
    cash,
    wallet as walletIcon,
    openOutline,
    linkOutline,
} from "ionicons/icons";
import "./InvoicePage.css";
import FileOptions from "../components/FileMenu/FileOptions";
import Menu from "../components/Menu/Menu";
import { useTheme } from "../contexts/ThemeContext";
import { useInvoice } from "../contexts/InvoiceContext";
import { useHistory, useLocation, useParams } from "react-router-dom";
import DynamicInvoiceForm from "../components/DynamicInvoiceForm";
import { isQuotaExceededError, getQuotaExceededMessage } from "../utils/helper";
import { getAutoSaveEnabled } from "../utils/settings";
import { SheetChangeMonitor } from "../utils/sheetChangeMonitor";
import { backgroundClip } from "html2canvas/dist/types/css/property-descriptors/background-clip";
import WalletConnect from "../components/WalletConnect";
import CreateInvoiceModal from "../components/CreateInvoiceModal";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { invoiceManager } from '../abi/invoiceManage';
import { INVOICE_MANAGER_ADDRESS, PYUSD_TOKEN_ADDRESS, PYUSD_TOKEN_ABI } from '../abi/contracts';
import { getIPFSUrl } from '../utils/ipfsUpload';
import { formatUnits, parseUnits } from 'viem';
import { saveInvoicePayment, getInvoicePayment, InvoicePayment } from '../services/invoicePaymentService';
import QRCode from 'qrcode';

const Invoice: React.FC = () => {
    const { isDarkMode } = useTheme();
    const {
        selectedFile,
        billType,
        store,
        updateSelectedFile,
        updateBillType,
        activeTemplateData,
        updateActiveTemplateData,
        updateCurrentSheetId,
    } = useInvoice();
    const history = useHistory();

    const [fileNotFound, setFileNotFound] = useState(false);
    const [templateNotFound, setTemplateNotFound] = useState(false);

    const { fileName: invoiceId } = useParams<{ fileName: string }>();

    const location = useLocation();

    // Wallet and blockchain state
    const { address, isConnected, chain } = useAccount();
    const [invoiceData, setInvoiceData] = useState<any>(null);
    const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
    const [invoiceNotFound, setInvoiceNotFound] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [isPaying, setIsPaying] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showSuccessAlert, setShowSuccessAlert] = useState(false);
    const [successTxHash, setSuccessTxHash] = useState<string>("");
    const [mongoPayment, setMongoPayment] = useState<InvoicePayment | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

    // Read invoice from contract
    const { data: contractInvoiceData, isError: invoiceReadError, isLoading: invoiceReadLoading, refetch: refetchInvoice } = useReadContract({
        address: INVOICE_MANAGER_ADDRESS,
        abi: invoiceManager,
        functionName: 'getInvoice',
        args: invoiceId ? [BigInt(invoiceId)] : undefined,
        query: {
            enabled: !!invoiceId && invoiceId !== '',
        }
    });

    // Write contracts for payment
    const { data: approveHash, writeContract: approveToken, isPending: isApprovePending } = useWriteContract();
    const { data: payHash, writeContract: payInvoice, isPending: isPayPending } = useWriteContract();

    // Wait for approve transaction
    const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
        hash: approveHash,
    });

    // Wait for pay transaction
    const { isLoading: isPayConfirming, isSuccess: isPaySuccess } = useWaitForTransactionReceipt({
        hash: payHash,
    });

    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastColor, setToastColor] = useState<
        "success" | "danger" | "warning"
    >("success");

    const [autosaveCount, setAutosaveCount] = useState(0);

    const activateFooter = (footer) => {
        console.log("🦶 activateFooter: Starting footer activation", { footer });
        // Only activate footer if SocialCalc is properly initialized
        try {
            const tableeditor = document.getElementById("tableeditor");
            const socialCalc = (window as any).SocialCalc;
            console.log("🔍 activateFooter: Checking DOM and SocialCalc", {
                hasTableEditor: !!tableeditor,
                hasSocialCalc: !!socialCalc,
                hasGetCurrentWorkBookControl: !!(
                    socialCalc && socialCalc.GetCurrentWorkBookControl
                ),
            });

            // Check if SocialCalc and WorkBook control are properly initialized
            if (tableeditor && socialCalc && socialCalc.GetCurrentWorkBookControl) {
                const control = socialCalc.GetCurrentWorkBookControl();
                console.log("📋 activateFooter: Control status", {
                    hasControl: !!control,
                    hasWorkbook: !!(control && control.workbook),
                    hasSpreadsheet: !!(
                        control &&
                        control.workbook &&
                        control.workbook.spreadsheet
                    ),
                });
                if (control && control.workbook && control.workbook.spreadsheet) {
                    console.log(
                        "✅ activateFooter: All requirements met, activating footer"
                    );
                    AppGeneral.activateFooterButton(footer);
                } else {
                    console.log(
                        "⚠️ activateFooter: SocialCalc WorkBook not ready for footer activation, skipping"
                    );
                }
            } else {
                console.log(
                    "⚠️ activateFooter: SocialCalc not ready for footer activation, skipping"
                );
            }
        } catch (error) {
            console.error("❌ activateFooter: Error activating footer", error);
        }
    };

    const initializeApp = async () => {
        console.log("🚀 initializeApp: Starting initialization", { invoiceId });

        try {
            // If no invoice ID is specified, show "no invoice to display"
            if (!invoiceId || invoiceId === "") {
                console.log(
                    "⚠️ initializeApp: No invoice ID specified"
                );
                setInvoiceNotFound(true);
                return;
            }

            // Fetch invoice from blockchain
            setIsLoadingInvoice(true);
            console.log("🔍 initializeApp: Fetching invoice from blockchain");

            // The invoice data will be fetched via useReadContract hook
            // We'll handle it in a separate useEffect

        } catch (error) {
            console.error(
                "💥 initializeApp: Caught error during initialization",
                error
            );
            setInvoiceNotFound(true);
            setTemplateNotFound(false);
        }
    };

    // Handle contract invoice data
    useEffect(() => {
        const loadInvoiceData = async () => {
            if (!invoiceId || invoiceId === "") {
                setInvoiceNotFound(true);
                setIsLoadingInvoice(false);
                return;
            }

            if (invoiceReadLoading) {
                setIsLoadingInvoice(true);
                return;
            }

            if (invoiceReadError) {
                console.error("❌ Error reading invoice from contract:", invoiceReadError);
                setInvoiceNotFound(true);
                setIsLoadingInvoice(false);
                return;
            }

            if (!contractInvoiceData) {
                console.log("⚠️ No invoice data returned from contract");
                setInvoiceNotFound(true);
                setIsLoadingInvoice(false);
                return;
            }

            // Check if invoice exists
            const invoice: any = contractInvoiceData;
            console.log("📄 Invoice data from contract:", invoice);

            // Check if invoice exists - use exists field OR check for valid data
            // (fallback in case contract doesn't set exists field properly)
            const hasValidData = invoice.id &&
                invoice.invoiceIpfsHash &&
                invoice.invoiceIpfsHash !== "" &&
                invoice.from &&
                invoice.from !== "0x0000000000000000000000000000000000000000";

            if (!invoice.exists && !hasValidData) {
                console.log("❌ Invoice does not exist in contract");
                setInvoiceNotFound(true);
                setIsLoadingInvoice(false);
                return;
            }

            setInvoiceData(invoice);

            // Fetch IPFS content
            try {
                const ipfsHash = invoice.invoiceIpfsHash;
                console.log("� Fetching IPFS content:", ipfsHash);

                const ipfsUrl = getIPFSUrl(ipfsHash);
                const response = await fetch(ipfsUrl);

                if (!response.ok) {
                    throw new Error(`Failed to fetch IPFS content: ${response.statusText}`);
                }

                const ipfsData = await response.json();
                const spreadsheetContent = ipfsData.content;

                console.log("📊 IPFS content loaded, length:", spreadsheetContent.length);

                // Make spreadsheet read-only by modifying the content
                // First parse the content string to JSON
                const contentJson = JSON.parse(spreadsheetContent);

                // Modify the EditableCells property
                contentJson.EditableCells = {
                    allow: true,
                    cells: {},
                    contraints: {}
                };

                // Convert back to string
                const modifiedContent = JSON.stringify(contentJson);
                console.log("🔧 MODIFIED: ", contentJson);

                // We'll initialize SocialCalc after the DOM is ready
                // Set loading to false first so the DOM elements render
                setIsLoadingInvoice(false);
                setInvoiceNotFound(false);
                setTemplateNotFound(false);

                // Wait for DOM elements to be rendered, then initialize SocialCalc
                setTimeout(() => {
                    console.log("⏰ Initializing SocialCalc with invoice content");

                    // Check if DOM elements exist
                    const tableeditor = document.getElementById("tableeditor");
                    const workbookControl = document.getElementById("workbookControl");

                    if (!tableeditor || !workbookControl) {
                        console.error("❌ Required DOM elements not found");
                        setToastMessage("Failed to initialize spreadsheet view");
                        setToastColor("danger");
                        setShowToast(true);
                        return;
                    }

                    try {
                        const currentControl = AppGeneral.getWorkbookInfo();
                        if (currentControl && currentControl.workbook) {
                            console.log("✅ SocialCalc already initialized, using viewFile");
                            AppGeneral.viewFile(`Invoice-${invoiceId}`, modifiedContent);
                        } else {
                            console.log("🔧 SocialCalc not initialized, initializing app");
                            AppGeneral.initializeApp(modifiedContent);
                        }
                    } catch (error) {
                        console.error("❌ Error initializing SocialCalc:", error);
                        setToastMessage("Failed to load invoice spreadsheet");
                        setToastColor("danger");
                        setShowToast(true);
                    }
                }, 500); // Increased timeout to ensure DOM is fully rendered

            } catch (error) {
                console.error("❌ Error loading IPFS content:", error);
                setToastMessage("Failed to load invoice content from IPFS");
                setToastColor("danger");
                setShowToast(true);
                setIsLoadingInvoice(false);
                setInvoiceNotFound(true);
            }
        };

        loadInvoiceData();
    }, [invoiceId, contractInvoiceData, invoiceReadError, invoiceReadLoading]);

    // Load payment from Firebase
    useEffect(() => {
        const loadPaymentFromFirebase = async () => {
            if (!invoiceId || invoiceId === '') return;

            try {
                const payment = await getInvoicePayment(invoiceId);
                if (payment) {
                    setMongoPayment(payment);
                    console.log('Payment loaded from Firebase:', payment);

                    // Generate QR code for the transaction link
                    const txLink = `https://sepolia.etherscan.io/tx/${payment.txHash}`;
                    const qrDataUrl = await QRCode.toDataURL(txLink, {
                        width: 300,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF',
                        },
                    });
                    setQrCodeUrl(qrDataUrl);
                } else {
                    setMongoPayment(null);
                    setQrCodeUrl('');
                }
            } catch (error) {
                console.error('Error loading payment from Firebase:', error);
            }
        };

        loadPaymentFromFirebase();
    }, [invoiceId, invoiceData]);


    useEffect(() => {
        initializeApp();
    }, [invoiceId]); // Only depend on invoiceId to prevent loops

    // Initialize sheet change monitor - disabled for read-only invoice view
    useEffect(() => {
        if (invoiceId && activeTemplateData) {
            // Sheet change monitoring disabled for invoice view as it's read-only
        }
    }, [invoiceId, activeTemplateData, updateCurrentSheetId]);

    useEffect(() => {
        if (invoiceId) {
            updateSelectedFile(invoiceId);
        }
    }, [invoiceId]);

    // Reset autosave to global setting when a new file is opened - disabled for invoice view
    useEffect(() => {
        if (invoiceId) {
            // Auto-save disabled for invoice view
        }
    }, [invoiceId]);

    useEffect(() => {
        // Auto-save disabled for invoice view (read-only)
    }, [autosaveCount]);

    useEffect(() => {
        // Auto-save disabled for invoice view
    }, [invoiceId, billType]);

    useEffect(() => {
        // Footer not needed for invoice view
    }, [billType]);

    useEffect(() => {
        // Template footers not used in invoice view
    }, [activeTemplateData]);

    // Handle approve transaction success
    useEffect(() => {
        if (isApproveSuccess) {
            setIsApproving(false);
            setToastMessage("Token approval successful! You can now pay the invoice.");
            setToastColor("success");
            setShowToast(true);
        }
    }, [isApproveSuccess]);

    // Handle pay transaction success
    useEffect(() => {
        if (isPaySuccess && payHash) {
            setIsPaying(false);
            setShowPaymentModal(false);
            setSuccessTxHash(payHash);
            setShowSuccessAlert(true);

            // Save payment to Firebase
            const savePayment = async () => {
                try {
                    await saveInvoicePayment({
                        invoiceId: invoiceId,
                        txHash: payHash,
                        paidBy: address || '',
                        amount: invoiceData?.amount ? formatUnits(invoiceData.amount, 6) : '0',
                        timestamp: new Date().toISOString(),
                    });
                    console.log('Payment saved to Firebase');

                    // Reload payment from Firebase
                    const payment = await getInvoicePayment(invoiceId);
                    if (payment) {
                        setMongoPayment(payment);

                        // Generate QR code for the transaction link
                        const txLink = `https://sepolia.etherscan.io/tx/${payment.txHash}`;
                        const qrDataUrl = await QRCode.toDataURL(txLink, {
                            width: 300,
                            margin: 2,
                            color: {
                                dark: '#000000',
                                light: '#FFFFFF',
                            },
                        });
                        setQrCodeUrl(qrDataUrl);
                    }
                } catch (error) {
                    console.error('Failed to save payment to Firebase:', error);
                }
            };

            savePayment();

            // Refetch invoice data
            setTimeout(() => {
                refetchInvoice();
            }, 2000);
        }
    }, [isPaySuccess, payHash, invoiceId, address, invoiceData]);

    // Payment functions
    const handleApproveToken = async () => {
        if (!isConnected) {
            setToastMessage("Please connect your wallet first");
            setToastColor("warning");
            setShowToast(true);
            return;
        }

        if (chain?.id !== 11155111) {
            setToastMessage("Please switch to Sepolia testnet");
            setToastColor("warning");
            setShowToast(true);
            return;
        }

        if (!invoiceData) {
            setToastMessage("Invoice data not loaded");
            setToastColor("danger");
            setShowToast(true);
            return;
        }

        try {
            setIsApproving(true);

            // Approve the invoice manager contract to spend PYUSD
            approveToken({
                address: PYUSD_TOKEN_ADDRESS,
                abi: PYUSD_TOKEN_ABI,
                functionName: 'approve',
                args: [INVOICE_MANAGER_ADDRESS, invoiceData.amount],
            } as any);
        } catch (error: any) {
            console.error("Error approving token:", error);
            setToastMessage(error.message || "Failed to approve token");
            setToastColor("danger");
            setShowToast(true);
            setIsApproving(false);
        }
    };

    const handlePayInvoice = async () => {
        if (!isConnected) {
            setToastMessage("Please connect your wallet first");
            setToastColor("warning");
            setShowToast(true);
            return;
        }

        if (chain?.id !== 11155111) {
            setToastMessage("Please switch to Sepolia testnet");
            setToastColor("warning");
            setShowToast(true);
            return;
        }

        if (!invoiceData) {
            setToastMessage("Invoice data not loaded");
            setToastColor("danger");
            setShowToast(true);
            return;
        }

        if (invoiceData.paid) {
            setToastMessage("Invoice already paid");
            setToastColor("warning");
            setShowToast(true);
            return;
        }

        if (invoiceData.from.toLowerCase() === address?.toLowerCase()) {
            setToastMessage("Cannot pay your own invoice");
            setToastColor("warning");
            setShowToast(true);
            return;
        }

        try {
            setIsPaying(true);

            // Call payInvoice function
            payInvoice({
                address: INVOICE_MANAGER_ADDRESS,
                abi: invoiceManager,
                functionName: 'payInvoice',
                args: [BigInt(invoiceId)],
            } as any);
        } catch (error: any) {
            console.error("Error paying invoice:", error);
            setToastMessage(error.message || "Failed to pay invoice");
            setToastColor("danger");
            setShowToast(true);
            setIsPaying(false);
        }
    };

    return (
        <IonPage
            className={isDarkMode ? "dark-theme" : ""}
            style={{ height: "100vh", overflow: "hidden" }}
        >
            <IonHeader>
                <IonToolbar color="primary">
                    <IonButtons slot="start">
                        <IonButton
                            fill="clear"
                            onClick={() => history.push("/app/files")}
                            style={{ color: "white" }}
                        >
                            <IonIcon icon={arrowBack} />
                        </IonButton>
                    </IonButtons>
                    <IonButtons
                        slot="start"
                        className="editing-title"
                        style={{ marginLeft: "8px" }}
                    >
                        <div style={{ display: "flex", alignItems: "center" }}>
                            <span>{invoiceId ? `Invoice #${invoiceId}` : "Invoice"}</span>
                        </div>
                    </IonButtons>

                    <IonButtons
                        slot="end"
                        className={isPlatform("desktop") && "ion-padding-end"}
                    >
                        {/* Wallet Connection */}
                        <div style={{ marginRight: "12px" }}>
                            <WalletConnect />
                        </div>
                        {/* Pay Invoice Button - only show if invoice is loaded and unpaid */}
                        {invoiceData && (
                            <>
                                {invoiceData.paid ? (
                                    <IonButton
                                        fill="solid"
                                        size="small"
                                        color="success"
                                        disabled
                                        style={{ marginRight: "12px" }}
                                    >
                                        <IonIcon icon={checkmarkCircle} slot="start" />
                                        Paid
                                    </IonButton>
                                ) : (
                                    <>
                                        {invoiceData.from.toLowerCase() === address?.toLowerCase() ? (
                                            <IonButton
                                                fill="solid"
                                                size="small"
                                                color="medium"
                                                disabled
                                                style={{ marginRight: "12px" }}
                                            >
                                                Your Invoice
                                            </IonButton>
                                        ) : (
                                            <IonButton
                                                fill="solid"
                                                size="small"
                                                color="success"
                                                onClick={() => setShowPaymentModal(true)}
                                                style={{ marginRight: "12px" }}
                                                disabled={!isConnected || chain?.id !== 11155111}
                                            >
                                                <IonIcon icon={cash} slot="start" />
                                                Pay Invoice
                                            </IonButton>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </IonButtons>
                </IonToolbar>
            </IonHeader>

            <IonContent
                fullscreen
                scrollY={false}
                style={{
                    overflow: "hidden",
                    height: "calc(100vh - var(--ion-safe-area-top) - 56px)", // Subtract header height
                }}
            >
                {/* Loading state */}
                {isLoadingInvoice && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            padding: "40px 20px",
                            textAlign: "center",
                        }}
                    >
                        <IonSpinner name="crescent" style={{ width: "80px", height: "80px", marginBottom: "20px" }} />
                        <h2
                            style={{
                                margin: "0 0 16px 0",
                                color: "var(--ion-color-dark)",
                                fontSize: "24px",
                                fontWeight: "600",
                            }}
                        >
                            Loading Invoice
                        </h2>
                        <p
                            style={{
                                margin: "0",
                                color: "var(--ion-color-medium)",
                                fontSize: "16px",
                            }}
                        >
                            Fetching invoice data from blockchain...
                        </p>
                    </div>
                )}

                {/* No invoice ID specified */}
                {!isLoadingInvoice && invoiceNotFound && !invoiceId && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            padding: "40px 20px",
                            textAlign: "center",
                        }}
                    >
                        <IonIcon
                            icon={documentText}
                            style={{
                                fontSize: "80px",
                                color: "var(--ion-color-medium)",
                                marginBottom: "20px",
                            }}
                        />
                        <h2
                            style={{
                                margin: "0 0 16px 0",
                                color: "var(--ion-color-dark)",
                                fontSize: "24px",
                                fontWeight: "600",
                            }}
                        >
                            No Invoice to Display
                        </h2>
                        <p
                            style={{
                                margin: "0 0 30px 0",
                                color: "var(--ion-color-medium)",
                                fontSize: "16px",
                                lineHeight: "1.5",
                                maxWidth: "400px",
                            }}
                        >
                            Please provide an invoice ID in the URL to view an invoice.
                        </p>
                        <IonButton
                            fill="solid"
                            size="default"
                            onClick={() => history.push("/app/files")}
                            style={{ minWidth: "200px" }}
                        >
                            <IonIcon icon={folder} slot="start" />
                            Go to File Explorer
                        </IonButton>
                    </div>
                )}

                {/* Invoice not found */}
                {!isLoadingInvoice && invoiceNotFound && invoiceId && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            padding: "40px 20px",
                            textAlign: "center",
                        }}
                    >
                        <IonIcon
                            icon={alertCircle}
                            style={{
                                fontSize: "80px",
                                color: "var(--ion-color-danger)",
                                marginBottom: "20px",
                            }}
                        />
                        <h2
                            style={{
                                margin: "0 0 16px 0",
                                color: "var(--ion-color-dark)",
                                fontSize: "24px",
                                fontWeight: "600",
                            }}
                        >
                            Invoice Not Found
                        </h2>
                        <p
                            style={{
                                margin: "0 0 30px 0",
                                color: "var(--ion-color-medium)",
                                fontSize: "16px",
                                lineHeight: "1.5",
                                maxWidth: "400px",
                            }}
                        >
                            Invoice #{invoiceId} doesn't exist on the blockchain. Please check the invoice ID and try again.
                        </p>
                        <IonButton
                            fill="solid"
                            size="default"
                            onClick={() => history.push("/app/files")}
                            style={{ minWidth: "200px" }}
                        >
                            <IonIcon icon={folder} slot="start" />
                            Go to File Explorer
                        </IonButton>
                    </div>
                )}

                {/* Invoice content */}
                {!isLoadingInvoice && !invoiceNotFound && invoiceData && (
                    <>
                        {/* Invoice info card */}
                        <IonCard style={{ margin: "16px" }}>
                            <IonCardHeader>
                                <IonCardTitle>Invoice Information</IonCardTitle>
                            </IonCardHeader>
                            <IonCardContent>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <div>
                                        <strong>Invoice ID:</strong> #{invoiceData.id.toString()}
                                    </div>
                                    <div>
                                        <strong>Status:</strong>{" "}
                                        <span style={{
                                            color: invoiceData.paid ? "var(--ion-color-success)" : "var(--ion-color-warning)",
                                            fontWeight: "600"
                                        }}>
                                            {invoiceData.paid ? "PAID" : "UNPAID"}
                                        </span>
                                    </div>
                                    <div>
                                        <strong>Amount:</strong> {formatUnits(invoiceData.amount, 6)} PYUSD
                                    </div>
                                    <div>
                                        <strong>From:</strong> {invoiceData.from.slice(0, 6)}...{invoiceData.from.slice(-4)}
                                    </div>
                                    {mongoPayment && mongoPayment.paidBy && (
                                        <div>
                                            <strong>Paid By:</strong> {mongoPayment.paidBy.slice(0, 6)}...{mongoPayment.paidBy.slice(-4)}
                                        </div>
                                    )}
                                    <div>
                                        <strong>Created:</strong> {new Date(Number(invoiceData.createdAt) * 1000).toLocaleDateString()}
                                    </div>
                                    {mongoPayment && mongoPayment.txHash && (
                                        <div style={{ gridColumn: "1 / -1" }}>
                                            <strong>Payment Transaction:</strong>{" "}
                                            <a
                                                href={`https://sepolia.etherscan.io/tx/${mongoPayment.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: "var(--ion-color-primary)",
                                                    textDecoration: "none",
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                }}
                                            >
                                                {mongoPayment.txHash.slice(0, 10)}...{mongoPayment.txHash.slice(-8)}
                                                <IonIcon icon={openOutline} style={{ fontSize: "16px" }} />
                                            </a>
                                        </div>
                                    )}
                                    {qrCodeUrl && (
                                        <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", alignItems: "center", marginTop: "16px", gap: "8px" }}>
                                            <strong>Transaction QR Code:</strong>
                                            <img
                                                src={qrCodeUrl}
                                                alt="Transaction QR Code"
                                                style={{
                                                    width: "200px",
                                                    height: "200px",
                                                    border: "2px solid var(--ion-color-medium)",
                                                    borderRadius: "8px",
                                                    padding: "8px",
                                                    backgroundColor: "white"
                                                }}
                                            />
                                            <p style={{ margin: "0", fontSize: "12px", color: "var(--ion-color-medium)" }}>
                                                Scan to view transaction on Etherscan
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </IonCardContent>
                        </IonCard>

                        {/* Spreadsheet container */}
                        <div id="container" style={{ height: "calc(100% - 200px)" }}>
                            <div id="workbookControl"></div>
                            <div id="tableeditor"></div>
                            <div id="msg"></div>
                        </div>
                    </>
                )}

                {/* Toast for notifications */}
                <IonToast
                    isOpen={showToast}
                    onDidDismiss={() => setShowToast(false)}
                    message={toastMessage}
                    duration={3000}
                    color={toastColor}
                    position="top"
                />

                {/* Payment Modal */}
                <IonModal
                    isOpen={showPaymentModal}
                    onDidDismiss={() => setShowPaymentModal(false)}
                >
                    <IonHeader>
                        <IonToolbar>
                            <IonTitle>Pay Invoice</IonTitle>
                            <IonButtons slot="end">
                                <IonButton onClick={() => setShowPaymentModal(false)}>
                                    <IonIcon icon={closeOutline} />
                                </IonButton>
                            </IonButtons>
                        </IonToolbar>
                    </IonHeader>
                    <IonContent>
                        <div style={{ padding: "20px" }}>
                            {invoiceData && (
                                <IonCard>
                                    <IonCardHeader>
                                        <IonCardTitle>Invoice Details</IonCardTitle>
                                    </IonCardHeader>
                                    <IonCardContent>
                                        <div style={{ marginBottom: "16px" }}>
                                            <strong>Invoice ID:</strong> #{invoiceData.id.toString()}
                                        </div>
                                        <div style={{ marginBottom: "16px" }}>
                                            <strong>Amount:</strong> {formatUnits(invoiceData.amount, 6)} PYUSD
                                        </div>
                                        <div style={{ marginBottom: "16px" }}>
                                            <strong>Issuer:</strong> {invoiceData.from}
                                        </div>
                                        <div style={{ marginBottom: "24px", padding: "12px", backgroundColor: "var(--ion-color-light)", borderRadius: "8px" }}>
                                            <p style={{ margin: "0 0 8px 0", fontSize: "14px" }}>
                                                <strong>Platform Fee (0.01%):</strong> {formatUnits(invoiceData.amount * BigInt(1) / BigInt(10000), 6)} PYUSD
                                            </p>
                                            <p style={{ margin: "0", fontSize: "14px" }}>
                                                <strong>You'll Pay:</strong> {formatUnits(invoiceData.amount, 6)} PYUSD
                                            </p>
                                        </div>
                                    </IonCardContent>
                                </IonCard>
                            )}

                            <div style={{ marginTop: "20px" }}>
                                <h3 style={{ marginBottom: "16px" }}>Payment Steps:</h3>
                                <ol style={{ paddingLeft: "20px", lineHeight: "1.8" }}>
                                    <li>First, approve the contract to spend PYUSD tokens</li>
                                    <li>Then, confirm the payment transaction</li>
                                </ol>
                            </div>

                            <div style={{ marginTop: "32px", display: "flex", gap: "12px" }}>
                                <IonButton
                                    expand="block"
                                    onClick={handleApproveToken}
                                    disabled={isApprovePending || isApproveConfirming || isApproving}
                                    style={{ flex: 1 }}
                                >
                                    {(isApprovePending || isApproveConfirming || isApproving) && (
                                        <IonSpinner name="crescent" style={{ marginRight: "8px" }} />
                                    )}
                                    {isApproveSuccess ? "✓ Approved" : "1. Approve"}
                                </IonButton>

                                <IonButton
                                    expand="block"
                                    color="success"
                                    onClick={handlePayInvoice}
                                    disabled={!isApproveSuccess || isPayPending || isPayConfirming || isPaying}
                                    style={{ flex: 1 }}
                                >
                                    {(isPayPending || isPayConfirming || isPaying) && (
                                        <IonSpinner name="crescent" style={{ marginRight: "8px" }} />
                                    )}
                                    2. Pay Invoice
                                </IonButton>
                            </div>
                        </div>
                    </IonContent>
                </IonModal>

                {/* Payment Success Alert */}
                <IonAlert
                    isOpen={showSuccessAlert}
                    onDidDismiss={() => setShowSuccessAlert(false)}
                    header="Payment Successful!"
                    message={`Your payment has been processed successfully.`}
                    buttons={[
                        {
                            text: 'OK',
                            role: 'cancel',
                        },
                        {
                            text: 'View on Etherscan',
                            handler: () => {
                                window.open(`https://sepolia.etherscan.io/tx/${successTxHash}`, '_blank');
                            }
                        }
                    ]}
                />
            </IonContent>
        </IonPage>
    );
};

export default Invoice;
