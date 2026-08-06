import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * Protege a API de credenciais: exige `Authorization: Bearer <INTEGRATION_ADMIN_TOKEN>`.
 * Se o token não estiver configurado, nega tudo (falha segura).
 */
@Injectable()
export class AdminTokenGuard implements CanActivate {
  private readonly token: string;

  constructor(config: ConfigService) {
    this.token = config.get<string>('adminToken') ?? '';
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.token) {
      throw new UnauthorizedException('INTEGRATION_ADMIN_TOKEN não configurado no serviço.');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.header('authorization') ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    const a = Buffer.from(provided);
    const b = Buffer.from(this.token);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Token de administração inválido.');
    }
    return true;
  }
}
