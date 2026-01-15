import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

class SocketService {
  private io: Server | null = null;
  private auctionRooms: Map<string, Set<string>> = new Map();

  initialize(httpServer: HttpServer): Server {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Authentication middleware
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        // Allow anonymous connections for viewing auctions
        return next();
      }

      try {
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        next();
      } catch (err) {
        // Allow connection but mark as unauthenticated
        next();
      }
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`[Socket] Client connected: ${socket.id}, User: ${socket.userId || 'anonymous'}`);

      // Join auction room
      socket.on('join:auction', (auctionId: string) => {
        socket.join(`auction:${auctionId}`);

        if (!this.auctionRooms.has(auctionId)) {
          this.auctionRooms.set(auctionId, new Set());
        }
        this.auctionRooms.get(auctionId)!.add(socket.id);

        console.log(`[Socket] ${socket.id} joined auction:${auctionId}`);

        // Notify room about viewer count
        this.emitViewerCount(auctionId);
      });

      // Leave auction room
      socket.on('leave:auction', (auctionId: string) => {
        socket.leave(`auction:${auctionId}`);

        if (this.auctionRooms.has(auctionId)) {
          this.auctionRooms.get(auctionId)!.delete(socket.id);
        }

        console.log(`[Socket] ${socket.id} left auction:${auctionId}`);
        this.emitViewerCount(auctionId);
      });

      // Join live auctions room (for auction list page)
      socket.on('join:live-auctions', () => {
        socket.join('live-auctions');
        console.log(`[Socket] ${socket.id} joined live-auctions room`);
      });

      socket.on('leave:live-auctions', () => {
        socket.leave('live-auctions');
        console.log(`[Socket] ${socket.id} left live-auctions room`);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${socket.id}`);

        // Remove from all auction rooms
        this.auctionRooms.forEach((sockets, auctionId) => {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            this.emitViewerCount(auctionId);
          }
        });
      });
    });

    console.log('[Socket] Socket.io server initialized');
    return this.io;
  }

  getIO(): Server | null {
    return this.io;
  }

  // Emit bid placed event
  emitBidPlaced(auctionId: string, bidData: {
    bidId: string;
    brandName: string;
    amount: number;
    currentPrice: number;
    bidCount: number;
    timestamp: Date;
  }): void {
    if (!this.io) return;

    this.io.to(`auction:${auctionId}`).emit('bid:placed', {
      auctionId,
      ...bidData,
    });

    // Also emit to live auctions room
    this.io.to('live-auctions').emit('auction:updated', {
      auctionId,
      currentPrice: bidData.currentPrice,
      bidCount: bidData.bidCount,
    });

    console.log(`[Socket] Emitted bid:placed for auction ${auctionId}`);
  }

  // Emit auction time extended (anti-snipe)
  emitTimeExtended(auctionId: string, newEndAt: Date, totalExtended: number): void {
    if (!this.io) return;

    this.io.to(`auction:${auctionId}`).emit('auction:extended', {
      auctionId,
      newEndAt,
      totalExtended,
    });

    console.log(`[Socket] Emitted auction:extended for auction ${auctionId}`);
  }

  // Emit auction status changed
  emitAuctionStatusChanged(auctionId: string, status: string, winningBid?: any): void {
    if (!this.io) return;

    this.io.to(`auction:${auctionId}`).emit('auction:status', {
      auctionId,
      status,
      winningBid,
    });

    this.io.to('live-auctions').emit('auction:status', {
      auctionId,
      status,
    });

    console.log(`[Socket] Emitted auction:status (${status}) for auction ${auctionId}`);
  }

  // Emit auction starting soon
  emitAuctionStartingSoon(auctionId: string, startAt: Date): void {
    if (!this.io) return;

    this.io.to('live-auctions').emit('auction:starting', {
      auctionId,
      startAt,
    });

    console.log(`[Socket] Emitted auction:starting for auction ${auctionId}`);
  }

  // Emit auction ending soon warning
  emitAuctionEndingSoon(auctionId: string, endAt: Date, secondsRemaining: number): void {
    if (!this.io) return;

    this.io.to(`auction:${auctionId}`).emit('auction:ending-soon', {
      auctionId,
      endAt,
      secondsRemaining,
    });

    console.log(`[Socket] Emitted auction:ending-soon for auction ${auctionId}`);
  }

  // Emit viewer count update
  private emitViewerCount(auctionId: string): void {
    if (!this.io) return;

    const count = this.auctionRooms.get(auctionId)?.size || 0;
    this.io.to(`auction:${auctionId}`).emit('auction:viewers', {
      auctionId,
      count,
    });
  }

  // Get current viewer count for an auction
  getViewerCount(auctionId: string): number {
    return this.auctionRooms.get(auctionId)?.size || 0;
  }
}

export const socketService = new SocketService();
