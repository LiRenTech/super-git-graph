
import { useGitGraphStore } from "@/store/gitGraphStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCommit, getBranchHue } from "@/lib/graphUtils";
import { Goal, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BranchItem {
  name: string;
  nodeId: string;
  y: number;
  isLoaded: boolean;
}

export function GitBranchList() {
  const { nodes, setFocusNodeId, allRefs } = useGitGraphStore();

  const allBranches = useMemo(() => {
    // If we have allRefs (from get_all_refs), use them as the source of truth
    if (allRefs.length > 0) {
      return allRefs
        .filter((ref) => ref.name !== "HEAD" && !ref.name.startsWith("refs/tags/"))
        .map((ref) => {
          // Check if this ref's commit is currently loaded in the graph
          const node = nodes.find((n) => {
            const commit = n.data.commit as GitCommit;
            return commit && commit.id === ref.commit_id;
          });
          return {
            name: ref.name,
            nodeId: ref.commit_id,
            // If loaded, use its Y position. If not, put it at the end (Infinity)
            y: node ? node.position.y : Infinity,
            isLoaded: !!node,
          };
        })
        .sort((a, b) => {
          // Sort loaded branches by Y position (Top to Bottom)
          // Sort unloaded branches alphabetically
          if (a.y === Infinity && b.y === Infinity) {
             return a.name.localeCompare(b.name);
          }
          if (a.y === Infinity) return 1;
          if (b.y === Infinity) return -1;
          return a.y - b.y;
        });
    }

    // Fallback to nodes if allRefs is empty (e.g. older backend or error)
    const branches: BranchItem[] = [];
    nodes.forEach((node) => {
      const commit = node.data.commit as GitCommit;
      if (commit && commit.refs) {
        commit.refs.forEach((ref) => {
          if (ref !== "HEAD" && !ref.startsWith("refs/tags/")) {
            branches.push({
              name: ref,
              nodeId: node.id,
              y: node.position.y,
              isLoaded: true,
            });
          }
        });
      }
    });
    return branches.sort((a, b) => a.y - b.y);
  }, [nodes, allRefs]);

  const { visible, hidden } = useMemo(() => {
    const visibleBranches: BranchItem[] = [];
    const otherBranches: BranchItem[] = [];

    allBranches.forEach((branch) => {
      // Logic:
      // "In View" (visible): Branches that are loaded (isLoaded = true)
      // "Other Branches" (hidden): Branches that are NOT loaded (isLoaded = false)
      
      if (branch.isLoaded) {
        visibleBranches.push(branch);
      } else {
        otherBranches.push(branch);
      }
    });

    return { visible: visibleBranches, hidden: otherBranches };
  }, [allBranches]);

  const handleJumpTo = (nodeId: string) => {
    setFocusNodeId(nodeId);
  };

  const BranchRow = ({ branch }: { branch: BranchItem }) => {
    const hue = getBranchHue(branch.name);
    return (
      <div className={cn(
        "flex items-center gap-2 py-0.5 px-2 hover:bg-muted/50 rounded-md group text-xs transition-opacity",
        !branch.isLoaded && "opacity-70"
      )}>
        {/* Color Block */}
        <div
          className="w-2.5 h-2.5 rounded-sm shrink-0 border"
          style={{
            backgroundColor: `hsl(${hue}, 85%, 90%)`, // Light mode approximation
            borderColor: `hsl(${hue}, 60%, 80%)`,
          }}
        >
          <div
            className="w-full h-full rounded-sm opacity-0 dark:opacity-100"
            style={{
               backgroundColor: `hsl(${hue}, 60%, 30%)`, // Dark mode approximation
               borderColor: `hsl(${hue}, 60%, 40%)`,
            }}
          />
        </div>

        {/* Branch Name - Flex grow to take available space */}
        <span className="truncate flex-1 min-w-0" title={branch.name}>
          {branch.name}
        </span>

        {/* Jump Button - Fixed width, always visible if loaded */}
        {branch.isLoaded && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                  onClick={() => handleJumpTo(branch.nodeId)}
                >
                  <Goal className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Jump to branch</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 font-semibold text-sm uppercase text-muted-foreground border-b shrink-0 bg-background/50 backdrop-blur-sm">
        Branches
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {visible.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                <span>Loaded</span>
                <span className="text-[10px] bg-muted px-1.5 rounded-full">{visible.length}</span>
              </div>
              <div className="space-y-0.5">
                {visible.map((branch) => (
                  <BranchRow key={branch.name} branch={branch} />
                ))}
              </div>
            </div>
          )}

          {visible.length > 0 && hidden.length > 0 && (
             <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Not Loaded</span>
                </div>
             </div>
          )}

          {hidden.length > 0 && (
            <div>
               {visible.length === 0 && (
                 <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                  <span>Not Loaded</span>
                  <span className="text-[10px] bg-muted px-1.5 rounded-full">{hidden.length}</span>
                </div>
               )}
              <div className="space-y-0.5">
                {hidden.map((branch) => (
                  <BranchRow key={branch.name} branch={branch} />
                ))}
              </div>
            </div>
          )}
          
          {visible.length === 0 && hidden.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <GitBranch className="w-8 h-8 opacity-20" />
                  <span>No branches found</span>
              </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
