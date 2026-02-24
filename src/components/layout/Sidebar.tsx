
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { GitBranchList } from "@/components/sidebar/GitBranchList";
import { GitTagList } from "@/components/sidebar/GitTagList";
import { GitAuthorList } from "@/components/sidebar/GitAuthorList";
import { SidebarView } from "./ActivityBar";

interface SidebarProps {
  activeView: SidebarView;
}

const MIN_WIDTH = 160;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 256; // w-64 is 256px

export function Sidebar({ activeView }: SidebarProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Activity bar width is 48px (w-12)
      const newWidth = e.clientX - 48;
      
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      ref={sidebarRef}
      style={{ width: activeView ? width : 0 }}
      className={cn(
        "flex flex-col border-r bg-muted/30 relative transition-none", // Remove transition during resize
        !isResizing && "transition-[width] duration-300 ease-in-out", // Only animate when not resizing
        activeView ? "opacity-100" : "opacity-0 border-r-0 overflow-hidden"
      )}
    >
      <div className="h-full w-full overflow-hidden">
        {activeView === "branch" && <GitBranchList />}
        {activeView === "tag" && <GitTagList />}
        {activeView === "author" && <GitAuthorList />}
      </div>
      
      {/* Resizer Handle */}
      {activeView && (
        <div
          className={cn(
            "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors z-50",
            isResizing && "bg-primary/50"
          )}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
}
