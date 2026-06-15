import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { map, Observable } from 'rxjs';
import { PaginatedResult } from '../dto/pagination.dto';

/**
 * Keeps list responses frontend-friendly. Services return a rich
 * `PaginatedResult` (items + nextCursor + hasMore); this interceptor unwraps it
 * so the HTTP BODY is a plain array (what `getPosts(): Promise<Post[]>` expects)
 * and moves pagination metadata into response headers:
 *
 *   X-Next-Cursor: <cursor | empty>
 *   X-Has-More:    true | false
 *
 * One convention for every list endpoint, no per-controller boilerplate.
 */
@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => {
        if (data instanceof PaginatedResult) {
          res.setHeader('X-Next-Cursor', data.nextCursor ?? '');
          res.setHeader('X-Has-More', String(data.hasMore));
          res.setHeader(
            'Access-Control-Expose-Headers',
            'X-Next-Cursor, X-Has-More',
          );
          return data.items;
        }
        return data;
      }),
    );
  }
}
