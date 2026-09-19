import { Route, Routes } from 'react-router-dom';
import { useMe } from '../lib/queries.ts';
import { Skeleton } from '../components/States.tsx';
import { t } from '../lib/i18n.ts';
import { AccessDenied } from './components/AccessDenied.tsx';
import { AdminPage } from './components/AdminPage.tsx';
import { AdminHome } from './pages/AdminHome.tsx';
import { OrdersList } from './pages/OrdersList.tsx';
import { OrderDetail } from './pages/OrderDetail.tsx';
import { ProductsList } from './pages/ProductsList.tsx';
import { ProductForm } from './pages/ProductForm.tsx';
import { VariantsList } from './pages/VariantsList.tsx';
import { Import } from './pages/Import.tsx';
import { Categories } from './pages/Categories.tsx';
import { Brands } from './pages/Brands.tsx';
import { Regions } from './pages/Regions.tsx';
import { Banners } from './pages/Banners.tsx';
import { Settings } from './pages/Settings.tsx';
import { Admins } from './pages/Admins.tsx';
import { Audit } from './pages/Audit.tsx';

/** Entry point for the /admin/* route, React.lazy-loaded from App.tsx so
 * nothing admin-only (including the xlsx import chunk Import.tsx dynamically
 * pulls in) ever lands in the customer bundle.
 *
 * Gates on GET /me's `is_admin` before rendering any admin screen — this is
 * a CONVENIENCE ONLY, not a security boundary: the server re-checks
 * `admin_users` fresh on every /admin/* request regardless of what this
 * screen shows (see api/src/routes/admin.ts's preHandler). Hiding the
 * "Adminlar" tile for a non-owner below is the same kind of convenience —
 * the server independently enforces role='owner' on every /admin/admins*
 * request via requireOwnerHook. */
export default function AdminApp(): JSX.Element {
  const { data: me, isLoading, isError } = useMe();

  // Both gate states render inside AdminPage so they keep the back control:
  // the bottom nav is hidden under /admin, and a bare skeleton or lock screen
  // with no way back traps the user (a single failed /me would be enough).
  if (isLoading) {
    return (
      <AdminPage title={t('admin.title')}>
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </AdminPage>
    );
  }
  if (isError || me === undefined || !me.is_admin) {
    return (
      <AdminPage title={t('admin.title')}>
        <AccessDenied />
      </AdminPage>
    );
  }

  const isOwner = me.admin_role === 'owner';

  // Relative (no leading slash) paths: App.tsx mounts this component at
  // <Route path="/admin/*">, and React Router resolves this nested <Routes>
  // against the remainder of the matched path via RouteContext.
  return (
    <Routes>
      <Route path="" element={<AdminHome isOwner={isOwner} />} />
      <Route path="orders" element={<OrdersList />} />
      <Route path="orders/:id" element={<OrderDetail />} />
      <Route path="products" element={<ProductsList />} />
      <Route path="products/new" element={<ProductForm />} />
      <Route path="products/:id" element={<ProductForm />} />
      <Route path="products/:id/variants" element={<VariantsList />} />
      <Route path="import" element={<Import />} />
      <Route path="categories" element={<Categories />} />
      <Route path="brands" element={<Brands />} />
      <Route path="regions" element={<Regions />} />
      <Route path="banners" element={<Banners />} />
      <Route path="settings" element={<Settings />} />
      <Route path="audit" element={<Audit />} />
      {isOwner && <Route path="admins" element={<Admins />} />}
      <Route path="*" element={<AdminHome isOwner={isOwner} />} />
    </Routes>
  );
}
