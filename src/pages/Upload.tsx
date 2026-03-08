import { Upload as UploadIcon, Image, Video, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const supportedTypes = [
  { icon: Image, label: "Images", formats: "JPG, PNG, GIF, WEBP" },
  { icon: Video, label: "Videos", formats: "MP4, MOV, AVI" },
  { icon: FileText, label: "Documents", formats: "PDF, DOC, DOCX" },
];

const UploadPage = () => {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload File</h1>
        <p className="text-sm text-muted-foreground">Select a file to analyze for authenticity.</p>
      </div>

      {/* Dropzone */}
      <Card className="border-2 border-dashed border-primary/30 hover:border-primary/50 transition-colors cursor-pointer">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <UploadIcon className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            Tap to browse or drag & drop
          </p>
          <p className="text-xs text-muted-foreground">
            Max file size: 50MB
          </p>
        </CardContent>
      </Card>

      {/* Supported Formats */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Supported Formats</h2>
        <div className="grid grid-cols-3 gap-2">
          {supportedTypes.map((type) => {
            const Icon = type.icon;
            return (
              <div key={type.label} className="rounded-lg bg-card border border-border p-3 text-center">
                <Icon className="h-5 w-5 text-primary mx-auto mb-1.5" />
                <p className="text-xs font-medium text-foreground">{type.label}</p>
                <p className="text-[10px] text-muted-foreground">{type.formats}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
