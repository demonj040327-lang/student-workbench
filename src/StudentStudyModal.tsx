import { useEffect, useRef } from 'react';
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
