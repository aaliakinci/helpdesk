import {
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthenticatedIdentity } from "../domain/identity.types.js";
import type { Permission } from "../domain/permissions.js";
import { IdentityService } from "../application/identity.service.js";

export interface IdentityHttpRequest {
  readonly headers: Record<string, string | string[] | undefined>;
  readonly ip?: string;
  readonly socket?: { readonly remoteAddress?: string };
  identity?: AuthenticatedIdentity;
}

const PERMISSION_METADATA = "helpdesk.identity.permission";

export const RequirePermission = (permission: Permission): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_METADATA, permission);

export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedIdentity => {
    const identity = context.switchToHttp().getRequest<IdentityHttpRequest>().identity;
    if (!identity) throw new UnauthorizedException("Authentication is required.");
    return identity;
  },
);

@Injectable()
export class AccessTokenGuard implements CanActivate {
  public constructor(private readonly identityService: IdentityService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IdentityHttpRequest>();
    const authorization = singleHeader(request.headers.authorization);
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authentication is required.");
    }
    const token = authorization.slice("Bearer ".length).trim();
    if (!token) throw new UnauthorizedException("Authentication is required.");
    request.identity = await this.identityService.authenticateAccessToken(token);
    return true;
  }
}

@Injectable()
export class PermissionGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission>(PERMISSION_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const identity = context.switchToHttp().getRequest<IdentityHttpRequest>().identity;
    return identity?.permissions.includes(permission) ?? false;
  }
}

export function singleHeader(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === "string" || value === undefined) return value;
  return value[0];
}
