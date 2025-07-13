import { useLocale, useTranslations } from 'next-intl';
import { Link } from '../../i18n/navigation';
import LocaleSwitcherSelect from '@/components/i18n/LocaleSwitcher/LocaleSwitcher';


export default function HomePage() {
  const t = useTranslations('HomePage');
  const locale = useLocale();
  return (
    <div>
      <h1>{t('title')}</h1>
      <Link href="/about">{t('about')}</Link>
      <LocaleSwitcherSelect defaultValue={locale} label="Select your language">
        <option value="en">English</option>
        <option value="de">Deutsch</option>
      </LocaleSwitcherSelect>
    </div>
  );
}