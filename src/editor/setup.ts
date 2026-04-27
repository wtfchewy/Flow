import { AffineSchemas } from '@blocksuite/affine/schemas';
import type { DocMode } from '@blocksuite/affine/model';
import {
  CommunityCanvasTextFonts,
  DocModeProvider,
  EditorSettingExtension,
  type EditorSetting,
  FeatureFlagService,
  FontConfigExtension,
  GeneralSettingSchema,
  ParseDocUrlExtension,
  type ParseDocUrlService,
} from '@blocksuite/affine/shared/services';
import {
  RefNodeSlotsProvider,
} from '@blocksuite/affine/inlines/reference';

export { RefNodeSlotsProvider };
import {
  type ExtensionType,
  type Store,
  type Workspace,
  Schema,
  Text,
} from '@blocksuite/affine/store';
import {
  type DocCollectionOptions,
  TestWorkspace,
} from '@blocksuite/affine/store/test';
import { MemoryBlobSource } from '@blocksuite/affine/sync';
import { effects as itEffects } from '@blocksuite/integration-test/effects';
import { getTestStoreManager } from '@blocksuite/integration-test/store';
import { getTestViewManager } from '@blocksuite/integration-test/view';
import { Signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import * as Y from 'yjs';

import type { PeakEditorContainer } from './editor-container';

// Register all BlockSuite custom elements
let initialized = false;
export function initBlockSuite() {
  if (initialized) return;
  initialized = true;
  itEffects();
}

// Extension managers
const storeManager = getTestStoreManager();
const viewManager = getTestViewManager();

export function getStoreExtensions(): ExtensionType[] {
  return storeManager.get('store');
}

// Create a workspace (doc collection)
export function createWorkspace(): TestWorkspace {
  const options: DocCollectionOptions = {
    id: 'peak-workspace',
    blobSources: {
      main: new MemoryBlobSource(),
      shadows: [],
    },
  };

  const collection = new TestWorkspace(options);
  collection.storeExtensions = storeManager.get('store');
  collection.meta.initialize();
  collection.start();

  return collection;
}

// Create a new empty doc with initial block structure
export function createNewDoc(
  collection: TestWorkspace,
  docId: string
): Store {
  const doc = collection.getDoc(docId) ?? collection.createDoc(docId);
  const store = doc.getStore({ id: docId });

  // store.load() (vs doc.load()) is required so HistoryExtension.loaded()
  // fires and wires up the canUndo/canRedo signals — without it, the
  // page-root keymap's Mod-z handler short-circuits on canUndo === false.
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text() });
    store.addBlock('affine:surface', {}, rootId);
    const noteId = store.addBlock('affine:note', {}, rootId);
    store.addBlock('affine:paragraph', {}, noteId);
  });

  return store;
}

// Load an existing doc from Yjs binary
export function loadExistingDoc(
  collection: TestWorkspace,
  docId: string,
  data: Uint8Array
): Store {
  const doc = collection.getDoc(docId) ?? collection.createDoc(docId);
  const store = doc.getStore({ id: docId });

  // Apply the saved Yjs state before loading so the loaded content isn't
  // captured as an undoable initial transaction.
  Y.applyUpdate(doc.spaceDoc, data);
  store.load();

  return store;
}

// Get the underlying Yjs doc for serialization
export function getYDoc(store: Store): Y.Doc {
  return store.spaceDoc;
}

// Build common extensions for the editor
function mockDocModeService(editor: PeakEditorContainer) {
  const docModeService: DocModeProvider = {
    getPrimaryMode: () => 'page' as DocMode,
    onPrimaryModeChange: () => new Subject<DocMode>().subscribe(),
    getEditorMode: () => editor.mode,
    setEditorMode: (mode: DocMode) => editor.switchEditor(mode),
    setPrimaryMode: () => {},
    togglePrimaryMode: () => {
      const mode = editor.mode === 'page' ? 'edgeless' : 'page';
      editor.switchEditor(mode);
      return mode;
    },
  };
  return docModeService;
}

function mockParseDocUrl(): ParseDocUrlService {
  return {
    parseDocUrl: () => undefined,
  };
}

function mockEditorSetting() {
  const initialVal = Object.entries(GeneralSettingSchema.shape).reduce(
    (pre: EditorSetting, [key, schema]) => {
      // @ts-expect-error key is EditorSetting field
      pre[key as keyof EditorSetting] = schema.parse(undefined);
      return pre;
    },
    {} as EditorSetting
  );
  return new Signal<EditorSetting>(initialVal);
}

export function getCommonExtensions(
  editor: PeakEditorContainer
): ExtensionType[] {
  return [
    FontConfigExtension(CommunityCanvasTextFonts),
    EditorSettingExtension({ setting$: mockEditorSetting() }),
    ParseDocUrlExtension(mockParseDocUrl()),
    {
      setup: di => {
        di.override(DocModeProvider, mockDocModeService(editor));
      },
    },
  ];
}

export function getPageSpecs(editor: PeakEditorContainer): ExtensionType[] {
  return [...viewManager.get('page'), ...getCommonExtensions(editor)];
}

export function getEdgelessSpecs(editor: PeakEditorContainer): ExtensionType[] {
  return [...viewManager.get('edgeless'), ...getCommonExtensions(editor)];
}
