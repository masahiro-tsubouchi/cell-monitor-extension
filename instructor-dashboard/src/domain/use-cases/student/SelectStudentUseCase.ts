/**
 * Select Student Use Case
 * 学生選択のビジネスロジック
 */

import { Student, StudentID } from '../../entities/Student';
import { StudentRepository, RepositoryResult } from '../../repositories/StudentRepository';

export interface SelectStudentRequest {
  studentId: StudentID;
  loadDetails?: boolean;
}

export interface SelectStudentResponse {
  selectedStudent: Student;
  previousStudent: Student | null;
}

export type SelectStudentResult = RepositoryResult<SelectStudentResponse>;

/**
 * SelectStudentUseCase
 * 学生選択のビジネスロジックを管理
 */
export class SelectStudentUseCase {
  private currentlySelected: Student | null = null;

  constructor(
    private readonly studentRepository: StudentRepository
  ) {}

  async execute(request: SelectStudentRequest): Promise<SelectStudentResult> {
    try {
      const { studentId, loadDetails = false } = request;

      // 指定された学生を取得
      const student = await this.studentRepository.getById(studentId);
      
      if (!student) {
        return {
          success: false,
          error: {
            name: 'StudentNotFoundError',
            message: `Student with ID ${studentId} not found`,
            code: 'STUDENT_NOT_FOUND'
          }
        };
      }

      // ビジネスルール: 学生が選択可能な状態かチェック
      const validationResult = this.validateStudentSelection(student);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            name: 'InvalidSelectionError',
            message: validationResult.reason || 'Invalid selection',
            code: 'INVALID_SELECTION'
          }
        };
      }

      const previousStudent = this.currentlySelected;
      this.currentlySelected = student;

      // 詳細情報が必要な場合の追加処理
      if (loadDetails) {
        // 必要に応じて追加データを読み込み
        // 例: 実行履歴、ノートブック履歴など
        await this.loadStudentDetails(student);
      }

      return {
        success: true,
        data: {
          selectedStudent: student,
          previousStudent
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          name: 'SelectStudentError',
          message: 'Failed to select student',
          code: 'SELECT_STUDENT_FAILED',
          cause: error as Error
        }
      };
    }
  }

  getCurrentSelection(): Student | null {
    return this.currentlySelected;
  }

  clearSelection(): void {
    this.currentlySelected = null;
  }

  private validateStudentSelection(student: Student): { isValid: boolean; reason?: string } {
    // ビジネスルール: 基本的なバリデーション
    if (!student.emailAddress || !student.userName) {
      return {
        isValid: false,
        reason: 'Student data is incomplete'
      };
    }

    // ビジネスルール: その他の選択制約があれば追加
    // 例: 特定の状態の学生のみ選択可能など

    return { isValid: true };
  }

  private async loadStudentDetails(student: Student): Promise<void> {
    // 詳細情報の読み込みロジック
    // 現在は基本実装のみ
    // 将来的に実行履歴やセッション詳細などを読み込み
  }
}

/**
 * Factory function
 */
export const createSelectStudentUseCase = (
  studentRepository: StudentRepository
): SelectStudentUseCase => {
  return new SelectStudentUseCase(studentRepository);
};