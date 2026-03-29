export interface NoteMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview: string;
  mode?: 'page' | 'edgeless';
  pinned?: boolean;
}
