/**
 * Metrics Domain Entity
 * ダッシュボードの統計・メトリクス情報を管理
 */

export interface ActivityTimePoint {
  readonly time: Date;
  readonly executionCount: number;
  readonly errorCount: number;
  readonly helpCount: number;
}

export interface DashboardMetricsProps {
  readonly totalStudents: number;
  readonly totalActive: number;
  readonly totalIdle: number;
  readonly errorCount: number;
  readonly totalExecutions: number;
  readonly helpCount: number;
  readonly lastUpdated: Date;
  readonly activityChart: ActivityTimePoint[];
}

/**
 * DashboardMetrics Entity
 * ダッシュボード全体の統計情報を管理
 */
export class DashboardMetrics {
  private constructor(private readonly props: DashboardMetricsProps) {
    this.validate();
  }

  static create(props: DashboardMetricsProps): DashboardMetrics {
    return new DashboardMetrics(props);
  }

  // Getters
  get totalStudents(): number {
    return this.props.totalStudents;
  }

  get totalActive(): number {
    return this.props.totalActive;
  }

  get totalIdle(): number {
    return this.props.totalIdle;
  }

  get errorCount(): number {
    return this.props.errorCount;
  }

  get totalExecutions(): number {
    return this.props.totalExecutions;
  }

  get helpCount(): number {
    return this.props.helpCount;
  }

  get lastUpdated(): Date {
    return this.props.lastUpdated;
  }

  get activityChart(): readonly ActivityTimePoint[] {
    return this.props.activityChart;
  }

  // Business Logic Methods
  getActivePercentage(): number {
    if (this.props.totalStudents === 0) return 0;
    return (this.props.totalActive / this.props.totalStudents) * 100;
  }

  getErrorPercentage(): number {
    if (this.props.totalStudents === 0) return 0;
    return (this.props.errorCount / this.props.totalStudents) * 100;
  }

  getHelpPercentage(): number {
    if (this.props.totalStudents === 0) return 0;
    return (this.props.helpCount / this.props.totalStudents) * 100;
  }

  getAverageExecutions(): number {
    if (this.props.totalStudents === 0) return 0;
    return this.props.totalExecutions / this.props.totalStudents;
  }

  hasRecentActivity(withinMinutes: number = 5): boolean {
    const now = new Date();
    const timeDiff = now.getTime() - this.props.lastUpdated.getTime();
    return timeDiff <= withinMinutes * 60 * 1000;
  }

  isHealthy(): boolean {
    const errorPercentage = this.getErrorPercentage();
    const activePercentage = this.getActivePercentage();
    
    // エラー率が10%未満かつアクティブ率が50%以上であれば健全
    return errorPercentage < 10 && activePercentage >= 50;
  }

  needsAttention(): boolean {
    return this.props.errorCount > 0 || this.props.helpCount > 0;
  }

  getRecentActivityTrend(hours: number = 1): 'increasing' | 'decreasing' | 'stable' {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentPoints = this.props.activityChart.filter(point => point.time >= cutoff);
    
    if (recentPoints.length < 2) return 'stable';
    
    const firstPoint = recentPoints[0];
    const lastPoint = recentPoints[recentPoints.length - 1];
    
    const firstTotal = firstPoint.executionCount + firstPoint.errorCount + firstPoint.helpCount;
    const lastTotal = lastPoint.executionCount + lastPoint.errorCount + lastPoint.helpCount;
    
    if (lastTotal > firstTotal * 1.1) return 'increasing';
    if (lastTotal < firstTotal * 0.9) return 'decreasing';
    return 'stable';
  }

  // Update Methods
  updateCounts(
    totalStudents: number,
    totalActive: number,
    errorCount: number,
    totalExecutions: number,
    helpCount: number
  ): DashboardMetrics {
    return new DashboardMetrics({
      ...this.props,
      totalStudents,
      totalActive,
      totalIdle: totalStudents - totalActive,
      errorCount,
      totalExecutions,
      helpCount,
      lastUpdated: new Date()
    });
  }

  addActivityPoint(point: ActivityTimePoint): DashboardMetrics {
    const updatedChart = [...this.props.activityChart, point];
    
    // 最新24時間のデータのみ保持
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filteredChart = updatedChart.filter(p => p.time >= cutoff);
    
    return new DashboardMetrics({
      ...this.props,
      activityChart: filteredChart,
      lastUpdated: new Date()
    });
  }

  // Validation
  private validate(): void {
    if (this.props.totalStudents < 0) {
      throw new Error('Total students cannot be negative');
    }
    if (this.props.totalActive < 0) {
      throw new Error('Total active cannot be negative');
    }
    if (this.props.totalActive > this.props.totalStudents) {
      throw new Error('Active students cannot exceed total students');
    }
    if (this.props.errorCount < 0) {
      throw new Error('Error count cannot be negative');
    }
    if (this.props.totalExecutions < 0) {
      throw new Error('Total executions cannot be negative');
    }
    if (this.props.helpCount < 0) {
      throw new Error('Help count cannot be negative');
    }
  }

  // Serialization
  toJSON() {
    return {
      totalStudents: this.props.totalStudents,
      totalActive: this.props.totalActive,
      errorCount: this.props.errorCount,
      totalExecutions: this.props.totalExecutions,
      helpCount: this.props.helpCount,
      lastUpdated: this.props.lastUpdated.toISOString(),
      activityChart: this.props.activityChart.map(point => ({
        time: point.time.toISOString(),
        executionCount: point.executionCount,
        errorCount: point.errorCount,
        helpCount: point.helpCount
      })),
      // 計算プロパティも含める
      activePercentage: this.getActivePercentage(),
      errorPercentage: this.getErrorPercentage(),
      helpPercentage: this.getHelpPercentage(),
      averageExecutions: this.getAverageExecutions(),
      isHealthy: this.isHealthy(),
      needsAttention: this.needsAttention(),
      trend: this.getRecentActivityTrend()
    };
  }
}

/**
 * DashboardMetrics Builder
 */
export class DashboardMetricsBuilder {
  private totalStudents: number = 0;
  private totalActive: number = 0;
  private totalIdle: number = 0;
  private errorCount: number = 0;
  private totalExecutions: number = 0;
  private helpCount: number = 0;
  private lastUpdated: Date = new Date();
  private activityChart: ActivityTimePoint[] = [];

  setTotalStudents(count: number): this {
    this.totalStudents = count;
    return this;
  }

  setTotalActive(count: number): this {
    this.totalActive = count;
    return this;
  }

  setTotalIdle(count: number): this {
    this.totalIdle = count;
    return this;
  }

  setErrorCount(count: number): this {
    this.errorCount = count;
    return this;
  }

  setTotalExecutions(count: number): this {
    this.totalExecutions = count;
    return this;
  }

  setHelpCount(count: number): this {
    this.helpCount = count;
    return this;
  }

  setLastUpdated(date: Date): this {
    this.lastUpdated = date;
    return this;
  }

  setActivityChart(chart: ActivityTimePoint[]): this {
    this.activityChart = chart;
    return this;
  }

  build(): DashboardMetrics {
    return DashboardMetrics.create({
      totalStudents: this.totalStudents,
      totalActive: this.totalActive,
      totalIdle: this.totalIdle,
      errorCount: this.errorCount,
      totalExecutions: this.totalExecutions,
      helpCount: this.helpCount,
      lastUpdated: this.lastUpdated,
      activityChart: this.activityChart
    });
  }
}

/**
 * ActivityTimePoint Factory
 */
export const createActivityTimePoint = (
  time: Date,
  executionCount: number,
  errorCount: number,
  helpCount: number
): ActivityTimePoint => {
  if (executionCount < 0 || errorCount < 0 || helpCount < 0) {
    throw new Error('Counts cannot be negative');
  }
  
  return {
    time,
    executionCount,
    errorCount,
    helpCount
  };
};

/**
 * Empty Metrics Factory
 */
export const createEmptyMetrics = (): DashboardMetrics => {
  return new DashboardMetricsBuilder().build();
};