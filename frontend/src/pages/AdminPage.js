import React, { useEffect, useState } from "react";
import { useAuth, useApi } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Shield, RefreshCw, Users, FileSearch, Loader2, AlertTriangle
} from "lucide-react";

export default function AdminPage() {
  const { user } = useAuth();
  const api = useApi();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [tab, setTab] = useState("logs");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, usersRes] = await Promise.all([
        api.get("/admin/audit-logs"),
        api.get("/admin/users"),
      ]);
      setLogs(logsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error("Admin access required");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const rebuildIndex = async () => {
    setRebuilding(true);
    try {
      const res = await api.post("/admin/rebuild-index");
      toast.success(res.data.message);
    } catch {
      toast.error("Rebuild failed");
    } finally {
      setRebuilding(false);
      fetchData();
    }
  };

  if (user?.role !== "admin") {
    return (
      <div data-testid="admin-denied" className="flex flex-col items-center justify-center h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-red-500/50 mb-4" />
        <h2 className="text-lg font-['Barlow_Condensed'] tracking-wider text-gray-400 mb-1">ACCESS DENIED</h2>
        <p className="text-xs text-gray-600 font-mono">Admin clearance required</p>
      </div>
    );
  }

  const actionColors = {
    user_register: "border-emerald-500/30 text-emerald-400",
    user_login: "border-blue-500/30 text-blue-400",
    document_upload: "border-amber-500/30 text-amber-400",
    document_delete: "border-red-500/30 text-red-400",
    query: "border-purple-500/30 text-purple-400",
    rebuild_index: "border-cyan-500/30 text-cyan-400",
  };

  return (
    <div data-testid="admin-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
            ADMIN CONTROL
          </h1>
          <p className="text-xs text-gray-600 font-mono mt-1">SYSTEM MANAGEMENT & AUDIT</p>
        </div>
        <div className="flex gap-2">
          <Button
            data-testid="rebuild-index-btn"
            onClick={rebuildIndex}
            disabled={rebuilding}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm h-9 text-xs font-['Barlow_Condensed'] tracking-wider shadow-[0_0_15px_rgba(37,99,235,0.2)]"
          >
            {rebuilding ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            REBUILD INDEX
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-[#0A0A0A] border border-white/[0.06] rounded-sm h-9 p-0.5">
          <TabsTrigger
            value="logs"
            data-testid="tab-audit-logs"
            className="rounded-sm text-xs font-mono tracking-wider data-[state=active]:bg-white/[0.07] data-[state=active]:text-white"
          >
            <FileSearch className="h-3.5 w-3.5 mr-1.5" />
            AUDIT LOGS
          </TabsTrigger>
          <TabsTrigger
            value="users"
            data-testid="tab-users"
            className="rounded-sm text-xs font-mono tracking-wider data-[state=active]:bg-white/[0.07] data-[state=active]:text-white"
          >
            <Users className="h-3.5 w-3.5 mr-1.5" />
            USERS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4">
          <Card className="bg-[#111] border-white/[0.06] rounded-md">
            <CardHeader className="border-b border-white/[0.06] p-4 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-gray-400 font-mono tracking-wider">
                SYSTEM AUDIT LOG ({logs.length})
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={fetchData} className="h-7 w-7 text-gray-600 hover:text-white">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <ScrollArea className="max-h-[calc(100vh-340px)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">TIMESTAMP</TableHead>
                    <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">ACTION</TableHead>
                    <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">DETAILS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12">
                        <Loader2 className="h-5 w-5 text-gray-600 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-gray-600 text-xs font-mono">
                        NO AUDIT RECORDS
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id} data-testid={`audit-log-${log.id}`} className="border-white/[0.04] hover:bg-white/[0.02]">
                        <TableCell className="text-[10px] text-gray-500 font-mono whitespace-nowrap">
                          {log.timestamp?.slice(0, 19).replace("T", " ")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono ${actionColors[log.action] || "border-gray-500/30 text-gray-400"}`}
                          >
                            {log.action?.toUpperCase().replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-400 max-w-[400px] truncate">
                          {log.details}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="bg-[#111] border-white/[0.06] rounded-md">
            <ScrollArea className="max-h-[calc(100vh-340px)]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">USERNAME</TableHead>
                    <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">EMAIL</TableHead>
                    <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">ROLE</TableHead>
                    <TableHead className="text-[10px] font-mono text-gray-500 tracking-wider">REGISTERED</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-gray-600 text-xs font-mono">
                        NO USERS
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id} data-testid={`user-row-${u.id}`} className="border-white/[0.04] hover:bg-white/[0.02]">
                        <TableCell className="text-sm text-gray-300">{u.username}</TableCell>
                        <TableCell className="text-xs text-gray-500 font-mono">{u.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono ${
                              u.role === "admin" ? "border-amber-500/30 text-amber-400" : "border-blue-500/30 text-blue-400"
                            }`}
                          >
                            {u.role?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-gray-600 font-mono">
                          {u.created_at?.slice(0, 10)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
