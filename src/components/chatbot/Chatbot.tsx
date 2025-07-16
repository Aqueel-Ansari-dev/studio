
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { askChatbot } from '@/ai/flows/chatbotFlow';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export default function Chatbot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessages([{ sender: 'bot', text: "Hello! I'm the FieldOps Assistant. How can I help you today?" }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await askChatbot({
        userId: user.id,
        organizationId: user.organizationId,
        query: input,
      });
      const botMessage: Message = { sender: 'bot', text: response };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage: Message = { sender: 'bot', text: "Sorry, I encountered an error. Please try again." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-4 z-50"
          >
            <Card className="w-80 h-[500px] flex flex-col shadow-2xl">
              <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Bot className="h-6 w-6 text-primary" />
                  <CardTitle className="text-lg font-headline">FieldOps Assistant</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}><X className="h-4 w-4" /></Button>
              </CardHeader>
              <CardContent className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                  <div key={index} className={cn("flex items-start gap-3", msg.sender === 'user' ? "justify-end" : "justify-start")}>
                    {msg.sender === 'bot' && <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-5 w-5 text-primary" /></div>}
                    <div className={cn("max-w-[75%] rounded-lg p-3 text-sm", msg.sender === 'user' ? "bg-primary text-primary-foreground" : "bg-muted")}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                   <div className="flex items-start gap-3 justify-start">
                       <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><Bot className="h-5 w-5 text-primary" /></div>
                       <div className="bg-muted p-3 rounded-lg"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                   </div>
                )}
                <div ref={messagesEndRef} />
              </CardContent>
              <CardFooter className="p-4 border-t">
                <form onSubmit={handleSubmit} className="flex w-full items-center gap-2">
                  <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question..." disabled={isLoading} />
                  <Button type="submit" size="icon" disabled={isLoading || !input.trim()}><Send className="h-4 w-4" /></Button>
                </form>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      
      {!isOpen && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring' }} className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            size="icon"
            className="rounded-full h-16 w-16 shadow-lg bg-primary hover:bg-primary/90"
          >
            <Bot className="h-8 w-8 text-primary-foreground" />
          </Button>
        </motion.div>
      )}
    </>
  );
}
