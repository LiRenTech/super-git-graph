import dagre from "@dagrejs/dagre";
import { Node, Edge } from "@xyflow/react";

export interface GitCommit {
  id: string;
  message: string;
  author: string;
  date: number;
  parents: string[];
  refs: string[];
}

export interface LayoutedElements {
  nodes: Node[];
  edges: Edge[];
}

export function getLayoutedElements(commits: GitCommit[]): LayoutedElements {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 50, nodesep: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to the graph
  commits.forEach((commit) => {
    g.setNode(commit.id, { width: 100, height: 60 });
  });

  // Add edges to the graph
  commits.forEach((commit) => {
    if (commit.parents) {
      commit.parents.forEach((parentId) => {
        // Only add edge if parent exists in our commits list
        if (commits.some((c) => c.id === parentId)) {
          g.setEdge(parentId, commit.id);
        }
      });
    }
  });

  dagre.layout(g);

  // Create nodes and edges for React Flow
  const nodes: Node[] = commits.map((commit) => {
    const nodeWithPosition = g.node(commit.id);
    return {
      id: commit.id,
      type: "commit",
      position: {
        x: nodeWithPosition.x - 50, // Center the node
        y: nodeWithPosition.y - 30,
      },
      data: {
        label: commit.message,
        commit: commit,
        // Add repoPath to node data so CommitNode can access it
        repoPath: "", // Will be set in GitGraphView
      },
    };
  });

  const edges: Edge[] = [];
  commits.forEach((commit) => {
    if (commit.parents) {
      commit.parents.forEach((parentId) => {
        if (commits.some((c) => c.id === parentId)) {
          edges.push({
            id: `${parentId}-${commit.id}`,
            source: parentId,
            target: commit.id,
            animated: false,
            style: { stroke: "#94a3b8" },
          });
        }
      });
    }
  });

  return { nodes, edges };
}

export function getBranchHue(name: string) {
  // Normalize name to ensure origin/abc and abc have same color
  // Remove common remote prefixes
  const cleanName = name.replace(/^(origin|upstream|gitlab|github|heroku)\//, "");

  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}

const nodeWidth = 60; // Just enough for the circle + padding
const nodeHeight = 60; // Enough for circle + label below
