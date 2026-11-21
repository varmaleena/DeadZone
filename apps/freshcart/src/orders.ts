import type { CartItem } from './cart';
import { getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  doc,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
} from 'firebase/firestore';

const env = import.meta.env;
const ORDERS_KEY = 'freshcart-orders';

export interface LocalOrder {
  id: string;
  createdAt: number;
  address: string[];
  status: string;
  items?: CartItem[];
  /** True once the order has been written to Firestore. */
  uploaded?: boolean;
}

function initialize() {
  if (!env.VITE_FIREBASE_PROJECT_ID || !env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_APP_ID) {
    throw new Error('Firebase configuration is missing. Your order remains saved locally.');
  }
  const app =
    getApps()[0] ??
    initializeApp({
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      apiKey: env.VITE_FIREBASE_API_KEY,
      appId: env.VITE_FIREBASE_APP_ID,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    });
  // App Check keeps order writes working when enforcement is turned on for Firestore.
  // Add the FreshCart domains to the reCAPTCHA Enterprise key before enabling enforcement.
  if (env.VITE_RECAPTCHA_SITE_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  }
  return {
    auth: getAuth(app),
    db: initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }),
  };
}

let services: ReturnType<typeof initialize> | undefined;

/**
 * Saves the order on this device first, so it survives going offline.
 * "queued" orders are sent to Firestore by syncOrders; "placed" orders were confirmed by the server.
 */
export function queueOrder(
  address: string[],
  items: CartItem[] = [],
  status: 'queued' | 'placed' = 'queued',
): LocalOrder {
  const order = { id: crypto.randomUUID(), createdAt: Date.now(), address, items, status };
  const orders = readOrders();
  orders.push(order);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  return order;
}

/** Simulated order service: the store needs a few seconds to accept an order. */
export const ORDER_PROCESSING_MS = 6000;

/** Marks a locally saved order as accepted by the store. */
export function markPlaced(id: string) {
  const orders = readOrders();
  const order = orders.find((o) => o.id === id);
  if (order) {
    order.status = 'placed';
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }
}

/**
 * Sends one order to the store. Waits for the (simulated) processing time first; if the
 * connection is lost at any point the request fails and the caller decides what to do.
 */
export async function submitOrder(): Promise<void> {
  if (!navigator.onLine) throw new Error('offline');
  await new Promise((resolve) => setTimeout(resolve, ORDER_PROCESSING_MS));
  if (!navigator.onLine) throw new Error('offline');
  const response = await fetch('/api/products.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Order service unavailable');
}

export function readOrders(): LocalOrder[] {
  try {
    const values = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
    return Array.isArray(values) ? values : [];
  } catch {
    return [];
  }
}

let syncing = false;

/** Sends queued orders to Firestore. Each order has a stable ID, so retries are safe. */
export async function syncOrders() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const client = (services ??= initialize());
    const user = client.auth.currentUser ?? (await signInAnonymously(client.auth)).user;
    for (const order of readOrders().filter((o) => !o.uploaded)) {
      await setDoc(doc(client.db, 'freshcart_orders', order.id), {
        ownerUid: user.uid,
        address: order.address,
        items: order.items || [],
        createdAt: order.createdAt,
        status: 'queued',
      });
      const current = readOrders();
      const index = current.findIndex((o) => o.id === order.id);
      if (index >= 0) {
        current[index].uploaded = true;
        localStorage.setItem(ORDERS_KEY, JSON.stringify(current));
      }
    }
  } finally {
    syncing = false;
  }
}

export function startOrderSync(onError: (error: unknown) => void) {
  const sync = () => {
    void syncOrders().catch(onError);
  };
  window.addEventListener('online', sync);
  sync();
  return () => window.removeEventListener('online', sync);
}
