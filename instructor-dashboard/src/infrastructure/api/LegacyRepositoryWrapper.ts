/**
 * Legacy Repository Wrapper
 * 新しいRepository実装を既存のインターフェースに適合させる
 */

import { APIDashboardRepository } from './APIDashboardRepository';
import { APIStudentRepository } from './APIStudentRepository';
import { Student } from '../../domain/entities/Student';
import { DashboardMetrics, ActivityTimePoint } from '../../domain/entities/Metrics';
import { Team } from '../../domain/entities/Team';
import { 
  DashboardRepository, 
  DashboardOverview 
} from '../../domain/repositories/DashboardRepository';
import { StudentRepository } from '../../domain/repositories/StudentRepository';

/**
 * Legacy-compatible DashboardRepository wrapper
 */
export class LegacyDashboardRepositoryWrapper implements DashboardRepository {
  constructor(private readonly enhancedRepo: APIDashboardRepository) {}

  async getMetrics(): Promise<DashboardMetrics> {
    const result = await this.enhancedRepo.getMetrics();
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  async updateMetrics(metrics: DashboardMetrics): Promise<void> {
    const result = await this.enhancedRepo.updateMetrics(metrics);
    if (!result.success) {
      throw result.error;
    }
  }

  async getTeams(): Promise<Team[]> {
    const result = await this.enhancedRepo.getTeams();
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  async getTeamById(teamId: string): Promise<Team | null> {
    const result = await this.enhancedRepo.getTeamById(teamId);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  async updateTeam(team: Team): Promise<void> {
    const result = await this.enhancedRepo.updateTeam(team);
    if (!result.success) {
      throw result.error;
    }
  }

  async getActivityHistory(hours: number): Promise<ActivityTimePoint[]> {
    const result = await this.enhancedRepo.getActivityHistory(hours);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  async addActivityPoint(point: ActivityTimePoint): Promise<void> {
    const result = await this.enhancedRepo.addActivityPoint(point);
    if (!result.success) {
      throw result.error;
    }
  }

  subscribeToMetricsUpdates(callback: (metrics: DashboardMetrics) => void): () => void {
    return this.enhancedRepo.subscribeToMetricsUpdates(callback);
  }

  subscribeToTeamUpdates(callback: (teams: Team[]) => void): () => void {
    return this.enhancedRepo.subscribeToTeamUpdates(callback);
  }
}

/**
 * Legacy-compatible StudentRepository wrapper  
 */
export class LegacyStudentRepositoryWrapper implements StudentRepository {
  constructor(private readonly enhancedRepo: APIStudentRepository) {}

  async getAll(): Promise<Student[]> {
    return this.enhancedRepo.getAll();
  }

  async getById(id: any): Promise<Student | null> {
    return this.enhancedRepo.getById(id);
  }

  async getByTeamId(teamId: string): Promise<Student[]> {
    return this.enhancedRepo.getByTeamId(teamId);
  }

  async update(student: Student): Promise<void> {
    return this.enhancedRepo.update(student);
  }

  async updateMany(students: Student[]): Promise<void> {
    return this.enhancedRepo.updateMany(students);
  }

  async getActiveStudents(): Promise<Student[]> {
    return this.enhancedRepo.getActiveStudents();
  }

  async getStudentsRequiringHelp(): Promise<Student[]> {
    return this.enhancedRepo.getStudentsRequiringHelp();
  }

  async getStudentsWithErrors(): Promise<Student[]> {
    return this.enhancedRepo.getStudentsWithErrors();
  }

  async getStudentsWithCache(maxAgeMs: number): Promise<Student[]> {
    return this.enhancedRepo.getStudentsWithCache(maxAgeMs);
  }

  subscribeToUpdates(callback: (students: Student[]) => void): () => void {
    return this.enhancedRepo.subscribeToUpdates(callback);
  }
}

/**
 * Factory functions
 */
export const createLegacyDashboardRepository = (
  apiBaseUrl: string,
  cacheMaxAge: number,
  timeout: number
): DashboardRepository => {
  const enhancedRepo = new APIDashboardRepository(
    require('axios').create({
      baseURL: apiBaseUrl,
      timeout,
      headers: { 'Content-Type': 'application/json' }
    }),
    cacheMaxAge
  );
  
  return new LegacyDashboardRepositoryWrapper(enhancedRepo);
};

export const createLegacyStudentRepository = (
  apiBaseUrl: string,
  timeout: number
): StudentRepository => {
  const enhancedRepo = new APIStudentRepository(
    require('axios').create({
      baseURL: apiBaseUrl,
      timeout,
      headers: { 'Content-Type': 'application/json' }
    })
  );
  
  return new LegacyStudentRepositoryWrapper(enhancedRepo);
};