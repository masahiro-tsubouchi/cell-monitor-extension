/**
 * Nominal Types Implementation for Type Safety
 * Phase 3: 厳密型システム実装
 */

import { z } from 'zod';

// ✅ Nominal Types基盤
export type Brand<T, B> = T & { readonly __brand: B };

// ✅ ID型定義（型安全）
export type StudentID = Brand<string, 'StudentID'>;
export type TeamID = Brand<string, 'TeamID'>;
export type InstructorID = Brand<string, 'InstructorID'>;
export type SessionID = Brand<string, 'SessionID'>;
export type NotebookID = Brand<string, 'NotebookID'>;

// ✅ Nominal Type作成ヘルパー
export const createStudentID = (value: string): StudentID => {
  if (!value || value.trim().length === 0) {
    throw new Error('StudentID cannot be empty');
  }
  if (!value.includes('@') || !value.includes('.')) {
    throw new Error('StudentID must be a valid email format');
  }
  return value as StudentID;
};

export const createTeamID = (value: string): TeamID => {
  if (!value || value.trim().length === 0) {
    throw new Error('TeamID cannot be empty');
  }
  if (value.length > 50) {
    throw new Error('TeamID must be 50 characters or less');
  }
  return value as TeamID;
};

export const createInstructorID = (value: string): InstructorID => {
  if (!value || value.trim().length === 0) {
    throw new Error('InstructorID cannot be empty');
  }
  return value as InstructorID;
};

export const createSessionID = (value: string): SessionID => {
  if (!value || value.trim().length === 0) {
    throw new Error('SessionID cannot be empty');
  }
  if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
    throw new Error('SessionID must contain only alphanumeric characters, hyphens, and underscores');
  }
  return value as SessionID;
};

export const createNotebookID = (value: string): NotebookID => {
  if (!value || value.trim().length === 0) {
    throw new Error('NotebookID cannot be empty');
  }
  return value as NotebookID;
};

// ✅ Zod Schemas for Runtime Validation
export const StudentIDSchema = z.string().email().transform(createStudentID);
export const TeamIDSchema = z.string().min(1).max(50).transform(createTeamID);
export const InstructorIDSchema = z.string().min(1).transform(createInstructorID);
export const SessionIDSchema = z.string().regex(/^[a-zA-Z0-9-_]+$/).transform(createSessionID);
export const NotebookIDSchema = z.string().min(1).transform(createNotebookID);

// ✅ 安全な型変換ユーティリティ
export const safeParseStudentID = (value: unknown): StudentID | null => {
  const result = StudentIDSchema.safeParse(value);
  return result.success ? result.data : null;
};

export const safeParseTeamID = (value: unknown): TeamID | null => {
  const result = TeamIDSchema.safeParse(value);
  return result.success ? result.data : null;
};

// ✅ 型安全なID比較ユーティリティ
export const isEqualStudentID = (a: StudentID, b: StudentID): boolean => a === b;
export const isEqualTeamID = (a: TeamID, b: TeamID): boolean => a === b;

// ✅ ID配列操作ユーティリティ
export const uniqueStudentIDs = (ids: StudentID[]): StudentID[] => 
  Array.from(new Set(ids));

export const uniqueTeamIDs = (ids: TeamID[]): TeamID[] => 
  Array.from(new Set(ids));

// ✅ デバッグ用ヘルパー
export const unwrapBrand = <T, B>(branded: Brand<T, B>): T => branded as T;

// ✅ 型ガード
export const isStudentID = (value: unknown): value is StudentID => {
  return StudentIDSchema.safeParse(value).success;
};

export const isTeamID = (value: unknown): value is TeamID => {
  return TeamIDSchema.safeParse(value).success;
};

export const isInstructorID = (value: unknown): value is InstructorID => {
  return InstructorIDSchema.safeParse(value).success;
};