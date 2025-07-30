// DashboardContainerSimple - 最小限の動作実装
import React, { useEffect, useState } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, CircularProgress } from '@mui/material';
import { ExitToApp as LogoutIcon } from '@mui/icons-material';
import { useAuthStore } from '../stores/authStore';
import Dashboard from './Dashboard';
import { Instructor, Seat, HelpRequest, Student, InstructorStatus } from '../types';

export const DashboardContainerSimple: React.FC = () => {
  const { instructor, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  // 最小限のモックデータ
  const [dashboardData, setDashboardData] = useState({
    seats: [] as Seat[],
    helpRequests: [] as HelpRequest[],
    students: [] as Student[]
  });

  // 初期化
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setIsLoading(true);

        // モックデータを生成
        const mockStudents: Student[] = [
          {
            id: '1',
            name: '田中太郎',
            email: 'tanaka@example.com',
            seatNumber: 'A-01',
            isActive: true
          },
          {
            id: '2',
            name: '佐藤花子',
            email: 'sato@example.com',
            seatNumber: 'A-02',
            isActive: true
          }
        ];

        const mockSeats: Seat[] = Array.from({ length: 20 }, (_, i) => {
          const row = String.fromCharCode(65 + Math.floor(i / 10)); // A, B, C...
          const number = String(i % 10 + 1).padStart(2, '0');
          const seatNumber = `${row}-${number}`;

          return {
            id: seatNumber,
            seatNumber,
            position: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 },
            status: i < 2 ? 'occupied' : 'empty',
            student: i < 2 ? mockStudents[i] : undefined
          };
        });

        const mockHelpRequests: HelpRequest[] = [
          {
            id: '1',
            seatNumber: 'A-01',
            studentId: '1',
            studentName: '田中太郎',
            message: 'プログラムが動きません',
            timestamp: new Date().toISOString(),
            urgency: 'medium',
            status: 'pending'
          }
        ];

        setDashboardData({
          seats: mockSeats,
          helpRequests: mockHelpRequests,
          students: mockStudents
        });

      } catch (error) {
        console.error('Dashboard initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeDashboard();
  }, []);

  // ログアウト処理
  const handleLogout = async () => {
    await logout();
  };

  // 座席クリック処理
  const handleSeatClick = (seat: Seat) => {
    console.log('Seat clicked:', seat);
  };

  // ヘルプ要請クリック処理
  const handleHelpRequestClick = (helpRequest: HelpRequest) => {
    console.log('Help request clicked:', helpRequest);
  };

  // データ更新処理
  const handleRefresh = () => {
    console.log('Refreshing data...');
  };

  // ステータス変更処理
  const handleStatusChange = (status: InstructorStatus) => {
    console.log('Status changed:', status);
  };

  // インストラクター情報がない場合の処理
  if (!instructor) {
    return (
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>講師情報を読み込み中...</Typography>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>ダッシュボードを読み込み中...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* アプリケーションバー */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            講師支援ダッシュボード
          </Typography>

          <Typography variant="body2" sx={{ mr: 2 }}>
            {instructor.name} 先生
          </Typography>

          <Typography
            variant="body2"
            sx={{
              mr: 2,
              color: 'lightgreen',
              fontWeight: 'bold'
            }}
          >
            接続中
          </Typography>

          <Button
            color="inherit"
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
          >
            ログアウト
          </Button>
        </Toolbar>
      </AppBar>

      {/* ダッシュボードメインコンテンツ */}
      <Dashboard
        instructor={{
          id: String(instructor.id),
          name: instructor.name,
          status: 'AVAILABLE' as InstructorStatus
        }}
        seats={dashboardData.seats}
        helpRequests={dashboardData.helpRequests}
        onSeatClick={handleSeatClick}
        onHelpRequestClick={handleHelpRequestClick}
        onStatusChange={handleStatusChange}
        onLogout={handleLogout}
      />
    </Box>
  );
};
