/**
 * Test Utilities for Type-Safe Testing
 * Phase 3: 包括的テスト基盤実装
 */

import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { 
  StudentActivity, 
  Team, 
  Metrics, 
  StudentActivityBuilder 
} from '../types/schemas';
import { 
  createStudentID, 
  createTeamID, 
  createInstructorID,
  StudentID,
  TeamID,
  InstructorID
} from '../types/nominal';

// ✅ テスト用Wrapper
interface TestWrapperProps {
  children: ReactNode;
}

function TestWrapper({ children }: TestWrapperProps) {
  return React.createElement(BrowserRouter, null, children);
}

// ✅ カスタムレンダー関数
export const renderWithRouter = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: TestWrapper, ...options });

// ✅ Mock Data Factories

export const createMockStudentActivity = (overrides: Partial<StudentActivity> = {}): StudentActivity => {
  const now = new Date().toISOString();
  const emailAddress = overrides.emailAddress || createStudentID('test@university.edu');
  const studentId = typeof emailAddress === 'string' ? createStudentID(emailAddress) : emailAddress;
  
  return new StudentActivityBuilder()
    .setId(studentId)
    .setUserName(overrides.userName || 'Test Student')
    .setStatus(overrides.status || 'active')
    .setCellExecutions(overrides.cellExecutions || 5)
    .setErrorCount(overrides.errorCount || 0)
    .setIsRequestingHelp(overrides.isRequestingHelp || false)
    .setLastActivity(overrides.lastActivity || now)
    .setJoinedAt(overrides.joinedAt || now)
    .setLastSeen(overrides.lastSeen || now)
    .build();
};

export const createMockStudentList = (count: number = 10): StudentActivity[] => {
  return Array.from({ length: count }, (_, index) => {
    const studentNumber = index + 1;
    return createMockStudentActivity({
      emailAddress: createStudentID(`student${studentNumber}@university.edu`),
      userName: `Student ${studentNumber}`,
      cellExecutions: Math.floor(Math.random() * 50),
      errorCount: Math.floor(Math.random() * 5),
      status: ['active', 'idle', 'help'][Math.floor(Math.random() * 3)] as any,
      isRequestingHelp: Math.random() > 0.8,
      teamId: createTeamID(`Team ${String.fromCharCode(65 + (index % 5))}`)
    });
  });
};

export const createMockTeam = (overrides: Partial<Team> = {}): Team => {
  const now = new Date().toISOString();
  const teamId = createTeamID(overrides.name || 'Test Team');
  
  return {
    id: teamId,
    name: overrides.name || 'Test Team',
    memberIds: overrides.memberIds || [
      createStudentID('member1@university.edu'),
      createStudentID('member2@university.edu')
    ],
    instructorId: overrides.instructorId || createInstructorID('instructor@university.edu'),
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    statistics: overrides.statistics || {
      totalMembers: 2,
      activeMembers: 1,
      averageProgress: 0.65,
      teamPerformanceScore: 75
    }
  };
};

export const createMockMetrics = (overrides: Partial<Metrics> = {}): Metrics => {
  const now = new Date().toISOString();
  
  return {
    totalStudents: overrides.totalStudents || 50,
    activeStudents: overrides.activeStudents || 35,
    helpRequestCount: overrides.helpRequestCount || 3,
    averageProgress: overrides.averageProgress || 0.72,
    totalExecutions: overrides.totalExecutions || 1250,
    totalErrors: overrides.totalErrors || 85,
    systemLoad: overrides.systemLoad || 0.45,
    timestamp: overrides.timestamp || now,
    executionDistribution: overrides.executionDistribution || {
      low: 15,
      medium: 25,
      high: 10
    },
    errorRateDistribution: overrides.errorRateDistribution || {
      excellent: 30,
      good: 15,
      needsHelp: 5
    }
  };
};

// ✅ データ生成ヘルパー
export const generateLargeDataset = (size: number): StudentActivity[] => {
  return Array.from({ length: size }, (_, index) => 
    createMockStudentActivity({
      emailAddress: createStudentID(`student${index}@university.edu`),
      userName: `Student ${index}`,
      cellExecutions: Math.floor(Math.random() * 100),
      errorCount: Math.floor(Math.random() * 10),
      teamId: createTeamID(`Team ${String.fromCharCode(65 + (index % 10))}`)
    })
  );
};