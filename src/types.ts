export interface ClaudeSessionLink {
  id: string;
  projectPath?: string;
  linkedAt: number;
}

export interface NoteMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  preview: string;
  mode?: 'page' | 'edgeless';
  pinned?: boolean;
  claudeSession?: ClaudeSessionLink;
}
