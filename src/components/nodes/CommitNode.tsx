import { Handle, Position, NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { GitCommit, getBranchHue } from "@/lib/graphUtils";
import {
  GitBranch,
  Tag,
  Copy,
  ArrowLeftRight,
  GitCompare,
  Upload,
  Loader2,
  Download,
  CornerUpRight,
  Plus,
  Trash2,
} from "lucide-react";
import { useGitGraphStore } from "@/store/gitGraphStore";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useState } from "react";
import { toast } from "sonner";

// Remove the interface and use inline typing
export function CommitNode(props: NodeProps) {
  const { data, selected, positionAbsoluteX, positionAbsoluteY, id } = props;

  // Use unknown first, then cast to the expected type
  const typedData = data as unknown as {
    label: string;
    commit: GitCommit & { head_type?: string };
    repoPath: string;
  };

  // Debug logging
  console.log(
    "Commit data:",
    typedData.commit.id,
    "HEAD refs:",
    typedData.commit.refs,
    "head_type:",
    typedData.commit.head_type,
  );

  // Determine HEAD type using backend-provided head_type field
  const hasHeadRef = typedData.commit?.refs?.includes("HEAD") || false;
  const headType = typedData.commit?.head_type; // "detached" or "branch" or undefined

  const isDetachedHead = hasHeadRef && headType === "detached";
  const isBranchHead = hasHeadRef && headType === "branch";

  const branchRefs =
    typedData.commit?.refs?.filter(
      (r: string) => r !== "HEAD" && !r.startsWith("refs/tags/"),
    ) || [];
  const tagRefs =
    typedData.commit?.refs?.filter((r: string) => r.startsWith("refs/tags/")) ||
    [];

  const isMerge =
    typedData.commit?.parents && typedData.commit.parents.length > 1;
  const isRoot =
    !typedData.commit?.parents || typedData.commit.parents.length === 0;
  const isUncommitted = typedData.commit?.id === "working-copy";
  const isStash = typedData.commit?.refs?.some((r: string) =>
    r.startsWith("stash@"),
  );

  const {
    showHash,
    showMessage,
    showCoordinates,
    startDiffMode,
    diffMode,
    checkoutCommit,
    checkoutBranch,
    pullBranch,
    pushBranch,
    createBranch,
    deleteBranch,
    isLoading,
    loadingOperation,
  } = useGitGraphStore();
  const isDiffSource = diffMode.active && diffMode.sourceCommitId === id;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState<string | null>(null);
  const [isCreateBranchDialogOpen, setIsCreateBranchDialogOpen] =
    useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);
  const [isDeleteBranchDialogOpen, setIsDeleteBranchDialogOpen] =
    useState(false);

  const handleCreateBranch = async () => {
    if (isLoading) return;
    if (!newBranchName.trim()) return;

    try {
      await createBranch(
        typedData.repoPath,
        newBranchName.trim(),
        typedData.commit.id,
      );
      toast.success(`Successfully created branch: ${newBranchName.trim()}`);
      setIsCreateBranchDialogOpen(false);
      setNewBranchName("");
    } catch (error) {
      console.error("Failed to create branch:", error);
      // Show more detailed error message
      if (typeof error === "string") {
        toast.error(`Failed to create branch: ${error}`);
      } else if (error instanceof Error) {
        toast.error(`Failed to create branch: ${error.message}`);
      } else {
        toast.error("Failed to create branch - unknown error");
      }
    }
  };

  const handleBranchDelete = async (branchName: string) => {
    if (isLoading) return;

    try {
      setBranchMenuOpen(null);
      await deleteBranch(typedData.repoPath, branchName);
      toast.success(`Successfully deleted branch: ${branchName}`);
      setIsDeleteBranchDialogOpen(false);
      setBranchToDelete(null);
    } catch (error) {
      console.error("Failed to delete branch:", error);
      // Show more detailed error message
      if (typeof error === "string") {
        toast.error(`Failed to delete branch: ${error}`);
      } else if (error instanceof Error) {
        toast.error(`Failed to delete branch: ${error.message}`);
      } else {
        toast.error("Failed to delete branch - unknown error");
      }
    }
  };

  const copyToClipboard = async (text: string, type: "message" | "hash") => {
    try {
      await writeText(text);
      toast.success(`Copied ${type} to clipboard`);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleCheckout = async () => {
    if (isLoading) return; // Prevent multiple clicks
    if (isUncommitted) {
      toast.error("Cannot checkout uncommitted changes");
      return;
    }

    try {
      setPopoverOpen(false);
      await checkoutCommit(typedData.repoPath, typedData.commit.id);
      toast.success("Successfully checked out commit");
    } catch (error) {
      console.error("Checkout failed:", error);
      // Show more detailed error message
      if (typeof error === "string") {
        toast.error(`Failed to checkout commit: ${error}`);
      } else if (error instanceof Error) {
        toast.error(`Failed to checkout commit: ${error.message}`);
      } else {
        toast.error("Failed to checkout commit - unknown error");
      }
    }
  };

  const handleBranchCheckout = async (branchName: string) => {
    if (isLoading) return; // Prevent multiple clicks

    try {
      setBranchMenuOpen(null);
      await checkoutBranch(typedData.repoPath, branchName);
      toast.success(`Successfully switched to branch: ${branchName}`);
    } catch (error) {
      console.error("Failed to switch branch:", error);
      // Show more detailed error message
      if (typeof error === "string") {
        toast.error(`Failed to switch branch: ${error}`);
      } else if (error instanceof Error) {
        toast.error(`Failed to switch branch: ${error.message}`);
      } else {
        toast.error("Failed to switch branch - unknown error");
      }
    }
  };

  const handleBranchCopy = async (branchName: string) => {
    try {
      setBranchMenuOpen(null);
      await writeText(branchName);
      toast.success(`Copied branch name to clipboard`);
    } catch (err) {
      console.error("Failed to copy branch name:", err);
      // Show more detailed error message
      if (typeof err === "string") {
        toast.error(`Failed to copy to clipboard: ${err}`);
      } else if (err instanceof Error) {
        toast.error(`Failed to copy to clipboard: ${err.message}`);
      } else {
        toast.error("Failed to copy to clipboard - unknown error");
      }
    }
  };

  const handleBranchPull = async (branchName: string) => {
    if (isLoading) return; // Prevent multiple clicks

    try {
      setBranchMenuOpen(null);
      await pullBranch(typedData.repoPath, branchName);
      toast.success(`Successfully pulled branch: ${branchName}`);
    } catch (error) {
      console.error("Failed to pull branch:", error);
      if (typeof error === "string") {
        toast.error(`Failed to pull branch: ${error}`);
      } else if (error instanceof Error) {
        toast.error(`Failed to pull branch: ${error.message}`);
      } else {
        toast.error("Failed to pull branch - unknown error");
      }
    }
  };

  const handleBranchPush = async (branchName: string) => {
    if (isLoading) return; // Prevent multiple clicks

    try {
      setBranchMenuOpen(null);
      await pushBranch(typedData.repoPath, branchName);
      toast.success(`Successfully pushed branch: ${branchName}`);
    } catch (error) {
      console.error("Failed to push branch:", error);
      if (typeof error === "string") {
        toast.error(`Failed to push branch: ${error}`);
      } else if (error instanceof Error) {
        toast.error(`Failed to push branch: ${error.message}`);
      } else {
        toast.error("Failed to push branch - unknown error");
      }
    }
  };

  return (
    <>
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

            {/* Detached HEAD Indicator - Only shown for detached HEAD */}
            {isDetachedHead && (
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 flex items-center gap-1 px-2 py-0.5 border border-red-500 dark:border-red-600 rounded text-[10px] font-medium shadow-sm whitespace-nowrap z-20 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>HEAD (detached)</span>
                <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-red-500 dark:border-l-red-600" />
              </div>
            )}

            {/* Branch/Tag Labels - Pointing to the node */}
            <div
              className="absolute bottom-full mb-2 flex flex-col items-center gap-1 origin-bottom"
              style={{ transform: "scale(var(--label-scale, 1))" }}
            >
              {branchRefs.map((branch: string) => {
                const hue = getBranchHue(branch);
                // Fix: HEAD should be shown for the current branch regardless of how many branches point to this commit
                // Determine if this branch is a remote branch (contains slash and starts with common remote names)
                const isRemoteBranch =
                  branch.includes("/") &&
                  (branch.startsWith("origin/") ||
                    branch.startsWith("upstream/") ||
                    branch.startsWith("fork/"));
                const isCurrentBranch = isBranchHead && !isRemoteBranch;

                return (
                  <Popover
                    key={branch}
                    open={branchMenuOpen === branch}
                    onOpenChange={(open) =>
                      setBranchMenuOpen(open ? branch : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <div
                        className={cn(
                          "relative flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium shadow-sm whitespace-nowrap border cursor-pointer hover:opacity-80 transition-all duration-150",
                          // Light theme colors
                          "bg-[hsl(var(--branch-hue),85%,96%)] text-[hsl(var(--branch-hue),80%,30%)] border-[hsl(var(--branch-hue),60%,85%)]",
                          // Dark theme colors
                          "dark:bg-[hsl(var(--branch-hue),60%,20%)] dark:text-[hsl(var(--branch-hue),80%,90%)] dark:border-[hsl(var(--branch-hue),60%,30%)]",
                          // Current branch highlight (light theme)
                          isCurrentBranch &&
                            "ring-2 ring-blue-300 dark:ring-blue-700",
                        )}
                        style={{ "--branch-hue": hue } as React.CSSProperties}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <GitBranch className="w-3 h-3" />
                        {branch}
                        <div
                          className={cn(
                            "absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent",
                            // Light theme triangle
                            "border-t-[hsl(var(--branch-hue),60%,85%)]",
                            // Dark theme triangle
                            "dark:border-t-[hsl(var(--branch-hue),60%,30%)]",
                          )}
                        />

                        {/* Branch HEAD Indicator - Only shown for the current branch */}
                        {isCurrentBranch && (
                          <div className="absolute -left-full top-1/2 -translate-y-1/2 -ml-3 flex items-center gap-1 px-2 py-0.5 border border-blue-500 dark:border-blue-600 rounded text-[10px] font-medium shadow-sm whitespace-nowrap bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span>HEAD</span>
                            <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-blue-500 dark:border-l-blue-600" />
                          </div>
                        )}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-48 p-2 flex flex-col gap-1"
                      side="bottom"
                      align="center"
                      sideOffset={5}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start gap-2 h-8"
                        onClick={() => handleBranchCheckout(branch)}
                        disabled={
                          isLoading &&
                          loadingOperation?.startsWith(`checking out ${branch}`)
                        }
                      >
                        {isLoading &&
                        loadingOperation?.startsWith(
                          `checking out ${branch}`,
                        ) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CornerUpRight className="w-4 h-4" />
                        )}
                        <span className="text-xs">Checkout branch</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start gap-2 h-8"
                        onClick={() => handleBranchPull(branch)}
                        disabled={
                          isLoading &&
                          loadingOperation?.startsWith(`pulling ${branch}`)
                        }
                      >
                        {isLoading &&
                        loadingOperation?.startsWith(`pulling ${branch}`) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span className="text-xs">Pull branch</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start gap-2 h-8"
                        onClick={() => handleBranchPush(branch)}
                        disabled={
                          isLoading &&
                          loadingOperation?.startsWith(`pushing ${branch}`)
                        }
                      >
                        {isLoading &&
                        loadingOperation?.startsWith(`pushing ${branch}`) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span className="text-xs">Push branch</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start gap-2 h-8"
                        onClick={() => handleBranchCopy(branch)}
                      >
                        <Copy className="w-4 h-4" />
                        <span className="text-xs">Copy branch name</span>
                      </Button>
                      {!isRemoteBranch && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-start gap-2 h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                          onClick={() => {
                            setBranchToDelete(branch);
                            setIsDeleteBranchDialogOpen(true);
                            setBranchMenuOpen(null);
                          }}
                          disabled={
                            isLoading ||
                            (isLoading &&
                              loadingOperation?.startsWith(
                                `deleting ${branch}`,
                              ))
                          }
                        >
                          {isLoading &&
                          loadingOperation?.startsWith(`deleting ${branch}`) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span className="text-xs">Delete branch</span>
                        </Button>
                      )}
                    </PopoverContent>
                  </Popover>
                );
              })}

              {tagRefs.map((tag: string) => (
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
                isDetachedHead
                  ? "border-red-500 ring-2 ring-red-200 dark:ring-red-900"
                  : isBranchHead
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
                isDiffSource
                  ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-background"
                  : "",
                !selected && "group-hover:scale-110", // Only hover scale if not selected
                isMerge && !selected && "opacity-50",
                "shadow-sm dark:shadow-none",
              )}
            >
              {isRoot && (
                <div className="absolute inset-0 rounded-full border-2 border-primary m-0.5" />
              )}
              {isRoot && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
              {isDetachedHead && (
                <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
              {isBranchHead && !isDetachedHead && (
                <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}
              {isMerge && !isDetachedHead && !isBranchHead && !isStash && (
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
                  {typedData.label}
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
                  {typedData.commit?.id.substring(0, 7)}
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
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-8"
            onClick={() => {
              setPopoverOpen(false);
              startDiffMode(typedData.commit.id);
            }}
          >
            <GitCompare className="w-4 h-4" />
            <span className="text-xs">Diff with another commit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-8"
            onClick={handleCheckout}
            disabled={isUncommitted}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span className="text-xs">Checkout this commit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-8"
            onClick={() => {
              setPopoverOpen(false);
              setIsCreateBranchDialogOpen(true);
            }}
            disabled={isUncommitted}
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs">Create new branch from this commit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-8"
            onClick={() =>
              copyToClipboard(typedData.commit?.message || "", "message")
            }
          >
            <Copy className="w-4 h-4" />
            <span className="text-xs truncate">Copy Message</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start gap-2 h-8"
            onClick={() => copyToClipboard(typedData.commit?.id || "", "hash")}
          >
            <Copy className="w-4 h-4" />
            <span className="text-xs">Copy Hash</span>
          </Button>
        </PopoverContent>
      </Popover>

      <Dialog
        open={isCreateBranchDialogOpen}
        onOpenChange={setIsCreateBranchDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new branch from commit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Branch name</div>
              <Input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Enter branch name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBranchName.trim()) {
                    handleCreateBranch();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateBranchDialogOpen(false);
                  setNewBranchName("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateBranch}
                disabled={!newBranchName.trim() || isLoading}
              >
                {isLoading &&
                loadingOperation?.startsWith("creating branch") ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create branch"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteBranchDialogOpen}
        onOpenChange={setIsDeleteBranchDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Are you sure you want to delete the branch{" "}
                <span className="font-medium text-foreground">
                  "{branchToDelete}"
                </span>
                ? This action cannot be undone.
              </div>
              {branchToDelete &&
              isBranchHead &&
              !(
                branchToDelete.includes("/") &&
                (branchToDelete.startsWith("origin/") ||
                  branchToDelete.startsWith("upstream/") ||
                  branchToDelete.startsWith("fork/"))
              ) ? (
                <div className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  Note: You cannot delete the current branch. If this is the
                  current branch, please checkout another branch first.
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteBranchDialogOpen(false);
                  setBranchToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (branchToDelete) {
                    handleBranchDelete(branchToDelete);
                  }
                }}
                disabled={!branchToDelete || isLoading}
              >
                {isLoading &&
                loadingOperation?.startsWith("deleting branch") ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete branch"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
