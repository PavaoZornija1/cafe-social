import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GameType } from '@prisma/client';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { JwtValidationService } from '../auth/jwt-validation.service';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from '../player/player.service';
import { PrismaService } from '../prisma/prisma.service';
import { BrawlerService } from './brawler.service';
import {
  BRAWLER_ARENA_EVENT,
  type BrawlerArenaSocketPayload,
} from './brawler-arena.events';

export { BRAWLER_ARENA_EVENT, type BrawlerArenaSocketPayload } from './brawler-arena.events';

@WebSocketGateway({
  namespace: '/brawler',
  cors: { origin: true, credentials: true },
})
export class BrawlerGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BrawlerGateway.name);

  constructor(
    private readonly jwt: JwtValidationService,
    private readonly players: PlayerService,
    private readonly prisma: PrismaService,
    private readonly brawler: BrawlerService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (typeof client.handshake.auth?.token === 'string' && client.handshake.auth.token) ||
      (typeof client.handshake.query?.token === 'string' && String(client.handshake.query.token)) ||
      null;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const claims = await this.jwt.validate(token);
      const email = normalizeUserEmail({ claims });
      if (!email) {
        client.disconnect(true);
        return;
      }
      client.data.email = email;
    } catch (e) {
      this.logger.debug(`WS auth failed: ${(e as Error).message}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const email = client.data.email as string | undefined;
    if (!email || !body?.sessionId) {
      return { ok: false, error: 'bad_request' };
    }
    try {
      const player = await this.players.findOrCreateByEmail(email);
      const session = await this.prisma.gameSession.findUnique({
        where: { id: body.sessionId },
        include: { participants: true },
      });
      if (!session || session.gameType !== GameType.BRAWLER) {
        return { ok: false, error: 'not_found' };
      }
      const member = session.participants.some((p) => p.playerId === player.id);
      if (!member) {
        return { ok: false, error: 'forbidden' };
      }
      await client.join(`match:${body.sessionId}`);
      const snapshot = await this.brawler.getArenaState(body.sessionId);
      client.emit('arena', snapshot);
      return { ok: true };
    } catch (e) {
      this.logger.warn(`subscribe failed: ${(e as Error).message}`);
      return { ok: false, error: 'server' };
    }
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId?: string },
  ): Promise<{ ok: boolean }> {
    if (body?.sessionId) {
      await client.leave(`match:${body.sessionId}`);
    }
    return { ok: true };
  }

  @OnEvent(BRAWLER_ARENA_EVENT)
  handleArenaEvent(payload: BrawlerArenaSocketPayload) {
    if (!this.server || !payload?.sessionId) return;
    this.server.to(`match:${payload.sessionId}`).emit('arena', payload);
  }
}
