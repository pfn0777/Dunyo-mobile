import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav.tsx';
import { RequireAuth } from './components/RequireAuth.tsx';
import { RequireSubscription } from './components/RequireSubscription.tsx';
import { Home } from './pages/Home.tsx';
import { Catalog } from './pages/Catalog.tsx';
import { Products } from './pages/Products.tsx';
import { Favorites } from './pages/Favorites.tsx';
import { Cart } from './pages/Cart.tsx';
import { Checkout } from './pages/Checkout.tsx';
import { OrderSuccess } from './pages/OrderSuccess.tsx';
import { Profile } from './pages/Profile.tsx';
import { Orders } from './pages/Orders.tsx';
import { OrderDetail } from './pages/OrderDetail.tsx';
import { Addresses } from './pages/Addresses.tsx';
import { Skeleton } from './components/States.tsx';
import { cartStore } from './lib/cart.ts';
import { initTelegram } from './lib/telegram.ts';

// React.lazy so the admin panel (phase 4b, incl. its xlsx/SheetJS import
// chunk) never lands in the customer's main bundle — only fetched when a
// user actually navigates to /admin. AdminApp.tsx is currently a minimal
// placeholder; phase 4b replaces it.
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'));

const NAV_HIDDEN_PATHS = ['/checkout', '/admin'];

export function App(): JSX.Element {
  const location = useLocation();
  const showBottomNav = !NAV_HIDDEN_PATHS.some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    initTelegram();
    void cartStore.hydrate();
  }, []);

  return (
    <RequireSubscription>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/products" element={<Products />} />
        <Route
          path="/favorites"
          element={
            <RequireAuth>
              <Favorites />
            </RequireAuth>
          }
        />
        <Route path="/cart" element={<Cart />} />
        <Route
          path="/checkout"
          element={
            <RequireAuth>
              <Checkout />
            </RequireAuth>
          }
        />
        <Route
          path="/orders/:id/success"
          element={
            <RequireAuth>
              <OrderSuccess />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/orders"
          element={
            <RequireAuth>
              <Orders />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/orders/:id"
          element={
            <RequireAuth>
              <OrderDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/addresses"
          element={
            <RequireAuth>
              <Addresses />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <Suspense
                fallback={
                  <div className="flex flex-col gap-space-sm p-margin pt-space-xl">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                  </div>
                }
              >
                <AdminApp />
              </Suspense>
            </RequireAuth>
          }
        />
      </Routes>
      {showBottomNav && <BottomNav />}
    </RequireSubscription>
  );
}
