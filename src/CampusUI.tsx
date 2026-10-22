import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from './i18n';
import Icon from './CampusIcons';

export function CampusDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className={`campus-dialog ${wide ? 'wide' : ''}`}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="campus-dialog-title"
    >
      <header>
        <h2 id="campus-dialog-title">{title}</h2>
        <button
          className="cp-icon-button"
          onClick={onClose}
          aria-label={t('关闭')}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="campus-dialog-content">{children}</div>
    </dialog>
  );
}
export function Meter({
  percent,
  color = '#6682ad',
  label,
}: {
  percent: number;
  color?: string;
  label: string;
}) {
  return (
    <div
      className="cp-meter"
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="cp-empty">
      <span>
        <Icon name="book" size={26} />
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="cp-alert" role="alert">
      {children}
    </p>
  );
}
