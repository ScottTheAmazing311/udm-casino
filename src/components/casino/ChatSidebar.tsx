"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ChevronDown, Send } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { PLAYERS } from "@/lib/constants";
import { HEADSHOTS } from "@/lib/headshots";

interface ChatMessage {
  id: string;
  player_id: number;
  player_name: string;
  message: string;
  chat_context: string;
  created_at: string;
}

interface ChatSidebarProps {
  playerId: number;
  playerName: string;
  chatContext: string;
  anchorLeft?: number;
}

export default function ChatSidebar({ playerId, playerName, chatContext }: ChatSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("udm_chat_messages")
        .select("*")
        .eq("chat_context", chatContext)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data) setMessages(data);
    };
    fetchMessages();

    const channel = supabase
      .channel(`chat-${chatContext}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "udm_chat_messages",
          filter: `chat_context=eq.${chatContext}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => [...prev.slice(-99), newMsg]);
          if (newMsg.player_id !== playerId) {
            setUnread((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatContext, playerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await supabase.from("udm_chat_messages").insert({
      player_id: playerId,
      player_name: playerName,
      message: text,
      chat_context: chatContext,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Toggle button — bottom center */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setUnread(0); }}
          className="fixed bottom-4 left-[75%] -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            background: "rgba(17,17,24,0.9)",
            border: "1px solid #2a2a3a",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          <MessageCircle size={14} className="text-casino-gold" />
          <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Chat</span>
          {unread > 0 && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: "#FF6B6B" }}
            >
              {unread > 9 ? "9+" : unread}
            </div>
          )}
        </button>
      )}

      {/* Chat panel — bottom center */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-4 left-[75%] -translate-x-1/2 z-50 flex flex-col"
            style={{
              width: "min(360px, calc(100vw - 32px))",
              maxHeight: "50vh",
              background: "linear-gradient(135deg, rgba(17,17,24,0.97), rgba(13,13,21,0.97))",
              border: "1px solid #2a2a3a",
              borderRadius: 16,
              backdropFilter: "blur(12px)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
              <MessageCircle size={14} className="text-casino-gold" />
              <span className="text-[10px] text-white/40 uppercase tracking-[2px] font-bold flex-1">
                {chatContext === "lobby" ? "Lobby Chat" : "Table Chat"}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/5"
              >
                <ChevronDown size={14} className="text-white/30" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
              {messages.length === 0 && (
                <div className="text-xs text-white/20 text-center py-6">
                  No messages yet. Say hi!
                </div>
              )}
              {messages.map((msg) => {
                const isMe = msg.player_id === playerId;
                const player = PLAYERS.find((p) => p.id === msg.player_id);
                const color = player?.color || "#666";

                return (
                  <div key={msg.id} className="flex items-start gap-2">
                    <div
                      className="w-6 h-6 rounded-full overflow-hidden border flex-shrink-0 mt-0.5"
                      style={{ borderColor: color }}
                    >
                      <Image
                        src={HEADSHOTS[msg.player_id] || ""}
                        alt={msg.player_name}
                        width={24}
                        height={24}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: isMe ? "#FFD700" : color }}
                      >
                        {isMe ? "You" : msg.player_name}
                      </span>
                      <div
                        className="text-xs leading-snug break-words"
                        style={{ color: "#ccc" }}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-white/5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 200))}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  autoFocus
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-casino-gold/40"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); sendMessage(); }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: input.trim() ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.03)" }}
                >
                  <Send size={13} className={input.trim() ? "text-casino-gold" : "text-white/20"} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
