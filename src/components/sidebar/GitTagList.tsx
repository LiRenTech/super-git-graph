import { useGitGraphStore } from "@/store/gitGraphStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCommit } from "@/lib/graphUtils";
import { Goal, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TagItem {
  name: string;
  nodeId: string;
  y: number;
  isLoaded: boolean;
}

export function GitTagList() {
  const { nodes, setFocusNodeId, allRefs } = useGitGraphStore();

  const allTags = useMemo(() => {
    // If we have allRefs (from get_all_refs), use them as the source of truth
    if (allRefs.length > 0) {
      return allRefs
        .filter((ref) => ref.name.startsWith("refs/tags/"))
        .map((ref) => {
          // Check if this ref's commit is currently loaded in the graph
          const node = nodes.find((n) => {
            const commit = n.data.commit as GitCommit;
            return commit && commit.id === ref.commit_id;
          });
          // Strip the "refs/tags/" prefix for display
          const displayName = ref.name.replace(/^refs\/tags\//, "");
          return {
            name: displayName,
            nodeId: ref.commit_id,
            // If loaded, use its Y position. If not, put it at the end (Infinity)
            y: node ? node.position.y : Infinity,
            isLoaded: !!node,
          };
        })
        .sort((a, b) => {
          // Sort loaded tags by Y position (Top to Bottom)
          // Sort unloaded tags alphabetically
          if (a.y === Infinity && b.y === Infinity) {
             return a.name.localeCompare(b.name);
          }
          if (a.y === Infinity) return 1;
          if (b.y === Infinity) return -1;
          return a.y - b.y;
        });
    }

    // Fallback to nodes if allRefs is empty (e.g. older backend or error)
    const tags: TagItem[] = [];
    nodes.forEach((node) => {
      const commit = node.data.commit as GitCommit;
      if (commit && commit.refs) {
        commit.refs.forEach((ref) => {
          if (ref.startsWith("refs/tags/")) {
            const displayName = ref.replace(/^refs\/tags\//, "");
            tags.push({
              name: displayName,
              nodeId: node.id,
              y: node.position.y,
              isLoaded: true,
            });
          }
        });
      }
    });
    return tags.sort((a, b) => a.y - b.y);
  }, [nodes, allRefs]);

  const { visible, hidden } = useMemo(() => {
    const visibleTags: TagItem[] = [];
    const otherTags: TagItem[] = [];

    allTags.forEach((tag) => {
      // Logic:
      // "In View" (visible): Tags that are loaded (isLoaded = true)
      // "Other Tags" (hidden): Tags that are NOT loaded (isLoaded = false)
      
      if (tag.isLoaded) {
        visibleTags.push(tag);
      } else {
        otherTags.push(tag);
      }
    });

    return { visible: visibleTags, hidden: otherTags };
  }, [allTags]);

  const handleJumpTo = (nodeId: string) => {
    setFocusNodeId(nodeId);
  };

  const TagRow = ({ tag }: { tag: TagItem }) => {
    // Fixed color for tags (gray)
    const hue = 0;
    const saturation = 0;
    const lightness = 70;
    return (
      <div className={cn(
        "flex items-center gap-2 py-0.5 px-2 hover:bg-muted/50 rounded-md group text-xs transition-opacity relative w-full overflow-hidden",
        !tag.isLoaded && "opacity-70"
      )}>
        {/* Color Block - fixed gray */}
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

        {/* Tag Name - Flex grow to take available space */}
        <span 
          className={cn(
            "truncate flex-1 min-w-0",
            tag.isLoaded && "pr-6" // Reserve space for the absolute button
          )} 
          title={tag.name}
        >
          {tag.name}
        </span>

        {/* Jump Button - Fixed width, always visible if loaded */}
        {tag.isLoaded && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 opacity-100 transition-opacity focus:opacity-100 hover:bg-muted"
                    onClick={() => handleJumpTo(tag.nodeId)}
                  >
                    <Goal className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Jump to tag</p>
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
        Tags
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
                {visible.map((tag) => (
                  <TagRow key={tag.name} tag={tag} />
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
                {hidden.map((tag) => (
                  <TagRow key={tag.name} tag={tag} />
                ))}
              </div>
            </div>
          )}
          
          {visible.length === 0 && hidden.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <Tag className="w-8 h-8 opacity-20" />
                  <span>No tags found</span>
              </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}