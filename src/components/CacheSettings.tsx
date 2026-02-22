import { useState, useEffect } from 'react';
import { Settings, Trash2, Database, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { layoutService } from '@/lib/layoutService';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';

export function CacheSettings() {
  const [open, setOpen] = useState(false);
  const [cachedRepos, setCachedRepos] = useState<string[]>([]);

  const loadKeys = async () => {
    const keys = await layoutService.getAllKeys();
    setCachedRepos(keys);
  };

  useEffect(() => {
    if (open) {
      loadKeys();
    }
  }, [open]);

  const handleClearCache = async (path: string) => {
    await layoutService.clearLayout(path);
    toast.success('Layout cache cleared for ' + path);
    loadKeys();
  };

  const handleOpenStoreDir = async () => {
    try {
        // Use Tauri's shell open to open the app data directory
        // The store file is typically in AppData/AppConfig dir
        // We can get the path via a custom command or just try to open standard locations?
        // Actually tauri-plugin-store stores in .git-graph-store or similar?
        // The file name is 'layout-cache.json'.
        // We can try to invoke a command to reveal it.
        // But first let's just log or use 'open' plugin if available?
        // We don't have open plugin explicitly imported here, but we can use 'opener'.
        // Let's use invoke('plugin:opener|reveal_item', ...) if we knew the path.
        
        // Since we don't know the absolute path easily in frontend,
        // let's add a button to at least SHOW the raw JSON of a selected item?
        // Or better, let's ask Rust to open the directory.
        // But we don't have a Rust command for that yet.
        
        // For now, let's just log that we can't easily open dir without backend support.
        // But user asked for it.
        // Let's add a backend command to reveal the store file.
        await invoke('reveal_store_file');
    } catch (e) {
        console.error("Failed to open store dir", e);
        toast.error("Failed to open store directory");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Database className="w-4 h-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Layout Cache Manager</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Layout Cache Manager</DialogTitle>
          <DialogDescription>
            Manage saved graph layouts for your repositories. Clearing a cache will reset the graph layout to default.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex justify-end mb-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleOpenStoreDir}
                className="gap-2"
            >
                <FolderOpen className="w-4 h-4" />
                Open Cache Folder
            </Button>
        </div>

        <div className="mt-4">
          {cachedRepos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No cached layouts found.
            </div>
          ) : (
            <ScrollArea className="h-[300px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repository Path</TableHead>
                    <TableHead className="w-[100px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cachedRepos.map((path) => (
                    <TableRow key={path}>
                      <TableCell className="font-mono text-xs break-all">
                        {path}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleClearCache(path)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
