
import { ScrollArea } from "@/components/ui/scroll-area";

export function GitTagList() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 font-semibold text-sm uppercase text-muted-foreground">
        Tags
      </div>
      <ScrollArea className="flex-1">
        <div className="px-4 text-sm text-muted-foreground">
          <p>Tags List...</p>
        </div>
      </ScrollArea>
    </div>
  );
}
