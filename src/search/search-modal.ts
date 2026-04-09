import { render } from 'lit';
import { SearchIcon } from '@blocksuite/icons/lit';
import { searchNotes, clearSearchCache, preloadAllNotes } from './search-engine';
import * as noteStore from '../storage/note-store';
import { formatDistanceToNow } from 'date-fns';
import type { EditorHost } from '@blocksuite/std';

let overlay: HTMLElement | null = null;

/**
 * After navigating to a note, scroll to and highlight the matched block.
 * Uses the same technique as BlockSuite's outline/TOC panel.
 */
function scrollToAndHighlightBlock(blockId: string) {
  const editor = document.querySelector('peak-editor-container') as any;
  if (!editor) return;

  let attempts = 0;
  const tryHighlight = () => {
    const host: EditorHost | null = editor.host;
    if (!host) {
      if (attempts++ < 30) requestAnimationFrame(tryHighlight);
      return;
    }

    const block = host.view.getBlock(blockId);
    if (!block) {
      if (attempts++ < 30) requestAnimationFrame(tryHighlight);
      return;
    }

    block.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait for scroll to settle, then show highlight overlay
    let lastTop = -1;
    let settle = 0;
    const check = () => {
      const el = host.view.getBlock(blockId);
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      if (top !== lastTop) {
        lastTop = top;
        settle = 0;
        if (settle < 30) requestAnimationFrame(check);
        return;
      }
      settle++;
      if (settle < 3) { requestAnimationFrame(check); return; }

      // Apply highlight
      const rootComponent = host.querySelector('affine-page-root') as HTMLElement & { viewport?: { top: number; left: number; scrollTop: number; scrollLeft: number } };
      if (!rootComponent?.viewport) return;

      const { top: offsetY, left: offsetX, scrollTop, scrollLeft } = rootComponent.viewport;
      const rect = el.getBoundingClientRect();

      const mask = document.createElement('div');
      Object.assign(mask.style, {
        position: 'absolute',
        top: `${rect.top - offsetY + scrollTop}px`,
        left: `${rect.left - offsetX + scrollLeft}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        background: 'var(--affine-hover-color)',
        borderRadius: '4px',
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
      });
      rootComponent.appendChild(mask);

      setTimeout(() => { mask.style.opacity = '0'; }, 1000);
      setTimeout(() => { mask.remove(); }, 1300);
    };
    requestAnimationFrame(check);
  };
  requestAnimationFrame(tryHighlight);
}

export function closeSearchModal() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

export function isSearchOpen(): boolean {
  return overlay !== null;
}

export function openSearchModal() {
  if (overlay) {
    const input = overlay.querySelector('.peak-search-input') as HTMLInputElement;
    input?.focus();
    return;
  }

  clearSearchCache();

  overlay = document.createElement('div');
  overlay.className = 'peak-search-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSearchModal();
  });

  const panel = document.createElement('div');
  panel.className = 'peak-search-panel';

  // Search input row
  const inputRow = document.createElement('div');
  inputRow.className = 'peak-search-input-row';

  const iconEl = document.createElement('span');
  iconEl.className = 'peak-search-icon';
  render(SearchIcon({ width: '20', height: '20' }), iconEl);
  inputRow.appendChild(iconEl);

  const input = document.createElement('input');
  input.className = 'peak-search-input';
  input.type = 'text';
  input.placeholder = 'Search your notes...';
  input.spellcheck = false;
  inputRow.appendChild(input);

  panel.appendChild(inputRow);

  // Divider
  const divider = document.createElement('div');
  divider.className = 'peak-search-divider';
  panel.appendChild(divider);

  // Results container
  const resultsContainer = document.createElement('div');
  resultsContainer.className = 'peak-search-results';

  // Show recent notes initially
  showRecentNotes(resultsContainer);

  panel.appendChild(resultsContainer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => input.focus());

  // Preload all note text in the background so searches are instant
  preloadAllNotes(noteStore.notes.value);

  let selectedIndex = 0;

  function updateSelection() {
    const items = resultsContainer.querySelectorAll('.peak-search-result-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });
    const selected = items[selectedIndex];
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }

  let searchVersion = 0;

  async function runSearch() {
    const query = input.value.trim();

    if (!query) {
      showRecentNotes(resultsContainer);
      selectedIndex = 0;
      return;
    }

    const version = ++searchVersion;
    const results = await searchNotes(query, noteStore.notes.value);

    // Discard if a newer search has started
    if (version !== searchVersion) return;

    resultsContainer.innerHTML = '';
    selectedIndex = 0;

    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'peak-search-empty';
      empty.textContent = 'No results found';
      resultsContainer.appendChild(empty);
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const item = createResultItem(result.title, result.matchSnippet, result.updatedAt, () => {
        closeSearchModal();
        noteStore.selectNote(result.noteId);
        if (result.matchBlockId) {
          scrollToAndHighlightBlock(result.matchBlockId);
        }
      });
      if (i === 0) item.classList.add('selected');
      resultsContainer.appendChild(item);
    }
  }

  input.addEventListener('input', runSearch);

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = resultsContainer.querySelectorAll('.peak-search-result-item');
    const count = items.length;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, count - 1);
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = items[selectedIndex] as HTMLElement;
      if (selected) selected.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchModal();
    }
  });
}

function showRecentNotes(container: HTMLElement) {
  container.innerHTML = '';

  const allNotes = noteStore.notes.value;
  if (allNotes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'peak-search-empty';
    empty.textContent = 'No notes yet';
    container.appendChild(empty);
    return;
  }

  const recent = allNotes.slice(0, 8);
  for (let i = 0; i < recent.length; i++) {
    const note = recent[i];
    const item = createResultItem(
      note.title || 'Untitled',
      note.preview || 'No additional text',
      note.updatedAt,
      () => {
        closeSearchModal();
        noteStore.selectNote(note.id);
      }
    );
    if (i === 0) item.classList.add('selected');
    container.appendChild(item);
  }
}

function createResultItem(
  title: string,
  snippet: string,
  updatedAt: number,
  onClick: () => void
): HTMLElement {
  const item = document.createElement('div');
  item.className = 'peak-search-result-item';

  const textCol = document.createElement('div');
  textCol.className = 'peak-search-result-text';

  const titleEl = document.createElement('div');
  titleEl.className = 'peak-search-result-title';
  titleEl.textContent = title;

  const snippetEl = document.createElement('div');
  snippetEl.className = 'peak-search-result-snippet';
  snippetEl.textContent = snippet || 'No additional text';

  textCol.appendChild(titleEl);
  textCol.appendChild(snippetEl);

  const timeEl = document.createElement('div');
  timeEl.className = 'peak-search-result-time';
  try {
    timeEl.textContent = formatDistanceToNow(updatedAt, { addSuffix: true });
  } catch {
    timeEl.textContent = '';
  }

  item.appendChild(textCol);
  item.appendChild(timeEl);

  item.addEventListener('click', onClick);

  item.addEventListener('mouseenter', () => {
    const parent = item.parentElement;
    if (!parent) return;
    parent.querySelectorAll('.peak-search-result-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
  });

  return item;
}

/**
 * Register the global Cmd+S keyboard shortcut.
 */
export function registerSearchShortcut() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      if (isSearchOpen()) {
        closeSearchModal();
      } else {
        openSearchModal();
      }
    }
  }, true);
}
