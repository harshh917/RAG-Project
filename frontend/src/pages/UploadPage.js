import React, { useState, useCallback } from "react";
import { useApi } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Upload, FileText, Image, Music, File, X, CheckCircle, AlertCircle, Loader2
} from "lucide-react";

const fileTypeConfig = {
  pdf: { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10", label: "PDF" },
  docx: { icon: FileText, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "DOCX" },
  image: { icon: Image, color: "text-amber-400", bg: "bg-amber-500/10", label: "IMAGE" },
  audio: { icon: Music, color: "text-purple-400", bg: "bg-purple-500/10", label: "AUDIO" },
  unknown: { icon: File, color: "text-gray-400", bg: "bg-gray-500/10", label: "FILE" },
};

function getFileType(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return "pdf";
  if (["docx", "doc"].includes(ext)) return "docx";
  if (["png", "jpg", "jpeg", "gif", "bmp", "webp"].includes(ext)) return "image";
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "audio";
  return "unknown";
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export default function UploadPage() {
  const api = useApi();
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState({});
  const [results, setResults] = useState({});

  const handleFiles = useCallback((newFiles) => {
    const fileArray = Array.from(newFiles).map((f) => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      name: f.name,
      size: f.size,
      type: getFileType(f.name),
    }));
    setFiles((prev) => [...prev, ...fileArray]);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setResults((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const uploadFile = async (fileItem) => {
    setUploading((prev) => ({ ...prev, [fileItem.id]: true }));
    try {
      const formData = new FormData();
      formData.append("file", fileItem.file);
      const res = await api.post("/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults((prev) => ({ ...prev, [fileItem.id]: { success: true, data: res.data } }));
      toast.success(`${fileItem.name} indexed (${res.data.total_chunks} chunks)`);
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [fileItem.id]: { success: false, error: err.response?.data?.detail || "Upload failed" },
      }));
      toast.error(`Failed to upload ${fileItem.name}`);
    } finally {
      setUploading((prev) => ({ ...prev, [fileItem.id]: false }));
    }
  };

  const uploadAll = async () => {
    const pending = files.filter((f) => !results[f.id]);
    for (const f of pending) {
      await uploadFile(f);
    }
  };

  return (
    <div data-testid="upload-page" className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
          INGEST FILES
        </h1>
        <p className="text-xs text-gray-600 font-mono mt-1">UPLOAD DOCUMENTS FOR SEMANTIC INDEXING</p>
      </div>

      {/* Supported formats */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(fileTypeConfig).filter(([k]) => k !== "unknown").map(([key, cfg]) => (
          <Badge
            key={key}
            variant="outline"
            className={`border-white/10 ${cfg.color} text-[10px] font-mono`}
          >
            {cfg.label}
          </Badge>
        ))}
      </div>

      {/* Drop Zone */}
      <Card
        data-testid="drop-zone"
        className={`bg-[#0A0A0A] border-dashed border-2 rounded-md transition-all duration-150 cursor-pointer ${
          dragActive ? "border-blue-500 bg-blue-500/[0.03]" : "border-white/10 hover:border-white/20"
        }`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragActive(false)}
        onClick={() => document.getElementById("file-input").click()}
      >
        <CardContent className="p-12 text-center">
          <Upload className={`h-10 w-10 mx-auto mb-4 ${dragActive ? "text-blue-400" : "text-gray-600"}`} />
          <p className="text-sm text-gray-400 mb-1">Drop files here or click to browse</p>
          <p className="text-[10px] text-gray-600 font-mono">PDF, DOCX, PNG, JPG, MP3, WAV</p>
          <input
            id="file-input"
            data-testid="file-input"
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.gif,.bmp,.webp,.mp3,.wav,.ogg,.m4a,.flac"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </CardContent>
      </Card>

      {/* File Queue */}
      {files.length > 0 && (
        <Card className="bg-[#111] border-white/[0.06] rounded-md">
          <CardHeader className="border-b border-white/[0.06] p-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-gray-400 font-mono tracking-wider">
              FILE QUEUE ({files.length})
            </CardTitle>
            <Button
              data-testid="upload-all-btn"
              onClick={uploadAll}
              disabled={files.every((f) => results[f.id])}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm h-8 text-xs font-['Barlow_Condensed'] tracking-wider shadow-[0_0_15px_rgba(37,99,235,0.2)]"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              PROCESS ALL
            </Button>
          </CardHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y divide-white/[0.04]">
              {files.map((f) => {
                const cfg = fileTypeConfig[f.type] || fileTypeConfig.unknown;
                const Icon = cfg.icon;
                const isUploading = uploading[f.id];
                const result = results[f.id];

                return (
                  <div
                    key={f.id}
                    data-testid={`file-item-${f.id}`}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className={`p-2 rounded-sm ${cfg.bg}`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 truncate">{f.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-600 font-mono">{formatSize(f.size)}</span>
                        {result?.success && (
                          <span className="text-[10px] text-emerald-500 font-mono">
                            {result.data.total_chunks} CHUNKS
                          </span>
                        )}
                      </div>
                      {isUploading && <Progress value={66} className="h-1 mt-1.5 bg-white/5" />}
                    </div>

                    <div className="flex items-center gap-2">
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                      ) : result?.success ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : result?.error ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`upload-single-${f.id}`}
                          onClick={() => uploadFile(f)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 text-xs"
                        >
                          UPLOAD
                        </Button>
                      )}
                      {!isUploading && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFile(f.id)}
                          className="h-7 w-7 text-gray-600 hover:text-red-400 hover:bg-red-500/5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
