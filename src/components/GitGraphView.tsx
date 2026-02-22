import { useState, useCallback, useEffect, useRef } from "react";
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  Viewport
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RefreshCw, GitBranch, Sun, Moon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLayoutedElements, GitCommit } from "@/lib/graphUtils";
import { CommitNode } from "@/components/nodes/CommitNode";

// Define node types outside component
const nodeTypes: NodeTypes = {
  commit: CommitNode,
};

interface GitGraphViewProps {
  repoPath: string;
  isActive: boolean;
}

export function GitGraphView({ repoPath, isActive }: GitGraphViewProps) {
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCommits = useCallback(async (path: string) => {
    try {
      setLoading(true);
      const commits = await invoke<GitCommit[]>('get_commits', { repoPath: path, limit: 100 });
      // Reverse commits to show oldest first (Top -> Bottom)
      const layoutData = getLayoutedElements(commits.reverse());
      setNodes(layoutData.nodes);
      setEdges(layoutData.edges);
      
      // Fit view after a short delay to allow rendering
      setTimeout(() => fitView({ padding: 0.2 }), 100);
    } catch (error) {
      console.error("Failed to fetch commits:", error);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges, fitView]);

  // Initial load
  useEffect(() => {
    fetchCommits(repoPath);
  }, [repoPath, fetchCommits]);

  const handleRefresh = () => {
    fetchCommits(repoPath);
  };

  // Filter nodes based on search query
  useEffect(() => {
    setNodes((nds) => 
      nds.map((node) => {
        if (!searchQuery) return { ...node, hidden: false };
        
        const label = (node.data.label as string).toLowerCase();
        const id = node.id.toLowerCase();
        const query = searchQuery.toLowerCase();
        const isMatch = label.includes(query) || id.includes(query);
        
        return { 
          ...node, 
          hidden: !isMatch,
          style: { 
            ...node.style,
            opacity: isMatch ? 1 : 0.1 
          }
        };
      })
    );
  }, [searchQuery, setNodes]);

  const onMove = useCallback((viewport: Viewport) => {
    if (containerRef.current) {
      // Threshold where we start clamping the scale to keep labels readable
      // Higher value = larger labels when zoomed out
      const minScale = 1.0;
      const scale = viewport.zoom < minScale ? minScale / viewport.zoom : 1;
      containerRef.current.style.setProperty('--label-scale', scale.toString());
    }
  }, []);

  return (
    <div className="flex flex-col h-full w-full relative" ref={containerRef}>
      {/* Toolbar overlay */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <div className="w-64">
          <Input
            type="search"
            placeholder="Search commits..."
            className="h-9 bg-background/80 backdrop-blur"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={handleRefresh} 
          disabled={loading}
          className="bg-background/80 backdrop-blur"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false}
        nodesDraggable={true}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.01}
        maxZoom={10}
        attributionPosition="bottom-right"
        onMove={(_, viewport) => onMove(viewport)}
        className="bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200"
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls className="dark:bg-zinc-800 dark:border-zinc-700 dark:fill-zinc-100 dark:text-zinc-100 [&>button]:dark:bg-zinc-800 [&>button]:dark:border-zinc-700 [&>button]:dark:fill-zinc-100 [&>button:hover]:dark:bg-zinc-700" />
      </ReactFlow>
    </div>
  );
}
