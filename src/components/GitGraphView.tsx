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
import { RefreshCw, ArrowUp, Eye, EyeOff } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLayoutedElements, GitCommit } from "@/lib/graphUtils";
import { layoutService } from "@/lib/layoutService";
import { debounce } from "@/lib/utils";
import { CommitNode } from "@/components/nodes/CommitNode";
import { useGitGraphStore, GitRef } from "@/store/gitGraphStore";
import { DiffDialog } from "@/components/DiffDialog";

// Define node types outside component
const nodeTypes: NodeTypes = {
  commit: CommitNode,
};

interface GitGraphViewProps {
  repoPath: string;
  isActive: boolean;
  isDarkMode: boolean;
}

interface CommitResponse {
  commits: GitCommit[];
  has_more: boolean;
}

export function GitGraphView({
  repoPath,
  isActive,
  isDarkMode,
}: GitGraphViewProps) {
  const { fitView, getNodes, setCenter, getViewport } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    isDragSubtreeMode,
    fixedLabelSize,
    setVisibleBranchNames,
    focusNodeId,
    setFocusNodeId,
    setGraphData,
    setAllRefs,
    diffMode,
    endDiffMode,
    setDiffTarget,
    setRepoPath,
    setRefreshCallback,
    showMergeTitles,
    setShowMergeTitles,
  } = useGitGraphStore();
  // const { showCoordinates, setShowCoordinates } = useGitGraphStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [localRefs, setLocalRefs] = useState<GitRef[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const loadedCommits = useRef<GitCommit[]>([]);
  const isCtrlPressed = useRef(false);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [diffArrowNodeId] = useState("__diff_arrow_target__");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") isCtrlPressed.current = true;
      if (e.key === "Escape" && diffMode.active) {
        endDiffMode();
        // Remove diff arrow
        setEdges((prevEdges) => prevEdges.filter((e) => e.id !== "diff-arrow"));
        // Remove virtual target node
        setNodes((prevNodes) =>
          prevNodes.filter((n) => n.id !== diffArrowNodeId),
        );
      }
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
  }, [diffMode.active, endDiffMode, setEdges, setNodes, diffArrowNodeId]);

  // Sync nodes to store when active
  useEffect(() => {
    if (isActive) {
      setGraphData(nodes, edges);
      setAllRefs(localRefs);
      // Also update visible branches based on current viewport when becoming active
      // This is needed because onMoveEnd might not fire if we just switch tabs without moving
      // We can trigger a recalculation or just let the user move to update
      // But ideally we should preserve visible branches state too?
      // For now, let's just ensure the data is correct.
    }
  }, [isActive, nodes, edges, localRefs, setGraphData, setAllRefs]);

  const fetchAllRefs = useCallback(
    async (path: string) => {
      try {
        const refs = await invoke<GitRef[]>("get_all_refs", {
          repoPath: path,
        });
        setLocalRefs(refs);
        if (isActive) {
          setAllRefs(refs);
        }
      } catch (e) {
        console.error("Failed to fetch refs", e);
      }
    },
    [isActive, setAllRefs],
  );

  const fetchCommits = useCallback(
    async (path: string, isLoadMore = false, preserveViewport = false) => {
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

        // Add repoPath to node data
        const nodesWithRepoPath = layoutData.nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            repoPath: path,
          },
        }));

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
            const anchorNodeNewDagre = nodesWithRepoPath.find(
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

            return nodesWithRepoPath.map((newNode) => {
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

            for (const node of nodesWithRepoPath) {
              if (finalPositions.has(node.id)) {
                const pos = finalPositions.get(node.id)!;
                resolvedNodes.push({ ...node, position: pos });
              } else {
                // Not cached. Try to align with parents.
                const nodeData = node.data as {
                  commit: GitCommit;
                  repoPath: string;
                };
                const parents = nodeData.commit.parents;
                let delta = { x: 0, y: 0 };

                if (parents && parents.length > 0) {
                  // Find first parent that has a final position
                  for (const pid of parents) {
                    if (finalPositions.has(pid)) {
                      const pFinal = finalPositions.get(pid)!;
                      // Find parent's dagre position
                      const pDagre = nodesWithRepoPath.find(
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
            setNodes(nodesWithRepoPath);
          }
        }

        // Delay setting edges to ensure nodes are registered in React Flow
        // This fixes the issue where edges sometimes don't render on initial load
        setTimeout(() => {
          console.log("Updating edges:", layoutData.edges.length);
          setEdges([...layoutData.edges]);

          // Fit view after edges are set, but only if we're not preserving viewport
          if (!isLoadMore && !preserveViewport) {
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

  // Set repoPath in store when component mounts or repoPath changes
  useEffect(() => {
    setRepoPath(repoPath);
  }, [repoPath, setRepoPath]);

  // Set refresh callback
  useEffect(() => {
    setRefreshCallback((path) => fetchCommits(path, false, true)); // preserveViewport = true for checkout refresh
    return () => {
      setRefreshCallback(() => {});
    };
  }, [fetchCommits, setRefreshCallback]);

  // Initial load
  useEffect(() => {
    fetchCommits(repoPath);
    fetchAllRefs(repoPath);
  }, [repoPath, fetchCommits, fetchAllRefs]);

  const handleRefresh = () => {
    fetchCommits(repoPath, false, true);
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

  const saveLayoutDebounced = useCallback(
    debounce((layoutData: { [key: string]: { x: number; y: number } }) => {
      layoutService.saveLayout(repoPath, layoutData);
    }, 500),
    [repoPath],
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

      saveLayoutDebounced(layoutData);
    },
    [repoPath, getNodes],
  );

  const onMove = useCallback(
    (viewport: Viewport) => {
      if (containerRef.current) {
        // Threshold where we start clamping the scale to keep labels readable
        // Higher value = larger labels when zoomed out
        const minScale = 1.0;
        let scale = 1;
        if (fixedLabelSize) {
          scale = viewport.zoom < minScale ? minScale / viewport.zoom : 1;
        }
        containerRef.current.style.setProperty(
          "--label-scale",
          scale.toString(),
        );
      }
    },
    [fixedLabelSize],
  );

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

  // Handle mouse movement in diff mode
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!diffMode.active || !containerRef.current || !diffMode.sourceCommitId)
        return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Convert screen coordinates to graph coordinates
      const viewport = getViewport();
      const graphX = (x - viewport.x) / viewport.zoom;
      const graphY = (y - viewport.y) / viewport.zoom;

      // Update the diff arrow edge
      setEdges((prevEdges) => {
        const filteredEdges = prevEdges.filter((e) => e.id !== "diff-arrow");

        return [
          ...filteredEdges,
          {
            id: "diff-arrow",
            source: diffMode.sourceCommitId!,
            target: diffArrowNodeId,
            type: "default",
            animated: false,
            style: {
              stroke: "#3b82f6",
              strokeWidth: 4,
            },
            markerEnd: {
              type: "arrowclosed",
              color: "#3b82f6",
              strokeWidth: 4,
              orient: "auto",
            },
            focusable: false,
            selectable: false,
            zIndex: 1000,
          } as Edge,
        ];
      });

      // Update the virtual target node position
      setNodes((prevNodes) => {
        const hasVirtualNode = prevNodes.some((n) => n.id === diffArrowNodeId);
        if (hasVirtualNode) {
          return prevNodes.map((n) =>
            n.id === diffArrowNodeId
              ? { ...n, position: { x: graphX, y: graphY } }
              : n,
          );
        } else {
          return [
            ...prevNodes,
            {
              id: diffArrowNodeId,
              position: { x: graphX, y: graphY },
              data: {},
              style: {
                opacity: 0,
                width: 0,
                height: 0,
              },
            } as Node,
          ];
        }
      });
    },
    [
      diffMode.active,
      diffMode.sourceCommitId,
      setEdges,
      setNodes,
      getViewport,
      diffArrowNodeId,
    ],
  );

  // Handle node click in diff mode
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!diffMode.active || diffMode.sourceCommitId === null) return;

      // Skip if trying to diff with "working-copy"
      if (node.id === "working-copy") {
        return;
      }

      event.stopPropagation();

      console.log("Node clicked in diff mode:", node.id);
      setDiffTarget(node.id);
      setShowDiffDialog(true);

      // Remove diff arrow immediately
      console.log("Removing diff arrow");
      setEdges((prevEdges) => {
        const filtered = prevEdges.filter((e) => e.id !== "diff-arrow");
        console.log("Edges after removal:", filtered.length);
        return filtered;
      });
      // Remove virtual target node immediately
      setNodes((prevNodes) => {
        const filtered = prevNodes.filter((n) => n.id !== diffArrowNodeId);
        console.log("Nodes after removal:", filtered.length);
        return filtered;
      });
    },
    [
      diffMode.active,
      diffMode.sourceCommitId,
      setDiffTarget,
      setEdges,
      setNodes,
      diffArrowNodeId,
    ],
  );

  // Handle canvas click to exit diff mode
  const handleCanvasClick = useCallback(() => {
    // Don't exit diff mode if dialog is open
    if (diffMode.active && !showDiffDialog) {
      endDiffMode();
      // Remove diff arrow
      setEdges((prevEdges) => prevEdges.filter((e) => e.id !== "diff-arrow"));
      // Remove virtual target node
      setNodes((prevNodes) =>
        prevNodes.filter((n) => n.id !== diffArrowNodeId),
      );
    }
  }, [
    diffMode.active,
    showDiffDialog,
    endDiffMode,
    setEdges,
    setNodes,
    diffArrowNodeId,
  ]);

  return (
    <div
      className="flex flex-col h-full w-full relative"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={handleCanvasClick}
    >
      {/* Diff Mode Indicator */}
      {diffMode.active && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg flex items-center gap-2 pointer-events-none">
          <span>Diff mode: Click another commit to compare</span>
          <span className="text-xs opacity-75">(ESC to cancel)</span>
        </div>
      )}

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
          onClick={() => setShowMergeTitles(!showMergeTitles)}
          className="bg-background/80 backdrop-blur"
          title={
            showMergeTitles
              ? "Hide merge commit titles"
              : "Show merge commit titles"
          }
        >
          {showMergeTitles ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </Button>
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
        onNodeClick={handleNodeClick}
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

      {/* Diff Dialog */}
      <DiffDialog
        open={showDiffDialog}
        onClose={() => {
          setShowDiffDialog(false);
          // Clean up diff mode when dialog is closed
          endDiffMode();
          // Remove diff arrow and virtual node
          setEdges((prevEdges) =>
            prevEdges.filter((e) => e.id !== "diff-arrow"),
          );
          setNodes((prevNodes) =>
            prevNodes.filter((n) => n.id !== diffArrowNodeId),
          );
        }}
        repoPath={repoPath}
        sourceCommitId={diffMode.sourceCommitId}
        targetCommitId={diffMode.targetCommitId}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
