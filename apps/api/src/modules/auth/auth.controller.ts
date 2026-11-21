import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/authenticate';
import { getValidatedInput } from '../../middlewares/validate';
import { loginInput, registerInput } from './auth.schemas';
import type { AuthResult, AuthService } from './auth.service';

const REFRESH_TOKEN_COOKIE = 'refresh_token';

const refreshCookieSchema = z.string().min(1).optional().catch(undefined);

export interface AuthControllerOptions {
  /** Cookies are marked Secure in production (HTTPS only). */
  secureCookies: boolean;
}

export function createAuthController(
  service: AuthService,
  { secureCookies }: AuthControllerOptions,
) {
  /** The refresh cookie is httpOnly, SameSite=Lax and only sent to the auth routes. */
  function cookieOptions(req: Request): CookieOptions {
    return { httpOnly: true, secure: secureCookies, sameSite: 'lax', path: req.baseUrl };
  }

  function readRefreshToken(req: Request): string | undefined {
    return refreshCookieSchema.parse(req.cookies[REFRESH_TOKEN_COOKIE]);
  }

  function sendSession(req: Request, res: Response, result: AuthResult, status: number): void {
    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken.token, {
      ...cookieOptions(req),
      expires: result.refreshToken.expiresAt,
    });
    res.status(status).json({ data: result.session });
  }

  const register: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, registerInput);
    sendSession(req, res, await service.register(body), 201);
  };

  const login: RequestHandler = async (req, res) => {
    const { body } = getValidatedInput(res, loginInput);
    sendSession(req, res, await service.login(body), 200);
  };

  const refresh: RequestHandler = async (req, res) => {
    try {
      sendSession(req, res, await service.refresh(readRefreshToken(req)), 200);
    } catch (error) {
      res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions(req));
      throw error;
    }
  };

  const logout: RequestHandler = async (req, res) => {
    await service.logout(readRefreshToken(req));
    res.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions(req));
    res.status(204).end();
  };

  const me: RequestHandler = async (req, res) => {
    res.json({ data: await service.getMe(requireAuth(req).userId) });
  };

  return { register, login, refresh, logout, me };
}
