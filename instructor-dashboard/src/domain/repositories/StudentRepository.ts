/**
 * Student Repository Interface
 * Domain層のRepository抽象化
 * Dependency Inversion Principleに基づく設計
 */

import { Student, StudentID } from '../entities/Student';

export interface StudentRepository {
  // 基本CRUD操作
  getAll(): Promise<Student[]>;
  getById(id: StudentID): Promise<Student | null>;
  getByTeamId(teamId: string): Promise<Student[]>;
  
  // 学生データの更新
  update(student: Student): Promise<void>;
  updateMany(students: Student[]): Promise<void>;
  
  // フィルタリング・検索
  getActiveStudents(): Promise<Student[]>;
  getStudentsRequiringHelp(): Promise<Student[]>;
  getStudentsWithErrors(): Promise<Student[]>;
  
  // パフォーマンス最適化
  getStudentsWithCache(maxAgeMs: number): Promise<Student[]>;
  
  // ストリーミング・リアルタイム
  subscribeToUpdates(callback: (students: Student[]) => void): () => void;
}

/**
 * Repository Result Type
 * エラーハンドリングを含む結果型
 */
export type RepositoryResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: RepositoryError;
};

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/**
 * Enhanced Student Repository with Result Type
 */
export interface EnhancedStudentRepository {
  getAll(): Promise<RepositoryResult<Student[]>>;
  getById(id: StudentID): Promise<RepositoryResult<Student | null>>;
  getByTeamId(teamId: string): Promise<RepositoryResult<Student[]>>;
  update(student: Student): Promise<RepositoryResult<void>>;
  updateMany(students: Student[]): Promise<RepositoryResult<void>>;
  getActiveStudents(): Promise<RepositoryResult<Student[]>>;
  getStudentsRequiringHelp(): Promise<RepositoryResult<Student[]>>;
  getStudentsWithErrors(): Promise<RepositoryResult<Student[]>>;
}