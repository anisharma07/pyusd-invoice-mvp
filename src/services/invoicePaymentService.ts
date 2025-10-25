import { db } from '../config/firebase';
import { collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface InvoicePayment {
    invoiceId: string;
    txHash: string;
    paidBy: string;
    amount: string;
    timestamp: string;
    createdAt?: string;
    updatedAt?: string;
}

const COLLECTION_NAME = 'invoice_payments';

export async function saveInvoicePayment(payment: Omit<InvoicePayment, 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
        const docRef = doc(db, COLLECTION_NAME, payment.invoiceId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // Update existing payment
            await updateDoc(docRef, {
                txHash: payment.txHash,
                paidBy: payment.paidBy,
                amount: payment.amount,
                timestamp: payment.timestamp,
                updatedAt: new Date().toISOString(),
            });
        } else {
            // Create new payment record
            await setDoc(docRef, {
                ...payment,
                createdAt: new Date().toISOString(),
            });
        }

        console.log('Payment saved to Firebase successfully');
    } catch (error: any) {
        console.error('Error saving invoice payment to Firebase:', error);
        throw error;
    }
}

export async function getInvoicePayment(invoiceId: string): Promise<InvoicePayment | null> {
    try {
        const docRef = doc(db, COLLECTION_NAME, invoiceId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as InvoicePayment;
        } else {
            console.log('No payment found in Firebase for invoice:', invoiceId);
            return null;
        }
    } catch (error: any) {
        console.error('Error fetching invoice payment from Firebase:', error);
        return null;
    }
}
