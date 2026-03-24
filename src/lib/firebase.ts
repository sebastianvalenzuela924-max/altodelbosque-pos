import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  query, 
  orderBy, 
  increment, 
  serverTimestamp, 
  deleteDoc 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'mock-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'smartsale-pos-dev',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

export type Product = {
  id: string; // Barcode EAN-13
  name: string;
  price: number;
  stock: number;
  category?: string;
};

export type SaleItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
};

export type ManualProduct = {
  description: string;
  amount: number;
};

export type Sale = {
  id?: string;
  timestamp: any;
  total: number;
  items: SaleItem[];
  manualProducts: ManualProduct[];
};

export const productsRef = collection(db, 'productos');
export const salesRef = collection(db, 'ventas');

export async function getProducts(): Promise<Product[]> {
  const snapshot = await getDocs(query(productsRef, orderBy('name')));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
}

export async function updateProduct(id: string, data: Partial<Product>) {
  const docRef = doc(db, 'productos', id);
  await setDoc(docRef, data, { merge: true });
}

export async function deleteProduct(id: string) {
  const docRef = doc(db, 'productos', id);
  await deleteDoc(docRef);
}

export async function finalizeSale(sale: Omit<Sale, 'id' | 'timestamp'>) {
  // 1. Save Sale
  const saleData = {
    ...sale,
    timestamp: serverTimestamp(),
  };
  const docRef = await addDoc(salesRef, saleData);

  // 2. Update Stocks
  for (const item of sale.items) {
    const productRef = doc(db, 'productos', item.id);
    const prodSnap = await getDoc(productRef);
    if (prodSnap.exists()) {
      await updateDoc(productRef, {
        stock: increment(-item.quantity)
      });
    }
  }
  
  return docRef.id;
}
