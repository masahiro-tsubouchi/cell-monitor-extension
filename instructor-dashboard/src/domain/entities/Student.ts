/**
 * Student Domain Entity
 * Domain層の中核となる学生エンティティ
 * ビジネスロジックとバリデーションを含む
 */

// Nominal Types for型安全性
type Brand<T, B> = T & { __brand: B };
export type StudentID = Brand<string, 'StudentID'>;
export type EmailAddress = Brand<string, 'EmailAddress'>;
export type TeamID = Brand<string, 'TeamID'>;

export enum StudentStatus {
  ACTIVE = 'active',
  IDLE = 'idle',
  ERROR = 'error'
}

export enum StudentHelpStatus {
  NONE = 'none',
  REQUESTING = 'requesting',
  RECEIVING = 'receiving'
}

export interface StudentProps {
  readonly id: StudentID;
  readonly emailAddress: EmailAddress;
  readonly userName: string;
  readonly teamId: TeamID;
  readonly status: StudentStatus;
  readonly helpStatus: StudentHelpStatus;
  readonly currentNotebook: string;
  readonly lastActivity: Date;
  readonly cellExecutions: number;
  readonly errorCount: number;
}

/**
 * Student Entity
 * SOLID原則のSingle Responsibilityに基づき、学生の状態管理のみを担当
 */
export class Student {
  private constructor(private readonly props: StudentProps) {
    this.validate();
  }

  static create(props: StudentProps): Student {
    return new Student(props);
  }

  // Getters
  get id(): StudentID {
    return this.props.id;
  }

  get emailAddress(): EmailAddress {
    return this.props.emailAddress;
  }

  get userName(): string {
    return this.props.userName;
  }

  get teamId(): TeamID {
    return this.props.teamId;
  }

  get status(): StudentStatus {
    return this.props.status;
  }

  get helpStatus(): StudentHelpStatus {
    return this.props.helpStatus;
  }

  get currentNotebook(): string {
    return this.props.currentNotebook;
  }

  get lastActivity(): Date {
    return this.props.lastActivity;
  }

  get cellExecutions(): number {
    return this.props.cellExecutions;
  }

  get errorCount(): number {
    return this.props.errorCount;
  }

  // Business Logic Methods
  isActive(): boolean {
    return this.props.status === StudentStatus.ACTIVE;
  }

  isRequestingHelp(): boolean {
    return this.props.helpStatus === StudentHelpStatus.REQUESTING ||
           this.props.helpStatus === StudentHelpStatus.RECEIVING;
  }

  hasErrors(): boolean {
    return this.props.errorCount > 0;
  }

  isRecentlyActive(withinMinutes: number = 5): boolean {
    const now = new Date();
    const timeDiff = now.getTime() - this.props.lastActivity.getTime();
    return timeDiff <= withinMinutes * 60 * 1000;
  }

  // Update Methods (返り値は新しいインスタンス)
  updateStatus(status: StudentStatus): Student {
    return new Student({
      ...this.props,
      status,
      lastActivity: new Date()
    });
  }

  updateHelpStatus(helpStatus: StudentHelpStatus): Student {
    return new Student({
      ...this.props,
      helpStatus,
      lastActivity: new Date()
    });
  }

  incrementExecutions(): Student {
    return new Student({
      ...this.props,
      cellExecutions: this.props.cellExecutions + 1,
      status: StudentStatus.ACTIVE,
      lastActivity: new Date()
    });
  }

  incrementErrors(): Student {
    return new Student({
      ...this.props,
      errorCount: this.props.errorCount + 1,
      status: StudentStatus.ERROR,
      lastActivity: new Date()
    });
  }

  updateNotebook(notebook: string): Student {
    return new Student({
      ...this.props,
      currentNotebook: notebook,
      lastActivity: new Date()
    });
  }

  // Validation
  private validate(): void {
    if (!this.props.id) {
      throw new Error('Student ID is required');
    }
    if (!this.props.emailAddress) {
      throw new Error('Email address is required');
    }
    if (!this.props.userName) {
      throw new Error('User name is required');
    }
    if (this.props.cellExecutions < 0) {
      throw new Error('Cell executions cannot be negative');
    }
    if (this.props.errorCount < 0) {
      throw new Error('Error count cannot be negative');
    }
  }

  // Equality
  equals(other: Student): boolean {
    return this.props.id === other.props.id;
  }

  // Serialization (for API compatibility)
  toJSON() {
    return {
      emailAddress: this.props.emailAddress,
      userName: this.props.userName,
      teamName: this.props.teamId,
      status: this.props.status,
      helpStatus: this.props.helpStatus,
      currentNotebook: this.props.currentNotebook,
      lastActivity: this.props.lastActivity.toISOString(),
      cellExecutions: this.props.cellExecutions,
      errorCount: this.props.errorCount,
      isRequestingHelp: this.isRequestingHelp()
    };
  }
}

/**
 * Student Builder for 型安全な構築
 */
export class StudentBuilder {
  private id?: StudentID;
  private emailAddress?: EmailAddress;
  private userName?: string;
  private teamId?: TeamID;
  private status: StudentStatus = StudentStatus.IDLE;
  private helpStatus: StudentHelpStatus = StudentHelpStatus.NONE;
  private currentNotebook: string = '';
  private lastActivity: Date = new Date();
  private cellExecutions: number = 0;
  private errorCount: number = 0;

  setId(id: StudentID): this {
    this.id = id;
    return this;
  }

  setEmailAddress(email: EmailAddress): this {
    this.emailAddress = email;
    return this;
  }

  setUserName(userName: string): this {
    this.userName = userName;
    return this;
  }

  setTeamId(teamId: TeamID): this {
    this.teamId = teamId;
    return this;
  }

  setStatus(status: StudentStatus): this {
    this.status = status;
    return this;
  }

  setHelpStatus(helpStatus: StudentHelpStatus): this {
    this.helpStatus = helpStatus;
    return this;
  }

  setCurrentNotebook(notebook: string): this {
    this.currentNotebook = notebook;
    return this;
  }

  setLastActivity(date: Date): this {
    this.lastActivity = date;
    return this;
  }

  setCellExecutions(count: number): this {
    this.cellExecutions = count;
    return this;
  }

  setErrorCount(count: number): this {
    this.errorCount = count;
    return this;
  }

  build(): Student {
    if (!this.id) {
      throw new Error('Student ID is required');
    }
    if (!this.emailAddress) {
      throw new Error('Email address is required');
    }
    if (!this.userName) {
      throw new Error('User name is required');
    }
    if (!this.teamId) {
      throw new Error('Team ID is required');
    }

    return Student.create({
      id: this.id,
      emailAddress: this.emailAddress,
      userName: this.userName,
      teamId: this.teamId,
      status: this.status,
      helpStatus: this.helpStatus,
      currentNotebook: this.currentNotebook,
      lastActivity: this.lastActivity,
      cellExecutions: this.cellExecutions,
      errorCount: this.errorCount
    });
  }
}

// Type Guards
export const isValidStudentStatus = (status: string): status is StudentStatus => {
  return Object.values(StudentStatus).includes(status as StudentStatus);
};

export const isValidHelpStatus = (status: string): status is StudentHelpStatus => {
  return Object.values(StudentHelpStatus).includes(status as StudentHelpStatus);
};

// Factory Functions
export const createStudentID = (id: string): StudentID => id as StudentID;
export const createEmailAddress = (email: string): EmailAddress => {
  if (!email.includes('@')) {
    throw new Error('Invalid email address');
  }
  return email as EmailAddress;
};
export const createTeamID = (teamId: string): TeamID => teamId as TeamID;