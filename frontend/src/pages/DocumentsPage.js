import React, { useEffect, useState } from "react";
import { useApi } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  FileText, Image, Music, Trash2, MoreVertical, Search, RefreshCw, Loader2
} from "lucide-react";

const typeConfig = {
  pdf: { icon: FileText, color: "text-blue-400", badge: "border-blue-500/30 text-blue-400" },
  docx: { icon: FileText, color: "text-emerald-400", badge: "border-emerald-500/30 text-emerald-400" },
  image: { icon: Image, color: "text-amber-400", badge: "border-amber-500/30 text-amber-400" },
  audio: { icon: Music, color: "text-purple-400", badge: "border-purple-500/30 text-purple-400" },
};

function formatSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export default function DocumentsPage() {
  const api = useApi();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);

  const fetchDocs = () => {
    setLoading(true);
    api.get("/documents")
      .then((res) => setDocs(res.data))
      .catch(() => toast.error("Failed to load documents"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDocs(); }, []);

  const deleteDoc = async (doc) => {
    setDeleting(doc.id);
    try {
      await api.delete(`/documents/${doc.id}`);
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success(`${doc.filename} removed`);
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const filtered = docs.filter((d) =>
    d.filename.toLowerCase().includes(search.toLowerCase()) ||
    d.file_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div data-testid="documents-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
            DOCUMENT INDEX
          </h1>
          <p className="text-xs text-gray-600 font-mono mt-1">
            {docs.length} FILES INDEXED
          </p>
        </div>
        <Button
          data-testid="refresh-docs-btn"
          variant="ghost"
          onClick={fetchDocs}
          className="text-gray-500 hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
        <Input
          data-testid="doc-search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="pl-10 bg-[#0A0A0A] border-white/10 focus:border-blue-500/50 rounded-sm h-10 text-sm"
        />
      </div>

      {/* Table */}
      <Card className="bg-[#111] border-white/[0.06] rounded-md">
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">FILE</TableHead>
                <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">TYPE</TableHead>
                <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">SIZE</TableHead>
                <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">CHUNKS</TableHead>
                <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">STATUS</TableHead>
                <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">UPLOADED</TableHead>
                <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="h-5 w-5 text-gray-600 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-600 text-xs font-mono">
                    {search ? "NO MATCHING DOCUMENTS" : "NO DOCUMENTS INDEXED"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((doc) => {
                  const cfg = typeConfig[doc.file_type] || typeConfig.pdf;
                  const Icon = cfg.icon;
                  return (
                    <TableRow
                      key={doc.id}
                      data-testid={`doc-row-${doc.id}`}
                      className="border-white/[0.04] hover:bg-white/[0.02]"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${cfg.color} shrink-0`} />
                          <span className="text-sm text-gray-300 truncate max-w-[200px]">{doc.filename}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${cfg.badge} text-[10px] font-mono`}>
                          {doc.file_type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 font-mono">{formatSize(doc.file_size)}</TableCell>
                      <TableCell className="text-xs text-gray-400 font-mono">{doc.total_chunks}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            doc.status === "indexed"
                              ? "border-emerald-500/30 text-emerald-400"
                              : "border-gray-500/30 text-gray-500"
                          }`}
                        >
                          {doc.status?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-gray-600 font-mono">
                        {doc.uploaded_at?.slice(0, 16).replace("T", " ")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-600 hover:text-white">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-[#111] border-white/10 text-gray-300 min-w-[120px]"
                          >
                            <DropdownMenuItem
                              data-testid={`delete-doc-${doc.id}`}
                              onClick={() => deleteDoc(doc)}
                              disabled={deleting === doc.id}
                              className="text-red-400 focus:text-red-400 focus:bg-red-500/10 text-xs"
                            >
                              {deleting === doc.id ? (
                                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                              )}
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
}
