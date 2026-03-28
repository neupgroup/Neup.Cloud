'use client';

import { Plus, Workflow } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PipelineContextMenuItem = {
  id: string;
  label: string;
  icon?: 'add' | 'branch';
  onSelect: () => void;
};

type PipelineContextMenuProps = {
  x: number;
  y: number;
  items: PipelineContextMenuItem[];
  className?: string;
};

export function PipelineContextMenu({ x, y, items, className }: PipelineContextMenuProps) {
  return (
    <div
      className={cn(
        'fixed z-[60] min-w-[190px] rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl',
        className
      )}
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      role="menu"
    >
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon === 'branch' ? Workflow : Plus;

          return (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              className="h-10 w-full justify-start rounded-xl px-3 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              onClick={item.onSelect}
              role="menuitem"
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
