/**
 * Team Domain Entity
 * チームの状態と統計を管理するエンティティ
 */

import { Student, StudentStatus, StudentHelpStatus, TeamID } from './Student';

export enum TeamPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface TeamProps {
  readonly id: TeamID;
  readonly name: string;
  readonly students: Student[];
  readonly priority: TeamPriority;
  readonly lastActivity: Date;
}

export interface TeamStats {
  totalStudents: number;
  activeCount: number;
  idleCount: number;
  errorCount: number;
  helpCount: number;
  totalExecutions: number;
  averageExecutions: number;
}

/**
 * Team Entity
 * 学生グループの集約ルート
 */
export class Team {
  private constructor(private readonly props: TeamProps) {
    this.validate();
  }

  static create(props: TeamProps): Team {
    return new Team(props);
  }

  // Getters
  get id(): TeamID {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get students(): readonly Student[] {
    return this.props.students;
  }

  get priority(): TeamPriority {
    return this.props.priority;
  }

  get lastActivity(): Date {
    return this.props.lastActivity;
  }

  // Business Logic Methods
  getStats(): TeamStats {
    const students = this.props.students;
    const totalStudents = students.length;
    
    if (totalStudents === 0) {
      return {
        totalStudents: 0,
        activeCount: 0,
        idleCount: 0,
        errorCount: 0,
        helpCount: 0,
        totalExecutions: 0,
        averageExecutions: 0
      };
    }

    const activeCount = students.filter(s => s.status === StudentStatus.ACTIVE).length;
    const idleCount = students.filter(s => s.status === StudentStatus.IDLE).length;
    const errorCount = students.filter(s => s.status === StudentStatus.ERROR).length;
    const helpCount = students.filter(s => s.isRequestingHelp()).length;
    
    const totalExecutions = students.reduce((sum, s) => sum + s.cellExecutions, 0);
    const averageExecutions = totalExecutions / totalStudents;

    return {
      totalStudents,
      activeCount,
      idleCount,
      errorCount,
      helpCount,
      totalExecutions,
      averageExecutions
    };
  }

  calculatePriority(): TeamPriority {
    const stats = this.getStats();
    
    // エラーまたはヘルプ要求がある場合は高優先度
    if (stats.errorCount > 0 || stats.helpCount > 0) {
      return TeamPriority.HIGH;
    }
    
    // アイドル状態の学生が多い場合は中優先度
    if (stats.idleCount > stats.activeCount) {
      return TeamPriority.MEDIUM;
    }
    
    return TeamPriority.LOW;
  }

  needsAttention(): boolean {
    return this.calculatePriority() === TeamPriority.HIGH;
  }

  hasActiveStudents(): boolean {
    return this.props.students.some(s => s.isActive());
  }

  getStudentById(studentId: string): Student | undefined {
    return this.props.students.find(s => s.id === studentId);
  }

  // Update Methods
  addStudent(student: Student): Team {
    if (this.props.students.some(s => s.equals(student))) {
      throw new Error('Student already exists in team');
    }

    const updatedStudents = [...this.props.students, student];
    return new Team({
      ...this.props,
      students: updatedStudents,
      priority: this.calculatePriorityForStudents(updatedStudents),
      lastActivity: new Date()
    });
  }

  removeStudent(studentId: string): Team {
    const updatedStudents = this.props.students.filter(s => s.id !== studentId);
    return new Team({
      ...this.props,
      students: updatedStudents,
      priority: this.calculatePriorityForStudents(updatedStudents),
      lastActivity: new Date()
    });
  }

  updateStudent(updatedStudent: Student): Team {
    const updatedStudents = this.props.students.map(s => 
      s.equals(updatedStudent) ? updatedStudent : s
    );

    return new Team({
      ...this.props,
      students: updatedStudents,
      priority: this.calculatePriorityForStudents(updatedStudents),
      lastActivity: new Date()
    });
  }

  updateAllStudents(students: Student[]): Team {
    return new Team({
      ...this.props,
      students,
      priority: this.calculatePriorityForStudents(students),
      lastActivity: new Date()
    });
  }

  private calculatePriorityForStudents(students: Student[]): TeamPriority {
    const errorCount = students.filter(s => s.hasErrors()).length;
    const helpCount = students.filter(s => s.isRequestingHelp()).length;
    const activeCount = students.filter(s => s.isActive()).length;
    const idleCount = students.filter(s => s.status === StudentStatus.IDLE).length;

    if (errorCount > 0 || helpCount > 0) {
      return TeamPriority.HIGH;
    }
    
    if (idleCount > activeCount) {
      return TeamPriority.MEDIUM;
    }
    
    return TeamPriority.LOW;
  }

  // Validation
  private validate(): void {
    if (!this.props.id) {
      throw new Error('Team ID is required');
    }
    if (!this.props.name) {
      throw new Error('Team name is required');
    }
  }

  // Equality
  equals(other: Team): boolean {
    return this.props.id === other.props.id;
  }

  // Serialization
  toJSON() {
    const stats = this.getStats();
    return {
      teamName: this.props.name,
      totalStudents: stats.totalStudents,
      activeCount: stats.activeCount,
      idleCount: stats.idleCount,
      errorCount: stats.errorCount,
      helpCount: stats.helpCount,
      priority: this.props.priority,
      lastActivity: this.props.lastActivity.toISOString(),
      students: this.props.students.map(s => s.toJSON())
    };
  }
}

/**
 * Team Builder
 */
export class TeamBuilder {
  private id?: TeamID;
  private name?: string;
  private students: Student[] = [];
  private priority: TeamPriority = TeamPriority.LOW;
  private lastActivity: Date = new Date();

  setId(id: TeamID): this {
    this.id = id;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setStudents(students: Student[]): this {
    this.students = students;
    return this;
  }

  setPriority(priority: TeamPriority): this {
    this.priority = priority;
    return this;
  }

  setLastActivity(date: Date): this {
    this.lastActivity = date;
    return this;
  }

  build(): Team {
    if (!this.id) {
      throw new Error('Team ID is required');
    }
    if (!this.name) {
      throw new Error('Team name is required');
    }

    return Team.create({
      id: this.id,
      name: this.name,
      students: this.students,
      priority: this.priority,
      lastActivity: this.lastActivity
    });
  }
}

// Type Guards
export const isValidTeamPriority = (priority: string): priority is TeamPriority => {
  return Object.values(TeamPriority).includes(priority as TeamPriority);
};

// Constants
export const DEFAULT_TEAM_NAME = '未割り当て';
export const createTeamName = (name: string): string => name || DEFAULT_TEAM_NAME;