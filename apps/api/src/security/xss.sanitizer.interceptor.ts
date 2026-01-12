import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class XssSanitizerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Sanitize request body
    if (request.body) {
      request.body = this.sanitizeObject(request.body);
    }
    
    // Sanitize request query
    if (request.query) {
      request.query = this.sanitizeObject(request.query);
    }
    
    // Sanitize request params
    if (request.params) {
      request.params = this.sanitizeObject(request.params);
    }

    return next.handle().pipe(
      map(data => {
        // Sanitize response data
        return this.sanitizeObject(data);
      })
    );
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj === 'string' ? this.sanitizeHtml(obj) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = this.sanitizeObject(obj[key]);
      }
    }
    
    return sanitized;
  }

  private sanitizeHtml(html: string): string {
    return sanitizeHtml(html, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }
}