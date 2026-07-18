import { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigate } from 'react-router';

import { useMutation, useQuery } from '@tanstack/react-query';

import {
  LucideBoxes,
  LucideBuilding2,
  LucideLogOut,
  LucidePanelLeftClose,
  LucidePanelLeftOpen,
  LucideServerCrash,
  LucideSquareUserRound,
  LucideUserCog,
  LucideUserStar,
  LucideUsersRound,
  LucideZap,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Routes } from '@/routes';
import { getSystemVersion, logout } from '@/services/admin-service';

import { adminAuthorizationUtil } from '@/utils/authorization-util';

import ThemeSwitch from '../../../components/theme-switch';
import { IS_ENTERPRISE } from '../utils';
import { CurrentUserInfoContext } from './root-layout';

const ADMIN_SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';

const AdminNavigationLayout = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, setCurrentUserInfo] = useContext(CurrentUserInfoContext);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) !== 'false';
  });

  const { data: version } = useQuery({
    queryKey: ['admin/version'],
    queryFn: async () => (await getSystemVersion())?.data?.data?.version,
  });

  const navItems = useMemo(
    () => [
      {
        path: Routes.AdminServices,
        name: t('admin.serviceStatus'),
        icon: <LucideServerCrash className="size-[1em]" />,
      },
      {
        path: Routes.AdminUserManagement,
        name: t('admin.userManagement'),
        icon: <LucideUserCog className="size-[1em]" />,
      },
      {
        path: Routes.AdminTeamManagement,
        name: t('admin.teamManagement.title'),
        icon: <LucideUsersRound className="size-[1em]" />,
      },
      {
        path: Routes.AdminDepartments,
        name: t('admin.departmentManagement'),
        icon: <LucideBuilding2 className="size-[1em]" />,
      },
      {
        path: Routes.AdminResourceManagement,
        name: t('admin.resourceManagement'),
        icon: <LucideBoxes className="size-[1em]" />,
      },
      {
        path: Routes.AdminSandboxSettings,
        name: t('admin.sandboxSettings'),
        icon: <LucideZap className="size-[1em]" />,
      },
      ...(IS_ENTERPRISE
        ? [
            {
              path: Routes.AdminWhitelist,
              name: t('admin.registrationWhitelist'),
              icon: <LucideUserStar className="size-[1em]" />,
            },
            {
              path: Routes.AdminRoles,
              name: t('admin.roles'),
              icon: <LucideSquareUserRound className="size-[1em]" />,
            },
          ]
        : []),
    ],
    [t],
  );

  const logoutMutation = useMutation({
    mutationKey: ['adminLogout'],
    mutationFn: async () => {
      await logout();
      adminAuthorizationUtil.removeAll();
      navigate(Routes.Admin);
      setCurrentUserInfo({
        userInfo: null,
        source: null,
      });
    },
    retry: false,
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  return (
    <main className="w-screen h-screen flex flex-row gap-6 px-6 pt-12 pb-6 dark:*:focus-visible:ring-white">
      <aside
        className={cn(
          'shrink-0 flex flex-col gap-6 transition-[width] duration-200 ease-out',
          sidebarCollapsed ? 'w-14' : 'w-[200px]',
        )}
      >
        <div
          className={cn(
            'flex h-8 items-center mb-6',
            sidebarCollapsed && 'justify-center',
          )}
        >
          {!sidebarCollapsed && (
            <>
              <img
                className="mr-3 size-8 shrink-0"
                src="/logo.svg"
                alt="logo"
              />
              <span className="min-w-0 truncate text-lg font-bold">
                {t('admin.title')}
              </span>
            </>
          )}
          <Button
            size="icon"
            variant="transparent"
            className={cn('shrink-0 border-0', !sidebarCollapsed && 'ml-auto')}
            title={
              sidebarCollapsed
                ? t('admin.expandSidebar')
                : t('admin.collapseSidebar')
            }
            aria-label={
              sidebarCollapsed
                ? t('admin.expandSidebar')
                : t('admin.collapseSidebar')
            }
            onClick={toggleSidebar}
          >
            {sidebarCollapsed ? (
              <LucidePanelLeftOpen />
            ) : (
              <LucidePanelLeftClose />
            )}
          </Button>
        </div>

        <nav>
          <ul className="space-y-4">
            {navItems.map((it) => (
              <li key={it.path}>
                <NavLink
                  to={it.path}
                  className={({ isActive }) =>
                    cn(
                      'px-4 py-3 rounded-lg',
                      'text-base w-full flex items-center justify-start text-text-secondary',
                      'hover:bg-bg-card focus:bg-bg-card focus-visible:bg-bg-card',
                      'hover:text-text-primary focus:text-text-primary focus-visible:text-text-primary',
                      'active:text-text-primary',
                      'transition-colors',
                      sidebarCollapsed && 'justify-center px-0',
                      {
                        'bg-bg-card text-text-primary': isActive,
                      },
                    )
                  }
                  title={sidebarCollapsed ? it.name : undefined}
                >
                  {it.icon}
                  {!sidebarCollapsed && (
                    <span className="ml-3 whitespace-nowrap">{it.name}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto space-y-4">
          <div
            className={cn(
              'flex items-center',
              sidebarCollapsed
                ? 'justify-center overflow-hidden'
                : 'justify-between',
            )}
          >
            {!sidebarCollapsed && (
              <span className="leading-none text-xs text-accent-primary">
                {version}
              </span>
            )}

            <ThemeSwitch className={cn(sidebarCollapsed && 'scale-75')} />
          </div>

          <Button
            size="lg"
            variant="transparent"
            block
            title={sidebarCollapsed ? t('header.logout') : undefined}
            aria-label={t('header.logout')}
            onClick={() => logoutMutation.mutate()}
          >
            {sidebarCollapsed ? <LucideLogOut /> : t('header.logout')}
          </Button>
        </div>
      </aside>

      <section className="min-w-0 flex-1 h-full">
        <Outlet />
      </section>
    </main>
  );
};

export default AdminNavigationLayout;
