import { render } from 'lit';
import {
  CloseIcon,
  ExportToMarkdownIcon,
  ZipIcon,
  ExportToHtmlIcon,
  NotionIcon,
} from '@blocksuite/icons/lit';
import {
  importMarkdownFile,
  importMarkdownZip,
  importHtmlFile,
  importNotionZip,
} from '../storage/note-store';

let overlay: HTMLElement | null = null;

export function closeImportModal() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => {
      resolve(Array.from(input.files ?? []));
    });
    // If user cancels, resolve empty
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

export function openImportModal() {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'peak-import-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeImportModal();
  });

  const panel = document.createElement('div');
  panel.className = 'peak-import-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'peak-import-header';

  const headerText = document.createElement('span');
  headerText.textContent = 'Import';
  header.appendChild(headerText);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'peak-import-close';
  render(CloseIcon({ width: '20', height: '20' }), closeBtn);
  closeBtn.addEventListener('click', closeImportModal);
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // Import options
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

    item.addEventListener('click', async () => {
      onClick();
    });

    options.appendChild(item);
  }

  addOption(
    ExportToMarkdownIcon,
    'Markdown files (.md)',
    async () => {
      const files = await pickFiles('.md', true);
      if (files.length === 0) return;
      closeImportModal();
      for (const file of files) {
        await importMarkdownFile(file);
      }
    },
  );

  addOption(
    ZipIcon,
    'Markdown with media files (.zip)',
    async () => {
      const files = await pickFiles('.zip', false);
      if (files.length === 0) return;
      closeImportModal();
      await importMarkdownZip(files[0]);
    },
  );

  addOption(
    ExportToHtmlIcon,
    'HTML',
    async () => {
      const files = await pickFiles('.html,.htm', true);
      if (files.length === 0) return;
      closeImportModal();
      for (const file of files) {
        await importHtmlFile(file);
      }
    },
  );

  addOption(
    NotionIcon,
    'Notion',
    async () => {
      const files = await pickFiles('.zip', false);
      if (files.length === 0) return;
      closeImportModal();
      await importNotionZip(files[0]);
    },
  );

  panel.appendChild(options);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}
