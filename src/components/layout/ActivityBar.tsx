
import { GitBranch, Tag, User, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SidebarView = "branch" | "tag" | "author" | "stash" | null;

interface ActivityBarProps {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

export function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  const handleViewClick = (view: SidebarView) => {
    if (activeView === view) {
      onViewChange(null); // Collapse if already active
    } else {
      onViewChange(view); // Expand/Switch
    }
  };

  return (
    <div className="w-12 border-r bg-muted flex flex-col items-center py-2 gap-2 shrink-0">
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-md hover:bg-muted-foreground/20",
                activeView === "branch" &&
                  "bg-background text-foreground shadow-sm hover:bg-background"
              )}
              onClick={() => handleViewClick("branch")}
            >
              <GitBranch className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Branches</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-md hover:bg-muted-foreground/20",
                activeView === "tag" &&
                  "bg-background text-foreground shadow-sm hover:bg-background"
              )}
              onClick={() => handleViewClick("tag")}
            >
              <Tag className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Tags</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-md hover:bg-muted-foreground/20",
                activeView === "author" &&
                  "bg-background text-foreground shadow-sm hover:bg-background"
              )}
              onClick={() => handleViewClick("author")}
            >
              <User className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Authors</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-md hover:bg-muted-foreground/20",
                activeView === "stash" &&
                  "bg-background text-foreground shadow-sm hover:bg-background"
              )}
              onClick={() => handleViewClick("stash")}
            >
              <Archive className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Stashes</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
