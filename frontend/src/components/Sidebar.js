import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import {
  LayoutDashboard,
  Upload,
  MessageSquare,
  FileText,
  Shield,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { path: "/", label: "DASHBOARD", icon: LayoutDashboard },
  { path: "/upload", label: "UPLOAD", icon: Upload },
  { path: "/query", label: "ASK", icon: MessageSquare },
  { path: "/documents", label: "DOCUMENTS", icon: FileText },
  { path: "/admin", label: "ADMIN", icon: Shield },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-testid="sidebar"
        className="fixed left-0 top-0 h-screen bg-black border-r border-white/[0.06] flex flex-col z-50"
        style={{ width: collapsed ? 64 : 240, transition: "width 0.2s ease" }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between h-14 border-b border-white/[0.06]">
          {!collapsed && (
            <span className="font-['Barlow_Condensed'] font-bold text-lg tracking-widest text-blue-500">
              OBSIDIAN
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-gray-500 hover:text-white hover:bg-white/5 h-8 w-8"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const isAdmin = item.path === "/admin";
            if (isAdmin && user?.role !== "admin") return null;

            const btn = (
              <button
                key={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-white/[0.07] text-white border-l-2 border-blue-500 pl-[10px]"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border-l-2 border-transparent pl-[10px]"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="font-['Barlow_Condensed'] font-medium tracking-wider text-xs">
                    {item.label}
                  </span>
                )}
              </button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{btn}</TooltipTrigger>
                  <TooltipContent side="right" className="bg-[#111] border-white/10 text-white text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return btn;
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/[0.06] p-3">
          {!collapsed && (
            <div className="mb-2 px-1">
              <p className="text-xs text-gray-400 truncate">{user?.username}</p>
              <p className="text-[10px] text-gray-600 font-mono uppercase">{user?.role}</p>
            </div>
          )}
          <Separator className="bg-white/[0.06] mb-2" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                onClick={logout}
                data-testid="logout-btn"
                className="w-full text-gray-500 hover:text-red-400 hover:bg-red-500/5 text-xs h-8"
              >
                <LogOut className="h-4 w-4" />
                {!collapsed && <span className="ml-2 font-['Barlow_Condensed'] tracking-wider">LOGOUT</span>}
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="bg-[#111] border-white/10 text-white text-xs">
                LOGOUT
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
