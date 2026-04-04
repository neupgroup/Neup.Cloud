
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Folder as FolderIcon, File as FileIcon, FileSymlink, Home, UploadCloud, FolderUp, Loader2, Copy, Trash, Move, Edit, Info, ClipboardPaste, X, FolderPlus, FilePlus, LayoutGrid, List, Shield, ShieldOff, Download } from 'lucide-react';
import { browseDirectory, uploadFile, renameFile, deleteFiles, moveFiles, copyFiles, createDirectory, createEmptyFile, isDirectory, type FileOrFolder } from '@/app/servers/[id]/actions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// function useLocalStorage removed

function ServerFilesBrowser({ serverId }: { serverId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State
  const [files, setFiles] = useState<FileOrFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'file' | 'folder' | null>(null);

  const [uploadQueue, setUploadQueue] = useState<{ name: string, size: number, progress: number }[]>([]);
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set());
  const [newItemState, setNewItemState] = useState<{ type: 'file' | 'folder', isCreating: boolean } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');


  const rootMode = searchParams.get('rootMode') === 'true';

  // Selection & Clipboard
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<{ op: 'copy' | 'move', files: string[], sourcePath: string } | null>(null);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'item' | 'bg' } | null>(null);

  // Dialog States
  const [renameState, setRenameState] = useState<{ isOpen: boolean, oldName: string, newName: string } | null>(null);
  const [deleteState, setDeleteState] = useState<{ isOpen: boolean, files: string[] } | null>(null);
  const [detailsState, setDetailsState] = useState<FileOrFolder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentPath = searchParams.get('path') || '/';

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  // Cache logic removed


  const fetchFiles = useCallback(async (path: string) => {
    setIsLoading(true);
    try {
      const { files: fetchedFiles, error } = await browseDirectory(serverId, path, rootMode);
      if (error) {
        toast({ variant: "destructive", title: "Failed to browse directory", description: error });
        setFiles([]);
      } else {
        const sortedFiles = fetchedFiles.sort((a, b) => {
          if (a.type === 'directory' && b.type !== 'directory') return -1;
          if (a.type !== 'directory' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(sortedFiles);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsLoading(false);
      setSelectedFiles(new Set()); // Clear selection on navigate
    }
  }, [serverId, toast, rootMode]);

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath, fetchFiles]);

  // Close context menu on click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Close context menu on scroll
  useEffect(() => {
    const handleScroll = () => setContextMenu(null);
    window.addEventListener('scroll', handleScroll, true); // Use capture phase to catch all scroll events
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('fileViewMode');
    if (savedViewMode === 'list' || savedViewMode === 'grid') {
      setViewMode(savedViewMode);
    }
  }, []);



  // Reset upload type when dialog closes
  useEffect(() => {
    if (!uploadDialogOpen) {
      const t = setTimeout(() => setUploadType(null), 300);
      return () => clearTimeout(t);
    }
  }, [uploadDialogOpen]);

  // -- Actions --

  const handleCreateSelection = (item: FileOrFolder, multi: boolean) => {
    const newSet = new Set(multi ? selectedFiles : []);
    if (newSet.has(item.name)) {
      if (multi) newSet.delete(item.name);
    } else {
      newSet.add(item.name);
    }
    setSelectedFiles(newSet);
  };

  const onContextMenu = (e: React.MouseEvent, item?: FileOrFolder) => {
    e.preventDefault();
    e.stopPropagation();

    if (item) {
      if (!selectedFiles.has(item.name)) {
        setSelectedFiles(new Set([item.name]));
      }
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'item' });
    } else {
      // Background click
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'bg' });
    }
  };

  const handleItemClick = async (e: React.MouseEvent, item: FileOrFolder) => {
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey) {
      handleCreateSelection(item, true);
      return;
    }

    // Normal navigation
    const fullPath = `${currentPath.endsWith('/') ? currentPath : currentPath + '/'}${item.name}`;

    const openViewer = () => {
      const ext = item.name.split('.').pop()?.toLowerCase() || '';
      let type = 'text';

      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
      const videoExts = ['mp4', 'webm', 'mov'];
      const codeExts = ['js', 'ts', 'tsx', 'jsx', 'css', 'html', 'json', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'sh', 'yaml', 'yml', 'toml', 'xml', 'md', 'env', 'gitignore', 'conf', 'ini'];

      if (imageExts.includes(ext)) type = 'image';
      else if (videoExts.includes(ext)) type = 'video';
      else if (codeExts.includes(ext)) type = 'code';

      router.push(`/viewer?path=${encodeURIComponent(fullPath)}&type=${type}${rootMode ? '&rootMode=true' : ''}`);
    };

    if (item.type === 'directory') {
      router.push(pathname + '?' + createQueryString('path', fullPath));
    } else if (item.type === 'symlink') {
      setIsProcessing(true);
      try {
        const isDir = await isDirectory(serverId, fullPath, rootMode);
        if (isDir) {
          router.push(pathname + '?' + createQueryString('path', fullPath));
        } else {
          openViewer();
        }
      } catch (e) {
        // Fallback to viewer if check fails
        openViewer();
      } finally {
        setIsProcessing(false);
      }
    } else {
      openViewer();
    }
  };

  // Clipboard Operations
  const handleCopy = () => {
    if (selectedFiles.size === 0) return;
    const filesToCopy = Array.from(selectedFiles).map(name =>
      currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name
    );
    setClipboard({ op: 'copy', files: filesToCopy, sourcePath: currentPath });
    toast({ title: 'Copied', description: `${selectedFiles.size} items to clipboard.` });
    setContextMenu(null);
  };

  const handleCut = () => {
    if (selectedFiles.size === 0) return;
    const filesToMove = Array.from(selectedFiles).map(name =>
      currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name
    );
    setClipboard({ op: 'move', files: filesToMove, sourcePath: currentPath });
    toast({ title: 'Cut', description: `${selectedFiles.size} items to clipboard.` });
    setContextMenu(null);
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    setIsProcessing(true);

    const { op, files: sourcePaths } = clipboard;
    const destPath = currentPath;

    let result;
    if (op === 'copy') {
      result = await copyFiles(serverId, sourcePaths, destPath, rootMode);
    } else {
      result = await moveFiles(serverId, sourcePaths, destPath, rootMode);
    }

    if (result.error) {
      toast({ variant: 'destructive', title: 'Action Failed', description: result.error });
    } else {
      toast({ title: 'Success', description: `Items ${op === 'copy' ? 'copied' : 'moved'} successfully.` });
      if (op === 'move') setClipboard(null); // Clear clipboard after move
      await fetchFiles(currentPath); // Force fetch on Paste as it's complex to predict exact file object
    }
    setIsProcessing(false);
    setContextMenu(null);
  };

  const handleRename = () => {
    if (selectedFiles.size !== 1) return;
    const name = Array.from(selectedFiles)[0];
    setRenameState({ isOpen: true, oldName: name, newName: name });
    setContextMenu(null);
  };

  const confirmRename = async () => {
    if (!renameState) return;
    // Optimistic Update
    const oldFiles = [...files];
    const { oldName, newName } = renameState;

    if (oldName === newName) {
      setRenameState(null);
      return;
    }

    // Update UI
    const updatedFiles = files.map(f => f.name === oldName ? { ...f, name: newName } : f).sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    setFiles(updatedFiles);
    setRenameState(null);

    const currentFilePath = currentPath.endsWith('/') ? currentPath + oldName : currentPath + '/' + oldName;
    const result = await renameFile(serverId, currentFilePath, newName, rootMode);

    if (result.error) {
      toast({ variant: 'destructive', title: 'Rename Failed', description: result.error });
      // Revert
      setFiles(oldFiles);
    } else {
      toast({ title: 'Renamed', description: `Successfully renamed to ${newName}` });
      // No need to fetchFiles, we already updated state.
    }
  };

  const handleDelete = () => {
    if (selectedFiles.size === 0) return;
    setDeleteState({ isOpen: true, files: Array.from(selectedFiles) });
    setContextMenu(null);
  };

  const confirmDelete = async () => {
    if (!deleteState) return;

    // Set deleting state for specific files
    const deleteSet = new Set(deleteState.files);
    // setDeletingFiles(deleteSet); // No need for deleting state if we remove immediately? 
    // Wait, visual feedback: User said "show the changes immediately". Removing them is the most immediate change.
    // So we remove them from the list.

    setDeleteState(null);

    const oldFiles = [...files];
    const filesToDelete = deleteState.files;

    // Optimistic Remove
    const newFiles = files.filter(f => !deleteSet.has(f.name));
    setFiles(newFiles);

    const pathsToDelete = filesToDelete.map(name =>
      currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name
    );

    const result = await deleteFiles(serverId, pathsToDelete, rootMode);

    if (result.error) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
      // Revert
      setFiles(oldFiles);
    } else {
      // Play sound
      try {
        const audio = new Audio('/sounds/recycle.mp3');
        audio.play().catch(e => console.error("Audio play failed", e));
      } catch (e) {
        console.error("Audio init failed", e);
      }
      toast({ title: 'Deleted', description: `Successfully deleted ${filesToDelete.length} items.` });
      // Don't fetch again
    }
  }

  const handleDetails = () => {
    if (selectedFiles.size !== 1) return;
    const uniqueName = Array.from(selectedFiles)[0];
    const item = files.find(f => f.name === uniqueName);
    if (item) setDetailsState(item);
    setContextMenu(null);
  };

  // Upload handlers (keep existing)
  // Upload handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploadDialogOpen(false);

    // Add all to queue
    const newQueueItems = Array.from(selectedFiles).map(file => ({ name: file.name, size: file.size, progress: 0 }));
    setUploadQueue(prev => [...prev, ...newQueueItems]);

    let successCount = 0;

    for (const file of Array.from(selectedFiles)) {
      // Monitor progress
      const interval = setInterval(() => {
        setUploadQueue(prev => prev.map(item =>
          item.name === file.name ? { ...item, progress: Math.min(item.progress + 10, 90) } : item
        ));
      }, 300);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const result = await uploadFile(serverId, currentPath, formData);
        clearInterval(interval);

        if (result.error) {
          toast({ variant: 'destructive', title: 'Upload Failed', description: `${file.name}: ${result.error}` });
          setUploadQueue(prev => prev.filter(item => item.name !== file.name));
        } else {
          successCount++;
          setUploadQueue(prev => prev.map(item => item.name === file.name ? { ...item, progress: 100 } : item));

          // Remove from queue after delay
          setTimeout(() => {
            setUploadQueue(prev => prev.filter(item => item.name !== file.name));
          }, 1000);
        }
      } catch (e: any) {
        clearInterval(interval);
        setUploadQueue(prev => prev.filter(item => item.name !== file.name));
        toast({ variant: 'destructive', title: 'Upload Error', description: `${file.name}: ${e.message}` });
      }
    }

    if (successCount > 0) {
      toast({ title: 'Upload Complete', description: `${successCount} files uploaded successfully.` });

      // Optimistic Update: Add uploaded files to current view
      const newFiles: FileOrFolder[] = Array.from(selectedFiles).map(file => ({
        name: file.name,
        type: 'file',
        size: file.size,
        permissions: 'rw-r--r--', // dummy
        lastModified: new Date().toISOString()
      }));

      // Merge with existing files, replacing potential duplicates
      const mergedFiles = [...files];
      newFiles.forEach(nf => {
        const idx = mergedFiles.findIndex(f => f.name === nf.name);
        if (idx >= 0) mergedFiles[idx] = nf;
        else mergedFiles.push(nf);
      });

      const sortedFiles = mergedFiles.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });

      setFiles(sortedFiles);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploadDialogOpen(false);

    // Add all to queue
    const newQueueItems = Array.from(selectedFiles).map(f => ({ name: f.name, size: f.size, progress: 0 }));
    setUploadQueue(prev => [...prev, ...newQueueItems]);

    toast({ title: 'Folder Upload Started', description: `Starting to upload ${selectedFiles.length} files.` });

    let successCount = 0;

    for (const file of Array.from(selectedFiles)) {
      // Start "simulated" progress for this file
      const interval = setInterval(() => {
        setUploadQueue(prev => prev.map(item =>
          item.name === file.name ? { ...item, progress: Math.min(item.progress + 10, 90) } : item
        ));
      }, 200);

      const formData = new FormData();
      const remoteFilePath = file.webkitRelativePath ? currentPath + '/' + file.webkitRelativePath.substring(0, file.webkitRelativePath.lastIndexOf('/')) : currentPath;
      formData.append('file', file);

      try {
        const result = await uploadFile(serverId, remoteFilePath, formData);
        clearInterval(interval);
        if (result.error) {
          // Remove failed
          setUploadQueue(prev => prev.filter(item => item.name !== file.name));
        } else {
          successCount++;
          setUploadQueue(prev => prev.map(item => item.name === file.name ? { ...item, progress: 100 } : item));
          // Remove success after delay
          setTimeout(() => {
            setUploadQueue(prev => prev.filter(item => item.name !== file.name));
          }, 1000);
        }
      } catch (e) {
        clearInterval(interval);
        setUploadQueue(prev => prev.filter(item => item.name !== file.name));
      }
    }

    toast({ title: 'Folder Upload Complete', description: `${successCount} files uploaded successfully.` });

    // Optimistic Update for Folder Upload
    // Start with existing
    const mergedFiles = [...files];
    const cacheKey = rootMode ? currentPath + ':root' : currentPath;
    let hasChanges = false;

    // Identify direct children of currentPath being created
    Array.from(selectedFiles).forEach(file => {
      // webkitRelativePath example: "folderName/subFolder/file.txt"
      // If we are uploading "folderName", we want to see "folderName" in current directory.
      if (file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split('/');
        if (parts.length > 0) {
          const topLevelName = parts[0];

          // Check if this top level item is already in our list
          const conflict = mergedFiles.find(f => f.name === topLevelName);
          // If it's not there, add it as a directory. 
          // If it is there, we assume it's updated (maybe size diff? folders don't have size usually shown correctly sum-wise here immediately)
          // Just ensuring it exists is enough for "Folder Upload".

          if (!conflict) {
            mergedFiles.push({
              name: topLevelName,
              type: 'directory',
              size: 0,
              permissions: 'drwxr-xr-x',
              lastModified: new Date().toISOString()
            });
            hasChanges = true;
          }
        }
      }
    });

    if (hasChanges) {
      const sortedFiles = mergedFiles.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
      setFiles(sortedFiles);
    }

    if (folderInputRef.current) folderInputRef.current.value = '';
  }

  const handleCreateNew = (type: 'file' | 'folder') => {
    setNewItemState({ type, isCreating: false });
  }

  const handleCreateSubmit = async (e: React.FocusEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if ('key' in e && e.key !== 'Enter') return;

    if (e.type === 'blur') {
      setNewItemState(null);
      return;
    }

    const val = e.currentTarget.value.trim();
    if (!val) {
      setNewItemState(null);
      return;
    }

    if (newItemState?.isCreating) return;

    // Optimistic Create
    const type = newItemState?.type || 'file';
    const oldFiles = [...files];

    const newFileObj: FileOrFolder = {
      name: val,
      type: type === 'folder' ? 'directory' : 'file',
      size: 0,
      permissions: 'drwxr-xr-x', // dummy
      lastModified: new Date().toISOString()
    };

    // Insert and sort
    const updatedFiles = [...files, newFileObj].sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });

    setFiles(updatedFiles);
    setNewItemState(null); // Remove input

    const newPath = currentPath.endsWith('/') ? currentPath + val : currentPath + '/' + val;
    let res;
    // We set creating state implicitly by having "optimistic" item. We don't have a "loading" state on that item unless we add it to a special "creating" set, but user wants immediate "show changes". showing the file is the change.

    if (type === 'folder') {
      res = await createDirectory(serverId, newPath, rootMode);
    } else {
      res = await createEmptyFile(serverId, newPath, rootMode);
    }

    if (res.error) {
      toast({ variant: 'destructive', title: 'Action Failed', description: res.error });
      // Revert
      setFiles(oldFiles);
    } else {
      toast({ title: 'Success', description: `${type === 'folder' ? 'Folder' : 'File'} created.` });
      // No fetch needed
    }
  }

  const handleViewModeChange = () => {
    const newMode = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(newMode);
    localStorage.setItem('fileViewMode', newMode);
    setContextMenu(null);
  }

  const handleRootModeToggle = () => {
    const newRootMode = !rootMode;
    const params = new URLSearchParams(searchParams.toString());
    params.set('rootMode', newRootMode.toString());
    router.push(pathname + '?' + params.toString());

    toast({
      title: newRootMode ? 'Root Mode Enabled' : 'Root Mode Disabled',
      description: newRootMode ? 'All file operations will now use sudo.' : 'File operations will run with normal permissions.',
    });
    setContextMenu(null);
  }

  const handleDownload = async () => {
    if (selectedFiles.size === 0) return;
    setContextMenu(null);

    // Show initial toast
    const downloadToast = toast({
      title: 'Starting Download',
      description: "Please wait, preparing download...",
      duration: Infinity, // Don't auto-dismiss
    });

    try {
      const filesToDownload = Array.from(selectedFiles).map(name =>
        currentPath.endsWith('/') ? currentPath + name : currentPath + '/' + name
      );

      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paths: filesToDownload,
          rootMode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        downloadToast.update({
          variant: 'destructive',
          title: 'Download Failed',
          description: error.error || 'Failed to download files.',
          duration: 5000,
        });
        return;
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'download';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create a blob from the response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Update toast to success and auto-dismiss
      downloadToast.update({
        title: 'Download Started',
        description: `Downloading ${selectedFiles.size} item(s).`,
        duration: 3000, // Auto-dismiss after 3 seconds
      });

      // Manually dismiss after duration
      setTimeout(() => {
        downloadToast.dismiss();
      }, 3000);
    } catch (e: any) {
      downloadToast.update({
        variant: 'destructive',
        title: 'Download Error',
        description: e.message,
        duration: 5000,
      });
    }
  }

  const handleBreadcrumbClick = (index: number) => {
    const pathSegments = currentPath.split('/').filter(Boolean);
    const newPath = '/' + pathSegments.slice(0, index + 1).join('/');
    router.push(pathname + '?' + createQueryString('path', newPath));
  }
  const breadcrumbSegments = currentPath.split('/').filter(Boolean);


  // Render
  return (
    <div className="min-h-[600px] flex flex-col relative" onContextMenu={(e) => onContextMenu(e)} ref={containerRef}>
      {isProcessing && <div className="absolute inset-0 bg-background/50 z-50 flex items-center justify-center"><Loader2 className="animate-spin" /></div>}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col text-sm">
            {contextMenu.type === 'item' ? (
              <>
                <button onClick={handleCopy} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </button>
                <button onClick={handleCut} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
                  <Move className="mr-2 h-4 w-4" /> Move (Cut)
                </button>
                {selectedFiles.size === 1 && (
                  <button onClick={handleRename} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
                    <Edit className="mr-2 h-4 w-4" /> Rename
                  </button>
                )}
                <button onClick={handleDownload} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
                  <Download className="mr-2 h-4 w-4" /> Download
                </button>
                <button onClick={handleDelete} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground text-red-600">
                  <Trash className="mr-2 h-4 w-4" /> Delete
                </button>
                {selectedFiles.size === 1 && (
                  <>
                    <div className="h-px bg-border my-1" />
                    <button onClick={handleDetails} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
                      <Info className="mr-2 h-4 w-4" /> Details
                    </button>
                  </>
                )}
              </>
            ) : null}

            {/* Paste (if clipboard has content) */}
            {clipboard && (
              <>
                {contextMenu.type === 'item' && <div className="h-px bg-border my-1" />}
                <button onClick={handlePaste} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
                  <ClipboardPaste className="mr-2 h-4 w-4" /> Paste ({clipboard.op})
                </button>
                <button onClick={() => { setClipboard(null); setContextMenu(null); }} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground text-xs text-muted-foreground">
                  <X className="mr-2 h-3 w-3" /> Clear Clipboard
                </button>
              </>
            )}

            {/* Separator before creation options */}
            {(contextMenu.type === 'item' || clipboard) && <div className="h-px bg-border my-1" />}

            {/* Upload, New Folder, New File - Always shown */}
            <button onClick={() => { setUploadDialogOpen(true); setContextMenu(null); }} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
              <UploadCloud className="mr-2 h-4 w-4" /> Upload
            </button>
            <button onClick={() => { handleCreateNew('folder'); setContextMenu(null); }} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
              <FolderPlus className="mr-2 h-4 w-4" /> New Folder
            </button>
            <button onClick={() => { handleCreateNew('file'); setContextMenu(null); }} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
              <FilePlus className="mr-2 h-4 w-4" /> New File
            </button>

            {/* Separator before view mode */}
            <div className="h-px bg-border my-1" />

            {/* View Mode Toggle - Always shown */}
            <button onClick={handleViewModeChange} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
              {viewMode === 'grid' ? (
                <><List className="mr-2 h-4 w-4" /> View as List</>
              ) : (
                <><LayoutGrid className="mr-2 h-4 w-4" /> View as Grid</>
              )}
            </button>

            {/* Root Mode Toggle - Always shown */}
            <button onClick={handleRootModeToggle} className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 outline-none hover:bg-accent hover:text-accent-foreground">
              {rootMode ? (
                <><ShieldOff className="mr-2 h-4 w-4" /> Turn Root Off</>
              ) : (
                <><Shield className="mr-2 h-4 w-4" /> Turn Root On</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={!!renameState} onOpenChange={(o) => !o && setRenameState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Item</DialogTitle>
            <DialogDescription>
              Enter a new name for the item.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input
                id="name"
                value={renameState?.newName || ''}
                onChange={(e) => setRenameState(prev => prev ? ({ ...prev, newName: e.target.value }) : null)}
                onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameState(null)}>Cancel</Button>
            <Button onClick={confirmRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteState} onOpenChange={(o) => !o && setDeleteState(null)}>
        <DialogContent onKeyDown={(e) => e.key === 'Enter' && confirmDelete()}>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This will permanently delete {deleteState?.files.length} items. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteState(null)}>Cancel</Button>
            <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsState} onOpenChange={(o) => !o && setDetailsState(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Item Details</DialogTitle></DialogHeader>
          {detailsState && (
            <div className="grid gap-2 text-sm">
              <div className="grid grid-cols-3"><span className="font-semibold text-muted-foreground">Name:</span> <span className="col-span-2 break-all font-medium">{detailsState.name}</span></div>
              <div className="grid grid-cols-3"><span className="font-semibold text-muted-foreground">Type:</span> <span className="col-span-2 capitalize">{detailsState.type}</span></div>
              <div className="grid grid-cols-3"><span className="font-semibold text-muted-foreground">Size:</span> <span className="col-span-2">{formatBytes(detailsState.size)}</span></div>
              <div className="grid grid-cols-3"><span className="font-semibold text-muted-foreground">Permissions:</span> <span className="col-span-2 font-mono">{detailsState.permissions}</span></div>
              <div className="grid grid-cols-3"><span className="font-semibold text-muted-foreground">Modified:</span> <span className="col-span-2">{detailsState.lastModified}</span></div>
              {detailsState.linkTarget && <div className="grid grid-cols-3"><span className="font-semibold text-muted-foreground">Symlink Target:</span> <span className="col-span-2 break-all">{detailsState.linkTarget}</span></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Root Mode Indicator */}
      {rootMode && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-amber-600 dark:text-amber-400">Root Mode Active</span>
          <span className="text-muted-foreground">- All file operations will use sudo</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground p-1">
        <span className="font-semibold text-foreground">Path:</span>
        <button
          onClick={() => router.push(pathname + '?' + createQueryString('path', '/'))}
          className="hover:underline hover:text-primary transition-colors"
        >
          root
        </button>
        {breadcrumbSegments.map((segment, index) => (
          <React.Fragment key={index}>
            <span className="text-muted-foreground/40">&gt;</span>
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className="hover:underline hover:text-primary transition-colors"
            >
              {segment}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="flex-1" onClick={() => setSelectedFiles(new Set())}>
        {isLoading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20' : 'grid grid-cols-1 gap-4 pb-20'}>
            {Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className={viewMode === 'grid' ? 'min-h-[120px]' : ''}>
                <CardContent className={viewMode === 'grid' ? 'p-4 flex flex-col items-start gap-3' : 'p-3 flex flex-row items-center gap-3'}>
                  {viewMode === 'grid' ? (
                    <>
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="w-full space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Skeleton className="h-5 w-5 rounded-md flex-shrink-0" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20' : 'grid grid-cols-1 gap-4 pb-20'}>
            {/* Pending Creation Card */}
            {newItemState && (
              <Card className="cursor-pointer transition-all hover:border-primary group relative border-primary/20 bg-accent/20">
                <CardContent className={viewMode === 'grid' ? 'p-4 flex flex-col items-start gap-3' : 'p-3 flex flex-row items-center gap-3'}>
                  {viewMode === 'grid' ? (
                    <>
                      <div className="p-2 bg-background rounded-md border shadow-sm">
                        {newItemState.type === 'folder' ? (
                          <FolderIcon className="h-6 w-6 text-primary" />
                        ) : (
                          <FileIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="w-full space-y-1">
                        {newItemState.isCreating ? (
                          <>
                            <p className="font-medium text-sm truncate w-full">New {newItemState.type}</p>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span className="text-primary flex items-center gap-1.5 font-medium animate-pulse">
                                <Loader2 className="h-3 w-3 animate-spin" /> Creating...
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <Input
                              autoFocus
                              placeholder=""
                              onKeyDown={handleCreateSubmit}
                              onBlur={handleCreateSubmit}
                              className="font-medium text-sm h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent"
                            />
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>{newItemState.type === 'folder' ? 'Folder' : 'File'}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-shrink-0">
                        {newItemState.type === 'folder' ? (
                          <FolderIcon className="h-5 w-5 text-primary" />
                        ) : (
                          <FileIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {newItemState.isCreating ? (
                          <>
                            <p className="font-medium text-sm truncate">New {newItemState.type}</p>
                            <div className="text-xs text-muted-foreground">
                              <span className="text-primary flex items-center gap-1.5 font-medium animate-pulse">
                                <Loader2 className="h-3 w-3 animate-spin" /> Creating...
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <Input
                              autoFocus
                              placeholder=""
                              onKeyDown={handleCreateSubmit}
                              onBlur={handleCreateSubmit}
                              className="font-medium text-sm h-auto p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent mb-1"
                            />
                            <div className="text-xs text-muted-foreground">
                              <span>{newItemState.type === 'folder' ? 'Folder' : 'File'}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Upload Queue Items */}
            {uploadQueue.map((item, index) => (
              <Card key={`upload-${index}`} className="relative overflow-hidden border-primary/20 bg-accent/20">
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded-md border shadow-sm">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={item.name}>{item.name}</p>
                      <p className="text-xs text-muted-foreground">Uploading...</p>
                    </div>
                  </div>
                  <Progress value={item.progress} className="h-2" />
                </CardContent>
              </Card>
            ))}

            {/* File Items */}
            {files.map((item, index) => {
              const isSelected = selectedFiles.has(item.name);
              const isDeleting = deletingFiles.has(item.name);

              return (
                <Card
                  key={index}
                  onClick={(e) => !isDeleting && handleItemClick(e, item)}
                  onContextMenu={(e) => !isDeleting && onContextMenu(e, item)}
                  className={`cursor-pointer transition-all hover:border-primary group relative
                            ${item.type === 'directory' ? 'border-primary/20' : ''}
                            ${isSelected ? 'ring-2 ring-primary border-transparent' : ''}
                            ${isDeleting ? 'opacity-60 bg-muted/20' : ''}
                        `}
                >
                  <CardContent className={viewMode === 'grid' ? 'p-4 flex flex-col items-start gap-3' : 'p-3 flex flex-row items-center gap-3'}>
                    {viewMode === 'grid' ? (
                      <>
                        <div className="p-2 bg-background rounded-md border shadow-sm">
                          {item.type === 'directory' && <FolderIcon className="h-6 w-6 text-primary" />}
                          {item.type === 'file' && <FileIcon className="h-6 w-6 text-muted-foreground" />}
                          {item.type === 'symlink' && <FileSymlink className="h-6 w-6 text-accent" />}
                        </div>
                        <div className="w-full space-y-1">
                          <p className="font-medium text-sm truncate w-full" title={item.name}>
                            {item.name}
                          </p>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            {isDeleting ? (
                              <span className="text-destructive flex items-center gap-1.5 font-medium animate-pulse">
                                <Loader2 className="h-3 w-3 animate-spin" /> Deleting...
                              </span>
                            ) : (
                              <span>{item.type === 'file' ? formatBytes(item.size) : 'Folder'}</span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-shrink-0">
                          {item.type === 'directory' && <FolderIcon className="h-5 w-5 text-primary" />}
                          {item.type === 'file' && <FileIcon className="h-5 w-5 text-muted-foreground" />}
                          {item.type === 'symlink' && <FileSymlink className="h-5 w-5 text-accent" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" title={item.name}>
                            {item.name}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            {isDeleting ? (
                              <span className="text-destructive flex items-center gap-1.5 font-medium animate-pulse">
                                <Loader2 className="h-3 w-3 animate-spin" /> Deleting...
                              </span>
                            ) : (
                              <span>{item.type === 'file' ? formatBytes(item.size) : 'Folder'}</span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-4xl h-[60vh] flex flex-col gap-0 p-0 overflow-hidden">
          <div className="px-6 py-4 border-b">
            <DialogTitle className="break-all">
              {uploadType ? `Upload ${uploadType === 'file' ? 'Files' : 'Folder'}` : `Upload to ${currentPath === '/' ? 'Root' : currentPath}`}
            </DialogTitle>
            <DialogDescription>
              {uploadType ? "Drag and drop or click to select." : "Choose upload type."}
            </DialogDescription>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/5">
            {!uploadType ? (
              <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl justify-center items-center h-full">
                <Button
                  variant="outline"
                  className="h-40 w-40 flex flex-col gap-4 border-2 hover:border-primary/50 hover:bg-accent transition-all rounded-xl"
                  onClick={() => setUploadType('file')}
                >
                  <FileIcon className="h-10 w-10 text-muted-foreground" />
                  <span className="text-lg font-medium">Upload Files</span>
                </Button>
                <div className="text-muted-foreground font-medium">- OR -</div>
                <Button
                  variant="outline"
                  className="h-40 w-40 flex flex-col gap-4 border-2 hover:border-primary/50 hover:bg-accent transition-all rounded-xl"
                  onClick={() => setUploadType('folder')}
                >
                  <FolderUp className="h-10 w-10 text-muted-foreground" />
                  <span className="text-lg font-medium">Upload Folder</span>
                </Button>
              </div>
            ) : (
              <div
                className="w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-6 p-8 transition-all hover:bg-muted/10 cursor-pointer animate-in fade-in-50 zoom-in-95"
                onClick={() => {
                  if (uploadType === 'file') fileInputRef.current?.click();
                  else folderInputRef.current?.click();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const fileIO = { target: { files: e.dataTransfer.files } } as any;
                    if (uploadType === 'file') handleFileUpload(fileIO);
                    else handleFolderUpload(fileIO);
                  }
                }}
              >
                <div className="bg-primary/10 p-6 rounded-full shadow-sm animate-bounce">
                  <UploadCloud className="h-12 w-12 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-semibold">Drop {uploadType === 'file' ? 'files' : 'folder'} here</h3>
                  <p className="text-muted-foreground text-base">or click to open explorer</p>
                </div>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setUploadType(null); }}>Back to selection</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <input type="file" ref={fileInputRef} onChange={(e) => { handleFileUpload(e); setUploadDialogOpen(false); }} className="hidden" multiple={true} />
      {/* @ts-ignore */}
      <input type="file" ref={folderInputRef} onChange={(e) => { handleFolderUpload(e); setUploadDialogOpen(false); }} className="hidden" multiple={true} webkitdirectory="" />
    </div>
  );
}

export default function ServerFilesPageContent({ serverId }: { serverId: string }) {
  if (!serverId) return null;
  return <ServerFilesBrowser serverId={serverId} />;
}
