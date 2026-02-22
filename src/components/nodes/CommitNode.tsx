import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { GitCommit } from '@/lib/graphUtils';
import { GitBranch, Tag } from 'lucide-react';

// We need to define the type of data our node expects
type CommitNodeData = Node<{
  label: string;
  commit: GitCommit;
}, 'commit'>['data'];

function getBranchHue(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}

export function CommitNode({ data, selected }: NodeProps<Node<CommitNodeData, 'commit'>>) {
  const isHead = data.commit?.refs?.includes('HEAD');
  const branches = data.commit?.refs?.filter(r => r !== 'HEAD' && !r.startsWith('refs/tags/')) || [];
  const tags = data.commit?.refs?.filter(r => r.startsWith('refs/tags/')) || [];

  return (
    <div className="relative flex flex-col items-center group">
      {/* Target Handle (Top side for TB layout) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-transparent !border-none !w-0 !h-0 pointer-events-none" 
        isConnectable={false}
      />
      
      {/* Branch/Tag Labels - Pointing to the node */}
      <div 
        className="absolute bottom-full mb-2 flex flex-col items-center gap-1 origin-bottom"
        style={{ transform: 'scale(var(--label-scale, 1))' }}
      >
        {isHead && (
           <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-medium shadow-sm whitespace-nowrap">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
             HEAD
             <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-blue-200 dark:border-t-blue-800" />
           </div>
        )}
        
        {branches.map(branch => {
          const hue = getBranchHue(branch);
          return (
            <div 
              key={branch} 
              className="relative flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium shadow-sm whitespace-nowrap border
                bg-[hsl(var(--branch-hue),85%,96%)] text-[hsl(var(--branch-hue),80%,30%)] border-[hsl(var(--branch-hue),60%,85%)]
                dark:bg-[hsl(var(--branch-hue),60%,20%)] dark:text-[hsl(var(--branch-hue),80%,90%)] dark:border-[hsl(var(--branch-hue),60%,30%)]"
              style={{ '--branch-hue': hue } as React.CSSProperties}
            >
              <GitBranch className="w-3 h-3" />
              {branch}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent 
                border-t-[hsl(var(--branch-hue),60%,85%)] dark:border-t-[hsl(var(--branch-hue),60%,30%)]" 
              />
            </div>
          );
        })}

        {tags.map(tag => (
          <div key={tag} className="relative flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 rounded text-[10px] font-medium shadow-sm whitespace-nowrap">
            <Tag className="w-3 h-3" />
            {tag.replace('refs/tags/', '')}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-yellow-200 dark:border-t-yellow-800" />
          </div>
        ))}
      </div>

      {/* The Circle Node */}
      <div 
        className={cn(
          "w-4 h-4 rounded-full border-2 transition-all duration-200 z-10",
          "bg-background",
          isHead ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900" : "border-primary",
          selected ? "scale-125 bg-primary border-primary" : "group-hover:scale-110",
          "shadow-sm dark:shadow-none"
        )}
      >
        {isHead && (
          <div className="absolute inset-0 m-auto w-1.5 h-1.5 bg-blue-500 rounded-full" />
        )}
      </div>

      {/* Label (Below the circle) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-48 text-center pointer-events-none">
        <p className="text-[10px] text-muted-foreground truncate font-mono opacity-70">
          {data.commit?.id.substring(0, 7)}
        </p>
        <p className={cn(
          "text-xs font-medium truncate max-w-full leading-tight transition-colors",
          selected ? "text-primary" : "text-foreground"
        )}>
          {data.label}
        </p>
      </div>

      {/* Source Handle (Bottom side for TB layout) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-transparent !border-none !w-0 !h-0 pointer-events-none" 
        isConnectable={false}
      />
    </div>
  );
}
