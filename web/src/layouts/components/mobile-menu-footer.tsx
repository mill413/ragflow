import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useFetchUserInfo } from '@/hooks/use-user-setting-request';
import { Routes } from '@/routes';

function FooterLink({
  children,
  onClick,
  to,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  to: string;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="text-text-secondary transition-colors hover:text-text-primary"
    >
      {children}
    </Link>
  );
}

type MobileMenuFooterProps = {
  onClose: () => void;
};

export function MobileMenuFooter({ onClose }: MobileMenuFooterProps) {
  const { t } = useTranslation();
  const { data: userInfo } = useFetchUserInfo();

  return (
    <div className="shrink-0 border-t border-border-button px-4 py-4">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
        <FooterLink to={Routes.Help} onClick={onClose}>
          {t('header.help')}
        </FooterLink>
        {userInfo.is_superuser && (
          <FooterLink to={Routes.AdminServices} onClick={onClose}>
            {t('header.adminConsole')}
          </FooterLink>
        )}
      </div>
    </div>
  );
}
