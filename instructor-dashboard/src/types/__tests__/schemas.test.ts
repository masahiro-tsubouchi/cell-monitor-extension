/**
 * Runtime Validation Tests
 * Phase 3: 型安全性テスト実装
 */

import { 
  StudentActivitySchema, 
  StudentActivityBuilder,
  ValidationError,
  TeamSchema,
  MetricsSchema,
  safeParseStudentActivity
} from '../schemas';
import { createStudentID, createTeamID } from '../nominal';

describe('Runtime Validation Schemas', () => {
  describe('StudentActivitySchema', () => {
    it('should validate valid student activity', () => {
      const validStudent = {
        id: 'test@university.edu',
        emailAddress: 'test@university.edu',
        userName: 'Test Student',
        status: 'active',
        cellExecutions: 5,
        errorCount: 0,
        isRequestingHelp: false,
        lastActivity: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      const result = StudentActivitySchema.safeParse(validStudent);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.userName).toBe('Test Student');
        expect(result.data.cellExecutions).toBe(5);
      }
    });

    it('should reject invalid email format', () => {
      const invalidStudent = {
        id: 'invalid-email',
        emailAddress: 'invalid-email',
        userName: 'Test Student',
        status: 'active',
        cellExecutions: 5,
        errorCount: 0,
        isRequestingHelp: false,
        lastActivity: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      const result = StudentActivitySchema.safeParse(invalidStudent);
      expect(result.success).toBe(false);
    });

    it('should reject negative cellExecutions', () => {
      const invalidStudent = {
        id: 'test@university.edu',
        emailAddress: 'test@university.edu',
        userName: 'Test Student',
        status: 'active',
        cellExecutions: -1, // Invalid: negative number
        errorCount: 0,
        isRequestingHelp: false,
        lastActivity: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      const result = StudentActivitySchema.safeParse(invalidStudent);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const invalidStudent = {
        id: 'test@university.edu',
        emailAddress: 'test@university.edu',
        userName: 'Test Student',
        status: 'invalid-status', // Invalid status
        cellExecutions: 5,
        errorCount: 0,
        isRequestingHelp: false,
        lastActivity: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      const result = StudentActivitySchema.safeParse(invalidStudent);
      expect(result.success).toBe(false);
    });
  });

  describe('StudentActivityBuilder', () => {
    it('should build valid student activity', () => {
      const student = new StudentActivityBuilder()
        .setId('test@university.edu')
        .setUserName('Test Student')
        .setStatus('active')
        .setCellExecutions(10)
        .setErrorCount(2)
        .setIsRequestingHelp(false)
        .setLastActivity(new Date().toISOString())
        .setJoinedAt(new Date().toISOString())
        .setLastSeen(new Date().toISOString())
        .build();

      expect(student.userName).toBe('Test Student');
      expect(student.cellExecutions).toBe(10);
      expect(student.errorCount).toBe(2);
      expect(student.status).toBe('active');
    });

    it('should throw error for missing required fields', () => {
      expect(() => {
        new StudentActivityBuilder()
          .setId('test@university.edu')
          .setUserName('Test Student')
          // Missing status
          .build();
      }).toThrow('StudentActivity status is required');
    });

    it('should validate data during building', () => {
      expect(() => {
        new StudentActivityBuilder()
          .setId('invalid-email') // Invalid email
          .build();
      }).toThrow();
    });
  });

  describe('safeParseStudentActivity', () => {
    it('should return null for invalid data', () => {
      const invalidData = { invalid: 'data' };
      const result = safeParseStudentActivity(invalidData);
      expect(result).toBeNull();
    });

    it('should return parsed data for valid input', () => {
      const validData = {
        id: 'test@university.edu',
        emailAddress: 'test@university.edu',
        userName: 'Test Student',
        status: 'active',
        cellExecutions: 5,
        errorCount: 0,
        isRequestingHelp: false,
        lastActivity: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      const result = safeParseStudentActivity(validData);
      expect(result).not.toBeNull();
      expect(result?.userName).toBe('Test Student');
    });
  });

  describe('TeamSchema', () => {
    it('should validate valid team', () => {
      const validTeam = {
        id: 'Team A',
        name: 'Team A',
        memberIds: ['student1@university.edu', 'student2@university.edu'],
        instructorId: 'instructor@university.edu',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = TeamSchema.safeParse(validTeam);
      expect(result.success).toBe(true);
    });

    it('should reject empty team name', () => {
      const invalidTeam = {
        id: 'Team A',
        name: '', // Empty name
        memberIds: ['student1@university.edu'],
        instructorId: 'instructor@university.edu',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = TeamSchema.safeParse(invalidTeam);
      expect(result.success).toBe(false);
    });
  });

  describe('MetricsSchema', () => {
    it('should validate valid metrics', () => {
      const validMetrics = {
        totalStudents: 50,
        activeStudents: 35,
        helpRequestCount: 3,
        averageProgress: 0.72,
        totalExecutions: 1250,
        totalErrors: 85,
        systemLoad: 0.45,
        timestamp: new Date().toISOString(),
        executionDistribution: {
          low: 15,
          medium: 25,
          high: 10
        },
        errorRateDistribution: {
          excellent: 30,
          good: 15,
          needsHelp: 5
        }
      };

      const result = MetricsSchema.safeParse(validMetrics);
      expect(result.success).toBe(true);
    });

    it('should reject invalid progress values', () => {
      const invalidMetrics = {
        totalStudents: 50,
        activeStudents: 35,
        helpRequestCount: 3,
        averageProgress: 1.5, // Invalid: > 1
        totalExecutions: 1250,
        totalErrors: 85,
        systemLoad: 0.45,
        timestamp: new Date().toISOString(),
        executionDistribution: {
          low: 15,
          medium: 25,
          high: 10
        },
        errorRateDistribution: {
          excellent: 30,
          good: 15,
          needsHelp: 5
        }
      };

      const result = MetricsSchema.safeParse(invalidMetrics);
      expect(result.success).toBe(false);
    });
  });
});