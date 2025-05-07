'use client';

import { useMessages } from '@/context/MessageContext';
import { useListings } from '@/context/ListingContext';
import { useRequests } from '@/context/RequestContext';
import { useWallet } from '@/context/WalletContext';
import RequireAuth from '@/components/RequireAuth';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { SearchIcon, DollarSign, Paperclip, Send, Mic, Smile } from 'lucide-react';

const ADMIN_ACCOUNTS = ['oakley', 'gerome'];

export default function BuyerMessagesPage() {
  const { user } = useListings();
  const {
    messages,
    sendMessage,
    markMessagesAsRead,
    blockUser,
    unblockUser,
    reportUser,
    isBlocked,
    hasReported,
  } = useMessages();
  const { addRequest, getRequestsForUser, respondToRequest, requests, setRequests } = useRequests();
  const { wallet, updateWallet } = useWallet();

  const searchParams = useSearchParams();
  const threadParam = searchParams?.get('thread');

  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendAsRequest, setSendAsRequest] = useState(false);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestPrice, setRequestPrice] = useState<number | ''>('');
  const [requestTags, setRequestTags] = useState('');
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState<number | ''>('');
  const [editTags, setEditTags] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingRequest, setPayingRequest] = useState<any>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [_, forceRerender] = useState(0);
  const markedThreadsRef = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    forceRerender((v) => v + 1);
  }, [requests, wallet]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread, messages]);

  // Prepare threads and messages
  const threads: { [seller: string]: any[] } = {};
  const unreadCounts: { [seller: string]: number } = {};
  let activeMessages: any[] = [];

  const buyerRequests = user ? getRequestsForUser(user.username, 'buyer') : [];

  if (user) {
    Object.values(messages).forEach((msgs) => {
      msgs.forEach((msg) => {
        if (msg.sender === user.username || msg.receiver === user.username) {
          const otherParty = msg.sender === user.username ? msg.receiver : msg.sender;
          if (!threads[otherParty]) threads[otherParty] = [];
          threads[otherParty].push(msg);
        }
      });
    });

    Object.values(threads).forEach((thread) =>
      thread.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    );

    Object.entries(threads).forEach(([seller, msgs]) => {
      unreadCounts[seller] = msgs.filter(
        (msg) => !msg.read && msg.receiver === user.username
      ).length;
    });

    if (activeThread) {
      activeMessages = threads[activeThread] || [];
    }
  }

  // Filter threads by search query if present
  const filteredThreads = Object.keys(threads).filter(seller => 
    searchQuery ? seller.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  useEffect(() => {
    if (threadParam && user) {
      if (!threads[threadParam]) {
        threads[threadParam] = [];
      }
      setActiveThread(threadParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadParam, user?.username]);

  useEffect(() => {
    if (user && activeThread && !markedThreadsRef.current.has(activeThread)) {
      markMessagesAsRead(user.username, activeThread);
      markMessagesAsRead(activeThread, user.username);
      markedThreadsRef.current.add(activeThread);
      setTimeout(() => forceRerender((v) => v + 1), 0);
    }
  }, [activeThread, user?.username, markMessagesAsRead]);

  // Image handling functions
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Message sending function
  const handleReply = () => {
    if (!activeThread || !user) return;

    const textContent = replyMessage.trim();

    if (!textContent && !selectedImage) {
      // Don't send empty messages
      return;
    }

    if (sendAsRequest) {
      if (!requestTitle.trim() || !requestPrice || isNaN(Number(requestPrice))) {
        alert('Please enter a valid title and price for your custom request.');
        return;
      }
      const tagsArray = requestTags.split(',').map(tag => tag.trim()).filter(Boolean);
      const requestId = uuidv4();

      addRequest({
        id: requestId,
        buyer: user.username,
        seller: activeThread,
        title: requestTitle.trim(),
        description: textContent,
        price: Number(requestPrice),
        tags: tagsArray,
        status: 'pending',
        date: new Date().toISOString(),
      });

      sendMessage(
        user.username,
        activeThread,
        `[PantyPost Custom Request] ${requestTitle.trim()}`,
        {
          type: 'customRequest',
          meta: {
            id: requestId,
            title: requestTitle.trim(),
            price: Number(requestPrice),
            tags: tagsArray,
            message: textContent,
            imageUrl: selectedImage || undefined,
          }
        }
      );
      setRequestTitle('');
      setRequestPrice('');
      setRequestTags('');
      setSendAsRequest(false);
    } else {
      // Send normal message or image message
      sendMessage(user.username, activeThread, textContent, {
        type: selectedImage ? 'image' : 'normal',
        meta: selectedImage ? { imageUrl: selectedImage } : undefined,
      });
    }

    setReplyMessage('');
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBlockToggle = () => {
    if (!user || !activeThread) return;
    if (isBlocked(user.username, activeThread)) {
      unblockUser(user.username, activeThread);
    } else {
      blockUser(user.username, activeThread);
    }
  };

  const handleReport = () => {
    if (user && activeThread && !hasReported(user.username, activeThread)) {
      reportUser(user.username, activeThread);
    }
  };

  const isUserBlocked = !!(user && activeThread && isBlocked(user.username, activeThread));
  const isUserReported = !!(user && activeThread && hasReported(user.username, activeThread));

  const handleEditRequest = (req: any) => {
    setEditRequestId(req.id);
    setEditPrice(req.price);
    setEditTitle(req.title);
    setEditTags(req.tags.join(', '));
    setEditMessage(req.description || '');
  };

  const handleEditSubmit = (req: any) => {
    if (!user || !activeThread || !editRequestId) return;
    respondToRequest(
      editRequestId,
      'pending',
      editMessage,
      {
        title: editTitle,
        price: Number(editPrice),
        tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
        description: editMessage,
      }
    );

    setEditRequestId(null);
    setEditPrice('');
    setEditTitle('');
    setEditTags('');
    setEditMessage('');
    setTimeout(() => forceRerender((v) => v + 1), 0);
  };

  const handleAccept = (req: any) => {
    if (req && req.status === 'pending') {
      respondToRequest(req.id, 'accepted');
      setTimeout(() => forceRerender((v) => v + 1), 0);
    }
  };
  
  const handleDecline = (req: any) => {
    if (req && req.status === 'pending') {
      respondToRequest(req.id, 'rejected');
      setTimeout(() => forceRerender((v) => v + 1), 0);
    }
  };

  // Payment handling
  const handlePayNow = (req: any) => {
    setPayingRequest(req);
    setShowPayModal(true);
  };

  const handleConfirmPay = () => {
    if (!user || !payingRequest) return;
    const basePrice = payingRequest.price;
    const markupPrice = Math.round(basePrice * 1.1 * 100) / 100;
    const seller = payingRequest.seller;
    const buyer = payingRequest.buyer;

    const sellerShare = Math.round(basePrice * 0.9 * 100) / 100;
    const adminCut = Math.round((markupPrice - sellerShare) * 100) / 100;

    if (wallet[buyer] === undefined || wallet[buyer] < markupPrice) {
      setShowPayModal(false);
      setPayingRequest(null);
      alert("Insufficient balance to complete this transaction.");
      return;
    }

    updateWallet(buyer, -markupPrice);
    updateWallet('oakley', adminCut);

    updateWallet(
      seller,
      sellerShare,
      {
        id: payingRequest.id,
        title: payingRequest.title,
        description: payingRequest.description,
        price: payingRequest.price,
        markedUpPrice: markupPrice,
        date: new Date().toISOString(),
        seller: payingRequest.seller,
        buyer: payingRequest.buyer,
        tags: payingRequest.tags,
      }
    );

    setRequests((prev: any) =>
      prev.map((r: any) =>
        r.id === payingRequest.id ? { ...r, paid: true, status: 'paid' } : r
      )
    );

    setShowPayModal(false);
    setPayingRequest(null);
    setTimeout(() => forceRerender((v) => v + 1), 0);
  };

  const handleCancelPay = () => {
    setShowPayModal(false);
    setPayingRequest(null);
  };

  function getLatestCustomRequestMessages(messages: any[], requests: any[]) {
    const seen = new Set();
    const result: any[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.type === 'customRequest' && msg.meta && msg.meta.id) {
        if (!seen.has(msg.meta.id)) {
          seen.add(msg.meta.id);
          result.unshift(msg);
        }
      } else {
        result.unshift(msg);
      }
    }
    return result;
  }

  const threadMessages =
    activeThread
      ? getLatestCustomRequestMessages(threads[activeThread] || [], buyerRequests)
      : [];

  function isLastEditor(customReq: any) {
    if (!customReq) return false;
    const lastMsg = threadMessages
      .filter(
        (msg) =>
          msg.type === 'customRequest' &&
          msg.meta &&
          msg.meta.id === customReq.id
      )
      .slice(-1)[0];
    return lastMsg && lastMsg.sender === user?.username;
  }

  // Helper function to format date
  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return diffDays === 1 ? '1d ago' : `${diffDays}d ago`;
    }
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours > 0) {
      return diffHours === 1 ? '1h ago' : `${diffHours}h ago`;
    }
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes > 0) {
      return diffMinutes === 1 ? '1m ago' : `${diffMinutes}m ago`;
    }
    
    return 'Just now';
  };

  // Status badge component
  function StatusBadge({ status }: { status: string }) {
    let color = 'bg-yellow-500 text-white';
    let label = status.toUpperCase();
    
    if (status === 'accepted') color = 'bg-green-600 text-white';
    else if (status === 'rejected') color = 'bg-red-600 text-white';
    else if (status === 'edited') color = 'bg-blue-600 text-white';
    else if (status === 'paid') color = 'bg-green-800 text-white';
    else if (status === 'pending') color = 'bg-yellow-500 text-white';
    
    return (
      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
        {label}
      </span>
    );
  }

  // Get the initial for avatar placeholder
  const getInitial = (username: string) => {
    return username.charAt(0).toUpperCase();
  };

  // Main UI rendering
  return (
    <RequireAuth role="buyer">
      <div className="flex h-screen bg-black">
        <div className="flex-1 flex flex-col max-w-6xl mx-auto bg-[#121212] rounded-lg overflow-hidden">
          <main className="flex flex-1 overflow-hidden">
            {/* Left column - Message threads */}
            <div className="w-1/3 border-r border-gray-800 flex flex-col">
              {/* Messages title */}
              <div className="p-4 border-b border-gray-800">
                <h1 className="text-xl font-bold text-white">📨 Messages</h1>
              </div>
              
              {/* Search Bar */}
              <div className="p-3 border-b border-gray-800">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full py-2 px-4 pr-10 rounded-full bg-[#222] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-[#ff950e] focus:border-transparent"
                  />
                  <div className="absolute right-3 top-2.5 text-gray-400">
                    <SearchIcon size={20} />
                  </div>
                </div>
              </div>
              
              {/* Thread list */}
              <div className="flex-1 overflow-y-auto">
                {filteredThreads.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    No conversations found
                  </div>
                ) : (
                  filteredThreads.map((seller) => {
                    const thread = threads[seller];
                    const lastMessage = thread[thread.length - 1];
                    const unreadCount = unreadCounts[seller] || 0;
                    const isActive = activeThread === seller;
                    
                    return (
                      <div 
                        key={seller}
                        onClick={() => setActiveThread(seller)}
                        className={`flex items-center p-3 cursor-pointer relative ${
                          isActive ? 'bg-[#2a2a2a]' : 'hover:bg-[#1a1a1a]'
                        }`}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff950e]"></div>
                        )}
                        
                        {/* Avatar */}
                        <div className="relative mr-3">
                          <div className="w-12 h-12 rounded-full bg-[#333] flex items-center justify-center text-white font-bold overflow-hidden">
                            {getInitial(seller)}
                          </div>
                          {unreadCount > 0 && (
                            <div className="absolute top-0 right-0 w-3 h-3 bg-[#ff950e] rounded-full border-2 border-[#121212]"></div>
                          )}
                        </div>
                        
                        {/* Message preview */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <h3 className="font-bold text-white truncate">{seller}</h3>
                            <span className="text-xs text-gray-400">
                              {lastMessage ? formatTimeAgo(lastMessage.date) : ''}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 truncate">
                            {lastMessage ? lastMessage.content.slice(0, 40) : ''}
                            {lastMessage && lastMessage.content.length > 40 ? '...' : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            {/* Right column - Active conversation */}
            <div className="w-2/3 flex flex-col">
              {activeThread ? (
                <>
                  {/* Conversation header */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800 bg-[#1a1a1a]">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-[#333] flex items-center justify-center text-white font-bold mr-3">
                        {getInitial(activeThread)}
                      </div>
                      <h2 className="font-bold text-lg text-white">{activeThread}</h2>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={handleBlockToggle}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                          isUserBlocked 
                            ? 'bg-green-600 text-white' 
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {isUserBlocked ? 'Unblock' : 'Block'}
                      </button>
                      <button
                        onClick={handleReport}
                        disabled={isUserReported}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                          isUserReported 
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                            : 'bg-[#ff950e] text-white'
                        }`}
                      >
                        {isUserReported ? 'Reported' : 'Report'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 bg-[#121212]">
                    <div className="max-w-3xl mx-auto space-y-4">
                      {threadMessages.map((msg, index) => {
                        const isFromMe = msg.sender === user?.username;
                        const time = new Date(msg.date).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        
                        // Get custom request info if available
                        let customReq: any = undefined;
                        if (
                          msg.type === 'customRequest' &&
                          msg.meta &&
                          typeof msg.meta.id === 'string'
                        ) {
                          customReq = buyerRequests.find((r) => r.id === msg.meta?.id);
                        }
                        
                        const isLatestCustom =
                          !!customReq &&
                          (customReq.status === 'pending' || customReq.status === 'edited' || customReq.status === 'accepted') &&
                          index === (threadMessages.length - 1) &&
                          msg.type === 'customRequest';
                        
                        const showPayNow =
                          !!customReq &&
                          customReq.status === 'accepted' &&
                          index === (threadMessages.length - 1) &&
                          msg.type === 'customRequest';
                        
                        const markupPrice = customReq ? Math.round(customReq.price * 1.1 * 100) / 100 : 0;
                        const buyerBalance = user ? wallet[user.username] ?? 0 : 0;
                        const canPay = customReq && buyerBalance >= markupPrice;
                        const isPaid = customReq && customReq.paid;
                        
                        const showActionButtons =
                          !!customReq &&
                          isLatestCustom &&
                          customReq.status === 'pending' &&
                          !isLastEditor(customReq);
                        
                        return (
                          <div key={index} className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`rounded-lg p-3 max-w-[75%] ${
                              isFromMe 
                                ? 'bg-[#ff950e] text-white' 
                                : 'bg-[#333] text-white'
                            }`}
                            >
                              {/* Message header */}
                              <div className="flex items-center text-xs mb-1">
                                <span className={isFromMe ? 'text-white opacity-75' : 'text-gray-300'}>
                                  {isFromMe ? 'You' : msg.sender} • {time}
                                </span>
                                {isFromMe && (
                                  <span className="ml-2 text-[10px]">
                                    {msg.read ? (
                                      <span className="text-white opacity-75">Read</span>
                                    ) : (
                                      <span className="text-white opacity-50">Sent</span>
                                    )}
                                  </span>
                                )}
                              </div>
                              
                              {/* Image message */}
                              {msg.type === 'image' && msg.meta?.imageUrl && (
                                <div className="mt-1 mb-2">
                                  <img 
                                    src={msg.meta.imageUrl} 
                                    alt="Shared image" 
                                    className="max-w-full rounded"
                                  />
                                </div>
                              )}
                              
                              {/* Text content */}
                              {(msg.type !== 'image' || msg.content) && (
                                <p className="text-white">
                                  {msg.content}
                                </p>
                              )}
                              
                              {/* Custom request */}
                              {msg.type === 'customRequest' && msg.meta && (
                                <div className={`mt-2 text-sm ${isFromMe ? 'text-white' : 'text-[#ff950e]'}`}>
                                  <p><strong>⚙️ Custom Request</strong></p>
                                  <p>📌 Title: {customReq ? customReq.title : msg.meta.title}</p>
                                  <p>💰 Price: {customReq ? `$${customReq.price.toFixed(2)}` : `$${msg.meta.price.toFixed(2)}`}</p>
                                  <p>🏷️ Tags: {customReq ? customReq.tags.join(', ') : msg.meta.tags?.join(', ')}</p>
                                  {(customReq ? customReq.description : msg.meta.message) && (
                                    <p>📝 {customReq ? customReq.description : msg.meta.message}</p>
                                  )}
                                  {customReq && (
                                    <div className="mt-1">
                                      <span className={isFromMe ? 'text-white opacity-75' : 'text-gray-300'}>Status:</span>
                                      <StatusBadge status={customReq.status} />
                                    </div>
                                  )}
                                  
                                  {/* Action buttons for custom requests */}
                                  {showActionButtons && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                      <button
                                        onClick={() => customReq && handleAccept(customReq)}
                                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => customReq && handleDecline(customReq)}
                                        className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                                      >
                                        Decline
                                      </button>
                                      <button
                                        onClick={() => customReq && handleEditRequest(customReq)}
                                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  )}
                                  
                                  {/* Pay now button */}
                                  {showPayNow && (
                                    <div className="flex flex-col gap-2 pt-2">
                                      {isPaid ? (
                                        <span className="text-green-400 font-bold">Paid ✅</span>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => customReq && canPay && handlePayNow(customReq)}
                                            className={`bg-black text-white px-3 py-1 rounded text-xs hover:bg-[#ff950e] ${
                                              !canPay ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                            disabled={!canPay}
                                          >
                                            Pay {customReq ? `$${markupPrice.toFixed(2)}` : ''} Now
                                          </button>
                                          {!canPay && (
                                            <span className="text-xs text-red-400">
                                              Insufficient balance to pay ${markupPrice.toFixed(2)}
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Edit form */}
                                  {editRequestId === customReq?.id && customReq && (
                                    <div className="mt-2 space-y-2">
                                      <input
                                        type="text"
                                        placeholder="Title"
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        className="w-full p-2 border rounded bg-[#222] border-gray-700 text-white"
                                      />
                                      <input
                                        type="number"
                                        placeholder="Price (USD)"
                                        value={editPrice}
                                        onChange={e => setEditPrice(Number(e.target.value))}
                                        className="w-full p-2 border rounded bg-[#222] border-gray-700 text-white"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Tags (comma-separated)"
                                        value={editTags}
                                        onChange={e => setEditTags(e.target.value)}
                                        className="w-full p-2 border rounded bg-[#222] border-gray-700 text-white"
                                      />
                                      <textarea
                                        placeholder="Message"
                                        value={editMessage}
                                        onChange={e => setEditMessage(e.target.value)}
                                        className="w-full p-2 border rounded bg-[#222] border-gray-700 text-white"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => customReq && handleEditSubmit(customReq)}
                                          className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                                        >
                                          Submit Edit
                                        </button>
                                        <button
                                          onClick={() => setEditRequestId(null)}
                                          className="bg-gray-700 text-white px-3 py-1 rounded text-xs hover:bg-gray-600"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Auto-scroll anchor */}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                  
                  {/* Message input */}
                  {!isUserBlocked && (
                    <div className="px-4 py-3 border-t border-gray-800 bg-[#1a1a1a]">
                      {/* Selected image preview */}
                      {selectedImage && (
                        <div className="mb-2">
                          <div className="relative inline-block">
                            <img src={selectedImage} alt="Preview" className="max-h-20 rounded" />
                            <button
                              onClick={() => {
                                setSelectedImage(null);
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = '';
                                }
                              }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 text-xs"
                              style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Custom request toggle */}
                      <div className="flex items-center mb-3">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="sendAsRequest"
                            checked={sendAsRequest}
                            onChange={() => setSendAsRequest(!sendAsRequest)}
                            disabled={!!selectedImage}
                            className="h-4 w-4 text-[#ff950e] bg-[#222] border-gray-700 rounded focus:ring-[#ff950e]"
                          />
                          <label htmlFor="sendAsRequest" className={`ml-2 text-sm font-medium ${selectedImage ? 'text-gray-500' : 'text-gray-300'}`}>
                            Send as custom request
                          </label>
                        </div>
                        
                        {/* Hidden file input */}
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          style={{ display: 'none' }}
                          onChange={handleImageSelect}
                        />
                      </div>
                      
                      {/* Custom request form */}
                      {sendAsRequest && (
                        <div className="space-y-2 mb-3">
                          <input
                            type="text"
                            placeholder="Title"
                            value={requestTitle}
                            onChange={(e) => setRequestTitle(e.target.value)}
                            className="w-full p-2 border rounded bg-[#222] border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-[#ff950e]"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Price (USD)"
                              value={requestPrice}
                              onChange={(e) => setRequestPrice(Number(e.target.value))}
                              className="flex-1 p-2 border rounded bg-[#222] border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-[#ff950e]"
                            />
                            <input
                              type="text"
                              placeholder="Tags (comma-separated)"
                              value={requestTags}
                              onChange={(e) => setRequestTags(e.target.value)}
                              className="flex-1 p-2 border rounded bg-[#222] border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-[#ff950e]"
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="flex flex-col gap-2">
                        {/* Message input */}
                        <div className="relative">
                          <textarea
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder={selectedImage ? "Add a caption..." : "Type a message"}
                            className="w-full p-3 pr-10 rounded-lg bg-[#222] border border-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-[#ff950e] min-h-[60px] max-h-28 resize-none"
                            rows={2}
                          />
                          <div className="absolute bottom-2 right-2">
                            <span className="text-xs text-gray-400">{replyMessage.length}/250</span>
                          </div>
                        </div>
                        
                        {/* Input actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#333]">
                              <DollarSign size={18} className="text-gray-400" />
                            </button>
                            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#333]">
                              <Smile size={18} className="text-gray-400" />
                            </button>
                            <button
                              onClick={triggerFileInput}
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#333]"
                              disabled={sendAsRequest}
                            >
                              <Paperclip size={18} className={sendAsRequest ? 'text-gray-600' : 'text-gray-400'} />
                            </button>
                            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#333]">
                              <Mic size={18} className="text-gray-400" />
                            </button>
                          </div>
                          
                          <button
                            onClick={handleReply}
                            disabled={!replyMessage.trim() && !selectedImage}
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              (!replyMessage.trim() && !selectedImage)
                                ? 'bg-[#ff950e] opacity-50 cursor-not-allowed'
                                : 'bg-[#ff950e] hover:bg-[#ff8500]'
                            }`}
                          >
                            <Send size={18} className="text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {isUserBlocked && (
                    <div className="p-4 border-t border-gray-800 text-center text-sm text-red-400 bg-[#1a1a1a]">
                      You have blocked this seller
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <div className="text-center p-4">
                    <p className="text-xl mb-2">Select a conversation to view messages</p>
                    <p className="text-sm">Your messages will appear here</p>
                  </div>
                </div>
              )}
            </div>
          </main>
          
          {/* Payment confirmation modal */}
          {showPayModal && payingRequest && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
              <div className="bg-[#222] rounded-lg p-6 max-w-sm w-full shadow-lg border border-gray-700">
                <h3 className="text-lg font-bold mb-4 text-white">Confirm Payment</h3>
                <p className="text-gray-300">
                  Are you sure you want to pay{' '}
                  <span className="font-bold text-[#ff950e]">
                    ${payingRequest ? (Math.round(payingRequest.price * 1.1 * 100) / 100).toFixed(2) : ''}
                  </span>
                  ?
                </p>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={handleCancelPay}
                    className="px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPay}
                    className="px-4 py-2 rounded bg-[#ff950e] text-white hover:bg-[#ff8500]"
                  >
                    Confirm & Pay
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}