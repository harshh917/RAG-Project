import React, { useState, useRef, useEffect } from "react";
import { useApi } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Send, FileText, Image, Music, ChevronDown, ChevronUp, Loader2, Sparkles, BookOpen
} from "lucide-react";

const typeIcons = {
  pdf: FileText,
  docx: FileText,
  image: Image,
  audio: Music,
};

function CitationCard({ citation }) {
  const [open, setOpen] = useState(false);
  const Icon = typeIcons[citation.file_type] || FileText;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          data-testid={`citation-${citation.index}`}
          className="w-full flex items-center gap-2 px-3 py-2 bg-[#0A0A0A] border border-white/[0.06] rounded-sm hover:border-white/10 transition-all duration-150 text-left"
        >
          <div className="p-1.5 bg-blue-500/10 rounded-sm">
            <Icon className="h-3 w-3 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-300 truncate block">[{citation.index}] {citation.filename}</span>
            <span className="text-[10px] text-gray-600 font-mono">
              {citation.page_number ? `Page ${citation.page_number}` : ""}
              {citation.timestamp ? ` ${citation.timestamp}` : ""}
              {citation.score ? ` // Score: ${citation.score}` : ""}
            </span>
          </div>
          {open ? <ChevronUp className="h-3 w-3 text-gray-500" /> : <ChevronDown className="h-3 w-3 text-gray-500" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 px-3 py-2 bg-[#080808] border border-white/[0.04] rounded-sm">
          <p className="text-xs text-gray-400 leading-relaxed font-mono">{citation.text_preview}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div className={`max-w-[80%] ${isUser ? "ml-12" : "mr-12"}`}>
        <div
          className={`px-4 py-3 rounded-md text-sm leading-relaxed ${
            isUser
              ? "bg-blue-600/20 border border-blue-500/20 text-gray-200"
              : "bg-[#111] border border-white/[0.06] text-gray-300"
          }`}
        >
          {!isUser && (
            <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/[0.04]">
              <Sparkles className="h-3 w-3 text-blue-400" />
              <span className="text-[10px] text-blue-400 font-mono tracking-wider">OBSIDIAN AI</span>
            </div>
          )}
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Citations */}
        {message.citations?.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-1.5 px-1 mb-1">
              <BookOpen className="h-3 w-3 text-gray-500" />
              <span className="text-[10px] text-gray-500 font-mono tracking-wider">REFERENCES</span>
            </div>
            {message.citations.map((c) => (
              <CitationCard key={c.index} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function QueryPage() {
  const api = useApi();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendQuery = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const query = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const res = await api.post("/query", { query, top_k: 5 });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.answer,
          citations: res.data.citations,
        },
      ]);
    } catch (err) {
      toast.error("Query failed");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "System error: Unable to process query. Please try again." },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div data-testid="query-page" className="flex gap-4 h-[calc(100vh-48px)]">
      {/* Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wider">
              QUERY SYSTEM
            </h1>
            <p className="text-xs text-gray-600 font-mono mt-1">ASK QUESTIONS ABOUT YOUR DOCUMENTS</p>
          </div>
          {messages.length > 0 && (
            <Button
              data-testid="clear-chat-btn"
              variant="ghost"
              onClick={() => setMessages([])}
              className="text-gray-500 hover:text-white text-xs font-mono"
            >
              CLEAR
            </Button>
          )}
        </div>

        {/* Messages */}
        <Card className="flex-1 bg-[#0A0A0A] border-white/[0.06] rounded-md flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-md mb-4">
                  <Sparkles className="h-8 w-8 text-blue-500/50" />
                </div>
                <h3 className="text-sm text-gray-400 mb-1 font-['Barlow_Condensed'] tracking-wider">
                  INTELLIGENCE QUERY ENGINE
                </h3>
                <p className="text-xs text-gray-600 max-w-xs font-mono">
                  Ask questions about your uploaded documents. Responses include numbered citations.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md">
                  {[
                    "Summarize the key findings",
                    "What are the main topics covered?",
                    "List all mentioned entities",
                    "Compare document contents",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="px-3 py-2 text-[11px] text-gray-500 border border-white/[0.06] rounded-sm hover:border-blue-500/30 hover:text-gray-300 transition-all duration-150 text-left font-mono"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}
                {loading && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="bg-[#111] border border-white/[0.06] rounded-md px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                        <span className="text-xs text-gray-500 font-mono">PROCESSING QUERY...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-white/[0.06] p-3">
            <form onSubmit={sendQuery} className="flex gap-2">
              <Input
                ref={inputRef}
                data-testid="query-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your query..."
                disabled={loading}
                className="flex-1 bg-black/50 border-white/10 focus:border-blue-500/50 rounded-sm h-10 text-sm"
              />
              <Button
                data-testid="query-submit-btn"
                type="submit"
                disabled={!input.trim() || loading}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-sm h-10 px-4 shadow-[0_0_15px_rgba(37,99,235,0.2)]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </div>
  );
}
