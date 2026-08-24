import { BookOpen, Heart, Info } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../i18n';
import Section from './Section';

interface Props {
  appVersion: string;
}

export default function AboutTab({ appVersion }: Props): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Section title={t('settings.about')} icon={Info}>
      <style>{`
        @keyframes heartPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
      <p
        className="text-content-secondary"
        style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', lineHeight: 1.6, marginBottom: 6, marginTop: -4 }}
      >
        {t('settings.about.description')}
      </p>
      <p
        className="text-content-faint"
        style={{ fontSize: 'calc(12px * var(--fs-scale-body, 1))', lineHeight: 1.6, marginBottom: 16 }}
      >
        {t('settings.about.madeWith')}{' '}
        <Heart
          size={11}
          fill="#991b1b"
          stroke="#991b1b"
          style={{ display: 'inline-block', verticalAlign: '-1px', animation: 'heartPulse 1.5s ease-in-out infinite' }}
        />{' '}
        {t('settings.about.madeBy')}{' '}
        <span
          className="bg-surface-tertiary text-content-faint"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 99,
            padding: '1px 7px',
            fontSize: 'calc(10px * var(--fs-scale-caption, 1))',
            fontWeight: 600,
            verticalAlign: '1px',
          }}
        >
          v{appVersion}
        </span>
      </p>

      <a
        href="/help"
        className="flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-surface-card px-5 py-4 no-underline transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#6366f1';
          e.currentTarget.style.boxShadow = '0 0 0 1px #6366f122';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-primary)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div
          className="bg-[#6366f115]"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BookOpen size={20} className="text-[#6366f1]" />
        </div>
        <div>
          <div className="text-sm font-semibold text-content">Wiki</div>
          <div className="text-xs text-content-faint">{t('settings.about.wikiHint')}</div>
        </div>
      </a>
    </Section>
  );
}
