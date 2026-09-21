import { NavLink } from 'react-router-dom';
import { useCartCount } from '../lib/useCart.ts';
import { t } from '../lib/i18n.ts';

interface NavItem {
  to: string;
  icon: string;
  label: string;
}

const ITEMS: NavItem[] = [
  { to: '/', icon: 'home', label: t('nav.home') },
  { to: '/catalog', icon: 'apps', label: t('nav.catalog') },
  { to: '/cart', icon: 'shopping_cart', label: t('nav.cart') },
  { to: '/favorites', icon: 'favorite', label: t('nav.favorites') },
  { to: '/profile', icon: 'person', label: t('nav.profile') },
];

export function BottomNav(): JSX.Element {
  const cartCount = useCartCount();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/40 pb-safe">
      <div className="flex items-stretch justify-between px-space-sm">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            aria-label={item.label}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] min-w-[44px] text-label-sm font-label-sm ${
                isActive ? 'text-primary-text' : 'text-on-surface-variant'
              }`
            }
          >
            <span className="relative">
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              {item.to === '/cart' && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-on-primary text-[10px] font-label-sm leading-4 text-center">
                  {cartCount}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
