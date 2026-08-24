import {
  Injectable,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";

import {
  PlatformConfigService,
  SessionInvalidationService,
  type SessionInvalidation,
  writeStructuredLog,
} from "../../../platform/index.js";
import { IdentityService, type AuthenticatedIdentity } from "../../identity/index.js";
import { REALTIME_EVENT_NAME, type RealtimeInvalidation } from "../domain/realtime-invalidation.js";
import { realtimeQueueRoom, realtimeRoleRoom, realtimeUserRoom } from "../domain/realtime-rooms.js";

interface SocketIdentity {
  readonly membershipId: string;
  readonly role: AuthenticatedIdentity["role"];
  readonly sessionId: string;
  readonly tenantId: string;
  readonly userId: string;
}

interface AuthenticatedSocketData {
  identity?: SocketIdentity;
}

type RealtimeSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  AuthenticatedSocketData
>;

@Injectable()
@WebSocketGateway({
  namespace: "/support",
  path: "/socket.io",
  serveClient: false,
  transports: ["websocket"],
})
export class RealtimeGateway
  implements
    OnGatewayInit<Namespace>,
    OnGatewayConnection<RealtimeSocket>,
    OnGatewayDisconnect<RealtimeSocket>,
    OnApplicationBootstrap,
    BeforeApplicationShutdown
{
  @WebSocketServer()
  private namespace!: Namespace;

  private readonly accessTokens = new Map<string, string>();
  private recheckTimer: NodeJS.Timeout | undefined;
  private unsubscribeInvalidations: (() => void) | undefined;

  public constructor(
    private readonly config: PlatformConfigService,
    private readonly identities: IdentityService,
    private readonly invalidations: SessionInvalidationService,
  ) {}

  public afterInit(namespace: Namespace): void {
    namespace.use((socket: RealtimeSocket, next) => {
      void this.authenticateHandshake(socket).then(() => next(), next);
    });
  }

  public async handleConnection(socket: RealtimeSocket): Promise<void> {
    const identity = socket.data.identity;
    if (!identity) {
      socket.disconnect(true);
      return;
    }
    await socket.join([...(await this.roomsFor(identity))]);
    writeStructuredLog("support-api", "info", "realtime.socket.connected", {
      membershipId: identity.membershipId,
      tenantId: identity.tenantId,
    });
  }

  public handleDisconnect(socket: RealtimeSocket): void {
    this.accessTokens.delete(socket.id);
  }

  public onApplicationBootstrap(): void {
    this.unsubscribeInvalidations = this.invalidations.subscribe((event) => {
      this.disconnectInvalidatedSockets(event);
    });
    this.recheckTimer = setInterval(
      () => void this.recheckConnections(),
      this.config.values.realtimeAuthRecheckMs,
    );
    this.recheckTimer.unref();
  }

  public beforeApplicationShutdown(): Promise<void> {
    if (this.recheckTimer) clearInterval(this.recheckTimer);
    this.unsubscribeInvalidations?.();
    this.accessTokens.clear();
    return Promise.resolve();
  }

  public publish(rooms: readonly string[], invalidation: RealtimeInvalidation): void {
    if (rooms.length === 0 || !this.namespace) return;
    this.namespace.to([...rooms]).emit(REALTIME_EVENT_NAME, invalidation);
  }

  private async authenticateHandshake(socket: RealtimeSocket): Promise<void> {
    if (socket.handshake.headers.origin !== this.config.values.webOrigin) {
      throw new Error("Origin is not allowed.");
    }
    const candidate: unknown = socket.handshake.auth?.accessToken;
    if (typeof candidate !== "string" || candidate.length < 1 || candidate.length > 8_192) {
      throw new Error("Authentication is required.");
    }
    const identity = await this.identities.authenticateAccessToken(candidate);
    socket.data.identity = toSocketIdentity(identity);
    this.accessTokens.set(socket.id, candidate);
  }

  private async roomsFor(identity: SocketIdentity): Promise<readonly string[]> {
    const rooms = [
      realtimeUserRoom(identity.tenantId, identity.userId),
      realtimeRoleRoom(identity.tenantId, identity.role),
    ];
    if (identity.role !== "AGENT") return rooms;
    const memberships = await this.identities.listActiveQueueIds(
      identity.tenantId,
      identity.membershipId,
    );
    return [
      ...rooms,
      ...memberships.map((queueId) => realtimeQueueRoom(identity.tenantId, queueId)),
    ];
  }

  private disconnectInvalidatedSockets(event: SessionInvalidation): void {
    if (!this.namespace) return;
    for (const socket of this.namespace.sockets.values() as Iterable<RealtimeSocket>) {
      const identity = socket.data.identity;
      if (!identity) continue;
      const matches =
        (event.scope === "SESSION" && identity.sessionId === event.id) ||
        (event.scope === "USER" && identity.userId === event.id) ||
        (event.scope === "MEMBERSHIP" && identity.membershipId === event.id);
      if (matches) socket.disconnect(true);
    }
  }

  private async recheckConnections(): Promise<void> {
    if (!this.namespace) return;
    await Promise.allSettled(
      [...this.namespace.sockets.values()].map(async (socket: RealtimeSocket) => {
        const token = this.accessTokens.get(socket.id);
        const previous = socket.data.identity;
        if (!token || !previous) {
          socket.disconnect(true);
          return;
        }
        try {
          const current = toSocketIdentity(await this.identities.authenticateAccessToken(token));
          if (!sameSocketIdentity(previous, current)) socket.disconnect(true);
        } catch {
          socket.disconnect(true);
        }
      }),
    );
  }
}

function toSocketIdentity(identity: AuthenticatedIdentity): SocketIdentity {
  return {
    membershipId: identity.membershipId,
    role: identity.role,
    sessionId: identity.sessionId,
    tenantId: identity.tenantId,
    userId: identity.userId,
  };
}

function sameSocketIdentity(left: SocketIdentity, right: SocketIdentity): boolean {
  return (
    left.membershipId === right.membershipId &&
    left.role === right.role &&
    left.sessionId === right.sessionId &&
    left.tenantId === right.tenantId &&
    left.userId === right.userId
  );
}
