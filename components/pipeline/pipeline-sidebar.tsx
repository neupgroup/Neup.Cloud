'use client';

import { Copy, Plus, Search, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  PIPELINE_SHARED_NODE_INFO,
  type PipelineNodeInspectorArgs,
  type PipelineNodeKind,
  type PipelineNodeModule,
  type PipelineNodeRecord,
  type PipelineNodeType,
} from '@/components/pipeline/node/interface';
import { cn } from '@/lib/utils';

type SidebarTemplate = {
  kind: PipelineNodeKind;
  label: string;
  subtitle: string;
  icon: LucideIcon;
};

type SidebarCategory = {
  id: PipelineNodeType;
  label: string;
  description: string;
  icon: LucideIcon;
  templates: SidebarTemplate[];
};

type SidebarSelectedNode = {
  id: string;
  data: PipelineNodeRecord;
};

type SidebarInspectorInfo = {
  identifier: string;
  title: string;
  type: string;
  name: string;
  description: string;
};

type PipelineSidebarProps = {
  isLibraryMode: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  activeCategory: PipelineNodeType;
  onActiveCategoryChange: (category: PipelineNodeType) => void;
  nodeCategories: SidebarCategory[];
  filteredTemplatesByCategory: Map<PipelineNodeType, SidebarTemplate[]>;
  matchingTemplateCount: number;
  parentNodeLabel: string;
  onAddNode: (kind: PipelineNodeKind) => void;
  selectedNode: SidebarSelectedNode | null;
  selectedNodeInspectorInfo: SidebarInspectorInfo | null;
  referenceSaveNotice: string | null;
  selectedNodeModule: PipelineNodeModule<PipelineNodeRecord> | null;
  selectedNodeInspectorArgs: PipelineNodeInspectorArgs<PipelineNodeRecord> | null;
  onUpdateBasicsName: (value: string) => void;
  onUpdateBasicsDescription: (value: string) => void;
  onAddChild: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  getNodeTone: (kind: PipelineNodeKind) => { header: string };
};

export function PipelineSidebar({
  isLibraryMode,
  search,
  onSearchChange,
  activeCategory,
  onActiveCategoryChange,
  nodeCategories,
  filteredTemplatesByCategory,
  matchingTemplateCount,
  parentNodeLabel,
  onAddNode,
  selectedNode,
  selectedNodeInspectorInfo,
  referenceSaveNotice,
  selectedNodeModule,
  selectedNodeInspectorArgs,
  onUpdateBasicsName,
  onUpdateBasicsDescription,
  onAddChild,
  onDuplicate,
  onDelete,
  getNodeTone,
}: PipelineSidebarProps) {
  return (
    <aside className="border-l border-white/60 bg-white/60">
      <ScrollArea className="h-[calc(100vh-81px)]">
        <div className="space-y-5 p-5">
          {isLibraryMode ? (
            <>
              <div className="space-y-3 rounded-[1.7rem] border border-white/80 bg-white/90 p-4 shadow-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Node Library</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Add the next step</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Choose a category first, then pick a node from the second level.
                  </p>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search nodes"
                    className="rounded-2xl border-slate-200 bg-slate-50 pl-9"
                  />
                </div>

                <div className="rounded-[1.4rem] border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-slate-700">
                  Adding a child after <span className="font-semibold">{parentNodeLabel}</span>.
                </div>
              </div>

              <div className="space-y-2">
                {nodeCategories.map((category) => {
                  const Icon = category.icon;
                  const isActive = activeCategory === category.id;
                  const templates = filteredTemplatesByCategory.get(category.id) ?? [];

                  return (
                    <div key={category.id} className="rounded-[1.5rem] border border-white/80 bg-white/90 shadow-sm">
                      <button
                        type="button"
                        onClick={() => onActiveCategoryChange(category.id)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-[1.5rem] px-4 py-3 text-left transition-all',
                          isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl',
                            isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={cn('font-semibold', isActive ? 'text-white' : 'text-slate-950')}>
                            {category.label}
                          </div>
                          <p className={cn('mt-1 text-sm leading-6', isActive ? 'text-slate-300' : 'text-slate-600')}>
                            {category.description}
                          </p>
                        </div>
                      </button>

                      {isActive ? (
                        <div className="space-y-2 border-t border-slate-100 px-3 py-3">
                          {templates.length > 0 ? (
                            templates.map((template) => {
                              const TemplateIcon = template.icon;
                              const tone = getNodeTone(template.kind);

                              return (
                                <button
                                  key={template.kind}
                                  type="button"
                                  onClick={() => onAddNode(template.kind)}
                                  className="w-full rounded-[1.15rem] border border-slate-200 bg-slate-50 px-3 py-3 text-left transition-all hover:border-slate-300 hover:bg-white"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r text-white', tone.header)}>
                                      <TemplateIcon className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-slate-950">{template.label}</p>
                                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                        {template.subtitle}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-[1.15rem] border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                              No matching nodes in this category.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {matchingTemplateCount === 0 ? (
                <Card className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/70 shadow-none">
                  <CardContent className="p-6 text-sm text-slate-500">
                    Nothing matched that search. Try another term.
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : selectedNode ? (
            <>
              <div className="space-y-1 px-1">
                <h2
                  className="text-xl font-semibold text-slate-950"
                  title={PIPELINE_SHARED_NODE_INFO.title.description}
                >
                  {selectedNodeInspectorInfo?.title ?? selectedNode.data.label}
                </h2>
                <p
                  className="font-mono text-sm text-slate-500"
                  title={PIPELINE_SHARED_NODE_INFO.identifier.description}
                >
                  {selectedNodeInspectorInfo?.identifier ?? selectedNode.data.referenceId}
                </p>
                <p className="text-sm text-slate-500">
                  {PIPELINE_SHARED_NODE_INFO.type.label}: {selectedNodeInspectorInfo?.type ?? selectedNode.data.nodeType}
                </p>
              </div>

              {referenceSaveNotice ? (
                <Alert className="rounded-[1.25rem] border border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Save changes</AlertTitle>
                  <AlertDescription>{referenceSaveNotice}</AlertDescription>
                </Alert>
              ) : null}

              {selectedNodeModule?.renderOptions && selectedNodeInspectorArgs
                ? selectedNodeModule.renderOptions(selectedNodeInspectorArgs)
                : null}

              {selectedNodeModule?.renderResponse && selectedNodeInspectorArgs
                ? selectedNodeModule.renderResponse(selectedNodeInspectorArgs)
                : null}

              <section className="space-y-4 px-1">
                <h3 className="text-lg font-semibold text-slate-950">Node basics</h3>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {PIPELINE_SHARED_NODE_INFO.name.label}
                  </label>
                  <Input
                    value={selectedNodeInspectorInfo?.name ?? selectedNode.data.label}
                    onChange={(event) => onUpdateBasicsName(event.target.value)}
                    className="rounded-2xl border-slate-200 bg-slate-50"
                  />
                  <p className="text-sm text-slate-500">{PIPELINE_SHARED_NODE_INFO.name.description}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {PIPELINE_SHARED_NODE_INFO.description.label}
                  </label>
                  <Textarea
                    value={selectedNodeInspectorInfo?.description ?? selectedNode.data.description}
                    onChange={(event) => onUpdateBasicsDescription(event.target.value)}
                    className="min-h-[110px] rounded-2xl border-slate-200 bg-slate-50"
                  />
                  <p className="text-sm text-slate-500">{PIPELINE_SHARED_NODE_INFO.description.description}</p>
                </div>
              </section>

              <section className="space-y-3 px-1">
                <h3 className="text-lg font-semibold text-slate-950">Quick actions</h3>
                <div className="grid gap-2">
                  <Button variant="outline" className="justify-start rounded-2xl border-slate-200 bg-slate-50" onClick={onDuplicate}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate node
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start rounded-2xl border-slate-200 bg-slate-50"
                    onClick={onAddChild}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add child node
                  </Button>
                  <Button variant="destructive" className="justify-start rounded-2xl" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove node
                  </Button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </ScrollArea>
    </aside>
  );
}
