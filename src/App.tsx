import { useState, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch, FolderOpen, Sun, Moon, Plus, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

import { Button } from "@/components/ui/button";
import { GitGraphView } from "@/components/GitGraphView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [openRepos, setOpenRepos] = useState<string[]>([]);
  const [activeRepo, setActiveRepo] = useState<string | null>(null);

  // Initialize dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const handleOpenRepo = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Open Git Repository",
    });

    if (selected && typeof selected === "string") {
      if (!openRepos.includes(selected)) {
        setOpenRepos([...openRepos, selected]);
      }
      setActiveRepo(selected);
    }
  };

  const closeRepo = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const newRepos = openRepos.filter((p) => p !== path);
    setOpenRepos(newRepos);
    if (activeRepo === path) {
      setActiveRepo(newRepos.length > 0 ? newRepos[newRepos.length - 1] : null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent, path: string) => {
    if (e.button === 1) {
      // Middle click
      e.preventDefault(); // Prevent default middle click behavior (like scroll)
      closeRepo(e, path);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 border-b flex items-center px-4 justify-between bg-card z-10 shrink-0">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex items-center gap-2 font-bold text-lg shrink-0">
            <GitBranch className="w-5 h-5" />
            <span>Super Git Graph</span>
          </div>

          <div className="h-6 w-px bg-border mx-2 shrink-0" />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleOpenRepo}
            >
              <FolderOpen className="w-4 h-4" />
              Open Repo
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
      </header>

      {/* Tabs and Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {openRepos.length > 0 ? (
          <Tabs
            value={activeRepo || undefined}
            onValueChange={setActiveRepo}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="border-b bg-muted/40 px-4 pt-2">
              <TabsList className="bg-transparent h-auto p-0 gap-2 w-full justify-start overflow-x-auto no-scrollbar">
                {openRepos.map((path) => (
                  <TabsTrigger
                    key={path}
                    value={path}
                    className="data-[state=active]:bg-background data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border rounded-t-md px-3 py-2 h-9 flex items-center gap-2 group min-w-[120px] max-w-[200px]"
                    onMouseDown={(e) => handleMouseDown(e, path)}
                  >
                    <span className="truncate text-xs">
                      {path.split("/").pop()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => closeRepo(e, path)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded-sm transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {openRepos.map((path) => (
              <TabsContent
                key={path}
                value={path}
                className="flex-1 m-0 p-0 overflow-hidden relative"
                forceMount={true} // Keep mounted to preserve graph state
                hidden={activeRepo !== path} // Hide instead of unmount
              >
                <div className="w-full h-full">
                  <ReactFlowProvider>
                    <GitGraphView
                      repoPath={path}
                      isActive={activeRepo === path}
                    />
                  </ReactFlowProvider>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
            <GitBranch className="w-16 h-16 opacity-20" />
            <p>Open a Git repository to get started</p>
            <Button onClick={handleOpenRepo}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Open Repository
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
