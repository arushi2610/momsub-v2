import React, { useState, useEffect, useRef } from 'react';
import { DisputeMessage, User } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send, User as UserIcon } from 'lucide-react';

interface DisputeChatProps {
  scheduleId: string;
  user: User;
}

export default function DisputeChat({ scheduleId, user }: DisputeChatProps) {
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const qMessages = query(
      collection(db, `schedules/${scheduleId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubMessages = onSnapshot(qMessages, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as DisputeMessage)));
    });

    return () => unsubMessages();
  }, [scheduleId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, `schedules/${scheduleId}/messages`), {
        scheduleId,
        senderId: user.id,
        senderName: user.name,
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `schedules/${scheduleId}/messages`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full md:max-h-[400px] border border-border-theme rounded-xl overflow-hidden bg-surface mt-3 md:mt-6">
      <div className="px-3 md:px-4 py-2 md:py-3 bg-error/10 border-b border-error/20 flex items-center justify-between">
        <div>
          <h4 className="text-[11px] font-bold text-error uppercase tracking-widest">Dispute Thread</h4>
          <p className="text-[9px] text-error/80 uppercase tracking-wider mt-0.5">Real-time communication</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-4 bg-white/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <p className="text-[10px] font-bold text-text-sub uppercase tracking-widest">No messages yet</p>
            <p className="text-xs text-text-sub mt-1">Start the conversation below.</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === user.id;
            const timestamp = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-bold text-text-sub uppercase tracking-wider">{msg.senderName}</span>
                  {timestamp && <span className="text-[9px] text-text-sub">{timestamp}</span>}
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

      <form onSubmit={handleSendMessage} className="p-2 md:p-3 bg-surface border-t border-border-theme flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Message..."
          className="flex-1 bg-white border border-border-theme rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] md:min-h-auto flex items-center justify-center"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
