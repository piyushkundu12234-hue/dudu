/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Lock, 
  ShieldCheck, 
  Users, 
  Settings, 
  MessageSquare,
  Key,
  Hash,
  ArrowRight
} from 'lucide-react';

// --- Crypto Helpers ---

const ALGO = "AES-GCM";

async function deriveKey(passphrase: string) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  // Use room name as salt or a fixed salt for simplicity in this 2-person demo
  const salt = enc.encode("secure-chat-salt"); 
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGO, length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function encryptMessage(text: string, cryptoKey: CryptoKey) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: ALGO, iv: iv },
    cryptoKey,
    enc.encode(text)
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Return as Base64 string
  return btoa(String.fromCharCode(...combined));
}

async function decryptMessage(encryptedBase64: string, cryptoKey: CryptoKey) {
  try {
    const combined = new Uint8Array(
      atob(encryptedBase64).split("").map((c) => c.charCodeAt(0))
    );
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: ALGO, iv: iv },
      cryptoKey,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return "[Decryption Failed: Key Mismatch]";
  }
}

// --- Components ---

interface Message {
  id: string;
  senderId: string;
  encryptedContent: string;
  decryptedContent?: string;
  timestamp: number;
}

export default function App() {
  const [roomId, setRoomId] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [userId] = useState(() => Math.random().toString(36).substring(7));
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !passphrase) return;

    const key = await deriveKey(passphrase);
    setCryptoKey(key);

    const newSocket = io();
    newSocket.emit('join-room', roomId);
    
    newSocket.on('receive-message', async (msg: Message) => {
      const decrypted = await decryptMessage(msg.encryptedContent, key);
      setMessages(prev => [...prev, { ...msg, decryptedContent: decrypted }]);
    });

    setSocket(newSocket);
    setIsJoined(true);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !cryptoKey || !roomId) return;

    const encrypted = await encryptMessage(inputText, cryptoKey);
    const newMessage: Message = {
      id: Math.random().toString(36).substring(7),
      senderId: userId,
      encryptedContent: encrypted,
      decryptedContent: inputText, // Keep local copy decrypted
      timestamp: Date.now(),
    };

    socket.emit('send-message', { roomId, message: newMessage });
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#141416] border border-[#232326] rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SecureChat</h1>
              <p className="text-sm text-gray-400">End-to-End Encrypted Relay</p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Hash className="w-3 h-3" /> Room ID
              </label>
              <input
                type="text"
                placeholder="e.g. coffee-break-2024"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="w-full bg-[#1c1c1f] border border-[#2d2d31] rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors text-white placeholder-gray-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Key className="w-3 h-3" /> Secret Passphrase
              </label>
              <input
                type="password"
                placeholder="Never shared with server"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full bg-[#1c1c1f] border border-[#2d2d31] rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500/50 transition-colors text-white placeholder-gray-600"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#0a0a0b] font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group"
            >
              Start Secure Session
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <p className="mt-8 text-[10px] text-gray-600 leading-relaxed text-center">
            Messages are encrypted in your browser using AES-GCM. 
            The server only relays encrypted blobs and never sees your messages or keys.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0b] text-white font-sans max-w-4xl mx-auto border-x border-[#1a1a1c]">
      {/* Header */}
      <header className="px-6 py-4 border-bottom border-[#1a1a1c] bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Lock className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-sm tracking-tight capitalize">{roomId}</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-500/80 font-mono">E2E ENCRYPTION ACTIVE</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
             <div className="w-8 h-8 rounded-full border-2 border-[#0a0a0b] bg-gray-800 flex items-center justify-center text-[10px] font-bold">ME</div>
             <div className="w-8 h-8 rounded-full border-2 border-[#0a0a0b] bg-gray-700 flex items-center justify-center">
                <Users className="w-4 h-4 text-gray-400" />
             </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
            <div className="p-4 rounded-full bg-white/5">
              <MessageSquare className="w-12 h-12" />
            </div>
            <p className="text-sm max-w-[200px]">Waiting for others to join and say something...</p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex flex-col ${msg.senderId === userId ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                  msg.senderId === userId
                    ? 'bg-emerald-500 text-[#0a0a0b] rounded-tr-none font-medium'
                    : 'bg-[#1c1c1f] text-gray-200 border border-[#2d2d31] rounded-tl-none font-normal'
                }`}
              >
                {msg.decryptedContent}
              </div>
              <span className="text-[10px] text-gray-600 mt-2 font-mono tabular-nums px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.senderId === userId && " • Sent encrypted"}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <form 
        onSubmit={handleSend}
        className="p-6 bg-[#0a0a0b] border-t border-[#1a1a1c]"
      >
        <div className="relative group">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Secure message..."
            className="w-full bg-[#141416] border border-[#232326] rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:border-emerald-500/50 transition-all text-sm"
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-[#0a0a0b] rounded-xl transition-all disabled:opacity-50"
            disabled={!inputText.trim()}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 justify-center opacity-30">
          <ShieldCheck className="w-3 h-3" />
          <span className="text-[10px] uppercase font-bold tracking-widest leading-none">AES-GCM Buffered Relay</span>
        </div>
      </form>
    </div>
  );
}
