import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/messages/:userId");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(params?.userId || null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get all conversations
  const { data: conversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ['/api/conversations'],
    refetchInterval: 3000, // Polling for real-time updates
  });

  // Get messages for selected conversation
  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['/api/conversations', selectedConversation],
    enabled: !!selectedConversation,
    refetchInterval: 2000, // More frequent polling for active conversation
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { receiverId: string; content: string }) => {
      return await apiRequest("POST", "/api/messages", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      setMessageText("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mark messages as read
  const markAsReadMutation = useMutation({
    mutationFn: async (senderId: string) => {
      return await apiRequest("PATCH", `/api/conversations/${senderId}/read`);
    },
  });

  useEffect(() => {
    if (selectedConversation && messages) {
      // Mark messages as read when viewing conversation
      markAsReadMutation.mutate(selectedConversation);
    }
  }, [selectedConversation, messages]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedConversation) return;

    sendMessageMutation.mutate({
      receiverId: selectedConversation,
      content: messageText.trim(),
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const ConversationList = () => (
    <Card className="h-full">
      <CardHeader>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messages
        </h2>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          {isLoadingConversations ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3 p-3 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {Array.isArray(conversations) && conversations.map((conversation: any) => {
                const partner = conversation.partner;
                const isSelected = selectedConversation === partner.id;
                
                return (
                  <div
                    key={partner.id}
                    className={cn(
                      "flex items-center space-x-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                      isSelected && "bg-blue-50 dark:bg-blue-900/20"
                    )}
                    onClick={() => setSelectedConversation(partner.id)}
                    data-testid={`conversation-${partner.id}`}
                  >
                    <Avatar>
                      <AvatarImage src={partner.profileImageUrl} />
                      <AvatarFallback>
                        {partner.firstName?.[0]}{partner.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {partner.firstName} {partner.lastName}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(conversation.latestMessage.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {conversation.latestMessage.content}
                      </p>
                    </div>
                    {conversation.unreadCount > 0 && (
                      <Badge variant="default" className="ml-2">
                        {conversation.unreadCount}
                      </Badge>
                    )}
                  </div>
                );
              })}
              {(!conversations || !Array.isArray(conversations) || conversations.length === 0) && (
                <div className="p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No conversations yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Start connecting with people to begin messaging!
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const MessageView = () => {
    if (!selectedConversation) {
      return (
        <Card className="h-full flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Select a conversation
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Choose a conversation from the list to start messaging
            </p>
          </div>
        </Card>
      );
    }

    const selectedPartner = Array.isArray(conversations) ? conversations.find((c: any) => c.partner.id === selectedConversation)?.partner : null;

    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-row items-center space-y-0 pb-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="mr-2 md:hidden"
            onClick={() => setSelectedConversation(null)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-10 w-10 mr-3">
            <AvatarImage src={selectedPartner?.profileImageUrl} />
            <AvatarFallback>
              {selectedPartner?.firstName?.[0]}{selectedPartner?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-semibold">
              {selectedPartner?.firstName} {selectedPartner?.lastName}
            </h3>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {isLoadingMessages ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={cn(
                      "flex animate-pulse",
                      i % 2 === 0 ? "justify-start" : "justify-end"
                    )}>
                      <div className={cn(
                        "max-w-xs p-3 rounded-lg space-y-2",
                        i % 2 === 0 ? "bg-gray-200 dark:bg-gray-700" : "bg-blue-200 dark:bg-blue-700"
                      )}>
                        <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {Array.isArray(messages) && messages.map((message: any) => {
                    const isOwn = message.senderId !== selectedConversation;
                    
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex",
                          isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-xs lg:max-w-md px-4 py-2 rounded-lg",
                            isOwn
                              ? "bg-blue-500 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                          )}
                          data-testid={`message-${message.id}`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            isOwn ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
                          )}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
                disabled={sendMessageMutation.isPending}
                data-testid="input-message"
              />
              <Button
                type="submit"
                disabled={!messageText.trim() || sendMessageMutation.isPending}
                data-testid="button-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Messages</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Stay connected with your professional network
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[700px]">
        <div className={cn(
          "md:col-span-1",
          selectedConversation && "hidden md:block"
        )}>
          <ConversationList />
        </div>
        
        <div className={cn(
          "md:col-span-2",
          !selectedConversation && "hidden md:block"
        )}>
          <MessageView />
        </div>
      </div>
    </div>
  );
}