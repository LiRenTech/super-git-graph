import { Handle, Position, NodeProps, Node } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { GitCommit } from '@/lib/graphUtils';

// We need to define the type of data our node expects
type CommitNodeData = Node<{
  label: string;
  commit: GitCommit;
}, 'commit'>['data'];

export function CommitNode({ data, selected }: NodeProps<Node<CommitNodeData, 'commit'>>) {
  return (
    <div className="relative flex flex-col items-center group">
      {/* Target Handle (Top side for TB layout) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-transparent !border-none !w-0 !h-0 pointer-events-none" 
        isConnectable={false}
      />
      
      {/* The Circle Node */}
      <div 
        className={cn(
          "w-4 h-4 rounded-full border-2 transition-all duration-200",
          "bg-background border-primary",
          selected ? "border-blue-500 scale-125 bg-blue-100 dark:bg-blue-900" : "group-hover:scale-110",
          "shadow-sm dark:shadow-none"
        )}
      />

      {/* Label (Below the circle) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-48 text-center pointer-events-none">
        <p className="text-[10px] text-muted-foreground truncate font-mono">
          {data.commit?.id.substring(0, 7)}
        </p>
        <p className="text-xs font-medium text-foreground truncate max-w-full leading-tight">
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
