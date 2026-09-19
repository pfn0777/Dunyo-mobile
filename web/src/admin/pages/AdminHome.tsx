import { Link } from 'react-router-dom';
import { AdminPage } from '../components/AdminPage.tsx';
import { t } from '../../lib/i18n.ts';

interface MenuItem {
  to: string;
  icon: string;
  labelKey: string;
}

const MENU: MenuItem[] = [
  { to: '/admin/orders', icon: 'receipt_long', labelKey: 'admin.menu.orders' },
  { to: '/admin/products', icon: 'inventory_2', labelKey: 'admin.menu.products' },
  { to: '/admin/import', icon: 'upload_file', labelKey: 'admin.menu.import' },
  { to: '/admin/categories', icon: 'category', labelKey: 'admin.menu.categories' },
  { to: '/admin/brands', icon: 'sell', labelKey: 'admin.menu.brands' },
  { to: '/admin/regions', icon: 'map', labelKey: 'admin.menu.regions' },
  { to: '/admin/banners', icon: 'campaign', labelKey: 'admin.menu.banners' },
  { to: '/admin/settings', icon: 'settings', labelKey: 'admin.menu.settings' },
];

export function AdminHome({ isOwner }: { isOwner: boolean }): JSX.Element {
  const items = isOwner
    ? [...MENU, { to: '/admin/admins', icon: 'admin_panel_settings', labelKey: 'admin.menu.admins' }]
    : MENU;
  const withAudit = [...items, { to: '/admin/audit', icon: 'history', labelKey: 'admin.menu.audit' }];

  return (
    <AdminPage title={t('admin.title')}>
      <div className="flex flex-col gap-space-sm">
        {withAudit.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-space-md bg-surface-container-lowest rounded-2xl p-space-md shadow-sm"
          >
            <span className="material-symbols-outlined text-primary">{item.icon}</span>
            <span className="text-title-sm font-title-sm text-on-surface">{t(item.labelKey)}</span>
            <span className="material-symbols-outlined text-on-surface-variant ml-auto">chevron_right</span>
          </Link>
        ))}
      </div>
    </AdminPage>
  );
}
