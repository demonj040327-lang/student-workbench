import { useEffect, useRef, type KeyboardEvent } from 'react';
import CampusLearning from './CampusLearning';
import type { CampusMaterial, PersonalApi, StudentProgress } from './campusStore';

type Props = {
  material: CampusMaterial;
  progress: StudentProgress;
  onProgress: (change: (progress: StudentProgress) => StudentProgress) => void;
  api: PersonalApi | null;
  onConnect: () => void;
  onClose: () => void;
  trigger: HTMLButtonElement | null;
  apiDialogOpen: boolean;
};

export default function StudentStudyModal({
  material, progress, onProgress, api, onConnect, onClose, trigger, apiDialogOpen,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const wasApiDialogOpen = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  useEffect(() => {
    if (wasApiDialogOpen.current && !apiDialogOpen) {
      ref.current?.querySelector<HTMLButtonElement>('.student-study-connect')?.focus();
    }
    wasApiDialogOpen.current = apiDialogOpen;
  }, [apiDialogOpen]);

  function close() {
    ref.current?.close();
    onClose();
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }

  function keepFocusInside(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab' || apiDialogOpen) return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || active === event.currentTarget)) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={ref}
      className="student-study-dialog"
      aria-label={material.title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={keepFocusInside}
    >
      <CampusLearning
        modal
        material={material}
        progress={progress}
        onProgress={onProgress}
        api={api}
        onConnect={onConnect}
        onBack={close}
      />
    </dialog>
  );
}
