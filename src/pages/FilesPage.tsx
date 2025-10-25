import React, { useState, useEffect } from "react";
import {
  IonAlert,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToast,
  IonToolbar,
  IonButton,
  IonIcon,
  IonButtons,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSpinner,
  IonBadge,
  IonLabel,
} from "@ionic/react";
import {
  chevronForward,
  layers,
  settings,
  add,
  close,
  phonePortraitOutline,
  tabletPortraitOutline,
  desktopOutline,
  filterOutline,
  moon,
  sunny,
  documentText,
  checkmarkCircle,
  timeOutline,
  cashOutline,
  receiptOutline,
  walletOutline,
  openOutline,
} from "ionicons/icons";
import Files from "../components/Files/Files";
import { useTheme } from "../contexts/ThemeContext";
import { useInvoice } from "../contexts/InvoiceContext";
import { DATA } from "../templates";
import { tempMeta } from "../templates-meta";
import * as AppGeneral from "../components/socialcalc/index";
import "./FilesPage.css";
import { useHistory } from "react-router-dom";
import { File } from "../components/Storage/LocalStorage";
import TemplateModal from "../components/TemplateModal/TemplateModal";
import { useAccount, useReadContract } from 'wagmi';
import { invoiceManager } from '../abi/invoiceManage';
import { INVOICE_MANAGER_ADDRESS } from '../abi/contracts';
import { formatUnits } from 'viem';
import WalletConnect from '../components/WalletConnect';
const FilesPage: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { selectedFile, store, updateSelectedFile, updateBillType } =
    useInvoice();
  const history = useHistory();

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSharedTemplateModal, setShowSharedTemplateModal] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // Legacy states for old template modal (will be removed later)
  const [templateFilter, setTemplateFilter] = useState<
    "all" | "web" | "mobile" | "tablet"
  >("all");
  const [selectedTemplateForFile, setSelectedTemplateForFile] = useState<
    number | null
  >(null);
  const [showFileNamePrompt, setShowFileNamePrompt] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const [device] = useState(AppGeneral.getDeviceType());

  // Main tab state - 'files' or 'blockchain'
  const [activeTab, setActiveTab] = useState<'files' | 'blockchain'>('files');

  // Blockchain states
  const { address, isConnected } = useAccount();
  const [createdInvoices, setCreatedInvoices] = useState<any[]>([]);
  const [paidInvoices, setPaidInvoices] = useState<any[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Read user's created invoices
  const { data: createdInvoiceIds, refetch: refetchCreated } = useReadContract({
    address: INVOICE_MANAGER_ADDRESS,
    abi: invoiceManager,
    functionName: 'getUserCreatedBills',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    }
  });

  // Read user's paid invoices
  const { data: paidInvoiceIds, refetch: refetchPaid } = useReadContract({
    address: INVOICE_MANAGER_ADDRESS,
    abi: invoiceManager,
    functionName: 'getUserPaidBills',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    }
  });

  // Fetch invoice details using getInvoicesBatch
  const { data: createdInvoicesData, refetch: refetchCreatedData } = useReadContract({
    address: INVOICE_MANAGER_ADDRESS,
    abi: invoiceManager,
    functionName: 'getInvoicesBatch',
    args: createdInvoiceIds && Array.isArray(createdInvoiceIds) && createdInvoiceIds.length > 0 ? [createdInvoiceIds] : undefined,
    query: {
      enabled: !!address && isConnected && !!createdInvoiceIds && Array.isArray(createdInvoiceIds) && createdInvoiceIds.length > 0,
    }
  });

  const { data: paidInvoicesData, refetch: refetchPaidData } = useReadContract({
    address: INVOICE_MANAGER_ADDRESS,
    abi: invoiceManager,
    functionName: 'getInvoicesBatch',
    args: paidInvoiceIds && Array.isArray(paidInvoiceIds) && paidInvoiceIds.length > 0 ? [paidInvoiceIds] : undefined,
    query: {
      enabled: !!address && isConnected && !!paidInvoiceIds && Array.isArray(paidInvoiceIds) && paidInvoiceIds.length > 0,
    }
  });

  // Fetch invoice details when IDs are loaded
  useEffect(() => {
    const processInvoiceData = () => {
      if (!address || !isConnected) {
        setCreatedInvoices([]);
        setPaidInvoices([]);
        setIsLoadingInvoices(false);
        return;
      }

      setIsLoadingInvoices(true);

      try {
        // Process created invoices
        if (createdInvoicesData && Array.isArray(createdInvoicesData)) {
          const created = createdInvoicesData
            .filter((inv: any) => {
              // Check exists field OR valid data (fallback)
              const hasValidData = inv.id &&
                inv.invoiceIpfsHash &&
                inv.invoiceIpfsHash !== "" &&
                inv.from &&
                inv.from !== "0x0000000000000000000000000000000000000000";
              return inv.exists || hasValidData;
            })
            .map((inv: any) => ({
              id: inv.id.toString(),
              amount: inv.amount,
              paid: inv.paid,
              from: inv.from,
              to: inv.to,
              createdAt: inv.createdAt,
              paidAt: inv.paidAt,
              paymentTxHash: inv.paymentTxHash,
              type: 'created'
            }));
          setCreatedInvoices(created);
        } else {
          setCreatedInvoices([]);
        }

        // Process paid invoices
        if (paidInvoicesData && Array.isArray(paidInvoicesData)) {
          const paid = paidInvoicesData
            .filter((inv: any) => {
              // Check exists field OR valid data (fallback)
              const hasValidData = inv.id &&
                inv.invoiceIpfsHash &&
                inv.invoiceIpfsHash !== "" &&
                inv.from &&
                inv.from !== "0x0000000000000000000000000000000000000000";
              return inv.exists || hasValidData;
            })
            .map((inv: any) => ({
              id: inv.id.toString(),
              amount: inv.amount,
              paid: inv.paid,
              from: inv.from,
              to: inv.to,
              createdAt: inv.createdAt,
              paidAt: inv.paidAt,
              paymentTxHash: inv.paymentTxHash,
              type: 'paid'
            }));
          setPaidInvoices(paid);
        } else {
          setPaidInvoices([]);
        }
      } catch (error) {
        console.error('Error processing invoice data:', error);
      } finally {
        setIsLoadingInvoices(false);
      }
    };

    processInvoiceData();
  }, [createdInvoicesData, paidInvoicesData, address, isConnected]);  // Refetch invoices when tab changes to blockchain
  useEffect(() => {
    if (activeTab === 'blockchain' && isConnected && address) {
      refetchCreated();
      refetchPaid();
      refetchCreatedData();
      refetchPaidData();
    }
  }, [activeTab, isConnected, address]);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 692);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Clear selected file when navigating to files page to prevent conflicts
  useEffect(() => {
    updateSelectedFile("");
  }, []);

  const getTemplateMetadata = (templateId: number) => {
    return tempMeta.find((meta) => meta.template_id === templateId);
  };

  // Categorize templates based on their category
  const categorizeTemplate = (templateId: number) => {
    const metadata = getTemplateMetadata(templateId);
    if (!metadata?.category) return "web";
    const category = metadata.category.toLowerCase();
    if (category === "mobile") {
      return "mobile";
    } else if (category === "tablet") {
      return "tablet";
    } else {
      return "web";
    }
  };

  const getAvailableTemplates = () => {
    // map tempMeta.template_id and tempMeta.tempate_name with templateId and template resp
    return tempMeta.map((template) => {
      const extra = DATA[template.template_id];
      return {
        templateId: template.template_id,
        template: template.name,
        ImageUri: template.ImageUri,
        footers: extra?.footers || [],
        ...extra,
      };
    });
  };

  const getTemplateInfo = (templateId: number) => {
    const template = DATA[templateId];
    return template ? template.template : `Template ${templateId}`;
  };

  // Get categorized templates
  const getCategorizedTemplates = () => {
    const templates = tempMeta;
    const categorized = {
      web: templates.filter((t) => {
        return categorizeTemplate(t.template_id) === "web";
      }),
      mobile: templates.filter((t) => {
        return categorizeTemplate(t.template_id) === "mobile";
      }),
      tablet: templates.filter((t) => {
        return categorizeTemplate(t.template_id) === "tablet";
      }),
    };
    return categorized;
  };

  // Get filtered templates based on current filter
  const getFilteredTemplates = () => {
    const categorized = getCategorizedTemplates();

    if (templateFilter === "all") {
      // Return in order: web, mobile, tablet
      return [...categorized.web, ...categorized.mobile, ...categorized.tablet];
    } else {
      return categorized[templateFilter] || [];
    }
  };

  const handleTemplateSelect = (templateId: number) => {
    setSelectedTemplateForFile(templateId);
    setShowFileNamePrompt(true);
    if (isSmallScreen) {
      setShowTemplateModal(false);
    }
  };

  // Reset template filter when modal closes
  const handleModalClose = () => {
    setShowTemplateModal(false);
    setTemplateFilter("all");
  };

  /* Utility functions */
  const _validateName = async (filename: string) => {
    filename = filename.trim();
    if (filename === "Untitled") {
      return {
        isValid: false,
        message: "cannot update Untitled file! Use Save As Button to save.",
      };
    } else if (filename === "" || !filename) {
      return {
        isValid: false,
        message: "Filename cannot be empty",
      };
    } else if (filename.length > 30) {
      return {
        isValid: false,
        message: "Filename too long",
      };
    } else if (/^[a-zA-Z0-9- ]*$/.test(filename) === false) {
      return {
        isValid: false,
        message: "Special Characters cannot be used",
      };
    } else if (await store._checkKey(filename)) {
      return {
        isValid: false,
        message: "Filename already exists",
      };
    }
    return {
      isValid: true,
      message: "",
    };
  };

  // Create new file with template
  const createNewFileWithTemplate = async (
    templateId: number,
    fileName: string
  ) => {
    try {
      // Validate filename first
      const validation = await _validateName(fileName);
      if (!validation.isValid) {
        setToastMessage(validation.message);
        setShowToast(true);
        return;
      }

      const templateData = DATA[templateId];
      if (!templateData) {
        setToastMessage("Template not found");
        setShowToast(true);
        return;
      }

      const mscContent = templateData.msc;
      const jsonMsc = JSON.stringify(mscContent);
      if (!mscContent) {
        setToastMessage("Error creating template content");
        setShowToast(true);
        return;
      }

      // Find the active footer index, default to 1 if none found
      const activeFooter = templateData.footers?.find(
        (footer) => footer.isActive
      );
      const activeFooterIndex = activeFooter ? activeFooter.index : 1;

      const now = new Date().toISOString();
      const newFile = new File(
        now,
        now,
        encodeURIComponent(jsonMsc), // mscContent is already a JSON string
        fileName,
        activeFooterIndex,
        templateId,
        false
      );

      await store._saveFile(newFile);

      setToastMessage(
        `File "${fileName}" created with ${templateData.template}`
      );
      setShowToast(true);

      // Reset modal state
      setShowFileNamePrompt(false);
      setSelectedTemplateForFile(null);
      setNewFileName("");
      setShowTemplateModal(false); // Dismiss the template modal

      updateSelectedFile(fileName);
      updateBillType(activeFooterIndex);

      // Add 200ms timeout for routing
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = `/app/editor/${fileName}`;
        link.click();
      }, 200);
    } catch (error) {
      setToastMessage("Failed to create file");
      setShowToast(true);
    }
  };

  // Render template modal for small screens
  const renderTemplateModal = () => {
    const filteredTemplates = getFilteredTemplates();
    const categorized = getCategorizedTemplates();

    return (
      <IonModal isOpen={showTemplateModal} onDidDismiss={handleModalClose}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Choose Template</IonTitle>
            <IonButtons slot="end">
              <IonButton fill="clear" onClick={handleModalClose}>
                <IonIcon icon={close} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {/* Filter Segment */}
          <div
            style={{
              padding: "16px",
              background: isDarkMode
                ? "var(--ion-color-step-50)"
                : "var(--ion-color-step-50)",
              borderBottom: `1px solid ${isDarkMode
                ? "var(--ion-color-step-200)"
                : "var(--ion-color-step-150)"
                }`,
              margin: "0",
            }}
          >
            <IonSegment
              value={templateFilter}
              onIonChange={(e) =>
                setTemplateFilter(
                  e.detail.value as "all" | "web" | "mobile" | "tablet"
                )
              }
              style={{
                background: isDarkMode
                  ? "var(--ion-color-step-150)"
                  : "var(--ion-background-color)",
                borderRadius: "8px",
                padding: "3px",
                border: `1px solid ${isDarkMode
                  ? "var(--ion-color-step-250)"
                  : "var(--ion-color-step-150)"
                  }`,
                boxShadow: "none",
                "--background": isDarkMode
                  ? "var(--ion-color-step-150)"
                  : "var(--ion-background-color)",
                "--background-checked": isDarkMode
                  ? "var(--ion-color-primary)"
                  : "var(--ion-color-primary)",
                "--color": isDarkMode ? "#ffffff" : "#000000",
                "--color-checked": "#ffffff",
              }}
            >
              <IonSegmentButton
                value="all"
                style={{
                  minHeight: "36px",
                  "--background": isDarkMode
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                  "--background-checked": isDarkMode
                    ? "var(--ion-color-primary)"
                    : "var(--ion-color-primary)",
                  "--color": isDarkMode ? "#ffffff" : "#000000",
                  "--color-checked": "#ffffff",
                }}
              >
                <IonIcon
                  icon={filterOutline}
                  style={{
                    fontSize: "16px",
                    color:
                      templateFilter === "all"
                        ? "#ffffff"
                        : isDarkMode
                          ? "#ffffff"
                          : "#000000",
                  }}
                />
                <IonText
                  style={{
                    fontSize: "11px",
                    fontWeight: "500",
                    marginLeft: "4px",
                    marginBottom: "15px",
                    color:
                      templateFilter === "all"
                        ? "#ffffff"
                        : isDarkMode
                          ? "#ffffff"
                          : "#000000",
                  }}
                >
                  All (
                  {categorized.web.length +
                    categorized.mobile.length +
                    categorized.tablet.length}
                  )
                </IonText>
              </IonSegmentButton>
              <IonSegmentButton
                value="web"
                style={{
                  minHeight: "36px",
                  "--background": isDarkMode
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                  "--background-checked": isDarkMode
                    ? "var(--ion-color-primary)"
                    : "var(--ion-color-primary)",
                  "--color": isDarkMode ? "#ffffff" : "#000000",
                  "--color-checked": "#ffffff",
                }}
              >
                <IonIcon
                  icon={desktopOutline}
                  style={{
                    fontSize: "16px",
                    color:
                      templateFilter === "web"
                        ? "#ffffff"
                        : isDarkMode
                          ? "#ffffff"
                          : "#000000",
                  }}
                />
                <IonText
                  style={{
                    fontSize: "11px",
                    fontWeight: "500",
                    marginLeft: "4px",
                    marginBottom: "15px",
                    color:
                      templateFilter === "web"
                        ? "#ffffff"
                        : isDarkMode
                          ? "#ffffff"
                          : "#000000",
                  }}
                >
                  Web ({categorized.web.length})
                </IonText>
              </IonSegmentButton>
              <IonSegmentButton
                value="mobile"
                style={{
                  minHeight: "36px",
                  "--background": isDarkMode
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                  "--background-checked": isDarkMode
                    ? "var(--ion-color-primary)"
                    : "var(--ion-color-primary)",
                  "--color": isDarkMode ? "#ffffff" : "#000000",
                  "--color-checked": "#ffffff",
                }}
              >
                <IonIcon
                  icon={phonePortraitOutline}
                  style={{
                    fontSize: "16px",
                    color:
                      templateFilter === "mobile"
                        ? "#ffffff"
                        : isDarkMode
                          ? "#ffffff"
                          : "#000000",
                  }}
                />
                <IonText
                  style={{
                    fontSize: "11px",
                    fontWeight: "500",
                    marginLeft: "4px",
                    marginBottom: "15px",
                    color:
                      templateFilter === "mobile"
                        ? "#ffffff"
                        : isDarkMode
                          ? "#ffffff"
                          : "#000000",
                  }}
                >
                  Mobile ({categorized.mobile.length})
                </IonText>
              </IonSegmentButton>
              <IonSegmentButton
                value="tablet"
                style={{
                  minHeight: "36px",
                  "--background": isDarkMode
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.05)",
                  "--background-checked": isDarkMode
                    ? "var(--ion-color-primary)"
                    : "var(--ion-color-primary)",
                  "--color": isDarkMode ? "#ffffff" : "#000000",
                  "--color-checked": "#ffffff",
                }}
              >
                <IonIcon
                  icon={tabletPortraitOutline}
                  style={{
                    fontSize: "16px",
                    color:
                      templateFilter === "tablet"
                        ? "#ffffff"
                        : isDarkMode
                          ? "#ffffff"
                          : "#000000",
                  }}
                />
                <IonText
                  style={{
                    fontSize: "11px",
                    fontWeight: "500",
                    marginLeft: "4px",
                    marginBottom: "15px",
                    color:
                      templateFilter === "tablet"
                        ? "#ffffff"
                        : isDarkMode
                          ? "#ffffff"
                          : "#000000",
                  }}
                >
                  Tablet ({categorized.tablet.length})
                </IonText>
              </IonSegmentButton>
            </IonSegment>
          </div>

          <div style={{ padding: "16px" }}>
            {filteredTemplates.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "var(--ion-color-medium)",
                }}
              >
                <IonIcon
                  icon={layers}
                  style={{
                    fontSize: "48px",
                    marginBottom: "16px",
                    display: "block",
                    opacity: 0.4,
                    color: "var(--ion-color-medium)",
                  }}
                />
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "16px",
                    fontWeight: "600",
                    color: "var(--ion-color-medium)",
                  }}
                >
                  No Templates Found
                </h3>
                <p style={{ margin: "0", fontSize: "13px", opacity: 0.8 }}>
                  No templates found for{" "}
                  {templateFilter === "all" ? "this filter" : templateFilter}{" "}
                  category
                </p>
              </div>
            ) : (
              <>
                {templateFilter === "all" && (
                  <>
                    {/* Web Templates Section */}
                    {categorized.web.length > 0 && (
                      <>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: isDarkMode
                              ? "var(--ion-color-step-600)"
                              : "var(--ion-color-step-500)",
                            padding: "8px 0",
                            borderBottom: `1px solid ${isDarkMode
                              ? "var(--ion-color-step-150)"
                              : "var(--ion-color-step-100)"
                              }`,
                            marginBottom: "16px",
                          }}
                        >
                          <IonIcon
                            icon={desktopOutline}
                            style={{ fontSize: "16px" }}
                          />
                          Web Templates ({categorized.web.length})
                        </div>
                        {categorized.web.map((template) =>
                          renderTemplateItem(template, "web")
                        )}
                        {(categorized.mobile.length > 0 ||
                          categorized.tablet.length > 0) && (
                            <div style={{ margin: "24px 0" }} />
                          )}
                      </>
                    )}

                    {/* Mobile Templates Section */}
                    {categorized.mobile.length > 0 && (
                      <>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: isDarkMode
                              ? "var(--ion-color-step-600)"
                              : "var(--ion-color-step-500)",
                            padding: "8px 0",
                            borderBottom: `1px solid ${isDarkMode
                              ? "var(--ion-color-step-150)"
                              : "var(--ion-color-step-100)"
                              }`,
                            marginBottom: "16px",
                          }}
                        >
                          <IonIcon
                            icon={phonePortraitOutline}
                            style={{ fontSize: "16px" }}
                          />
                          Mobile Templates ({categorized.mobile.length})
                        </div>
                        {categorized.mobile.map((template) =>
                          renderTemplateItem(template, "mobile")
                        )}
                        {categorized.tablet.length > 0 && (
                          <div style={{ margin: "24px 0" }} />
                        )}
                      </>
                    )}

                    {/* Tablet Templates Section */}
                    {categorized.tablet.length > 0 && (
                      <>
                        <div
                          style={{
                            fontSize: "14px",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            color: isDarkMode
                              ? "var(--ion-color-step-600)"
                              : "var(--ion-color-step-500)",
                            padding: "8px 0",
                            borderBottom: `1px solid ${isDarkMode
                              ? "var(--ion-color-step-150)"
                              : "var(--ion-color-step-100)"
                              }`,
                            marginBottom: "16px",
                          }}
                        >
                          <IonIcon
                            icon={tabletPortraitOutline}
                            style={{ fontSize: "16px" }}
                          />
                          Tablet Templates ({categorized.tablet.length})
                        </div>
                        {categorized.tablet.map((template) =>
                          renderTemplateItem(template, "tablet")
                        )}
                      </>
                    )}
                  </>
                )}

                {templateFilter !== "all" &&
                  filteredTemplates.map((template) =>
                    renderTemplateItem(template, "filtered")
                  )}
              </>
            )}
          </div>
        </IonContent>
      </IonModal>
    );
  };

  // Helper function to render individual template items
  const renderTemplateItem = (template: any, keyPrefix?: string) => {
    const metadata = getTemplateMetadata(
      template.templateId || template.template_id
    );
    const templateName =
      metadata?.name ||
      template.template ||
      template.name ||
      "Unknown Template";
    const category = categorizeTemplate(
      template.templateId || template.template_id
    );

    // Get the template data from DATA to access footers
    const templateData = DATA[template.templateId || template.template_id];
    const footers = templateData?.footers || [];

    return (
      <div
        key={
          keyPrefix
            ? `${keyPrefix}-${template.templateId || template.template_id}`
            : template.templateId || template.template_id
        }
        onClick={() => setShowSharedTemplateModal(true)}
        style={{
          border: `1px solid ${isDarkMode
            ? "var(--ion-color-step-200)"
            : "var(--ion-color-step-150)"
            }`,
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "12px",
          cursor: "pointer",
          backgroundColor: isDarkMode
            ? "var(--ion-color-step-50)"
            : "var(--ion-background-color)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          transition: "all 0.2s ease",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = isDarkMode
            ? "var(--ion-color-step-100)"
            : "var(--ion-color-step-50)";
          e.currentTarget.style.borderColor = isDarkMode
            ? "var(--ion-color-step-300)"
            : "var(--ion-color-step-200)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = isDarkMode
            ? "var(--ion-color-step-50)"
            : "var(--ion-background-color)";
          e.currentTarget.style.borderColor = isDarkMode
            ? "var(--ion-color-step-200)"
            : "var(--ion-color-step-150)";
        }}
      >
        {/* Template Image */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "6px",
            overflow: "hidden",
            backgroundColor: isDarkMode
              ? "var(--ion-color-step-100)"
              : "var(--ion-color-step-50)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: `1px solid ${isDarkMode
              ? "var(--ion-color-step-200)"
              : "var(--ion-color-step-150)"
              }`,
          }}
        >
          {metadata?.ImageUri ? (
            <img
              src={`data:image/png;base64,${metadata.ImageUri}`}
              alt={metadata.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <IonIcon
              icon={layers}
              style={{
                fontSize: "24px",
                color: isDarkMode
                  ? "var(--ion-color-step-400)"
                  : "var(--ion-color-step-500)",
              }}
            />
          )}
        </div>

        {/* Template Info */}
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: "0 0 4px 0",
              fontSize: "15px",
              fontWeight: "600",
              color: isDarkMode
                ? "var(--ion-color-step-750)"
                : "var(--ion-color-step-650)",
              lineHeight: "1.3",
            }}
          >
            {templateName}
          </h3>
          <p
            style={{
              margin: "0 0 6px 0",
              fontSize: "12px",
              color: isDarkMode
                ? "var(--ion-color-step-500)"
                : "var(--ion-color-step-450)",
              fontWeight: "400",
            }}
          >
            {footers.length} footer{footers.length !== 1 ? "s" : ""}
          </p>
          {/* Category Badge */}
          <div
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "4px",
              display: "inline-block",
              fontWeight: "500",
              letterSpacing: "0.3px",
              backgroundColor: isDarkMode
                ? "var(--ion-color-step-150)"
                : "var(--ion-color-step-100)",
              color: isDarkMode
                ? "var(--ion-color-step-600)"
                : "var(--ion-color-step-500)",
              border: `1px solid ${isDarkMode
                ? "var(--ion-color-step-200)"
                : "var(--ion-color-step-150)"
                }`,
              textTransform: "uppercase",
            }}
          >
            {category}
          </div>
        </div>

        {/* Arrow Icon */}
        <IonIcon
          icon={chevronForward}
          style={{
            fontSize: "18px",
            color: isDarkMode
              ? "var(--ion-color-step-400)"
              : "var(--ion-color-step-350)",
            opacity: 0.7,
          }}
        />
      </div>
    );
  };

  return (
    <IonPage className={isDarkMode ? "dark-theme" : ""}>
      <IonHeader className="files-modal-header">
        <IonToolbar style={{ minHeight: "56px", "--min-height": "56px" }}>
          <IonTitle
            className="files-modal-title"
            style={{
              fontSize: "21px",
              fontWeight: "400",
            }}
          >
            <img
              src="/favicon.png"
              alt="Invoice App"
              style={{
                width: "24px",
                height: "24px",
                objectFit: "contain",
              }}
            />{" "}
            Invoice App
          </IonTitle>
          <IonButtons slot="end">
            {activeTab === 'blockchain' && (
              <div style={{ marginRight: "8px" }}>
                <WalletConnect />
              </div>
            )}
            <IonButton
              fill="clear"
              onClick={toggleDarkMode}
              style={{ fontSize: "1.2em" }}
            >
              <IonIcon icon={isDarkMode ? sunny : moon} />
            </IonButton>
            <IonButton
              fill="clear"
              onClick={() => history.push("/app/settings")}
              style={{ fontSize: "1.2em" }}
            >
              <IonIcon icon={settings} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {/* Template Creation Section */}
        <div
          style={{
            padding: isSmallScreen ? "16px 16px 0 16px" : "16px",
            background: isDarkMode
              ? "var(--ion-color-step-50)"
              : "var(--ion-color-step-25)",
            borderBottom: `1px solid ${isDarkMode
              ? "var(--ion-color-step-200)"
              : "var(--ion-color-step-150)"
              }`,
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: isSmallScreen ? "16px" : "20px",
            }}
          >
            <h2
              style={{
                margin: "0",
                fontSize: isSmallScreen ? "18px" : "20px",
                fontWeight: "600",
                color: "var(--ion-color-dark)",
              }}
            >
              Create New File
            </h2>
          </div>

          {/* Desktop: Template Cards - Show only first 3 */}
          {!isSmallScreen && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "16px",
                  marginBottom: "16px",
                  maxWidth: "1200px",
                  margin: "0 auto 16px auto",
                }}
              >
                {getAvailableTemplates()
                  .slice(0, 3)
                  .map((template) => {
                    const metadata = getTemplateMetadata(template.templateId);
                    return (
                      <div
                        key={template.templateId}
                        onClick={() =>
                          handleTemplateSelect(template.templateId)
                        }
                        style={{
                          border: "2px solid var(--ion-color-light)",
                          borderRadius: "12px",
                          padding: "20px",
                          cursor: "pointer",
                          transition: "all 0.3s ease",
                          backgroundColor: "var(--ion-color-light-tint)",
                          display: "flex",
                          alignItems: "center",
                          gap: "16px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor =
                            "var(--ion-color-primary)";
                          e.currentTarget.style.transform = "translateY(-4px)";
                          e.currentTarget.style.boxShadow =
                            "0 8px 24px rgba(0,0,0,0.15)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor =
                            "var(--ion-color-light)";
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 2px 8px rgba(0,0,0,0.1)";
                        }}
                      >
                        {/* Template Image */}
                        <div
                          style={{
                            width: "80px",
                            height: "80px",
                            borderRadius: "8px",
                            overflow: "hidden",
                            backgroundColor: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            border: "1px solid var(--ion-color-medium-tint)",
                          }}
                        >
                          {metadata?.ImageUri ? (
                            <img
                              src={`data:image/png;base64,${metadata.ImageUri}`}
                              alt={metadata.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            <IonIcon
                              icon={layers}
                              style={{
                                fontSize: "32px",
                                color: "var(--ion-color-medium)",
                              }}
                            />
                          )}
                        </div>

                        {/* Template Info */}
                        <div style={{ flex: 1 }}>
                          <h3
                            style={{
                              margin: "0 0 8px 0",
                              fontSize: "18px",
                              fontWeight: "600",
                              color: "var(--ion-color-dark)",
                            }}
                          >
                            {metadata?.name || template.template}
                          </h3>
                          <p
                            style={{
                              margin: "0",
                              fontSize: "14px",
                              color: "var(--ion-color-medium)",
                            }}
                          >
                            {template.footers.length} footer(s)
                          </p>
                        </div>

                        {/* Arrow Icon */}
                        <IonIcon
                          icon={chevronForward}
                          style={{
                            fontSize: "20px",
                            color: "var(--ion-color-medium)",
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    );
                  })}

                {/* Plus icon card to show more templates */}
                <div
                  onClick={() => setShowSharedTemplateModal(true)}
                  style={{
                    border: "2px dashed var(--ion-color-light)",
                    borderRadius: "12px",
                    padding: "20px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    backgroundColor: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "16px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor =
                      "var(--ion-color-primary)";
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 24px rgba(0,0,0,0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor =
                      "var(--ion-color-light)";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 2px 8px rgba(0,0,0,0.05)";
                  }}
                >
                  {/* Plus Icon */}
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "8px",
                      backgroundColor: "var(--ion-color-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      border: "1px solid var(--ion-color-medium-tint)",
                    }}
                  >
                    <IonIcon
                      icon={add}
                      style={{
                        fontSize: "40px",
                        color: "var(--ion-color-medium)",
                      }}
                    />
                  </div>

                  {/* More Info */}
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "var(--ion-color-dark)",
                      }}
                    >
                      More Templates
                    </h3>
                    <p
                      style={{
                        margin: "0",
                        fontSize: "14px",
                        color: "var(--ion-color-medium)",
                      }}
                    >
                      View all available templates
                    </p>
                  </div>

                  {/* Arrow Icon */}
                  <IonIcon
                    icon={chevronForward}
                    style={{
                      fontSize: "20px",
                      color: "var(--ion-color-medium)",
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Mobile: Show template previews */}
          {isSmallScreen && (
            <div
              className="template-preview-scroll"
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                paddingBottom: "16px",
                paddingRight: "4px", // Add some padding for scroll
              }}
            >
              {getAvailableTemplates()
                .slice(0, 3)
                .map((template) => {
                  const metadata = getTemplateMetadata(template.templateId);
                  return (
                    <div
                      key={template.templateId}
                      onClick={() => handleTemplateSelect(template.templateId)}
                      style={{
                        minWidth: "110px",
                        width: "110px",
                        border: `1px solid ${isDarkMode
                          ? "var(--ion-color-step-200)"
                          : "var(--ion-color-step-150)"
                          }`,
                        borderRadius: "8px",
                        padding: "12px",
                        cursor: "pointer",
                        backgroundColor: isDarkMode
                          ? "var(--ion-color-step-50)"
                          : "var(--ion-background-color)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        transition: "all 0.2s ease",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                        flexShrink: 0, // Prevent cards from shrinking
                      }}
                    >
                      {/* Template Image */}
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "6px",
                          overflow: "hidden",
                          backgroundColor: isDarkMode
                            ? "var(--ion-color-step-100)"
                            : "var(--ion-color-step-50)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: `1px solid ${isDarkMode
                            ? "var(--ion-color-step-200)"
                            : "var(--ion-color-step-150)"
                            }`,
                        }}
                      >
                        {metadata?.ImageUri ? (
                          <img
                            src={`data:image/png;base64,${metadata.ImageUri}`}
                            alt={metadata.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <IonIcon
                            icon={layers}
                            style={{
                              fontSize: "22px",
                              color: isDarkMode
                                ? "var(--ion-color-step-400)"
                                : "var(--ion-color-step-500)",
                            }}
                          />
                        )}
                      </div>

                      {/* Template Name */}
                      <div style={{ textAlign: "center", width: "100%" }}>
                        <h4
                          style={{
                            margin: "0",
                            fontSize: "11px",
                            fontWeight: "600",
                            color: isDarkMode
                              ? "var(--ion-color-step-700)"
                              : "var(--ion-color-step-600)",
                            lineHeight: "1.2",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {metadata?.name || template.template}
                        </h4>
                      </div>
                    </div>
                  );
                })}

              {/* Plus icon card to show more templates */}
              <div
                onClick={() => setShowSharedTemplateModal(true)}
                style={{
                  minWidth: "110px",
                  width: "110px",
                  border: `2px dashed ${isDarkMode
                    ? "var(--ion-color-step-300)"
                    : "var(--ion-color-step-200)"
                    }`,
                  borderRadius: "8px",
                  padding: "12px",
                  cursor: "pointer",
                  backgroundColor: "transparent",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                  flexShrink: 0, // Prevent card from shrinking
                }}
              >
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isDarkMode
                      ? "var(--ion-color-step-100)"
                      : "var(--ion-color-step-50)",
                  }}
                >
                  <IonIcon
                    icon={add}
                    style={{
                      fontSize: "28px",
                      color: isDarkMode
                        ? "var(--ion-color-step-500)"
                        : "var(--ion-color-step-400)",
                    }}
                  />
                </div>

                <div style={{ textAlign: "center", width: "100%" }}>
                  <h4
                    style={{
                      margin: "0",
                      fontSize: "11px",
                      fontWeight: "600",
                      color: isDarkMode
                        ? "var(--ion-color-step-600)"
                        : "var(--ion-color-step-500)",
                      lineHeight: "1.2",
                    }}
                  >
                    More
                  </h4>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Segment */}
        <div
          style={{
            padding: "16px 16px 0 16px",
            background: isDarkMode
              ? "var(--ion-color-step-50)"
              : "var(--ion-background-color)",
          }}
        >
          <IonSegment
            value={activeTab}
            onIonChange={(e) => setActiveTab(e.detail.value as 'files' | 'blockchain')}
            style={{
              background: isDarkMode
                ? "var(--ion-color-step-150)"
                : "var(--ion-color-step-50)",
              borderRadius: "8px",
              padding: "4px",
              maxWidth: "400px",
              margin: "0 auto",
            }}
          >
            <IonSegmentButton value="files">
              <IonLabel>
                <IonIcon icon={documentText} style={{ marginRight: "8px" }} />
                Local Files
              </IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="blockchain">
              <IonLabel>
                <IonIcon icon={walletOutline} style={{ marginRight: "8px" }} />
                Blockchain Invoices
              </IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'files' && (
          <Files
            store={store}
            file={selectedFile}
            updateSelectedFile={updateSelectedFile}
            updateBillType={updateBillType}
          />
        )}

        {activeTab === 'blockchain' && (
          <div style={{ padding: "16px" }}>
            {!isConnected ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: "var(--ion-color-medium)",
                }}
              >
                <IonIcon
                  icon={walletOutline}
                  style={{
                    fontSize: "64px",
                    marginBottom: "16px",
                    display: "block",
                    opacity: 0.4,
                    color: "var(--ion-color-medium)",
                  }}
                />
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "var(--ion-color-medium)",
                  }}
                >
                  Connect Your Wallet
                </h3>
                <p style={{ margin: "0 0 24px 0", fontSize: "14px", opacity: 0.8 }}>
                  Connect your wallet to view your blockchain invoices
                </p>
                <WalletConnect />
              </div>
            ) : (
              <>
                {isLoadingInvoices ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <IonSpinner name="crescent" />
                    <p style={{ marginTop: "16px", color: "var(--ion-color-medium)" }}>
                      Loading invoices...
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Created Invoices Section */}
                    <div style={{ marginBottom: "24px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "12px",
                          gap: "8px",
                        }}
                      >
                        <IonIcon
                          icon={receiptOutline}
                          style={{
                            fontSize: "20px",
                            color: "var(--ion-color-primary)",
                          }}
                        />
                        <h2
                          style={{
                            margin: "0",
                            fontSize: "18px",
                            fontWeight: "600",
                            color: isDarkMode
                              ? "var(--ion-color-step-750)"
                              : "var(--ion-color-step-650)",
                          }}
                        >
                          Created Invoices
                        </h2>
                        <IonBadge color="primary">{createdInvoices.length}</IonBadge>
                      </div>

                      {createdInvoices.length === 0 ? (
                        <IonCard>
                          <IonCardContent style={{ textAlign: "center", padding: "32px 20px" }}>
                            <IonIcon
                              icon={documentText}
                              style={{
                                fontSize: "48px",
                                opacity: 0.3,
                                color: "var(--ion-color-medium)",
                              }}
                            />
                            <p
                              style={{
                                margin: "12px 0 0 0",
                                color: "var(--ion-color-medium)",
                                fontSize: "14px",
                              }}
                            >
                              No invoices created yet
                            </p>
                          </IonCardContent>
                        </IonCard>
                      ) : (
                        <div style={{ display: "grid", gap: "12px" }}>
                          {createdInvoices.map((invoice) => (
                            <IonCard
                              key={invoice.id}
                              button
                              onClick={() => history.push(`/app/invoice/${invoice.id}`)}
                              style={{
                                margin: "0",
                                cursor: "pointer",
                                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                              }}
                            >
                              <IonCardContent>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                                    <div
                                      style={{
                                        width: "40px",
                                        height: "40px",
                                        borderRadius: "8px",
                                        background: invoice.paid ? "var(--ion-color-success)" : "var(--ion-color-primary)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <IonIcon
                                        icon={invoice.paid ? checkmarkCircle : receiptOutline}
                                        style={{ fontSize: "20px", color: "white" }}
                                      />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <h3
                                        style={{
                                          margin: "0 0 4px 0",
                                          fontSize: "16px",
                                          fontWeight: "600",
                                        }}
                                      >
                                        Invoice #{invoice.id}
                                      </h3>
                                      <p
                                        style={{
                                          margin: "0 0 4px 0",
                                          fontSize: "13px",
                                          color: "var(--ion-color-medium)",
                                        }}
                                      >
                                        {formatUnits(invoice.amount, 6)} PYUSD
                                      </p>
                                      <p
                                        style={{
                                          margin: "0",
                                          fontSize: "12px",
                                          color: invoice.paid ? "var(--ion-color-success)" : "var(--ion-color-warning)",
                                          fontWeight: "600",
                                        }}
                                      >
                                        {invoice.paid ? "PAID" : "UNPAID"}
                                        {invoice.paid && invoice.paymentTxHash && invoice.paymentTxHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                                          <a
                                            href={`https://sepolia.etherscan.io/tx/${invoice.paymentTxHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              marginLeft: "8px",
                                              color: "var(--ion-color-primary)",
                                              textDecoration: "none",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "2px",
                                            }}
                                          >
                                            <IonIcon icon={openOutline} style={{ fontSize: "14px" }} />
                                          </a>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <IonIcon
                                    icon={chevronForward}
                                    style={{
                                      fontSize: "20px",
                                      color: "var(--ion-color-medium)",
                                    }}
                                  />
                                </div>
                              </IonCardContent>
                            </IonCard>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Paid Invoices Section */}
                    <div style={{ marginBottom: "24px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "12px",
                          gap: "8px",
                        }}
                      >
                        <IonIcon
                          icon={checkmarkCircle}
                          style={{
                            fontSize: "20px",
                            color: "var(--ion-color-success)",
                          }}
                        />
                        <h2
                          style={{
                            margin: "0",
                            fontSize: "18px",
                            fontWeight: "600",
                            color: isDarkMode
                              ? "var(--ion-color-step-750)"
                              : "var(--ion-color-step-650)",
                          }}
                        >
                          Paid Invoices
                        </h2>
                        <IonBadge color="success">{paidInvoices.length}</IonBadge>
                      </div>

                      {paidInvoices.length === 0 ? (
                        <IonCard>
                          <IonCardContent style={{ textAlign: "center", padding: "32px 20px" }}>
                            <IonIcon
                              icon={cashOutline}
                              style={{
                                fontSize: "48px",
                                opacity: 0.3,
                                color: "var(--ion-color-medium)",
                              }}
                            />
                            <p
                              style={{
                                margin: "12px 0 0 0",
                                color: "var(--ion-color-medium)",
                                fontSize: "14px",
                              }}
                            >
                              No invoices paid yet
                            </p>
                          </IonCardContent>
                        </IonCard>
                      ) : (
                        <div style={{ display: "grid", gap: "12px" }}>
                          {paidInvoices.map((invoice) => (
                            <IonCard
                              key={invoice.id}
                              button
                              onClick={() => history.push(`/app/invoice/${invoice.id}`)}
                              style={{
                                margin: "0",
                                cursor: "pointer",
                                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                              }}
                            >
                              <IonCardContent>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                                    <div
                                      style={{
                                        width: "40px",
                                        height: "40px",
                                        borderRadius: "8px",
                                        background: "var(--ion-color-success)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <IonIcon
                                        icon={checkmarkCircle}
                                        style={{ fontSize: "20px", color: "white" }}
                                      />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <h3
                                        style={{
                                          margin: "0 0 4px 0",
                                          fontSize: "16px",
                                          fontWeight: "600",
                                        }}
                                      >
                                        Invoice #{invoice.id}
                                      </h3>
                                      <p
                                        style={{
                                          margin: "0 0 4px 0",
                                          fontSize: "13px",
                                          color: "var(--ion-color-medium)",
                                        }}
                                      >
                                        {formatUnits(invoice.amount, 6)} PYUSD
                                      </p>
                                      <p
                                        style={{
                                          margin: "0",
                                          fontSize: "12px",
                                          color: "var(--ion-color-success)",
                                          fontWeight: "600",
                                        }}
                                      >
                                        PAID BY YOU
                                        {invoice.paymentTxHash && invoice.paymentTxHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                                          <a
                                            href={`https://sepolia.etherscan.io/tx/${invoice.paymentTxHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              marginLeft: "8px",
                                              color: "var(--ion-color-primary)",
                                              textDecoration: "none",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "2px",
                                            }}
                                          >
                                            <IonIcon icon={openOutline} style={{ fontSize: "14px" }} />
                                          </a>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <IonIcon
                                    icon={chevronForward}
                                    style={{
                                      fontSize: "20px",
                                      color: "var(--ion-color-medium)",
                                    }}
                                  />
                                </div>
                              </IonCardContent>
                            </IonCard>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Template Modal */}
        <TemplateModal
          isOpen={showSharedTemplateModal}
          onClose={() => setShowSharedTemplateModal(false)}
          onFileCreated={(fileName, templateId) => {
            setToastMessage(`File "${fileName}" created successfully!`);
            setShowToast(true);
          }}
        />
      </IonContent>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        color={toastMessage.includes("successfully") ? "success" : "warning"}
        position="top"
      />

      {/* File Name Prompt */}
      <IonAlert
        isOpen={showFileNamePrompt}
        onDidDismiss={() => {
          setShowFileNamePrompt(false);
          setSelectedTemplateForFile(null);
          setNewFileName("");
        }}
        header="Create New File"
        message="Enter a name for your new file:"
        inputs={[
          {
            name: "fileName",
            type: "text",
            placeholder: "File name",
            value: newFileName,
          },
        ]}
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => {
              setShowFileNamePrompt(false);
              setSelectedTemplateForFile(null);
              setNewFileName("");
            },
          },
          {
            text: "Create",
            handler: async (data) => {
              if (data.fileName && selectedTemplateForFile !== null) {
                await createNewFileWithTemplate(
                  selectedTemplateForFile,
                  data.fileName
                );
              }
            },
          },
        ]}
      />
    </IonPage>
  );
};

export default FilesPage;
