"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type Order = {
  id: string;
  title: string;
  description: string;
  price: number;
  markedUpPrice: number;
  imageUrl?: string; // This is where the first image URL will be stored
  date: string;
  seller: string;
  buyer: string;
  tags?: string[];
  wearTime?: string; // Note: This seems to correspond to 'hoursWorn' in Listing type
};

type Withdrawal = {
  amount: number;
  date: string;
};

type WalletContextType = {
  buyerBalances: { [username: string]: number };
  adminBalance: number;
  sellerBalances: { [username: string]: number };
  setBuyerBalance: (username: string, balance: number) => void;
  getBuyerBalance: (username: string) => number;
  setAdminBalance: (balance: number) => void;
  setSellerBalance: (seller: string, balance: number) => void;
  getSellerBalance: (seller: string) => number;
  // Updated type to expect the full Listing object
  purchaseListing: (listing: any, buyerUsername: string) => boolean; // Using 'any' temporarily for simplicity, ideally define a specific type if Listing is not directly usable
  subscribeToSellerWithPayment: (
    buyer: string,
    seller: string,
    amount: number
  ) => boolean;
  orderHistory: Order[];
  addOrder: (order: Order) => void;
  sellerWithdrawals: { [username: string]: Withdrawal[] };
  adminWithdrawals: Withdrawal[];
  addSellerWithdrawal: (username: string, amount: number) => void;
  addAdminWithdrawal: (amount: number) => void;
  wallet: { [username: string]: number };
  updateWallet: (username: string, amount: number, orderToFulfil?: Order) => void;
  sendTip: (buyer: string, seller: string, amount: number) => boolean;
  setAddSellerNotificationCallback?: (fn: (seller: string, message: string) => void) => void;
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [buyerBalances, setBuyerBalancesState] = useState<{ [username: string]: number }>({});
  const [adminBalance, setAdminBalanceState] = useState<number>(0);
  const [sellerBalances, setSellerBalancesState] = useState<{ [username: string]: number }>({});
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [sellerWithdrawals, setSellerWithdrawals] = useState<{ [username: string]: Withdrawal[] }>({});
  const [adminWithdrawals, setAdminWithdrawals] = useState<Withdrawal[]>([]);

  // Notification callback injected by ListingContext
  const [addSellerNotification, setAddSellerNotification] = useState<((seller: string, message: string) => void) | null>(null);

  // Allow ListingContext to inject the notification function
  const setAddSellerNotificationCallback = (fn: (seller: string, message: string) => void) => {
    setAddSellerNotification(() => fn);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const buyers = localStorage.getItem("wallet_buyers");
    const admin = localStorage.getItem("wallet_admin");
    const sellers = localStorage.getItem("wallet_sellers");
    const orders = localStorage.getItem("wallet_orders");
    const sellerWds = localStorage.getItem("wallet_sellerWithdrawals");
    const adminWds = localStorage.getItem("wallet_adminWithdrawals");

    if (buyers) setBuyerBalancesState(JSON.parse(buyers));
    if (admin) setAdminBalanceState(parseFloat(admin));
    if (sellers) setSellerBalancesState(JSON.parse(sellers));
    if (orders) setOrderHistory(JSON.parse(orders));
    if (sellerWds) setSellerWithdrawals(JSON.parse(sellerWds));
    if (adminWds) setAdminWithdrawals(JSON.parse(adminWds));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("wallet_buyers", JSON.stringify(buyerBalances));
  }, [buyerBalances]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("wallet_admin", adminBalance.toString());
  }, [adminBalance]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("wallet_sellers", JSON.stringify(sellerBalances));
  }, [sellerBalances]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("wallet_orders", JSON.stringify(orderHistory));
  }, [orderHistory]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("wallet_sellerWithdrawals", JSON.stringify(sellerWithdrawals));
  }, [sellerWithdrawals]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem("wallet_adminWithdrawals", JSON.stringify(adminWithdrawals));
  }, [adminWithdrawals]);

  const getBuyerBalance = (username: string): number => {
    return buyerBalances[username] || 0;
  };

  const setBuyerBalance = (username: string, balance: number) => {
    setBuyerBalancesState((prev) => ({
      ...prev,
      [username]: balance,
    }));
  };

  const getSellerBalance = (seller: string): number => {
    return sellerBalances[seller] || 0;
  };

  const setSellerBalance = (seller: string, balance: number) => {
    setSellerBalancesState((prev) => ({
      ...prev,
      [seller]: balance,
    }));
  };

  const setAdminBalance = (balance: number) => {
    setAdminBalanceState(balance);
  };

  const addOrder = (order: Order) => {
    setOrderHistory((prev) => [...prev, order]);
  };

  // Modified purchaseListing to save the image URL
  const purchaseListing = (listing: any, buyerUsername: string): boolean => {
    const price = (listing.markedUpPrice !== undefined && listing.markedUpPrice !== null)
      ? listing.markedUpPrice
      : listing.price;

    const seller = listing.seller;
    const sellerCut = listing.price * 0.9;
    const platformCut = price - sellerCut;
    const currentBuyerBalance = getBuyerBalance(buyerUsername);

    if (currentBuyerBalance < price) {
      return false;
    }

    // Transaction Locking
    const transactionLockKey = `transaction_lock_${buyerUsername}_${seller}`;
    if (localStorage.getItem(transactionLockKey)) {
      return false; // Transaction is already in progress
    }
    localStorage.setItem(transactionLockKey, 'locked');

    try {
      // Input Validation
      if (price <= 0 || !listing.title || !listing.id || !seller) {
        return false;
      }

      setBuyerBalance(buyerUsername, currentBuyerBalance - price);

      setSellerBalancesState((prev) => ({
        ...prev,
        [seller]: (prev[seller] || 0) + sellerCut,
      }));

      updateWallet('oakley', platformCut);

      const order: Order = {
        ...listing,
        buyer: buyerUsername,
        date: new Date().toISOString(),
        imageUrl: listing.imageUrls?.[0] || undefined, // Explicitly add the first image URL
        // Note: 'wearTime' in Order type seems to correspond to 'hoursWorn' in Listing type.
        // If you need hoursWorn in the order, you might need to map it explicitly too.
        // For now, keeping it as is based on the original Order type.
      } as Order;

      addOrder(order);

      const displayPrice = (listing.markedUpPrice !== undefined && listing.markedUpPrice !== null)
        ? listing.markedUpPrice.toFixed(2)
        : listing.price.toFixed(2);

      if (addSellerNotification) {
        addSellerNotification(
          seller,
          `💸 New sale: "${listing.title}" for $${displayPrice}`
        );
      }

      return true;
    } finally {
      localStorage.removeItem(transactionLockKey);
    }
  };

  const subscribeToSellerWithPayment = (
    buyer: string,
    seller: string,
    amount: number
  ): boolean => {
    if (!buyer || !seller || amount <= 0) {
      return false;
    }

    const transactionLockKey = `subscription_lock_${buyer}_${seller}`;
    if (localStorage.getItem(transactionLockKey)) {
      return false;
    }
    localStorage.setItem(transactionLockKey, 'locked');

    try {
      const buyerBalance = getBuyerBalance(buyer);
      if (buyerBalance < amount) {
        return false;
      }

      const sellerCut = amount * 0.75;
      const adminCut = amount * 0.25;

      setBuyerBalance(buyer, buyerBalance - amount);
      setSellerBalance(seller, getSellerBalance(seller) + sellerCut);

      updateWallet('oakley', adminCut);

      if (addSellerNotification) {
        addSellerNotification(
          seller,
          `💰 New subscriber: ${buyer} paid $${amount.toFixed(2)}/month`
        );
      }

      return true;
    } finally {
      localStorage.removeItem(transactionLockKey);
    }
  };

  const addSellerWithdrawal = (username: string, amount: number) => {
    if (!username || amount <= 0) {
      throw new Error("Invalid withdrawal parameters");
    }

    const currentBalance = getSellerBalance(username);
    if (currentBalance < amount) {
      throw new Error("Insufficient balance for withdrawal");
    }

    const withdrawalLockKey = `withdrawal_lock_${username}`;
    if (localStorage.getItem(withdrawalLockKey)) {
      throw new Error("Another withdrawal is in progress");
    }
    localStorage.setItem(withdrawalLockKey, 'locked');

    try {
      const date = new Date().toISOString();
      setSellerWithdrawals((prev) => ({
        ...prev,
        [username]: [...(prev[username] || []), { amount, date }],
      }));
      setSellerBalance(username, currentBalance - amount);
    } finally {
      localStorage.removeItem(withdrawalLockKey);
    }
  };

  const addAdminWithdrawal = (amount: number) => {
    if (amount <= 0) {
      throw new Error("Invalid withdrawal amount");
    }

    if (adminBalance < amount) {
      throw new Error("Insufficient admin balance for withdrawal");
    }

    const adminWithdrawalLockKey = 'admin_withdrawal_lock';
    if (localStorage.getItem(adminWithdrawalLockKey)) {
      throw new Error("Another admin withdrawal is in progress");
    }
    localStorage.setItem(adminWithdrawalLockKey, 'locked');

    try {
      const date = new Date().toISOString();
      setAdminWithdrawals((prev) => [...prev, { amount, date }]);
      setAdminBalanceState((prev) => prev - amount);
    } finally {
      localStorage.removeItem(adminWithdrawalLockKey);
    }
  };

  const wallet: { [username: string]: number } = {
    ...buyerBalances,
    ...sellerBalances,
    oakley: adminBalance,
    gerome: adminBalance,
    admin: adminBalance,
  };

  const updateWallet = (username: string, amount: number, orderToFulfil?: Order) => {
    if (["oakley", "gerome", "admin"].includes(username)) {
      setAdminBalanceState((prev) => prev + amount);
    } else if (username in sellerBalances || (orderToFulfil && orderToFulfil.seller === username)) {
      setSellerBalance(username, (sellerBalances[username] || 0) + amount);
      if (orderToFulfil) {
        addOrder(orderToFulfil);
        if (addSellerNotification) {
          addSellerNotification(
            username,
            `🛒 New custom order to fulfil: "${orderToFulfil.title}" for $${orderToFulfil.price.toFixed(2)}`
          );
        }
      }
    } else if (username in buyerBalances) {
      setBuyerBalance(username, (buyerBalances[username] || 0) + amount);
    } else {
      if (amount > 0) {
        setSellerBalance(username, (sellerBalances[username] || 0) + amount);
        if (orderToFulfil) {
          addOrder(orderToFulfil);
          if (addSellerNotification) {
            addSellerNotification(
              username,
              `🛒 New custom order to fulfil: "${orderToFulfil.title}" for $${orderToFulfil.price.toFixed(2)}`
            );
          }
        }
      } else {
        setBuyerBalance(username, (buyerBalances[username] || 0) + amount);
      }
    }
  };

  // --- TIP LOGIC WITH NOTIFICATION ---
  const sendTip = (buyer: string, seller: string, amount: number): boolean => {
    if (!buyer || !seller || amount <= 0) return false;
    const buyerBalance = getBuyerBalance(buyer);
    if (buyerBalance < amount) return false;

    setBuyerBalance(buyer, buyerBalance - amount);
    setSellerBalance(seller, getSellerBalance(seller) + amount);

    // Add notification for the seller
    if (addSellerNotification) {
      addSellerNotification(
        seller,
        `💸 Tip received from ${buyer} - $${amount.toFixed(2)}`
      );
    }

    return true;
  };

  return (
    <WalletContext.Provider
      value={{
        buyerBalances,
        adminBalance,
        sellerBalances,
        setBuyerBalance,
        getBuyerBalance,
        setAdminBalance,
        setSellerBalance,
        getSellerBalance,
        purchaseListing,
        subscribeToSellerWithPayment,
        orderHistory,
        addOrder,
        sellerWithdrawals,
        adminWithdrawals,
        addSellerWithdrawal,
        addAdminWithdrawal,
        wallet,
        updateWallet,
        sendTip,
        setAddSellerNotificationCallback,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
