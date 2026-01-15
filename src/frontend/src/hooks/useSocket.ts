import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

interface BidPlacedEvent {
  auctionId: string;
  bidId: string;
  brandName: string;
  amount: number;
  currentPrice: number;
  bidCount: number;
  timestamp: Date;
}

interface AuctionExtendedEvent {
  auctionId: string;
  newEndAt: Date;
  totalExtended: number;
}

interface AuctionStatusEvent {
  auctionId: string;
  status: string;
  winningBid?: any;
}

interface AuctionViewersEvent {
  auctionId: string;
  count: number;
}

interface AuctionUpdatedEvent {
  auctionId: string;
  currentPrice: number;
  bidCount: number;
}

interface UseSocketOptions {
  onBidPlaced?: (data: BidPlacedEvent) => void;
  onAuctionExtended?: (data: AuctionExtendedEvent) => void;
  onAuctionStatus?: (data: AuctionStatusEvent) => void;
  onAuctionViewers?: (data: AuctionViewersEvent) => void;
  onAuctionUpdated?: (data: AuctionUpdatedEvent) => void;
  onAuctionEndingSoon?: (data: { auctionId: string; endAt: Date; secondsRemaining: number }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { accessToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  // Initialize socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: {
        token: accessToken,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    // Event listeners
    socket.on('bid:placed', (data: BidPlacedEvent) => {
      console.log('[Socket] Bid placed:', data);
      options.onBidPlaced?.(data);
    });

    socket.on('auction:extended', (data: AuctionExtendedEvent) => {
      console.log('[Socket] Auction extended:', data);
      options.onAuctionExtended?.(data);
    });

    socket.on('auction:status', (data: AuctionStatusEvent) => {
      console.log('[Socket] Auction status changed:', data);
      options.onAuctionStatus?.(data);
    });

    socket.on('auction:viewers', (data: AuctionViewersEvent) => {
      console.log('[Socket] Viewer count:', data);
      setViewerCount(data.count);
      options.onAuctionViewers?.(data);
    });

    socket.on('auction:updated', (data: AuctionUpdatedEvent) => {
      console.log('[Socket] Auction updated:', data);
      options.onAuctionUpdated?.(data);
    });

    socket.on('auction:ending-soon', (data) => {
      console.log('[Socket] Auction ending soon:', data);
      options.onAuctionEndingSoon?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  // Join auction room
  const joinAuction = useCallback((auctionId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:auction', auctionId);
      console.log('[Socket] Joining auction:', auctionId);
    }
  }, []);

  // Leave auction room
  const leaveAuction = useCallback((auctionId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:auction', auctionId);
      console.log('[Socket] Leaving auction:', auctionId);
    }
  }, []);

  // Join live auctions room
  const joinLiveAuctions = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:live-auctions');
      console.log('[Socket] Joining live-auctions room');
    }
  }, []);

  // Leave live auctions room
  const leaveLiveAuctions = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:live-auctions');
      console.log('[Socket] Leaving live-auctions room');
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    viewerCount,
    joinAuction,
    leaveAuction,
    joinLiveAuctions,
    leaveLiveAuctions,
  };
}

// Simplified hook for auction detail page
export function useAuctionSocket(auctionId: string | undefined, options: UseSocketOptions = {}) {
  const socket = useSocket(options);

  useEffect(() => {
    if (auctionId && socket.isConnected) {
      socket.joinAuction(auctionId);

      return () => {
        socket.leaveAuction(auctionId);
      };
    }
  }, [auctionId, socket.isConnected]);

  return socket;
}

// Simplified hook for auctions list page
export function useLiveAuctionsSocket(options: UseSocketOptions = {}) {
  const socket = useSocket(options);

  useEffect(() => {
    if (socket.isConnected) {
      socket.joinLiveAuctions();

      return () => {
        socket.leaveLiveAuctions();
      };
    }
  }, [socket.isConnected]);

  return socket;
}
