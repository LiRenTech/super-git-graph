import { useState, useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Controls,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
  NodeTypes,
  useReactFlow,
  Viewport,
  OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RefreshCw, ArrowUp } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLayoutedElements, GitCommit } from "@/lib/graphUtils";
import { layoutService } from "@/lib/layoutService";
import { CommitNode } from "@/components/nodes/CommitNode";
import { useGitGraphStore, GitRef } from "@/store/gitGraphStore";

// Define node types outside component
const nodeTypes: NodeTypes = {
  commit: CommitNode,
};

interface GitGraphViewProps {
  repoPath: string;
  isActive: boolean;
}

interface CommitResponse {
  commits: GitCommit[];
  has_more: boolean;
}

export function GitGraphView({ repoPath, isActive }: GitGraphViewProps) {
  const { fitView, getNodes, setCenter, getViewport } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    isDragSubtreeMode,
    setVisibleBranchNames,
    focusNodeId,
    setFocusNodeId,
    setGraphData,
    setAllRefs,
  } = useGitGraphStore();
  // const { showCoordinates, setShowCoordinates } = useGitGraphStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadedCommits = useRef<GitCommit[]>([]);
  const isCtrlPressed = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") isCtrlPressed.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta")
        isCtrlPressed.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Sync nodes to store when active
  useEffect(() => {
    if (isActive) {
      setGraphData(nodes, edges);
    }
  }, [isActive, nodes, edges, setGraphData]);

  const fetchAllRefs = useCallback(
    async (path: string) => {
      try {
        const refs = await invoke<GitRef[]>("get_all_refs", {
          repoPath: path,
        });
        setAllRefs(refs);
      } catch (e) {
        console.error("Failed to fetch refs", e);
      }
    },
    [setAllRefs],
  );

  const fetchCommits = useCallback(
    async (path: string, isLoadMore = false) => {
      try {
        setLoading(true);
        // If it's load more, we want to fetch the next batch.
        // We use loadedCommits.current.length as the skip offset.
        // But we need to handle the case where "Uncommitted Changes" is present.
        // "Uncommitted Changes" is NOT a real commit in git history, so git2 revwalk won't count it.
        // But our loadedCommits array INCLUDES it.
        // So if loadedCommits has "working-copy", we should subtract 1 from skip.

        let skip = isLoadMore ? loadedCommits.current.length : 0;
        if (
          isLoadMore &&
          loadedCommits.current.some((c) => c.id === "working-copy")
        ) {
          skip -= 1;
        }

        const limit = 50;

        // Capture the oldest commit ID before updating loadedCommits
        // Since loadedCommits is ordered [Newest ... Oldest], the oldest is the last one.
        const previousOldestCommitId =
          isLoadMore && loadedCommits.current.length > 0
            ? loadedCommits.current[loadedCommits.current.length - 1].id
            : null;

        const response = await invoke<CommitResponse>("get_commits", {
          repoPath: path,
          limit,
          skip: skip > 0 ? skip : undefined,
        });

        const newCommits = response.commits;

        if (isLoadMore) {
          loadedCommits.current = [...loadedCommits.current, ...newCommits];
        } else {
          loadedCommits.current = newCommits;
        }

        setHasMore(response.has_more);

        // Reverse commits to show oldest first (Top -> Bottom)
        // We use a copy for layout calculation
        const allCommits = [...loadedCommits.current].reverse();
        const layoutData = getLayoutedElements(allCommits);

        // Load cached layout
        const cachedLayout = await layoutService.getLayout(path);

        if (cachedLayout) {
          console.log("Applying cached layout to nodes");
        }

        if (isLoadMore && previousOldestCommitId) {
          // Preserve existing node positions
          setNodes((currentNodes) => {
            const currentNodesMap = new Map(currentNodes.map((n) => [n.id, n]));

            // Anchor from Current View (Real-time position)
            const anchorNodeCurrent = currentNodesMap.get(
              previousOldestCommitId,
            );

            // Anchor from Cache (Saved position)
            const anchorNodeCachePos = cachedLayout
              ? cachedLayout[previousOldestCommitId]
              : null;

            // Anchor from New Dagre Layout (Default position for uncached nodes)
            const anchorNodeNewDagre = layoutData.nodes.find(
              (n) => n.id === previousOldestCommitId,
            );

            let dagreDeltaX = 0;
            let dagreDeltaY = 0;

            let cacheDeltaX = 0;
            let cacheDeltaY = 0;

            if (anchorNodeCurrent && anchorNodeNewDagre) {
              dagreDeltaX =
                anchorNodeCurrent.position.x - anchorNodeNewDagre.position.x;
              dagreDeltaY =
                anchorNodeCurrent.position.y - anchorNodeNewDagre.position.y;
            }

            if (anchorNodeCurrent && anchorNodeCachePos) {
              cacheDeltaX = anchorNodeCurrent.position.x - anchorNodeCachePos.x;
              cacheDeltaY = anchorNodeCurrent.position.y - anchorNodeCachePos.y;
            }

            return layoutData.nodes.map((newNode) => {
              // 1. If in current view (dragged by user previously in this session), use current pos
              const existingNode = currentNodesMap.get(newNode.id);
              if (existingNode) {
                return { ...newNode, position: existingNode.position };
              }

              // 2. If node is in cache (and we have a valid cache anchor to align it), use cached pos aligned to current view
              if (
                cachedLayout &&
                cachedLayout[newNode.id] &&
                anchorNodeCachePos
              ) {
                return {
                  ...newNode,
                  position: {
                    x: cachedLayout[newNode.id].x + cacheDeltaX,
                    y: cachedLayout[newNode.id].y + cacheDeltaY,
                  },
                };
              }

              // 3. Fallback: Use Dagre layout with delta offset (for completely new/uncached nodes)
              return {
                ...newNode,
                position: {
                  x: newNode.position.x + dagreDeltaX,
                  y: newNode.position.y + dagreDeltaY,
                },
              };
            });
          });
          // For load more, we don't need to update edges explicitly here as they are updated below
          // But we need to make sure finalNodes is not used for setNodes in this branch
        } else {
          // Initial Load or Refresh
          // Apply cached positions if available
          if (cachedLayout) {
            const resolvedNodes = [];
            const finalPositions = new Map<string, { x: number; y: number }>();

            // Populate map with cached positions first
            Object.entries(cachedLayout).forEach(([id, pos]) => {
              finalPositions.set(id, pos);
            });

            for (const node of layoutData.nodes) {
              if (finalPositions.has(node.id)) {
                const pos = finalPositions.get(node.id)!;
                resolvedNodes.push({ ...node, position: pos });
              } else {
                // Not cached. Try to align with parents.
                const nodeData = node.data as { commit: GitCommit };
                const parents = nodeData.commit.parents;
                let delta = { x: 0, y: 0 };

                if (parents && parents.length > 0) {
                  // Find first parent that has a final position
                  for (const pid of parents) {
                    if (finalPositions.has(pid)) {
                      const pFinal = finalPositions.get(pid)!;
                      // Find parent's dagre position
                      const pDagre = layoutData.nodes.find(
                        (n) => n.id === pid,
                      )?.position;
                      if (pDagre) {
                        delta = {
                          x: pFinal.x - pDagre.x,
                          y: pFinal.y - pDagre.y,
                        };
                        break;
                      }
                    }
                  }
                }

                const newPos = {
                  x: node.position.x + delta.x,
                  y: node.position.y + delta.y,
                };

                // Store for children
                finalPositions.set(node.id, newPos);
                resolvedNodes.push({ ...node, position: newPos });
              }
            }
            setNodes(resolvedNodes);
          } else {
            setNodes(layoutData.nodes);
          }
        }

        // Delay setting edges to ensure nodes are registered in React Flow
        // This fixes the issue where edges sometimes don't render on initial load
        setTimeout(() => {
          console.log("Updating edges:", layoutData.edges.length);
          setEdges([...layoutData.edges]);

          // Fit view after edges are set
          if (!isLoadMore) {
            setTimeout(() => fitView({ padding: 0.2 }), 50);
          }
        }, 10);
      } catch (error) {
        console.error("Failed to fetch commits:", error);
      } finally {
        setLoading(false);
      }
    },
    [setNodes, setEdges, fitView],
  );

  // Initial load
  useEffect(() => {
    fetchCommits(repoPath);
    fetchAllRefs(repoPath);
  }, [repoPath, fetchCommits, fetchAllRefs]);

  const handleRefresh = () => {
    fetchCommits(repoPath);
    fetchAllRefs(repoPath);
  };

  const handleLoadMore = () => {
    fetchCommits(repoPath, true);
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
            opacity: isMatch ? 1 : 0.1,
          },
        };
      }),
    );
  }, [searchQuery, setNodes]);

  // To implement this correctly with delta, we need to track the last position
  const lastNodePos = useRef<{ x: number; y: number } | null>(null);

  const onNodeDragStart: OnNodeDrag = useCallback((_, node) => {
    lastNodePos.current = { ...node.position };
  }, []);

  const onNodeDragHandler: OnNodeDrag = useCallback(
    (_, node) => {
      // Logic for Drag Mode:
      // isDragSubtreeMode = true (Default Subtree):
      //    - Drag: Move Subtree
      //    - Ctrl + Drag: Move Single Node
      // isDragSubtreeMode = false (Default Single):
      //    - Drag: Move Single Node
      //    - Ctrl + Drag: Move Subtree

      const isSubtreeDrag = isDragSubtreeMode
        ? !isCtrlPressed.current // Mode=Subtree: No Ctrl -> Subtree
        : isCtrlPressed.current; // Mode=Single: Ctrl -> Subtree

      if (!isSubtreeDrag || !lastNodePos.current) {
        lastNodePos.current = { ...node.position };
        return;
      }

      const dx = node.position.x - lastNodePos.current.x;
      const dy = node.position.y - lastNodePos.current.y;

      if (dx === 0 && dy === 0) return;

      // Find descendants
      const descendants = new Set<string>();
      const queue = [node.id];

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const childEdges = edges.filter((e) => e.source === currentId);

        childEdges.forEach((edge) => {
          if (!descendants.has(edge.target)) {
            descendants.add(edge.target);
            queue.push(edge.target);
          }
        });
      }

      if (descendants.size > 0) {
        setNodes((nds) =>
          nds.map((n) => {
            if (descendants.has(n.id)) {
              return {
                ...n,
                position: {
                  x: n.position.x + dx,
                  y: n.position.y + dy,
                },
              };
            }
            return n;
          }),
        );
      }

      lastNodePos.current = { ...node.position };
    },
    [edges, setNodes, isDragSubtreeMode],
  );

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_, _node, _nodes) => {
      // Save all node positions to layout service
      // We use getNodes() to ensure we get the latest state of all nodes,
      // including those moved programmatically by our custom drag handler.
      const allNodes = getNodes();

      const layoutData = allNodes.reduce(
        (acc, n) => {
          acc[n.id] = { x: n.position.x, y: n.position.y };
          return acc;
        },
        {} as { [key: string]: { x: number; y: number } },
      );

      layoutService.saveLayout(repoPath, layoutData);
    },
    [repoPath, getNodes],
  );

  const onMove = useCallback((viewport: Viewport) => {
    if (containerRef.current) {
      // Threshold where we start clamping the scale to keep labels readable
      // Higher value = larger labels when zoomed out
      const minScale = 1.0;
      const scale = viewport.zoom < minScale ? minScale / viewport.zoom : 1;
      containerRef.current.style.setProperty("--label-scale", scale.toString());
    }
  }, []);

  // Update visible branches on move end
  const onMoveEnd = useCallback(() => {
    if (!isActive || !containerRef.current) return;

    const { x, y, zoom } = getViewport();
    const { width, height } = containerRef.current.getBoundingClientRect();

    // Calculate visible area in graph coordinates
    // x_screen = x_graph * zoom + x_viewport
    // x_graph = (x_screen - x_viewport) / zoom
    const minX = -x / zoom;
    const maxX = (width - x) / zoom;
    const minY = -y / zoom;
    const maxY = (height - y) / zoom;

    const currentNodes = getNodes();
    const visibleBranches = new Set<string>();

    currentNodes.forEach((node) => {
      const commit = node.data.commit as GitCommit;
      if (!commit || !commit.refs) return;

      // Check if node is within viewport (approximate with point check for performance)
      // Ideally check bounding box overlap, but point check is faster and good enough for list
      const isVisible =
        node.position.x >= minX - 100 && // Add padding
        node.position.x <= maxX + 100 &&
        node.position.y >= minY - 100 &&
        node.position.y <= maxY + 100;

      if (isVisible) {
        commit.refs.forEach((ref) => {
          if (ref !== "HEAD" && !ref.startsWith("refs/tags/")) {
            visibleBranches.add(ref);
          }
        });
      }
    });

    setVisibleBranchNames(Array.from(visibleBranches));
  }, [getNodes, getViewport, setVisibleBranchNames]);

  // Handle focus request
  useEffect(() => {
    if (focusNodeId) {
      const node = getNodes().find((n) => n.id === focusNodeId);
      if (node) {
        setCenter(node.position.x, node.position.y, {
          zoom: 1.5,
          duration: 800,
        });
        setFocusNodeId(null);
      }
    }
  }, [focusNodeId, getNodes, setCenter, setFocusNodeId]);

  return (
    <div className="flex flex-col h-full w-full relative" ref={containerRef}>
      {/* Load More Button */}
      {hasMore && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loading}
            className="bg-background/80 backdrop-blur gap-2 shadow-sm"
          >
            <ArrowUp className={`w-4 h-4 ${loading ? "animate-bounce" : ""}`} />
            {loading ? "Loading..." : "Load Older Commits"}
          </Button>
        </div>
      )}

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
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false}
        nodesDraggable={true}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDragHandler}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.01}
        maxZoom={10}
        attributionPosition="bottom-right"
        onMove={(_, viewport) => onMove(viewport)}
        onMoveEnd={onMoveEnd}
        className="bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200"
        edgesFocusable={false}
        elementsSelectable={true}
      >
        <Controls className="dark:bg-zinc-800 dark:border-zinc-700 dark:fill-zinc-100 dark:text-zinc-100 [&>button]:dark:bg-zinc-800 [&>button]:dark:border-zinc-700 [&>button]:dark:fill-zinc-100 [&>button:hover]:dark:bg-zinc-700" />
      </ReactFlow>
    </div>
  );
}
