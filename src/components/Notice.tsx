import type { ReactNode } from 'react';

interface NoticeProps {
  kind: 'info' | 'error';
  children: ReactNode;
  onClose?(): void;
}

export function Notice({ kind, children, onClose }: NoticeProps) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="notice-text">{children}</span>
      {onClose && (
        <button className="notice-close" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
