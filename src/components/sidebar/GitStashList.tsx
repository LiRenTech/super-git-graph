import { useGitGraphStore } from "@/store/gitGraphStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCommit } from "@/lib/graphUtils";
import { Goal, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StashItem {
  name: string;
  nodeId: string;
  y: number;
  isLoaded: boolean;
}

export function GitStashList() {
  const { nodes, setFocusNodeId, allRefs } = useGitGraphStore();

  const allStashes = useMemo(() => {
    // If we have allRefs (from get_all_refs), use them as the source of truth
    if (allRefs.length > 0) {
      return allRefs
        .filter((ref) => ref.name.startsWith("stash@{"))
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
          // Sort loaded stashes by Y position (Top to Bottom)
          // Sort unloaded stashes by stash index (reverse chronological order)
          // stash@{0} is the latest stash, stash@{1} is older, etc.
          if (a.y === Infinity && b.y === Infinity) {
            // Both unloaded, sort by stash index numerically
            const aIndex = parseInt(a.name.match(/\{(\d+)\}/)?.[1] || "0");
            const bIndex = parseInt(b.name.match(/\{(\d+)\}/)?.[1] || "0");
            return aIndex - bIndex; // Older stash (higher index) first
          }
          if (a.y === Infinity) return 1;
          if (b.y === Infinity) return -1;
          return a.y - b.y;
        });
    }

    // Fallback to nodes if allRefs is empty (e.g. older backend or error)
    const stashes: StashItem[] = [];
    nodes.forEach((node) => {
      const commit = node.data.commit as GitCommit;
      if (commit && commit.refs) {
        commit.refs.forEach((ref) => {
          if (ref.startsWith("stash@{")) {
            stashes.push({
              name: ref,
              nodeId: node.id,
              y: node.position.y,
              isLoaded: true,
            });
          }
        });
      }
    });
    return stashes.sort((a, b) => a.y - b.y);
  }, [nodes, allRefs]);

  const { visible, hidden } = useMemo(() => {
    const visibleStashes: StashItem[] = [];
    const otherStashes: StashItem[] = [];

    allStashes.forEach((stash) => {
      // Logic:
      // "In View" (visible): Stashes that are loaded (isLoaded = true)
      // "Other Stashes" (hidden): Stashes that are NOT loaded (isLoaded = false)
      
      if (stash.isLoaded) {
        visibleStashes.push(stash);
      } else {
        otherStashes.push(stash);
      }
    });

    return { visible: visibleStashes, hidden: otherStashes };
  }, [allStashes]);

  const handleJumpTo = (nodeId: string) => {
    setFocusNodeId(nodeId);
  };

  const StashRow = ({ stash }: { stash: StashItem }) => {
    // Fixed color for stashes (orange)
    const hue = 30;
    const saturation = 70;
    const lightness = 70;
    return (
      <div className={cn(
        "flex items-center gap-2 py-0.5 px-2 hover:bg-muted/50 rounded-md group text-xs transition-opacity relative w-full overflow-hidden",
        !stash.isLoaded && "opacity-70"
      )}>
        {/* Color Block - fixed orange */}
        <div
          className="w-2.5 h-2.5 rounded-sm shrink-0 border"
          style={{
            backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`, // Light mode approximation
            borderColor: `hsl(${hue}, ${saturation}%, ${lightness - 10}%)`,
          }}
        >
          <div
            className="w-full h-full rounded-sm opacity-0 dark:opacity-100"
            style={{
               backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness - 40}%)`, // Dark mode approximation
               borderColor: `hsl(${hue}, ${saturation}%, ${lightness - 30}%)`,
            }}
          />
        </div>

        {/* Stash Name - Flex grow to take available space */}
        <span 
          className={cn(
            "truncate flex-1 min-w-0",
            stash.isLoaded && "pr-6" // Reserve space for the absolute button
          )} 
          title={stash.name}
        >
          {stash.name}
        </span>

        {/* Jump Button - Fixed width, always visible if loaded */}
        {stash.isLoaded && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 opacity-100 transition-opacity focus:opacity-100 hover:bg-muted"
                    onClick={() => handleJumpTo(stash.nodeId)}
                  >
                    <Goal className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Jump to stash</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 font-semibold text-sm uppercase text-muted-foreground border-b shrink-0 bg-background/50 backdrop-blur-sm overflow-hidden">
        Stashes
      </div>
      <ScrollArea className="flex-1 w-full overflow-hidden">
        <div className="p-2 space-y-4 w-full">
          {visible.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                <span>Loaded</span>
                <span className="text-[10px] bg-muted px-1.5 rounded-full">{visible.length}</span>
              </div>
              <div className="space-y-0.5">
                {visible.map((stash) => (
                  <StashRow key={stash.name} stash={stash} />
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
                {hidden.map((stash) => (
                  <StashRow key={stash.name} stash={stash} />
                ))}
              </div>
            </div>
          )}
          
          {visible.length === 0 && hidden.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <Archive className="w-8 h-8 opacity-20" />
                  <span>No stashes found</span>
              </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}