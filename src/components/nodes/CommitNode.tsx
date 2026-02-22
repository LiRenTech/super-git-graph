import { Handle, Position, NodeProps, Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { GitCommit } from "@/lib/graphUtils";
import {
  GitBranch,
  Tag,
  Copy,
  GitCommitVertical,
  ArrowLeftRight,
} from "lucide-react";
import { useGitGraphStore } from "@/store/gitGraphStore";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useState } from "react";
import { toast } from "sonner";

// We need to define the type of data our node expects
type CommitNodeData = Node<
  {
    label: string;
    commit: GitCommit;
  },
  "commit"
>["data"];

function getBranchHue(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}

export function CommitNode({
  data,
  selected,
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<Node<CommitNodeData, "commit">>) {
  const isHead = data.commit?.refs?.includes("HEAD");
  const branches =
    data.commit?.refs?.filter(
      (r) => r !== "HEAD" && !r.startsWith("refs/tags/"),
    ) || [];
  const tags =
    data.commit?.refs?.filter((r) => r.startsWith("refs/tags/")) || [];
  const isMerge = data.commit?.parents && data.commit.parents.length > 1;
  const isRoot = !data.commit?.parents || data.commit.parents.length === 0;
  const isUncommitted = data.commit?.id === "working-copy";
  const isStash = data.commit?.refs?.some((r) => r.startsWith("stash@"));

  const { showHash, showMessage, showCoordinates } = useGitGraphStore();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const copyToClipboard = async (text: string, type: "message" | "hash") => {
    try {
      await writeText(text);
      toast.success(`Copied ${type} to clipboard`);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Popover open={selected && popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div
          className="relative flex flex-col items-center group cursor-pointer outline-none"
          onClick={() => setPopoverOpen(true)}
        >
          {/* Coordinates Debug */}
          {showCoordinates && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground font-mono whitespace-nowrap bg-background/90 px-1 py-0.5 rounded border pointer-events-none z-50">
              {Math.round(positionAbsoluteX)}, {Math.round(positionAbsoluteY)}
            </div>
          )}

          {/* Target Handle (Top side for TB layout) */}
          <Handle
            type="target"
            position={Position.Top}
            className="!bg-transparent !border-none !w-0 !h-0 pointer-events-none"
            isConnectable={false}
          />

          {isHead && (
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-medium shadow-sm whitespace-nowrap z-20">
              HEAD
              <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-blue-200 dark:border-l-blue-800" />
            </div>
          )}

          {/* Branch/Tag Labels - Pointing to the node */}
          <div
            className="absolute bottom-full mb-2 flex flex-col items-center gap-1 origin-bottom"
            style={{ transform: "scale(var(--label-scale, 1))" }}
          >
            {branches.map((branch) => {
              const hue = getBranchHue(branch);
              return (
                <div
                  key={branch}
                  className="relative flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium shadow-sm whitespace-nowrap border
                bg-[hsl(var(--branch-hue),85%,96%)] text-[hsl(var(--branch-hue),80%,30%)] border-[hsl(var(--branch-hue),60%,85%)]
                dark:bg-[hsl(var(--branch-hue),60%,20%)] dark:text-[hsl(var(--branch-hue),80%,90%)] dark:border-[hsl(var(--branch-hue),60%,30%)]"
                  style={{ "--branch-hue": hue } as React.CSSProperties}
                >
                  <GitBranch className="w-3 h-3" />
                  {branch}
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent 
                border-t-[hsl(var(--branch-hue),60%,85%)] dark:border-t-[hsl(var(--branch-hue),60%,30%)]"
                  />
                </div>
              );
            })}

            {tags.map((tag) => (
              <div
                key={tag}
                className="relative flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 rounded text-[10px] font-medium shadow-sm whitespace-nowrap"
              >
                <Tag className="w-3 h-3" />
                {tag.replace("refs/tags/", "")}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-yellow-200 dark:border-t-yellow-800" />
              </div>
            ))}
          </div>

          {/* Selection Ring */}
          {selected && (
            <div
              className="absolute pointer-events-none z-0"
              style={{
                top: "50%",
                left: "50%",
                width: "32px",
                height: "32px",
                marginTop: "-16px",
                marginLeft: "-16px",
                transform: "scale(var(--label-scale, 1))",
              }}
            >
              <div className="w-full h-full rounded-full border-2 border-green-500 border-dashed animate-spin-slow" />
            </div>
          )}

          {/* The Circle Node */}
          <div
            className={cn(
              "transition-all duration-200 z-10 flex items-center justify-center relative",
              "bg-background",
              isStash ? "rounded-md" : "rounded-full",
              isRoot ? "w-6 h-6 border-2 border-primary" : "w-4 h-4 border-2",
              isHead
                ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900"
                : isRoot
                  ? "border-primary"
                  : "border-primary",
              isUncommitted
                ? "border-dashed border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-zinc-800"
                : "",
              isStash
                ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30"
                : "",
              !selected && "group-hover:scale-110", // Only hover scale if not selected
              isMerge && !selected && "opacity-50",
              "shadow-sm dark:shadow-none",
            )}
          >
            {isRoot && (
              <div className="absolute inset-0 rounded-full border-2 border-primary m-0.5" />
            )}
            {isRoot && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
            {isHead && (
              <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-blue-500 rounded-full" />
            )}
            {isMerge && !isHead && !isStash && (
              <span className="text-[8px] font-bold text-foreground leading-none">
                M
              </span>
            )}
            {isStash && (
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 leading-none">
                S
              </span>
            )}
          </div>

          {/* Label (Below the circle) */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-48 text-center pointer-events-none">
            {showMessage && (
              <p
                className={cn(
                  "text-xs font-medium truncate absolute left-[calc(50%+14px)] -top-5 text-left max-w-[200px] text-foreground",
                  isMerge && !selected && "opacity-50",
                )}
              >
                {data.label}
              </p>
            )}
            {showHash && (
              <p
                className={cn(
                  "text-[9px] font-mono truncate max-w-full leading-tight transition-colors mt-1 opacity-60",
                  selected ? "text-primary" : "text-foreground",
                  isMerge && !selected && "opacity-40",
                )}
              >
                {data.commit?.id.substring(0, 7)}
              </p>
            )}
          </div>

          {/* Source Handle (Bottom side for TB layout) */}
          <Handle
            type="source"
            position={Position.Bottom}
            className="!bg-transparent !border-none !w-0 !h-0 pointer-events-none"
            isConnectable={false}
          />
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-2 flex flex-col gap-1"
        side="bottom"
        align="start"
        sideOffset={10}
        alignOffset={20}
      >
        <Button variant="ghost" size="sm" className="justify-start gap-2 h-8">
          <ArrowLeftRight className="w-4 h-4" />
          <span className="text-xs">Checkout this commit</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 h-8"
          onClick={() => copyToClipboard(data.commit?.message || "", "message")}
        >
          <Copy className="w-4 h-4" />
          <span className="text-xs truncate">Copy Message</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 h-8"
          onClick={() => copyToClipboard(data.commit?.id || "", "hash")}
        >
          <Copy className="w-4 h-4" />
          <span className="text-xs">Copy Hash</span>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
