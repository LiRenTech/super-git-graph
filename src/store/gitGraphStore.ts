import { create } from 'zustand';
import { Node, Edge } from '@xyflow/react';

interface GitGraphState {
  repoPath: string | null;
  nodes: Node[];
  edges: Edge[];
  showHash: boolean;
  showMessage: boolean;
  setRepoPath: (path: string) => void;
  setGraphData: (nodes: Node[], edges: Edge[]) => void;
  setShowHash: (show: boolean) => void;
  setShowMessage: (show: boolean) => void;
}

export const useGitGraphStore = create<GitGraphState>((set) => ({
  repoPath: null,
  nodes: [],
  edges: [],
  showHash: true,
  showMessage: true,
  setRepoPath: (path) => set({ repoPath: path }),
  setGraphData: (nodes, edges) => set({ nodes, edges }),
  setShowHash: (show) => set({ showHash: show }),
  setShowMessage: (show) => set({ showMessage: show }),
}));
