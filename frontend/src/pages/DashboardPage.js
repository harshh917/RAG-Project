import React, { useEffect, useState } from "react";
import { useApi } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Database, MessageSquare, Users, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#FF3B30", "#8B5CF6"];

function StatCard({ icon: Icon, label, value, color, delay }) {
  return (
    <Card
      data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}
      className={`bg-[#111] border-white/[0.06] rounded-md animate-fade-in stagger-${delay}`}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-2.5 rounded-sm ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold font-['Barlow_Condensed'] tracking-wide text-white">
            {value}
          </p>
          <p className="text-[10px] text-gray-500 font-mono tracking-wider uppercase">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-black border border-white/10 rounded-sm px-3 py-2 text-xs">
        <p className="text-gray-400 font-mono">{label}</p>
        <p className="text-blue-400 font-bold">{payload[0].value} queries</p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const api = useApi();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/stats")
      .then((res) => setStats(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <p className="font-mono text-sm text-gray-600">LOADING TELEMETRY...</p>
      </div>
    );
  }

  const pieData = stats?.file_distribution
    ? Object.entries(stats.file_distribution).map(([name, value]) => ({ name: name.toUpperCase(), value }))
    : [];

  const barData = stats?.query_by_date?.map((d) => ({
    date: d.date.slice(5),
    count: d.count,
  })) || [];

  return (
    <div data-testid="dashboard-page" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
            SYSTEM OVERVIEW
          </h1>
          <p className="text-xs text-gray-600 font-mono mt-1">REAL-TIME INTELLIGENCE METRICS</p>
        </div>
        <Badge variant="outline" className="border-green-500/30 text-green-500 text-[10px] font-mono">
          OPERATIONAL
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Documents" value={stats?.total_documents || 0} color="bg-blue-500/10 text-blue-400" delay={1} />
        <StatCard icon={Database} label="Chunks" value={stats?.total_chunks || 0} color="bg-emerald-500/10 text-emerald-400" delay={2} />
        <StatCard icon={MessageSquare} label="Queries" value={stats?.total_queries || 0} color="bg-amber-500/10 text-amber-400" delay={3} />
        <StatCard icon={Users} label="Users" value={stats?.total_users || 0} color="bg-purple-500/10 text-purple-400" delay={4} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Query Trend */}
        <Card className="bg-[#111] border-white/[0.06] rounded-md">
          <CardHeader className="border-b border-white/[0.06] p-4">
            <CardTitle className="text-xs text-gray-400 font-mono tracking-wider flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              QUERY ACTIVITY
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[240px]">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 10, fill: "#666" }} />
                  <YAxis stroke="#555" tick={{ fontSize: 10, fill: "#666" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 text-xs font-mono">
                NO QUERY DATA YET
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Distribution */}
        <Card className="bg-[#111] border-white/[0.06] rounded-md">
          <CardHeader className="border-b border-white/[0.06] p-4">
            <CardTitle className="text-xs text-gray-400 font-mono tracking-wider flex items-center gap-2">
              <Database className="h-3.5 w-3.5" />
              FILE DISTRIBUTION
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[240px] flex items-center justify-center">
            {pieData.length > 0 ? (
              <div className="flex items-center gap-6 w-full">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, fontSize: 11 }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-400 font-mono">{d.name}</span>
                      <span className="text-white font-bold ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-gray-600 text-xs font-mono">NO FILES INDEXED</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Queries */}
      <Card className="bg-[#111] border-white/[0.06] rounded-md">
        <CardHeader className="border-b border-white/[0.06] p-4">
          <CardTitle className="text-xs text-gray-400 font-mono tracking-wider">RECENT QUERIES</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[200px]">
            {stats?.recent_queries?.length > 0 ? (
              <div className="divide-y divide-white/[0.04]">
                {stats.recent_queries.map((q, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-300 truncate">{q.query}</p>
                      <p className="text-[10px] text-gray-600 font-mono mt-0.5">{q.username}</p>
                    </div>
                    <span className="text-[10px] text-gray-600 font-mono ml-4 shrink-0">
                      {q.created_at?.slice(0, 16).replace("T", " ")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 text-xs font-mono p-8">
                NO QUERIES RECORDED
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
