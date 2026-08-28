'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { Textarea } from "#/components/ui/textarea";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import type { Application } from "@/services/server/applications/_types";
import { useFilesForm } from '@/components/applications/files-form';

export function FilesForm({ application }: { application: Application }) {
  const {
    files,
    isSaving,
    isEditDialogOpen,
    setIsEditDialogOpen,
    currentFile,
    setCurrentFile,
    isDeleteAlertOpen,
    setIsDeleteAlertOpen,
    fileToDelete,
    isNewFile,
    handleSaveFile,
    handleDeleteFile,
    openNewFileDialog,
    openEditDialog,
    openDeleteAlert,
  } = useFilesForm(application);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Application Files</CardTitle>
          <CardDescription>
            Create or override files in your application deployment.
          </CardDescription>
        </div>
        <Button onClick={openNewFileDialog}>
          <Plus className="mr-2 h-4 w-4" /> Add File
        </Button>
      </CardHeader>
      <CardContent>
        {Object.keys(files).length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-10 w-10 mb-3 opacity-50" />
            <p>No custom files configured.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Path</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(files).map(([path, content]) => (
                <TableRow key={path}>
                  <TableCell className="font-medium font-mono text-sm">{path}</TableCell>
                  <TableCell className="text-muted-foreground">{content.length} bytes</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(path, content)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteAlert(path)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isNewFile ? "Add New File" : "Edit File"}</DialogTitle>
            <DialogDescription>
              Specify the relative path and content for the file.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 flex-1 overflow-hidden">
            <div className="grid gap-2">
              <Label htmlFor="path">File Path (Relative to app root)</Label>
              <Input
                id="path"
                value={currentFile?.path || ""}
                onChange={(e) => setCurrentFile((prev) => (prev ? { ...prev, path: e.target.value } : null))}
                placeholder="e.g. public/robots.txt or config/settings.json"
                disabled={!isNewFile}
                className="font-mono"
              />
            </div>
            <div className="grid gap-2 flex-1 min-h-[300px]">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={currentFile?.content || ""}
                onChange={(e) => setCurrentFile((prev) => (prev ? { ...prev, content: e.target.value } : null))}
                className="font-mono h-full resize-none min-h-[300px]"
                placeholder="File content here..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveFile} disabled={isSaving || !currentFile?.path}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the override for <strong>{fileToDelete}</strong>.
              If the file exists in the repository, the original version will be restored on next deployment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
