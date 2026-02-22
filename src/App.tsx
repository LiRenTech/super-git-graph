import { useState, useCallback, useEffect } from "react";
import {
	ReactFlow,
	Background,
	Controls,
	MiniMap,
	useNodesState,
	useEdgesState,
	addEdge,
	Connection,
	Edge,
	Node,
	BackgroundVariant,
	NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	Search,
	RefreshCw,
	GitBranch,
	FolderOpen,
	Sun,
	Moon,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLayoutedElements, GitCommit } from "@/lib/graphUtils";
import { CommitNode } from "@/components/nodes/CommitNode";

// Define node types outside component to prevent re-creation
const nodeTypes: NodeTypes = {
	commit: CommitNode,
};

function App() {
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
	const [repoPath, setRepoPath] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [loading, setLoading] = useState(false);
	const [isDarkMode, setIsDarkMode] = useState(true);

	// Initialize dark mode
	useEffect(() => {
		if (isDarkMode) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}, [isDarkMode]);

	const toggleTheme = () => setIsDarkMode(!isDarkMode);

	const fetchCommits = async (path: string) => {
		try {
			setLoading(true);
			const commits = await invoke<GitCommit[]>("get_commits", {
				repoPath: path,
				limit: 100,
			});
			// Reverse commits to show oldest first (Left -> Right)
			const layoutData = getLayoutedElements(commits.reverse());
			setNodes(layoutData.nodes);
			setEdges(layoutData.edges);
		} catch (error) {
			console.error("Failed to fetch commits:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleOpenRepo = async () => {
		const selected = await open({
			directory: true,
			multiple: false,
			title: "Open Git Repository",
		});

		if (selected && typeof selected === "string") {
			setRepoPath(selected);
			await fetchCommits(selected);
		}
	};

	const handleRefresh = () => {
		if (repoPath) {
			fetchCommits(repoPath);
		}
	};

	const onConnect = useCallback(
		(params: Connection) => setEdges((eds) => addEdge(params, eds)),
		[setEdges],
	);

	return (
		<div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
			{/* Top Bar */}
			<header className="h-14 border-b flex items-center px-4 justify-between bg-card z-10">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2 font-bold text-lg">
						<GitBranch className="w-5 h-5" />
						<span>Super Git Graph</span>
					</div>

					<div className="h-6 w-px bg-border mx-2" />

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="gap-2"
							onClick={handleOpenRepo}
						>
							<FolderOpen className="w-4 h-4" />
							{repoPath ? repoPath.split("/").pop() : "Open Repo"}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							title="Refresh"
							onClick={handleRefresh}
							disabled={!repoPath || loading}
						>
							<RefreshCw
								className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
							/>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={toggleTheme}
							title="Toggle Theme"
						>
							{isDarkMode ? (
								<Sun className="w-4 h-4" />
							) : (
								<Moon className="w-4 h-4" />
							)}
						</Button>
					</div>
				</div>

				<div className="flex items-center gap-2 w-1/3 max-w-sm">
					<div className="relative w-full">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search commits..."
							className="pl-8 h-9"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
				</div>
			</header>

			{/* Main Canvas Area */}
			<main className="flex-1 relative">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					nodesConnectable={false}
					nodesDraggable={true}
					nodeTypes={nodeTypes}
					fitView
					attributionPosition="bottom-right"
					className="bg-slate-50 dark:bg-slate-900 transition-colors duration-200"
				>
					<Background variant={BackgroundVariant.Dots} gap={12} size={1} />
					<Controls className="dark:bg-slate-800 dark:border-slate-700 dark:fill-slate-100 dark:text-slate-100 [&>button]:dark:bg-slate-800 [&>button]:dark:border-slate-700 [&>button]:dark:fill-slate-100 [&>button:hover]:dark:bg-slate-700" />
				</ReactFlow>
			</main>
		</div>
	);
}

export default App;
