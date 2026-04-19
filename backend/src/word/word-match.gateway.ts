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

export const WORD_MATCH_REFRESH_EVENT = 'word-match.refresh' as const;

export type WordMatchRefreshPayload = {
  sessionId: string;
  reason?: string;
  /** `GameParticipant.id` for versus progress events */
  participantId?: string;
  score?: number;
};

@WebSocketGateway({
  namespace: '/word-match',
  cors: { origin: true, credentials: true },
})
export class WordMatchGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WordMatchGateway.name);

  constructor(
    private readonly jwt: JwtValidationService,
    private readonly players: PlayerService,
    private readonly prisma: PrismaService,
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
      if (!session || session.gameType !== GameType.WORD_GAME) {
        return { ok: false, error: 'not_found' };
      }
      const member = session.participants.some((p) => p.playerId === player.id);
      if (!member) {
        return { ok: false, error: 'forbidden' };
      }
      await client.join(`match:${body.sessionId}`);
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

  @OnEvent(WORD_MATCH_REFRESH_EVENT)
  handleSessionRefresh(payload: string | WordMatchRefreshPayload) {
    if (!this.server) return;
    const body: WordMatchRefreshPayload =
      typeof payload === 'string' ? { sessionId: payload } : payload;
    if (!body.sessionId) return;
    const room = `match:${body.sessionId}`;
    this.server.to(room).emit('refresh', body);
    this.server.to(room).emit('matchUpdate', body);
  }
}
