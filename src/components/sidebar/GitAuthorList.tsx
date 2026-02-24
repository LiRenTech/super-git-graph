import { useGitGraphStore } from "@/store/gitGraphStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitCommit, getAuthorHue } from "@/lib/graphUtils";
import { User } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface AuthorItem {
  name: string;
  hue: number;
  count: number; // Number of commits by this author
}

export function GitAuthorList() {
  const { nodes } = useGitGraphStore();

  const authors = useMemo(() => {
    const authorMap = new Map<string, number>();
    
    // Count commits per author
    nodes.forEach((node) => {
      const commit = node.data.commit as GitCommit;
      if (commit && commit.author) {
        const currentCount = authorMap.get(commit.author) || 0;
        authorMap.set(commit.author, currentCount + 1);
      }
    });

    // Convert to array and sort by count (descending) then name
    const authorArray: AuthorItem[] = Array.from(authorMap.entries())
      .map(([name, count]) => ({
        name,
        hue: getAuthorHue(name),
        count,
      }))
      .sort((a, b) => {
        // Sort by commit count (descending), then alphabetically
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
      });

    return authorArray;
  }, [nodes]);

  const AuthorRow = ({ author }: { author: AuthorItem }) => {
    const hue = author.hue;
    return (
      <div className={cn(
        "flex items-center gap-2 py-0.5 px-2 hover:bg-muted/50 rounded-md group text-xs transition-opacity relative w-full overflow-hidden"
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

        {/* Author Name - Flex grow to take available space */}
        <span 
          className="truncate flex-1 min-w-0" 
          title={author.name}
        >
          {author.name}
        </span>

        {/* Commit Count */}
        <span className="text-[10px] text-muted-foreground shrink-0">
          {author.count}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 font-semibold text-sm uppercase text-muted-foreground border-b shrink-0 bg-background/50 backdrop-blur-sm overflow-hidden">
        Authors
      </div>
      <ScrollArea className="flex-1 w-full overflow-hidden">
        <div className="p-2 space-y-4 w-full">
          {authors.length > 0 ? (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                <span>Author Colors</span>
                <span className="text-[10px] bg-muted px-1.5 rounded-full">{authors.length}</span>
              </div>
              <div className="space-y-0.5">
                {authors.map((author) => (
                  <AuthorRow key={author.name} author={author} />
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <User className="w-8 h-8 opacity-20" />
              <span>No authors found</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}