import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  CheckCircle,
  XCircle,
  Trash2,
  Database,
  ImagePlus,
  Loader2,
  ArrowLeft,
  FileImage,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Label = "authentic" | "manipulated";

interface DatasetEntry {
  id: string;
  file_name: string;
  storage_path: string;
  label: Label;
  notes: string | null;
  created_at: string;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const DatasetCollection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [label, setLabel] = useState<Label>("authentic");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Fetch existing dataset entries
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["training-dataset"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_dataset" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as DatasetEntry[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (entry: DatasetEntry) => {
      await supabase.storage.from("uploads").remove([entry.storage_path]);
      const { error } = await supabase
        .from("training_dataset" as any)
        .delete()
        .eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-dataset"] });
      toast({ title: "Entry deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        ACCEPTED_TYPES.includes(f.type)
      );
      setSelectedFiles((prev) => [...prev, ...files]);
    },
    []
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      ACCEPTED_TYPES.includes(f.type)
    );
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!user || selectedFiles.length === 0) return;
    setUploading(true);

    try {
      let successCount = 0;
      for (const file of selectedFiles) {
        const path = `training/${user.id}/${Date.now()}-${file.name}`;
        const { error: storageError } = await supabase.storage
          .from("uploads")
          .upload(path, file);
        if (storageError) {
          console.error("Storage upload error:", storageError);
          continue;
        }

        const { error: dbError } = await supabase
          .from("training_dataset" as any)
          .insert({
            user_id: user.id,
            file_name: file.name,
            storage_path: path,
            label,
            notes: notes.trim() || null,
          } as any);
        if (dbError) {
          console.error("DB insert error:", dbError);
          continue;
        }
        successCount++;
      }

      toast({
        title: `${successCount}/${selectedFiles.length} images uploaded`,
        description: `Labeled as "${label}"`,
      });
      setSelectedFiles([]);
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["training-dataset"] });
    } catch (err) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <Database className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Sign in required</h2>
        <p className="text-muted-foreground text-center">
          You need to be logged in to build a training dataset.
        </p>
        <Button onClick={() => navigate("/login")}>Sign In</Button>
      </div>
    );
  }

  const authenticCount = entries.filter((e) => e.label === "authentic").length;
  const manipulatedCount = entries.filter((e) => e.label === "manipulated").length;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">Dataset Collection</h1>
            <p className="text-xs text-muted-foreground">
              Upload & label images for model training
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{entries.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{authenticCount}</p>
              <p className="text-xs text-muted-foreground">Authentic</p>
            </CardContent>
          </Card>
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{manipulatedCount}</p>
              <p className="text-xs text-muted-foreground">Manipulated</p>
            </CardContent>
          </Card>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImagePlus className="h-5 w-5 text-primary" />
              Add Training Images
            </CardTitle>
            <CardDescription>
              Drop images or click to select, then label and upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
              onClick={() => document.getElementById("dataset-file-input")?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag & drop images or <span className="text-primary font-medium">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, GIF</p>
              <input
                id="dataset-file-input"
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(",")}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Selected files preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {selectedFiles.length} file(s) selected
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="relative group rounded-lg border border-border overflow-hidden"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-24 object-cover"
                      />
                      <button
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </button>
                      <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">
                        {file.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Label selector */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Label</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={label === "authentic" ? "default" : "outline"}
                  className={cn(
                    "flex-1 gap-2",
                    label === "authentic" && "bg-green-600 hover:bg-green-700 text-white"
                  )}
                  onClick={() => setLabel("authentic")}
                >
                  <CheckCircle className="h-4 w-4" />
                  Authentic
                </Button>
                <Button
                  type="button"
                  variant={label === "manipulated" ? "default" : "outline"}
                  className={cn(
                    "flex-1 gap-2",
                    label === "manipulated" && "bg-red-600 hover:bg-red-700 text-white"
                  )}
                  onClick={() => setLabel("manipulated")}
                >
                  <XCircle className="h-4 w-4" />
                  Manipulated
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Notes (optional)</p>
              <Textarea
                placeholder="e.g. 'Photoshop splice on left side' or 'Original DSLR capture'"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploading}
              className="w-full gap-2"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {selectedFiles.length} Image{selectedFiles.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Dataset entries list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-5 w-5 text-primary" />
              Your Dataset ({entries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileImage className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No images yet. Start uploading!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <FileImage className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.file_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant={entry.label === "authentic" ? "default" : "destructive"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {entry.label}
                        </Badge>
                        {entry.notes && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {entry.notes}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(entry)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DatasetCollection;
