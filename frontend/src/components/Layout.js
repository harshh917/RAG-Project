import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#050505]" data-testid="app-layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ marginLeft: collapsed ? 64 : 240, transition: "margin-left 0.2s ease" }}
      >
        <div className="p-6 max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  );
}
