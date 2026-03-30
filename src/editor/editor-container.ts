import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import type { DocMode } from '@blocksuite/affine/model';
import { ThemeProvider } from '@blocksuite/affine/shared/services';
import { BlockStdScope, ShadowlessElement } from '@blocksuite/affine/std';
import {
  type BlockModel,
  type ExtensionType,
  type Store,
} from '@blocksuite/affine/store';
import { computed, signal } from '@preact/signals-core';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { when } from 'lit/directives/when.js';

export class PeakEditorContainer extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .affine-page-viewport {
      position: relative;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      overflow-y: auto;
      container-name: viewport;
      container-type: inline-size;
      font-family: var(--affine-font-family);
      height: 100%;
    }
    .affine-page-viewport * {
      box-sizing: border-box;
    }

    .peak-page-editor-container {
      flex-grow: 1;
      font-family: var(--affine-font-family);
      display: block;
    }

    .peak-page-editor-container * {
      box-sizing: border-box;
    }

    .edgeless-editor-container {
      font-family: var(--affine-font-family);
      background: var(--affine-background-primary-color);
      display: block;
      height: 100%;
      position: relative;
      overflow: clip;
    }

    .edgeless-editor-container * {
      box-sizing: border-box;
    }

    .affine-edgeless-viewport {
      display: block;
      height: 100%;
      position: relative;
      overflow: clip;
      container-name: viewport;
      container-type: inline-size;
    }
  `;

  private _docSubscription: (() => void) | null = null;

  private readonly _doc = signal<Store>();

  private readonly _edgelessSpecs = signal<ExtensionType[]>([]);

  private readonly _mode = signal<DocMode>('page');

  private readonly _pageSpecs = signal<ExtensionType[]>([]);

  private readonly _specs = computed(() =>
    this._mode.value === 'page'
      ? this._pageSpecs.value
      : this._edgelessSpecs.value
  );

  private readonly _std = computed(() => {
    if (!this._doc.value) return null;
    return new BlockStdScope({
      store: this.doc,
      extensions: this._specs.value,
    });
  });

  private readonly _editorTemplate = computed(() => {
    return this._std.value?.render();
  });

  get doc() {
    return this._doc.value as Store;
  }

  set doc(doc: Store) {
    // Unsubscribe from previous doc
    if (this._docSubscription) {
      this._docSubscription();
      this._docSubscription = null;
    }
    this._doc.value = doc;
    // Subscribe to rootAdded for the new doc
    if (doc) {
      const sub = doc.slots.rootAdded.subscribe(() => this.requestUpdate());
      this._docSubscription = () => sub.unsubscribe();
    }
  }

  set edgelessSpecs(specs: ExtensionType[]) {
    this._edgelessSpecs.value = specs;
  }

  get edgelessSpecs() {
    return this._edgelessSpecs.value;
  }

  get host() {
    try {
      return this.std.host;
    } catch {
      return null;
    }
  }

  get mode() {
    return this._mode.value;
  }

  set mode(mode: DocMode) {
    this._mode.value = mode;
  }

  set pageSpecs(specs: ExtensionType[]) {
    this._pageSpecs.value = specs;
  }

  get pageSpecs() {
    return this._pageSpecs.value;
  }

  get rootModel() {
    return this.doc.root as BlockModel;
  }

  get std() {
    return this._std.value!;
  }

  override connectedCallback() {
    super.connectedCallback();

    if (this._doc.value) {
      this._disposables.add(
        this.doc.slots.rootAdded.subscribe(() => this.requestUpdate())
      );
    }
  }

  override firstUpdated() {
    this._tryAutofocus();
  }

  override updated() {
    this._tryAutofocus();
  }

  private _tryAutofocus() {
    if (!this.autofocus || this.mode !== 'page') return;
    this.autofocus = false;
    setTimeout(() => {
      const docTitle = this.querySelector('doc-title');
      if (docTitle) {
        const richText = docTitle.querySelector('rich-text') as any;
        const inlineEditor = richText?.inlineEditor;
        if (inlineEditor) {
          inlineEditor.focusEnd();
          return;
        }
      }
      // Fallback to first rich-text
      const richText = this.querySelector('rich-text') as any;
      richText?.inlineEditor?.focusEnd();
    }, 50);
  }

  override render() {
    if (!this._doc.value || !this.doc.root) {
      return html`<div></div>`;
    }

    const mode = this._mode.value;
    const themeService = this.std.get(ThemeProvider);
    const appTheme = themeService.app$.value;
    const edgelessTheme = themeService.edgeless$.value;

    return html`${keyed(
      this.rootModel.id + mode,
      html`
        <div
          data-theme=${mode === 'page' ? appTheme : edgelessTheme}
          class=${mode === 'page'
            ? 'affine-page-viewport'
            : 'affine-edgeless-viewport'}
        >
          ${when(
            mode === 'page',
            () => html` <doc-title .doc=${this.doc}></doc-title> `
          )}
          <div
            class=${mode === 'page'
              ? 'page-editor peak-page-editor-container'
              : 'edgeless-editor-container'}
          >
            ${this._editorTemplate.value}
          </div>
        </div>
      `
    )}`;
  }

  switchEditor(mode: DocMode) {
    this._mode.value = mode;
  }

  @property({ attribute: false })
  override accessor autofocus = false;
}

customElements.define('peak-editor-container', PeakEditorContainer);

declare global {
  interface HTMLElementTagNameMap {
    'peak-editor-container': PeakEditorContainer;
  }
}
