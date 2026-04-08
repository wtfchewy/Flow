import { render } from 'lit';
import {
  CloseIcon,
  ExportToMarkdownIcon,
  ExportToHtmlIcon,
  ExportToPdfIcon,
} from '@blocksuite/icons/lit';
import {
  exportNoteAsMarkdown,
  exportNoteAsHtml,
  exportNoteAsPdf,
} from '../storage/note-store';

let overlay: HTMLElement | null = null;

export function closeExportModal() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

export function openExportModal(noteId: string) {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'peak-import-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeExportModal();
  });

  const panel = document.createElement('div');
  panel.className = 'peak-import-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'peak-import-header';

  const headerText = document.createElement('span');
  headerText.textContent = 'Export';
  header.appendChild(headerText);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'peak-import-close';
  render(CloseIcon({ width: '20', height: '20' }), closeBtn);
  closeBtn.addEventListener('click', closeExportModal);
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // Export options
  const options = document.createElement('div');
  options.className = 'peak-import-options';

  function addOption(
    iconFn: (opts: any) => any,
    label: string,
    onClick: () => void,
  ) {
    const item = document.createElement('button');
    item.className = 'peak-import-option';

    const iconEl = document.createElement('span');
    iconEl.className = 'peak-import-option-icon';
    render(iconFn({ width: '20', height: '20' }), iconEl);
    item.appendChild(iconEl);

    const labelEl = document.createElement('span');
    labelEl.className = 'peak-import-option-label';
    labelEl.textContent = label;
    item.appendChild(labelEl);

    item.addEventListener('click', () => {
      closeExportModal();
      onClick();
    });

    options.appendChild(item);
  }

  addOption(
    ExportToMarkdownIcon,
    'Markdown',
    () => exportNoteAsMarkdown(noteId),
  );

  addOption(
    ExportToHtmlIcon,
    'HTML',
    () => exportNoteAsHtml(noteId),
  );

  addOption(
    ExportToPdfIcon,
    'PDF',
    () => exportNoteAsPdf(noteId),
  );

  panel.appendChild(options);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
