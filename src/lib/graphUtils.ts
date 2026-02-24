import dagre from "@dagrejs/dagre";
import { Node, Edge } from "@xyflow/react";

export interface GitCommit {
  id: string;
  message: string;
  author: string;
  date: number;
  /**
   * Parent commit IDs. For merge commits, the first parent (parents[0]) is the main line,
   * and subsequent parents are merged branches.
   */
  parents: string[];
  refs: string[];
  /**
   * For uncommitted changes node (id === "working-copy"), indicates the type of changes.
   * - "staged": only staged changes
   * - "unstaged": only unstaged (working directory) changes
   * - "mixed": both staged and unstaged changes
   */
  uncommitted_state?: string;
}

export interface LayoutedElements {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Creates nodes and edges for the Git graph visualization.
 * 
 * Edge styling rules:
 * - Edge color is based on the target commit's author (hue derived from author string hash)
 * - For merge commits (commits with multiple parents):
 *   - First parent (parents[0]) -> solid line (main line)
 *   - Second and subsequent parents -> dashed line (merged branches)
 * 
 * Example: If commit B is a merge of A (main) and C (branch):
 *   - A->B: solid line
 *   - C->B: dashed line
 */
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
      commit.parents.forEach((parentId, index) => {
        if (commits.some((c) => c.id === parentId)) {
          // Use gray for edges pointing to uncommitted changes node
          const stroke = commit.id === "working-copy" 
            ? "#6b7280" // same gray as the node background
            : `hsl(${getAuthorHue(commit.author)}, 60%, 60%)`;
          const style: { stroke: string; strokeWidth?: number; strokeDasharray?: string } = { 
            stroke,
            strokeWidth: 4,
          };
          // For merge commits, only the second and subsequent parents (merged branches) get dashed lines
          // First parent (main line) remains solid
          if (commit.parents.length > 1 && index > 0) {
            style.strokeDasharray = "10,10";
          }
          edges.push({
            id: `${parentId}-${commit.id}`,
            source: parentId,
            target: commit.id,
            animated: false,
            style,
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

export function isRemoteBranch(name: string): boolean {
  // Check if the branch name is a remote branch (contains slash and starts with common remote names)
  return name.includes("/") &&
    (name.startsWith("origin/") ||
     name.startsWith("upstream/") ||
     name.startsWith("fork/"));
}

export function getAuthorHue(author: string) {
  // Use the entire author string for hashing
  let hash = 0;
  for (let i = 0; i < author.length; i++) {
    hash = author.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}


