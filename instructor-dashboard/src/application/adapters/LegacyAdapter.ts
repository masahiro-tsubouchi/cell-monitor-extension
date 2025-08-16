/**
 * Legacy Adapter
 * 既存の型定義と新しいDomain層の橋渡し
 * 後方互換性を保ちながら段階的移行を実現
 */

import { 
  Student, 
  StudentBuilder, 
  StudentStatus, 
  StudentHelpStatus,
  createStudentID,
  createEmailAddress,
  createTeamID 
} from '../../domain/entities/Student';

import { 
  Team, 
  TeamBuilder, 
  TeamPriority 
} from '../../domain/entities/Team';

import { 
  DashboardMetrics, 
  DashboardMetricsBuilder, 
  ActivityTimePoint, 
  createActivityTimePoint 
} from '../../domain/entities/Metrics';

// 既存の型定義をインポート
import { 
  StudentActivity as LegacyStudentActivity,
  DashboardMetrics as LegacyDashboardMetrics,
  ActivityTimePoint as LegacyActivityTimePoint,
  DashboardOverview as LegacyDashboardOverview,
  StudentDetailData,
  TeamStats,
  InstructorSettings
} from '../../types/domain';

// API層で使用される拡張型定義
interface ExtendedStudentActivity extends Omit<LegacyStudentActivity, 'status'> {
  status: 'active' | 'idle' | 'error' | 'help';
}

/**
 * Legacy to Domain Entity Adapters
 */
export class LegacyToDomainAdapter {
  
  /**
   * Convert legacy StudentActivity to Domain Student entity
   */
  static studentActivityToStudent(legacy: LegacyStudentActivity | ExtendedStudentActivity): Student {
    try {
      return new StudentBuilder()
        .setId(createStudentID(legacy.emailAddress))
        .setEmailAddress(createEmailAddress(legacy.emailAddress))
        .setUserName(legacy.userName)
        .setTeamId(createTeamID(legacy.teamName || '未割り当て'))
        .setStatus(this.mapLegacyStatus(legacy.status))
        .setHelpStatus(this.mapLegacyHelpStatus(legacy))
        .setCurrentNotebook(legacy.currentNotebook)
        .setLastActivity(this.parseLegacyActivityTime(legacy.lastActivity))
        .setCellExecutions(legacy.cellExecutions)
        .setErrorCount(legacy.errorCount)
        .build();
    } catch (error) {
      console.warn(`Failed to convert legacy student ${legacy.emailAddress}:`, error);
      throw new Error(`Invalid legacy student data: ${legacy.emailAddress}`);
    }
  }

  /**
   * Convert multiple legacy StudentActivity to Students
   */
  static studentActivitiesToStudents(legacyStudents: (LegacyStudentActivity | ExtendedStudentActivity)[]): Student[] {
    return legacyStudents
      .map(legacy => {
        try {
          return this.studentActivityToStudent(legacy);
        } catch (error) {
          console.warn(`Skipping invalid legacy student:`, legacy, error);
          return null;
        }
      })
      .filter((student): student is Student => student !== null);
  }

  /**
   * Convert legacy DashboardMetrics to Domain DashboardMetrics
   */
  static dashboardMetricsToEntity(legacy: LegacyDashboardMetrics): DashboardMetrics {
    return new DashboardMetricsBuilder()
      .setTotalStudents(legacy.totalStudents)
      .setTotalActive(legacy.totalActive)
      .setTotalIdle(legacy.totalStudents - legacy.totalActive)
      .setErrorCount(legacy.errorCount)
      .setTotalExecutions(legacy.totalExecutions)
      .setHelpCount(legacy.helpCount)
      .setLastUpdated(legacy.lastUpdated || new Date())
      .build();
  }

  /**
   * Convert legacy ActivityTimePoint to Domain ActivityTimePoint
   */
  static activityTimePointToEntity(legacy: LegacyActivityTimePoint): ActivityTimePoint {
    return createActivityTimePoint(
      new Date(legacy.time),
      legacy.executionCount,
      legacy.errorCount,
      legacy.helpCount
    );
  }

  /**
   * Convert legacy ActivityTimePoints array
   */
  static activityTimePointsToEntities(legacyPoints: LegacyActivityTimePoint[]): ActivityTimePoint[] {
    return legacyPoints
      .map(point => {
        try {
          return this.activityTimePointToEntity(point);
        } catch (error) {
          console.warn('Invalid activity time point:', point, error);
          return null;
        }
      })
      .filter((point): point is ActivityTimePoint => point !== null);
  }

  /**
   * Convert legacy DashboardOverview to Domain entities
   */
  static dashboardOverviewToEntities(legacy: LegacyDashboardOverview): {
    students: Student[];
    metrics: DashboardMetrics;
    activityHistory: ActivityTimePoint[];
    teams: Team[];
  } {
    const students = this.studentActivitiesToStudents(legacy.students);
    const metrics = this.dashboardMetricsToEntity(legacy.metrics);
    const activityHistory = this.activityTimePointsToEntities(legacy.activityChart);
    const teams = this.createTeamsFromStudents(students);

    return {
      students,
      metrics,
      activityHistory,
      teams
    };
  }

  // Private helper methods
  private static mapLegacyStatus(legacyStatus: string): StudentStatus {
    switch (legacyStatus) {
      case 'active':
        return StudentStatus.ACTIVE;
      case 'idle':
        return StudentStatus.IDLE;
      case 'error':
        return StudentStatus.ERROR;
      case 'help':
        return StudentStatus.IDLE; // ヘルプ状態はIDLEとして扱い、helpStatusで区別
      default:
        return StudentStatus.IDLE;
    }
  }

  private static mapLegacyHelpStatus(legacy: LegacyStudentActivity | ExtendedStudentActivity): StudentHelpStatus {
    if ((legacy as ExtendedStudentActivity).status === 'help' || legacy.isRequestingHelp) {
      return StudentHelpStatus.REQUESTING;
    }
    return StudentHelpStatus.NONE;
  }

  private static parseLegacyActivityTime(activityString: string): Date {
    const now = new Date();
    
    if (activityString === '不明' || !activityString) {
      return new Date(now.getTime() - 60 * 60 * 1000); // 1時間前をデフォルト
    }

    // "2秒前", "5分前", "1時間前" などの日本語形式をパース
    const secondsMatch = activityString.match(/(\d+)秒前/);
    if (secondsMatch) {
      return new Date(now.getTime() - parseInt(secondsMatch[1]) * 1000);
    }

    const minutesMatch = activityString.match(/(\d+)分前/);
    if (minutesMatch) {
      return new Date(now.getTime() - parseInt(minutesMatch[1]) * 60 * 1000);
    }

    const hoursMatch = activityString.match(/(\d+)時間前/);
    if (hoursMatch) {
      return new Date(now.getTime() - parseInt(hoursMatch[1]) * 60 * 60 * 1000);
    }

    // ISO文字列として解析を試行
    try {
      return new Date(activityString);
    } catch {
      return new Date(now.getTime() - 60 * 60 * 1000); // フォールバック
    }
  }

  private static createTeamsFromStudents(students: Student[]): Team[] {
    const teamMap = new Map<string, Student[]>();
    
    students.forEach(student => {
      const teamId = student.teamId;
      if (!teamMap.has(teamId)) {
        teamMap.set(teamId, []);
      }
      teamMap.get(teamId)!.push(student);
    });

    return Array.from(teamMap.entries()).map(([teamId, teamStudents]) => {
      return new TeamBuilder()
        .setId(createTeamID(teamId))
        .setName(teamId)
        .setStudents(teamStudents)
        .setLastActivity(this.getLatestActivityDate(teamStudents))
        .build();
    });
  }

  private static getLatestActivityDate(students: Student[]): Date {
    if (students.length === 0) return new Date();
    
    return students.reduce((latest, student) => {
      return student.lastActivity > latest ? student.lastActivity : latest;
    }, students[0].lastActivity);
  }
}

/**
 * Domain to Legacy Adapters
 */
export class DomainToLegacyAdapter {

  /**
   * Convert Domain Student to legacy StudentActivity
   */
  static studentToStudentActivity(student: Student): ExtendedStudentActivity {
    return {
      emailAddress: student.emailAddress,
      userName: student.userName,
      teamName: student.teamId,
      helpStatus: student.helpStatus as any, // ヘルプ状態をそのまま渡す
      currentNotebook: student.currentNotebook,
      lastActivity: this.formatActivityTime(student.lastActivity),
      status: this.mapDomainStatus(student.status, student.helpStatus),
      isRequestingHelp: student.isRequestingHelp(),
      cellExecutions: student.cellExecutions,
      errorCount: student.errorCount
    };
  }

  /**
   * Convert Domain Students to legacy StudentActivity array
   */
  static studentsToStudentActivities(students: Student[]): ExtendedStudentActivity[] {
    return students.map(student => this.studentToStudentActivity(student));
  }

  /**
   * Convert Domain DashboardMetrics to legacy DashboardMetrics
   */
  static metricsToLegacyMetrics(metrics: DashboardMetrics): LegacyDashboardMetrics {
    return {
      totalStudents: metrics.totalStudents,
      totalActive: metrics.totalActive,
      errorCount: metrics.errorCount,
      totalExecutions: metrics.totalExecutions,
      helpCount: metrics.helpCount,
      lastUpdated: metrics.lastUpdated
    };
  }

  /**
   * Convert Domain ActivityTimePoint to legacy ActivityTimePoint
   */
  static activityPointToLegacyPoint(point: ActivityTimePoint): LegacyActivityTimePoint {
    return {
      time: point.time.toISOString(),
      executionCount: point.executionCount,
      errorCount: point.errorCount,
      helpCount: point.helpCount
    };
  }

  /**
   * Convert Domain ActivityTimePoints to legacy array
   */
  static activityPointsToLegacyPoints(points: ActivityTimePoint[]): LegacyActivityTimePoint[] {
    return points.map(point => this.activityPointToLegacyPoint(point));
  }

  /**
   * Convert Domain entities to legacy DashboardOverview
   */
  static entitiesToDashboardOverview(
    students: Student[],
    metrics: DashboardMetrics,
    activityHistory: ActivityTimePoint[]
  ): any {
    return {
      students: this.studentsToStudentActivities(students),
      metrics: this.metricsToLegacyMetrics(metrics),
      activityChart: this.activityPointsToLegacyPoints(activityHistory),
      timestamp: new Date().toISOString()
    };
  }

  // Private helper methods
  private static mapDomainStatus(status: StudentStatus, helpStatus: StudentHelpStatus): 'active' | 'idle' | 'error' | 'help' {
    if (helpStatus === StudentHelpStatus.REQUESTING || helpStatus === StudentHelpStatus.RECEIVING) {
      return 'help';
    }
    
    switch (status) {
      case StudentStatus.ACTIVE:
        return 'active';
      case StudentStatus.IDLE:
        return 'idle';
      case StudentStatus.ERROR:
        return 'error';
      default:
        return 'idle';
    }
  }

  private static formatActivityTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 60 * 1000) {
      const seconds = Math.floor(diffMs / 1000);
      return `${seconds}秒前`;
    } else if (diffMs < 60 * 60 * 1000) {
      const minutes = Math.floor(diffMs / (60 * 1000));
      return `${minutes}分前`;
    } else if (diffMs < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diffMs / (60 * 60 * 1000));
      return `${hours}時間前`;
    } else {
      return date.toLocaleDateString('ja-JP');
    }
  }
}

/**
 * Bidirectional Adapter with validation
 */
export class LegacyDomainBridge {
  
  /**
   * Safe conversion with validation
   */
  static safeConvertToDomain(legacy: LegacyDashboardOverview): {
    success: boolean;
    data?: { students: Student[]; metrics: DashboardMetrics; activityHistory: ActivityTimePoint[]; teams: Team[]; };
    errors: string[];
  } {
    const errors: string[] = [];
    
    try {
      const result = LegacyToDomainAdapter.dashboardOverviewToEntities(legacy);
      
      // 基本的なバリデーション
      if (result.students.length !== legacy.students.length) {
        errors.push(`Student conversion mismatch: ${legacy.students.length} -> ${result.students.length}`);
      }
      
      if (result.activityHistory.length !== legacy.activityChart.length) {
        errors.push(`Activity chart conversion mismatch: ${legacy.activityChart.length} -> ${result.activityHistory.length}`);
      }
      
      return {
        success: errors.length === 0,
        data: result,
        errors
      };
    } catch (error) {
      errors.push(`Conversion failed: ${(error as Error).message}`);
      return {
        success: false,
        errors
      };
    }
  }

  /**
   * Safe conversion with validation
   */
  static safeConvertToLegacy(
    students: Student[],
    metrics: DashboardMetrics,
    activityHistory: ActivityTimePoint[]
  ): {
    success: boolean;
    data?: LegacyDashboardOverview;
    errors: string[];
  } {
    const errors: string[] = [];
    
    try {
      const result = DomainToLegacyAdapter.entitiesToDashboardOverview(students, metrics, activityHistory);
      
      // 基本的なバリデーション
      if (result.students.length !== students.length) {
        errors.push(`Student conversion mismatch: ${students.length} -> ${result.students.length}`);
      }
      
      return {
        success: errors.length === 0,
        data: result,
        errors
      };
    } catch (error) {
      errors.push(`Conversion failed: ${(error as Error).message}`);
      return {
        success: false,
        errors
      };
    }
  }
}