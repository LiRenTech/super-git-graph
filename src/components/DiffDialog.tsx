import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

interface FileDiff {
  path: string;
  old_content: string;
  new_content: string;
}

interface DiffDialogProps {
  open: boolean;
  onClose: () => void;
  repoPath: string | null;
  sourceCommitId: string | null;
  targetCommitId: string | null;
  isDarkMode: boolean;
}

export function DiffDialog({
  open,
  onClose,
  repoPath,
  sourceCommitId,
  targetCommitId,
  isDarkMode,
}: DiffDialogProps) {
  const [diffs, setDiffs] = useState<FileDiff[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const fetchDiff = async () => {
    console.log("fetchDiff called:", { repoPath, sourceCommitId, targetCommitId });
    if (!repoPath || !sourceCommitId || !targetCommitId) {
      console.log("Missing required parameters");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log("Invoking get_diff with:", { repoPath, sourceCommitId, targetCommitId });
      const result = await invoke<{ files: FileDiff[] }>("get_diff", {
        repoPath,
        oldCommit: sourceCommitId,
        newCommit: targetCommitId,
      });
      console.log("Diff result:", result);
      console.log("Number of files:", result.files.length);
      setDiffs(result.files);
      if (result.files.length > 0) {
        setSelectedFileIndex(0);
      }
    } catch (err) {
      console.error("Failed to fetch diff:", err);
      setError(typeof err === "string" ? err : "Failed to fetch diff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("DiffDialog useEffect:", { open, repoPath, sourceCommitId, targetCommitId });
    if (open && repoPath && sourceCommitId && targetCommitId) {
      fetchDiff();
    } else {
      setDiffs(null);
      setSelectedFileIndex(null);
      setError(null);
    }
  }, [open, repoPath, sourceCommitId, targetCommitId]);

  const selectedDiff = selectedFileIndex !== null ? diffs?.[selectedFileIndex] : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] h-[90vh] max-w-none rounded-none border-none p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">Commit Diff</DialogTitle>
              <DialogDescription className="text-xs mt-1">
                {sourceCommitId?.substring(0, 7)} →{" "}
                {targetCommitId?.substring(0, 7)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* File List Sidebar */}
          <div className="w-64 border-r flex flex-col shrink-0">
            <div className="p-3 border-b bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground">
                Changed Files ({diffs?.length || 0})
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <p className="text-xs text-red-500 p-2">{error}</p>
                ) : diffs && diffs.length > 0 ? (
                  diffs.map((diff, index) => (
                    <button
                      key={diff.path}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFileIndex(index);
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-xs truncate transition-colors ${
                        selectedFileIndex === index
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      {diff.path}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    No changes
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Diff View */}
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-red-500">{error}</p>
              </div>
            ) : !selectedDiff ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Select a file to view diff</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-4" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-4">
                    <h3 className="text-sm font-medium">{selectedDiff.path}</h3>
                  </div>
                  <ReactDiffViewer
                    oldValue={selectedDiff.old_content}
                    newValue={selectedDiff.new_content}
                    splitView={true}
                    useDarkTheme={isDarkMode}
                    compareMethod={DiffMethod.WORDS}
                    hideLineNumbers={false}
                    disableWordDiff={false}
                  />
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
