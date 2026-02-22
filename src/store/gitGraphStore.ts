import { create } from 'zustand';
import { Node, Edge } from '@xyflow/react';

export interface GitRef {
  name: string;
  commit_id: string;
}

interface GitGraphState {
  repoPath: string | null;
  nodes: Node[];
  edges: Edge[];
  allRefs: GitRef[];
  showHash: boolean;
  showMessage: boolean;
  showBackground: boolean;
  showCoordinates: boolean;
  isDragSubtreeMode: boolean;
  visibleBranchNames: string[];
  focusNodeId: string | null;
  diffMode: {
    active: boolean;
    sourceCommitId: string | null;
    targetCommitId: string | null;
  };
  setRepoPath: (path: string) => void;
  setGraphData: (nodes: Node[], edges: Edge[]) => void;
  setAllRefs: (refs: GitRef[]) => void;
  setShowHash: (show: boolean) => void;
  setShowMessage: (show: boolean) => void;
  setShowBackground: (show: boolean) => void;
  setShowCoordinates: (show: boolean) => void;
  setIsDragSubtreeMode: (isDragSubtreeMode: boolean) => void;
  setVisibleBranchNames: (names: string[]) => void;
  setFocusNodeId: (id: string | null) => void;
  startDiffMode: (sourceCommitId: string) => void;
  endDiffMode: () => void;
  setDiffTarget: (targetCommitId: string) => void;
}

export const useGitGraphStore = create<GitGraphState>((set) => ({
  repoPath: null,
  nodes: [],
  edges: [],
  allRefs: [],
  showHash: true,
  showMessage: true,
  showBackground: true,
  showCoordinates: false,
  isDragSubtreeMode: false,
  visibleBranchNames: [],
  focusNodeId: null,
  diffMode: {
    active: false,
    sourceCommitId: null,
    targetCommitId: null,
  },
  setRepoPath: (path) => set({ repoPath: path }),
  setGraphData: (nodes, edges) => set({ nodes, edges }),
  setAllRefs: (refs) => set({ allRefs: refs }),
  setShowHash: (show) => set({ showHash: show }),
  setShowMessage: (show) => set({ showMessage: show }),
  setShowBackground: (show) => set({ showBackground: show }),
  setShowCoordinates: (show) => set({ showCoordinates: show }),
  setIsDragSubtreeMode: (mode) => set({ isDragSubtreeMode: mode }),
  setVisibleBranchNames: (names) => set({ visibleBranchNames: names }),
  setFocusNodeId: (id) => set({ focusNodeId: id }),
  startDiffMode: (sourceCommitId) =>
    set({
      diffMode: {
        active: true,
        sourceCommitId,
        targetCommitId: null,
      },
    }),
  endDiffMode: () =>
    set({
      diffMode: {
        active: false,
        sourceCommitId: null,
        targetCommitId: null,
      },
    }),
  setDiffTarget: (targetCommitId) =>
    set((state) => ({
      diffMode: {
        ...state.diffMode,
        targetCommitId,
      },
    })),
}));
