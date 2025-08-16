/**
 * Zod Runtime Validation Schemas
 * Phase 3: 完全なRuntime Validation実装
 */

import { z } from 'zod';
import { 
  StudentIDSchema, 
  TeamIDSchema, 
  InstructorIDSchema, 
  SessionIDSchema, 
  NotebookIDSchema 
} from './nominal';

// ✅ 基本型スキーマ
export const TimestampSchema = z.string().datetime().or(z.date());
export const URLSchema = z.string().url();
export const EmailSchema = z.string().email();
export const PositiveIntegerSchema = z.number().int().min(0);
export const PositiveNumberSchema = z.number().min(0);

// ✅ Student Activity状態型安全スキーマ
export const StudentStatusSchema = z.enum(['active', 'idle', 'help']);
export type StudentStatus = z.infer<typeof StudentStatusSchema>;

// ✅ 位置情報スキーマ
export const PositionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100)
});

// ✅ 実行統計スキーマ
export const ExecutionStatsSchema = z.object({
  cellExecutions: PositiveIntegerSchema,
  errorCount: PositiveIntegerSchema,
  lastActivity: TimestampSchema,
  averageExecutionTime: PositiveNumberSchema.optional(),
  successRate: z.number().min(0).max(1).optional()
});

// ✅ Student Entityスキーマ（完全型安全）
export const StudentActivitySchema = z.object({
  id: StudentIDSchema,
  emailAddress: StudentIDSchema, // メールアドレスをIDとして使用
  userName: z.string().min(1).max(100),
  status: StudentStatusSchema,
  cellExecutions: PositiveIntegerSchema,
  errorCount: PositiveIntegerSchema,
  isRequestingHelp: z.boolean(),
  lastActivity: TimestampSchema,
  currentNotebook: NotebookIDSchema.optional(),
  teamId: TeamIDSchema.optional(),
  teamName: z.string().max(50).optional(),
  position: PositionSchema.optional(),
  
  // 拡張統計
  executionHistory: z.array(z.object({
    timestamp: TimestampSchema,
    cellType: z.enum(['code', 'markdown']),
    executionTime: PositiveNumberSchema,
    success: z.boolean(),
    errorMessage: z.string().optional()
  })).optional(),
  
  // メタデータ
  joinedAt: TimestampSchema,
  lastSeen: TimestampSchema,
  sessionId: SessionIDSchema.optional()
});

export type StudentActivity = z.infer<typeof StudentActivitySchema>;

// ✅ Team Entityスキーマ
export const TeamSchema = z.object({
  id: TeamIDSchema,
  name: z.string().min(1).max(50),
  memberIds: z.array(StudentIDSchema),
  instructorId: InstructorIDSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  
  // チーム統計
  statistics: z.object({
    totalMembers: PositiveIntegerSchema,
    activeMembers: PositiveIntegerSchema,
    averageProgress: z.number().min(0).max(1),
    teamPerformanceScore: z.number().min(0).max(100)
  }).optional()
});

export type Team = z.infer<typeof TeamSchema>;

// ✅ Metrics Entityスキーマ
export const MetricsSchema = z.object({
  totalStudents: PositiveIntegerSchema,
  activeStudents: PositiveIntegerSchema,
  helpRequestCount: PositiveIntegerSchema,
  averageProgress: z.number().min(0).max(1),
  totalExecutions: PositiveIntegerSchema,
  totalErrors: PositiveIntegerSchema,
  systemLoad: z.number().min(0).max(1),
  
  // 時系列データ
  timestamp: TimestampSchema,
  
  // 分布統計
  executionDistribution: z.object({
    low: PositiveIntegerSchema,    // 0-10 executions
    medium: PositiveIntegerSchema, // 11-50 executions
    high: PositiveIntegerSchema    // 51+ executions
  }),
  
  errorRateDistribution: z.object({
    excellent: PositiveIntegerSchema, // 0-5% error rate
    good: PositiveIntegerSchema,      // 6-15% error rate
    needsHelp: PositiveIntegerSchema  // 16%+ error rate
  })
});

export type Metrics = z.infer<typeof MetricsSchema>;

// ✅ API Response Schemas
export const DashboardOverviewSchema = z.object({
  students: z.array(StudentActivitySchema),
  metrics: MetricsSchema,
  teams: z.array(TeamSchema),
  activityChart: z.array(z.object({
    timestamp: TimestampSchema,
    activeCount: PositiveIntegerSchema,
    executionCount: PositiveIntegerSchema,
    errorCount: PositiveIntegerSchema
  })),
  lastUpdated: TimestampSchema
});

export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

// ✅ WebSocket Message Schemas
export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('student_progress_update'),
    data: StudentActivitySchema
  }),
  z.object({
    type: z.literal('cell_execution'),
    data: z.object({
      studentId: StudentIDSchema,
      cellType: z.enum(['code', 'markdown']),
      executionTime: PositiveNumberSchema,
      timestamp: TimestampSchema
    })
  }),
  z.object({
    type: z.literal('help_request'),
    data: z.object({
      studentId: StudentIDSchema,
      message: z.string().optional(),
      timestamp: TimestampSchema
    })
  }),
  z.object({
    type: z.literal('help_resolved'),
    data: z.object({
      studentId: StudentIDSchema,
      resolvedBy: InstructorIDSchema,
      timestamp: TimestampSchema
    })
  })
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// ✅ Filter & Sort Schemas
export const StudentFilterSchema = z.object({
  searchQuery: z.string().optional(),
  statusFilter: StudentStatusSchema.or(z.literal('all')).optional(),
  teamFilter: TeamIDSchema.optional(),
  minExecutions: PositiveIntegerSchema.optional(),
  maxErrorRate: z.number().min(0).max(1).optional(),
  hasHelp: z.boolean().optional()
});

export type StudentFilter = z.infer<typeof StudentFilterSchema>;

export const SortConfigSchema = z.object({
  sortBy: z.enum(['name', 'executions', 'errors', 'errorRate', 'team', 'lastActivity']),
  sortOrder: z.enum(['asc', 'desc'])
});

export type SortConfig = z.infer<typeof SortConfigSchema>;

// ✅ Configuration Schemas
export const SystemConfigSchema = z.object({
  api: z.object({
    baseUrl: URLSchema,
    timeout: PositiveIntegerSchema.max(60000),
    retryAttempts: PositiveIntegerSchema.max(5)
  }),
  
  websocket: z.object({
    url: URLSchema,
    reconnectInterval: PositiveIntegerSchema.max(30000),
    maxReconnectAttempts: PositiveIntegerSchema.max(10)
  }),
  
  ui: z.object({
    refreshInterval: PositiveIntegerSchema.min(1000).max(60000),
    pageSize: PositiveIntegerSchema.min(10).max(1000),
    enableAnimations: z.boolean(),
    theme: z.enum(['light', 'dark', 'auto'])
  }),
  
  performance: z.object({
    enableWorkers: z.boolean(),
    workerPoolSize: PositiveIntegerSchema.min(1).max(8),
    virtualScrollThreshold: PositiveIntegerSchema.min(50).max(10000),
    memoizationTTL: PositiveIntegerSchema.min(1000).max(300000)
  })
});

export type SystemConfig = z.infer<typeof SystemConfigSchema>;

// ✅ 安全なパース関数
export const safeParseStudentActivity = (data: unknown): StudentActivity | null => {
  const result = StudentActivitySchema.safeParse(data);
  return result.success ? result.data : null;
};

export const safeParseDashboardOverview = (data: unknown): DashboardOverview | null => {
  const result = DashboardOverviewSchema.safeParse(data);
  return result.success ? result.data : null;
};

export const safeParseWebSocketMessage = (data: unknown): WebSocketMessage | null => {
  const result = WebSocketMessageSchema.safeParse(data);
  return result.success ? result.data : null;
};

// ✅ 型安全なBuilder Pattern実装
export class StudentActivityBuilder {
  private data: Partial<StudentActivity> = {};

  setId(id: string): this {
    this.data.id = StudentIDSchema.parse(id);
    this.data.emailAddress = this.data.id; // IDとメールアドレスは同じ
    return this;
  }

  setUserName(userName: string): this {
    this.data.userName = z.string().min(1).max(100).parse(userName);
    return this;
  }

  setStatus(status: StudentStatus): this {
    this.data.status = StudentStatusSchema.parse(status);
    return this;
  }

  setCellExecutions(count: number): this {
    this.data.cellExecutions = PositiveIntegerSchema.parse(count);
    return this;
  }

  setErrorCount(count: number): this {
    this.data.errorCount = PositiveIntegerSchema.parse(count);
    return this;
  }

  setIsRequestingHelp(requesting: boolean): this {
    this.data.isRequestingHelp = z.boolean().parse(requesting);
    return this;
  }

  setLastActivity(timestamp: string | Date): this {
    this.data.lastActivity = TimestampSchema.parse(timestamp);
    return this;
  }

  setTeamId(teamId: string): this {
    this.data.teamId = TeamIDSchema.parse(teamId);
    return this;
  }

  setJoinedAt(timestamp: string | Date): this {
    this.data.joinedAt = TimestampSchema.parse(timestamp);
    return this;
  }

  setLastSeen(timestamp: string | Date): this {
    this.data.lastSeen = TimestampSchema.parse(timestamp);
    return this;
  }

  build(): StudentActivity {
    // 必須フィールドの検証
    if (!this.data.id) throw new Error('StudentActivity ID is required');
    if (!this.data.userName) throw new Error('StudentActivity userName is required');
    if (!this.data.status) throw new Error('StudentActivity status is required');
    if (this.data.cellExecutions === undefined) throw new Error('StudentActivity cellExecutions is required');
    if (this.data.errorCount === undefined) throw new Error('StudentActivity errorCount is required');
    if (this.data.isRequestingHelp === undefined) throw new Error('StudentActivity isRequestingHelp is required');
    if (!this.data.lastActivity) throw new Error('StudentActivity lastActivity is required');
    if (!this.data.joinedAt) throw new Error('StudentActivity joinedAt is required');
    if (!this.data.lastSeen) throw new Error('StudentActivity lastSeen is required');

    return StudentActivitySchema.parse(this.data);
  }
}

// ✅ バリデーションエラー型
export class ValidationError extends Error {
  constructor(
    public readonly fieldErrors: z.ZodError,
    message = 'Validation failed'
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  getFieldErrors(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    this.fieldErrors.errors.forEach(error => {
      const path = error.path.join('.');
      if (!errors[path]) errors[path] = [];
      errors[path].push(error.message);
    });
    return errors;
  }
}