
import { ScrollArea } from "@/components/ui/scroll-area";

export function GitBranchList() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 font-semibold text-sm uppercase text-muted-foreground">
        Branches
      </div>
      <ScrollArea className="flex-1">
        <div className="px-4 text-sm text-muted-foreground">
          <p>Local Branches...</p>
          <p>Remote Branches...</p>
        </div>
      </ScrollArea>
    </div>
  );
}
