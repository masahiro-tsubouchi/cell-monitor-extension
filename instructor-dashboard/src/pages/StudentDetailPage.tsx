import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Person as PersonIcon,
  Code as CodeIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useProgressDashboardStore } from '../stores/progressDashboardStore';
import { dashboardAPI, StudentActivity } from '../services/dashboardAPI';

interface StudentDetailData {
  student: {
    emailAddress: string;
    name: string;
    teamName: string;
  };
  recentExecutions: Array<{
    cellId: string;
    executionTime: number;
    hasError: boolean;
    timestamp: string;
    status: string;
    output: string;
    errorMessage: string;
  }>;
  sessions: Array<{
    id: number;
    sessionId: string;
    startedAt: string;
    endedAt: string | null;
    isActive: boolean;
  }>;
}

export const StudentDetailPage: React.FC = () => {
  const { emailAddress } = useParams<{ emailAddress: string }>();
  const navigate = useNavigate();
  const { students, refreshData } = useProgressDashboardStore();

  const [studentDetail, setStudentDetail] = useState<StudentDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const student = students.find(s => s.emailAddress === emailAddress);

  useEffect(() => {
    if (emailAddress) {
      loadStudentDetail();
    }
  }, [emailAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStudentDetail = async () => {
    if (!emailAddress) return;

    setIsLoading(true);
    setError(null);

    try {
      const detail = await dashboardAPI.getStudentActivity(emailAddress);
      setStudentDetail(detail);
    } catch (err: any) {
      setError('受講生詳細情報の取得に失敗しました: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };


  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleDismissHelp = async () => {
    if (!emailAddress) return;

    try {
      await dashboardAPI.dismissHelpRequest(emailAddress);
      console.log(`Help request dismissed for student: ${emailAddress}`);
      // データを再読み込み
      setTimeout(() => {
        refreshData();
        loadStudentDetail();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to dismiss help request:', error);
      alert('対応完了の記録に失敗しました: ' + error.message);
    }
  };

  const getStatusColor = (status: StudentActivity['status']) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'idle': return '#ff9800';
      case 'error': return '#f44336';
      case 'help': return '#ff5722';
      default: return '#9e9e9e';
    }
  };

  const getStatusText = (status: StudentActivity['status']) => {
    switch (status) {
      case 'active': return 'アクティブ';
      case 'idle': return '待機中';
      case 'error': return 'エラー';
      case 'help': return 'ヘルプ要求';
      default: return '不明';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400
        }}>
          <CircularProgress size={40} />
          <Typography sx={{ ml: 2 }}>
            受講生詳細情報を読み込み中...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (error || !studentDetail || !student) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || '受講生情報が見つかりません'}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBackToDashboard}
        >
          ダッシュボードに戻る
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 4 }}>
        {/* パンくずリスト */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={handleBackToDashboard}
            sx={{ textDecoration: 'none' }}
          >
            📚 学習進捗ダッシュボード
          </Link>
          <Typography color="text.primary">👤 {student.userName}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
              👤 {student.userName} の詳細情報
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Email: {student.emailAddress}
            </Typography>
            {student.teamName && (
              <Typography variant="body1" color="primary.main">
                📋 チーム: {student.teamName}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {student.status === 'help' && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckIcon />}
                onClick={handleDismissHelp}
              >
                対応完了
              </Button>
            )}
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={handleBackToDashboard}
            >
              ダッシュボードに戻る
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 3
      }}>
        {/* 受講生基本情報 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              📋 基本情報
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Box>
                  <Typography variant="body1" fontWeight="bold">
                    {studentDetail.student.name || student.userName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {studentDetail.student.emailAddress || 'メールアドレス未設定'}
                  </Typography>
                  {studentDetail.student.teamName && (
                    <Typography variant="body2" color="primary.main">
                      📋 {studentDetail.student.teamName}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  現在のステータス
                </Typography>
                <Chip
                  label={getStatusText(student.status)}
                  sx={{
                    bgcolor: getStatusColor(student.status),
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  現在のノートブック
                </Typography>
                <Typography variant="body1">
                  📓 {student.currentNotebook.split('/').pop()?.replace('.ipynb', '') || 'なし'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  最終活動
                </Typography>
                <Typography variant="body1">
                  <ScheduleIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  {student.lastActivity}
                </Typography>
              </Box>
            </CardContent>
          </Card>

        {/* 実行統計 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              📊 実行統計
            </Typography>

            <Box sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2
            }}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
                <CodeIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="primary.main">
                  {student.cellExecutions}
                </Typography>
                <Typography variant="body2">
                  セル実行数
                </Typography>
              </Box>

              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.light', borderRadius: 2 }}>
                <ErrorIcon sx={{ fontSize: 32, color: 'error.main', mb: 1 }} />
                <Typography variant="h4" fontWeight="bold" color="error.main">
                  {student.errorCount}
                </Typography>
                <Typography variant="body2">
                  エラー数
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* 最近の実行履歴 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              ⚡ 最近の実行履歴
            </Typography>

            {studentDetail.recentExecutions.length === 0 ? (
              <Typography color="text.secondary">
                実行履歴がありません
              </Typography>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {studentDetail.recentExecutions.slice(0, 10).map((execution, index) => (
                  <React.Fragment key={index}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                              セル {execution.cellId}
                            </Typography>
                            {execution.hasError && (
                              <Chip
                                label="エラー"
                                size="small"
                                color="error"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {formatDateTime(execution.timestamp)} • {execution.executionTime}ms
                            </Typography>
                            {execution.hasError && execution.errorMessage && (
                              <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                                {execution.errorMessage.substring(0, 100)}...
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < studentDetail.recentExecutions.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* セッション履歴 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              🔗 セッション履歴
            </Typography>

            {studentDetail.sessions.length === 0 ? (
              <Typography color="text.secondary">
                セッション履歴がありません
              </Typography>
            ) : (
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {studentDetail.sessions.slice(0, 5).map((session, index) => (
                  <React.Fragment key={session.id}>
                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                              セッション {session.sessionId}
                            </Typography>
                            {session.isActive && (
                              <Chip
                                label="アクティブ"
                                size="small"
                                color="success"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              開始: {formatDateTime(session.startedAt)}
                            </Typography>
                            {session.endedAt && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                終了: {formatDateTime(session.endedAt)}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < studentDetail.sessions.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default StudentDetailPage;
