import { create } from "zustand";
import { Node, Edge } from "@xyflow/react";

interface GitGraphState {
	repoPath: string | null;
	nodes: Node[];
	edges: Edge[];
	setRepoPath: (path: string) => void;
	setGraphData: (nodes: Node[], edges: Edge[]) => void;
}

export const useGitGraphStore = create<GitGraphState>((set) => ({
	repoPath: null,
	nodes: [],
	edges: [],
	setRepoPath: (path) => set({ repoPath: path }),
	setGraphData: (nodes, edges) => set({ nodes, edges }),
}));
