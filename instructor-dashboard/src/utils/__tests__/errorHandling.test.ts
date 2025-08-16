/**
 * Error Handling Tests
 * Phase 3: 高度エラーハンドリングテスト
 */

import {
  ValidationError,
  NetworkError,
  AuthenticationError,
  BusinessLogicError,
  SystemError,
  handleError,
  safeAsync,
  safeSync,
  withRetry
} from '../errorHandling';
import { z } from 'zod';

describe('Error Handling System', () => {
  describe('DomainError Classes', () => {
    it('should create ValidationError with correct properties', () => {
      const zodError = z.string().safeParse(123);
      if (!zodError.success) {
        const error = new ValidationError(zodError.error, { field: 'test' });
        
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.severity).toBe('medium');
        expect(error.category).toBe('validation');
        expect(error.context.field).toBe('test');
        expect(error.retryable).toBe(false);
        expect(error.userMessage).toBe('入力データに問題があります。正しい形式で入力してください。');
      }
    });

    it('should create NetworkError with correct properties', () => {
      const error = new NetworkError('Request failed', 404, '/api/students');
      
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.severity).toBe('high');
      expect(error.category).toBe('network');
      expect(error.statusCode).toBe(404);
      expect(error.endpoint).toBe('/api/students');
      expect(error.retryable).toBe(true);
      expect(error.userMessage).toBe('リクエストされたデータが見つかりませんでした。');
    });

    it('should create AuthenticationError with correct properties', () => {
      const error = new AuthenticationError('Invalid token');
      
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.severity).toBe('high');
      expect(error.category).toBe('authentication');
      expect(error.retryable).toBe(false);
      expect(error.userMessage).toBe('ログインが必要です。再度ログインしてください。');
    });

    it('should create BusinessLogicError with correct properties', () => {
      const error = new BusinessLogicError(
        'Cannot delete student with active sessions',
        'student_deletion_rule'
      );
      
      expect(error.code).toBe('BUSINESS_LOGIC_ERROR');
      expect(error.severity).toBe('medium');
      expect(error.category).toBe('business_logic');
      expect(error.businessRule).toBe('student_deletion_rule');
      expect(error.retryable).toBe(false);
    });

    it('should create SystemError with correct properties', () => {
      const error = new SystemError('Database connection failed', 'database');
      
      expect(error.code).toBe('SYSTEM_ERROR');
      expect(error.severity).toBe('critical');
      expect(error.category).toBe('system');
      expect(error.systemComponent).toBe('database');
      expect(error.retryable).toBe(true);
    });
  });

  describe('Error Details and Serialization', () => {
    it('should provide detailed error information', () => {
      const error = new NetworkError('Request failed', 500, '/api/test');
      const details = error.getDetails();
      
      expect(details.code).toBe('NETWORK_ERROR');
      expect(details.severity).toBe('high');
      expect(details.category).toBe('network');
      expect(details.timestamp).toBeInstanceOf(Date);
      expect(details.context).toEqual({ statusCode: 500, endpoint: '/api/test' });
      expect(details.retryable).toBe(true);
    });

    it('should serialize error to JSON', () => {
      const error = new ValidationError(
        z.string().safeParse(123).error as z.ZodError,
        { field: 'test' }
      );
      const json = JSON.parse(JSON.stringify(error));
      
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.message).toContain('Validation failed');
      expect(json.context.field).toBe('test');
    });
  });

  describe('Error Handling Utilities', () => {
    it('should handle unknown errors', () => {
      const unknownError = 'Something went wrong';
      const result = handleError(unknownError, 'test context');
      
      expect(result).toBeInstanceOf(SystemError);
      expect(result.message).toContain('Unknown error: Something went wrong');
      expect(result.context).toEqual({});
    });

    it('should handle Error instances', () => {
      const jsError = new Error('JavaScript error');
      const result = handleError(jsError, 'test context');
      
      expect(result).toBeInstanceOf(SystemError);
      expect(result.message).toBe('JavaScript error');
    });

    it('should handle ZodError instances', () => {
      const zodError = z.string().safeParse(123);
      if (!zodError.success) {
        const result = handleError(zodError.error, 'test context');
        
        expect(result).toBeInstanceOf(ValidationError);
        expect((result as ValidationError).validationErrors).toBe(zodError.error);
      }
    });

    it('should preserve DomainError instances', () => {
      const originalError = new NetworkError('Network failed');
      const result = handleError(originalError, 'test context');
      
      expect(result).toBe(originalError);
    });
  });

  describe('safeAsync', () => {
    it('should return success for successful operation', async () => {
      const operation = async () => 'success';
      const result = await safeAsync(operation, 'test operation');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('success');
      }
    });

    it('should return error for failed operation', async () => {
      const operation = async () => {
        throw new Error('Operation failed');
      };
      const result = await safeAsync(operation, 'test operation');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(SystemError);
        expect(result.error.message).toBe('Operation failed');
      }
    });

    it('should return fallback value on error', async () => {
      const operation = async () => {
        throw new Error('Operation failed');
      };
      const result = await safeAsync(operation, 'test operation', 'fallback');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.data).toBe('fallback');
      }
    });
  });

  describe('safeSync', () => {
    it('should return success for successful operation', () => {
      const operation = () => 'success';
      const result = safeSync(operation, 'test operation');
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('success');
      }
    });

    it('should return error for failed operation', () => {
      const operation = () => {
        throw new Error('Operation failed');
      };
      const result = safeSync(operation, 'test operation');
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(SystemError);
        expect(result.error.message).toBe('Operation failed');
      }
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new NetworkError('Temporary failure'))
        .mockResolvedValue('success');
      
      const result = await withRetry(operation, 3, 10);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new AuthenticationError('Auth failed'));
      
      await expect(withRetry(operation, 3, 10)).rejects.toThrow('Auth failed');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max attempts', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new NetworkError('Network failure'));
      
      await expect(withRetry(operation, 2, 10)).rejects.toThrow('Network failure');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('ValidationError field errors', () => {
    it('should extract field errors from ZodError', () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().min(0)
      });
      
      const result = schema.safeParse({
        name: '',
        email: 'invalid-email',
        age: -1
      });
      
      if (!result.success) {
        const error = new ValidationError(result.error);
        const fieldErrors = error.getFieldErrors();
        
        expect(fieldErrors).toHaveProperty('name');
        expect(fieldErrors).toHaveProperty('email');
        expect(fieldErrors).toHaveProperty('age');
        expect(fieldErrors.name).toContain('String must contain at least 1 character(s)');
        expect(fieldErrors.email).toContain('Invalid email');
        expect(fieldErrors.age).toContain('Number must be greater than or equal to 0');
      }
    });
  });
});