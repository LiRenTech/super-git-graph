import dagre from "@dagrejs/dagre";
import { Node, Edge, Position } from "@xyflow/react";

export interface GitCommit {
	id: string;
	message: string;
	author: string;
	date: number;
	parents: string[];
}

const nodeWidth = 60; // Just enough for the circle + padding
const nodeHeight = 60; // Enough for circle + label below

export const getLayoutedElements = (commits: GitCommit[]) => {
	const dagreGraph = new dagre.graphlib.Graph();
	dagreGraph.setDefaultEdgeLabel(() => ({}));

	// Rankdir: TB (Top-Bottom) which results in diagonal with proper node configuration
	// Nodesep: Separation between nodes in the same rank.
	// Ranksep: Separation between ranks.
	dagreGraph.setGraph({
		rankdir: "TB",
		nodesep: 60,
		ranksep: 60,
	});

	commits.forEach((commit) => {
		dagreGraph.setNode(commit.id, { width: nodeWidth, height: nodeHeight });
		commit.parents.forEach((parentId) => {
			// Edge direction: Parent -> Child
			dagreGraph.setEdge(parentId, commit.id);
		});
	});

	dagre.layout(dagreGraph);

	const nodes: Node[] = commits.map((commit) => {
		const nodeWithPosition = dagreGraph.node(commit.id);
		// Add offset to create diagonal effect if needed, though DAGre usually handles hierarchy well.
		// For a strict diagonal, we might need custom positioning, but let's try standard DAG layout first
		// as it handles branches better than a hardcoded diagonal.
		return {
			id: commit.id,
			type: "commit", // Use our custom node type
			position: {
				x: nodeWithPosition.x - nodeWidth / 2,
				y: nodeWithPosition.y - nodeHeight / 2,
			},
			data: {
				label: commit.message,
				commit: commit,
			},
			// Remove inline styles as we use Tailwind in the component
			style: {},
		};
	});

	const edges: Edge[] = [];
	commits.forEach((commit) => {
		commit.parents.forEach((parentId) => {
			edges.push({
				id: `e${parentId}-${commit.id}`,
				source: parentId,
				target: commit.id,
				type: "default", // Bezier curve is default in React Flow
				animated: false,
				style: {
					stroke: "hsl(var(--muted-foreground))",
					strokeWidth: 2,
				},
			});
		});
	});

	return { nodes, edges };
};
