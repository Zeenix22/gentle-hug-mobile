import { supabase } from "@/integrations/supabase/client";
import type { FileType } from "@/types";

export async function uploadFileAndCreateAnalysis(
  file: File,
  fileType: FileType,
  userId: string
): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const storagePath = `${userId}/${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(storagePath, file);

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data, error: insertError } = await supabase
    .from("analyses" as any)
    .insert({
      user_id: userId,
      file_name: file.name,
      file_type: fileType,
      file_size: file.size,
      storage_path: storagePath,
      status: "uploading",
    } as any)
    .select("id")
    .single();

  if (insertError) throw new Error(`Failed to create analysis: ${insertError.message}`);

  return (data as any).id;
}

export async function triggerProcessing(analysisId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/process-file`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ analysisId }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Processing failed");
  }
}

export async function getAnalysis(analysisId: string) {
  const { data, error } = await supabase
    .from("analyses" as any)
    .select("*")
    .eq("id", analysisId)
    .single();

  if (error) throw new Error(error.message);
  return data as any;
}

export async function getUserAnalyses() {
  const { data, error } = await supabase
    .from("analyses" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as any[]) || [];
}

export async function deleteAnalysis(analysisId: string): Promise<void> {
  const { data: analysis, error: fetchError } = await supabase
    .from("analyses" as any)
    .select("storage_path")
    .eq("id", analysisId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const storagePath = (analysis as any)?.storage_path;
  if (storagePath) {
    await supabase.storage.from("uploads").remove([storagePath]);
  }

  const { error } = await supabase
    .from("analyses" as any)
    .delete()
    .eq("id", analysisId);

  if (error) throw new Error(error.message);
}
