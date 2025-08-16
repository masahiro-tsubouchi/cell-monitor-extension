/**
 * Fetch Students Use Case
 * 学生データ取得のビジネスロジック
 */

import { Student } from '../../entities/Student';
import { StudentRepository, RepositoryResult } from '../../repositories/StudentRepository';

export interface FetchStudentsRequest {
  includeInactive?: boolean;
  teamFilter?: string;
  forceRefresh?: boolean;
}

export interface FetchStudentsResponse {
  students: Student[];
  lastUpdated: Date;
  fromCache: boolean;
}

export type FetchStudentsResult = RepositoryResult<FetchStudentsResponse>;

/**
 * FetchStudentsUseCase
 * SOLID原則のSingle Responsibilityに基づき、学生データ取得のみを担当
 */
export class FetchStudentsUseCase {
  constructor(
    private readonly studentRepository: StudentRepository
  ) {}

  async execute(request: FetchStudentsRequest = {}): Promise<FetchStudentsResult> {
    try {
      const {
        includeInactive = true,
        teamFilter,
        forceRefresh = false
      } = request;

      // フィルタ条件に応じてリポジトリメソッドを選択
      let students: Student[];
      let fromCache = false;

      if (teamFilter) {
        students = await this.studentRepository.getByTeamId(teamFilter);
      } else if (!includeInactive) {
        students = await this.studentRepository.getActiveStudents();
      } else {
        // キャッシュ戦略: 強制リフレッシュでない場合は5分間のキャッシュを使用
        if (!forceRefresh) {
          students = await this.studentRepository.getStudentsWithCache(5 * 60 * 1000);
          fromCache = true;
        } else {
          students = await this.studentRepository.getAll();
        }
      }

      // ビジネスルール: 学生データのバリデーション
      const validatedStudents = this.validateStudents(students);

      return {
        success: true,
        data: {
          students: validatedStudents,
          lastUpdated: new Date(),
          fromCache
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          name: 'FetchStudentsError',
          message: 'Failed to fetch students',
          code: 'FETCH_STUDENTS_FAILED',
          cause: error as Error
        }
      };
    }
  }

  private validateStudents(students: Student[]): Student[] {
    return students.filter(student => {
      try {
        // 基本的なバリデーション
        if (!student.emailAddress || !student.userName) {
          console.warn(`Invalid student data: ${student.id}`);
          return false;
        }
        return true;
      } catch (error) {
        console.warn(`Student validation failed for ${student.id}:`, error);
        return false;
      }
    });
  }
}

/**
 * Factory function for dependency injection
 */
export const createFetchStudentsUseCase = (
  studentRepository: StudentRepository
): FetchStudentsUseCase => {
  return new FetchStudentsUseCase(studentRepository);
};