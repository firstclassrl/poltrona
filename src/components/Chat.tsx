import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Avatar } from './ui/Avatar';
import { 
  MessageCircle, 
  Send, 
  Clock, 
  Check, 
  CheckCheck,
  ArrowLeft,
  Megaphone,
  X,
  UserPlus,
  Loader2,
  Search
} from 'lucide-react';
import { formatTime, formatDate } from '../utils/date';
import type { Client } from '../types';
import { apiService } from '../services/api';

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const { 
    chats, 
    activeChat, 
    messages, 
    isLoading, 
    unreadCount,
    setActiveChat, 
    sendMessage,
    sendBroadcast,
    startChatWithClient
  } = useChat();
  
  const [messageInput, setMessageInput] = useState('');
  const [showChatList, setShowChatList] = useState(true);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [isSendingNewMessage, setIsSendingNewMessage] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [newMessageError, setNewMessageError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!showNewMessageModal) return;
    let isMounted = true;

    const loadInitialClients = async () => {
      setIsLoadingClients(true);
      try {
        const results = await apiService.searchClients('');
        if (isMounted) {
          setClientResults(results);
        }
      } catch (error) {
        console.error('Error loading clients:', error);
      } finally {
        if (isMounted) {
          setIsLoadingClients(false);
        }
      }
    };

    loadInitialClients();

    return () => {
      isMounted = false;
    };
  }, [showNewMessageModal]);

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    await sendMessage(messageInput);
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    
    setIsSendingBroadcast(true);
    try {
      await sendBroadcast(broadcastMessage);
      setBroadcastMessage('');
      setShowBroadcastModal(false);
    } catch (error) {
      console.error('Error sending broadcast:', error);
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleBroadcastKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendBroadcast();
    }
  };

  const handleClientSearch = async (value: string) => {
    setClientSearch(value);
    const trimmedValue = value.trim();
    // Evita chiamate continue se l'utente sta digitando i primi caratteri
    if (trimmedValue.length > 0 && trimmedValue.length < 3) {
      return;
    }

    setIsLoadingClients(true);
    try {
      const results = await apiService.searchClients(trimmedValue);
      setClientResults(results);
    } catch (error) {
      console.error('Error searching clients:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const resetNewMessageModal = () => {
    setShowNewMessageModal(false);
    setClientSearch('');
    setSelectedClient(null);
    setNewMessageContent('');
    setNewMessageError(null);
  };

  const handleSendNewMessage = async () => {
    if (!selectedClient || !newMessageContent.trim()) return;

    setIsSendingNewMessage(true);
    setNewMessageError(null);
    try {
      await startChatWithClient(selectedClient.id, newMessageContent);
      resetNewMessageModal();
      setShowChatList(false);
    } catch (error) {
      console.error('Error sending direct message:', error);
      setNewMessageError('Impossibile inviare il messaggio. Riprova più tardi.');
    } finally {
      setIsSendingNewMessage(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return formatTime(date);
    } else {
      return formatDate(date);
    }
  };

  const getMessageStatus = (message: any) => {
    if (message.sender_id === user?.id) {
      return message.read_at ? (
        <CheckCheck className="w-4 h-4 text-blue-500" />
      ) : (
        <Check className="w-4 h-4 text-gray-400" />
      );
    }
    return null;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Devi essere loggato per accedere alla chat</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          {!showChatList && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChatList(true)}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Chat</h1>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} messaggi non letti` : 'Tutti i messaggi letti'}
            </p>
          </div>
        </div>
        
        {/* Azioni disponibili solo a barbiere/admin */}
        {(user?.role === 'barber' || user?.role === 'admin') && (
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowNewMessageModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuovo Messaggio</span>
            </Button>
            <Button
              onClick={() => setShowBroadcastModal(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Megaphone className="w-4 h-4" />
              <span>Broadcast</span>
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat List */}
        {showChatList && (
          <div className="w-80 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Conversazioni</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Caricamento conversazioni...
                </div>
              ) : chats.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {user?.role === 'client' 
                    ? 'Nessuna conversazione ancora. I tuoi barbieri ti contatteranno qui per comunicazioni importanti.'
                    : 'Nessuna conversazione'
                  }
                </div>
              ) : (
                chats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setActiveChat(chat);
                      setShowChatList(false);
                    }}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                      activeChat?.id === chat.id ? 'bg-green-50 border-green-200' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Avatar 
                        name={chat.client_name || 'Cliente'}
                        size="lg"
                        imageUrl={chat.client_photo && !chat.client_photo.includes('/api/placeholder') ? chat.client_photo : undefined}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {chat.client_name}
                          </h3>
                          {chat.unread_count > 0 && (
                            <span className="bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {chat.unread_count}
                            </span>
                          )}
                        </div>
                        
                        {chat.last_message && (
                          <div className="mt-1">
                            <p className="text-sm text-gray-600 truncate">
                              {chat.last_message.sender_type === 'staff' ? 'Tu: ' : ''}
                              {chat.last_message.content}
                            </p>
                            <div className="flex items-center space-x-1 mt-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-400">
                                {formatMessageTime(chat.last_message.created_at)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Chat Window */}
        {activeChat && !showChatList && (
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center space-x-3">
                <Avatar 
                  name={activeChat.client_name || 'Cliente'}
                  size="md"
                  imageUrl={activeChat.client_photo && !activeChat.client_photo.includes('/api/placeholder') ? activeChat.client_photo : undefined}
                />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {activeChat.client_name}
                  </h2>
                  <p className="text-sm text-gray-500">Online</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="text-center text-gray-500">
                  Caricamento messaggi...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500">
                  Nessun messaggio ancora
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${
                      message.sender_id === user.id ? 'flex-row-reverse space-x-reverse' : ''
                    }`}>
                      <Avatar 
                        name={message.sender_name || 'Unknown'}
                        size="sm"
                        imageUrl={message.sender_photo && !message.sender_photo.includes('/api/placeholder') ? message.sender_photo : undefined}
                      />
                      
                      <div className={`px-4 py-2 rounded-lg ${
                        message.sender_id === user.id
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <div className={`flex items-center justify-between mt-1 ${
                          message.sender_id === user.id ? 'text-green-100' : 'text-gray-500'
                        }`}>
                          <span className="text-xs">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {getMessageStatus(message)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Scrivi un messaggio..."
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* No Chat Selected */}
        {!activeChat && !showChatList && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {user?.role === 'client' ? 'Chat con il Barbiere' : 'Seleziona una conversazione'}
              </h3>
              <p className="text-gray-500">
                {user?.role === 'client' 
                  ? 'I tuoi barbieri ti contatteranno qui per comunicazioni importanti e per rispondere alle tue domande.'
                  : 'Scegli una conversazione dalla lista per iniziare a chattare'
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nuovo Messaggio Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Nuovo Messaggio</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetNewMessageModal}
                className="p-1"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleziona cliente
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    value={clientSearch}
                    onChange={(e) => handleClientSearch(e.target.value)}
                    placeholder="Cerca per nome o telefono..."
                    className="pl-9"
                  />
                </div>
                <div className="mt-3 max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {isLoadingClients ? (
                    <div className="flex items-center justify-center py-6 text-gray-500">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Caricamento clienti...
                    </div>
                  ) : clientResults.length === 0 ? (
                    <div className="py-6 text-center text-gray-500">
                      Nessun cliente trovato
                    </div>
                  ) : (
                    clientResults.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => setSelectedClient(client)}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          selectedClient?.id === client.id
                            ? 'bg-green-50 border-l-4 border-green-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">
                          {client.first_name} {client.last_name || ''}
                        </div>
                        <div className="text-sm text-gray-500">
                          {client.phone_e164}
                          {client.email ? ` • ${client.email}` : ''}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedClient && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-100 text-sm text-green-800">
                  Destinatario:{' '}
                  <span className="font-semibold">
                    {selectedClient.first_name} {selectedClient.last_name || ''}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Messaggio
                </label>
                <textarea
                  value={newMessageContent}
                  onChange={(e) => setNewMessageContent(e.target.value)}
                  placeholder={
                    selectedClient
                      ? `Scrivi un messaggio per ${selectedClient.first_name}...`
                      : 'Seleziona prima un cliente'
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  rows={4}
                  disabled={!selectedClient || isSendingNewMessage}
                />
              </div>

              {newMessageError && (
                <p className="text-sm text-red-600">{newMessageError}</p>
              )}

              <div className="flex justify-end space-x-3">
                <Button
                  variant="ghost"
                  onClick={resetNewMessageModal}
                  disabled={isSendingNewMessage}
                >
                  Annulla
                </Button>
                <Button
                  onClick={handleSendNewMessage}
                  disabled={
                    !selectedClient || !newMessageContent.trim() || isSendingNewMessage
                  }
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSendingNewMessage ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Invio...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Send className="w-4 h-4" />
                      <span>Invia</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Megaphone className="w-6 h-6 text-orange-500" />
                <h3 className="text-lg font-semibold text-gray-900">Invia Broadcast</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBroadcastModal(false)}
                className="p-1"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Messaggio per tutti i clienti
              </label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                onKeyPress={handleBroadcastKeyPress}
                placeholder="Scrivi il messaggio da inviare a tutti i clienti..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                rows={4}
                disabled={isSendingBroadcast}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button
                variant="ghost"
                onClick={() => setShowBroadcastModal(false)}
                disabled={isSendingBroadcast}
              >
                Annulla
              </Button>
              <Button
                onClick={handleSendBroadcast}
                disabled={!broadcastMessage.trim() || isSendingBroadcast}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isSendingBroadcast ? 'Invio...' : 'Invia Broadcast'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
