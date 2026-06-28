import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send } from 'lucide-react';

interface MatchChatProps {
  matchId: string;
  user: User;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

export default function MatchChat({ matchId, user }: MatchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const qMessages = query(
      collection(db, `matches/${matchId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubMessages = onSnapshot(qMessages, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    });

    return () => unsubMessages();
  }, [matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, `matches/${matchId}/messages`), {
        matchId,
        senderId: user.id,
        senderName: user.name,
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `matches/${matchId}/messages`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen md:h-full md:min-h-[400px] border border-border-theme rounded-none md:rounded-xl overflow-hidden bg-surface">
      <div className="px-3 md:px-4 py-2 md:py-3 bg-white border-b border-border-theme flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-text-main tracking-tight">Messages</h4>
          <p className="text-[10px] font-bold text-text-sub uppercase tracking-wider mt-0.5">Direct Communication</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <p className="text-[10px] font-bold text-text-sub uppercase tracking-widest">No messages yet</p>
            <p className="text-xs text-text-sub mt-1">Start the conversation below.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === user.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-bold text-text-sub uppercase tracking-wider">{msg.senderName}</span>
                </div>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-surface border border-border-theme text-text-main rounded-tl-sm'}`}>
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-2 md:p-3 bg-surface border-t border-border-theme flex gap-2 w-full">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Message..."
          className="flex-1 bg-white border border-border-theme rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors min-w-0"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="p-2 md:p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 min-w-[44px] min-h-[44px] md:min-h-auto flex items-center justify-center"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
