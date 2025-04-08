'use client';

import Link from 'next/link';
import { useListings } from '@/context/ListingContext'; // Assuming useListings includes role and balance
import { useEffect, useState } from 'react';

export default function Header() {
  const { user, role, buyerBalance, sellerBalance, logout } = useListings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="bg-pink-600 text-white px-6 py-4 flex justify-between items-center">
      <Link href="/" className="text-2xl font-bold">PantyPost</Link>

      <nav className="flex items-center gap-6">
        <Link href="/browse">Browse</Link>
        <Link href="/sellers/my-listings">My Listings</Link>
        <Link href="/wallet/seller">Wallet</Link>
        <Link href="/login">Login</Link>

        {mounted && user && (
          <div className="flex items-center gap-4">
            <span className="font-semibold">{user} ({role})</span>
            {role === 'buyer' && (
              <>
                <span>💰 ${buyerBalance}</span>
                {/* Add link to 'My Orders' page for buyers */}
                <Link href="/buyers/my-orders" className="ml-4 text-white underline">My Orders</Link>
              </>
            )}
            {role === 'seller' && <span>💼 ${sellerBalance}</span>}
            <button
              onClick={logout}
              className="ml-2 bg-white text-pink-600 px-2 py-1 rounded"
            >
              Log out
            </button>
          </div>
        )}
      </nav>
    </header>
  );
}
