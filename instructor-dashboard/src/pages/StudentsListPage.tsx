import React, { useEffect, useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  Chip,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  FilterList as FilterIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useProgressDashboardStore } from '../stores/progressDashboardStore';
import { StudentActivity, dashboardAPI } from '../services/dashboardAPI';

export const StudentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    students,
    isLoading,
    error,
    lastUpdated,
    refreshData,
    clearError
  } = useProgressDashboardStore();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filteredStudents, setFilteredStudents] = useState<StudentActivity[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // データ読み込み
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // フィルタリング処理
  useEffect(() => {
    let filtered = [...students];

    // Help要求中の学生は常に先頭表示
    const helpStudents = filtered.filter(s => s.status === 'help');
    const otherStudents = filtered.filter(s => s.status !== 'help');

    // ステータスフィルター適用
    const filteredOthers = statusFilter === 'all'
      ? otherStudents
      : otherStudents.filter(s => s.status === statusFilter);

    // Help学生を先頭に配置
    setFilteredStudents([...helpStudents, ...filteredOthers]);
  }, [students, statusFilter]);

  const handleStatusFilterChange = (event: SelectChangeEvent<string>) => {
    setStatusFilter(event.target.value);
    setPage(0); // Reset to first page when filter changes
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard');
  };

  const handleStudentDetail = (emailAddress: string) => {
    navigate(`/dashboard/student/${encodeURIComponent(emailAddress)}`);
  };

  const handleDismissHelp = async (emailAddress: string) => {
    try {
      await dashboardAPI.dismissHelpRequest(emailAddress);
      console.log(`Help request dismissed for student: ${emailAddress}`);
      // データを再読み込み
      setTimeout(() => {
        refreshData();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to dismiss help request:', error);
      alert('対応完了の記録に失敗しました: ' + error.message);
    }
  };

  const getStatusChip = (status: StudentActivity['status']) => {
    const statusConfig = {
      'help': { label: 'ヘルプ要求', color: '#ff5722', icon: '🆘' },
      'active': { label: 'アクティブ', color: '#4caf50', icon: '⚡' },
      'error': { label: 'エラー', color: '#f44336', icon: '❌' },
      'idle': { label: '待機中', color: '#ff9800', icon: '⏸️' }
    };

    const config = statusConfig[status] || { label: '不明', color: '#9e9e9e', icon: '?' };

    return (
      <Chip
        label={`${config.icon} ${config.label}`}
        size="small"
        sx={{
          bgcolor: config.color,
          color: 'white',
          fontWeight: 'bold'
        }}
      />
    );
  };

  // Get paginated data
  const paginatedStudents = filteredStudents.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (isLoading) {
    return (
      <Container maxWidth={false} sx={{ py: 3 }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400
        }}>
          <CircularProgress size={40} />
          <Typography sx={{ ml: 2 }}>
            受講生データを読み込み中...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3 }}>
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
          <Typography color="text.primary">👥 受講生詳細一覧</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
              👥 受講生詳細一覧
            </Typography>
            <Typography variant="body1" color="text.secondary">
              全{students.length}名の学習状況 (Help要求: {students.filter(s => s.status === 'help').length}名)
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToDashboard}
          >
            ダッシュボードに戻る
          </Button>
        </Box>

        {/* フィルター */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <FilterIcon color="action" />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              displayEmpty
            >
              <MenuItem value="all">全員表示</MenuItem>
              <MenuItem value="help">🆘 ヘルプ要求</MenuItem>
              <MenuItem value="active">⚡ アクティブ</MenuItem>
              <MenuItem value="error">❌ エラー発生</MenuItem>
              <MenuItem value="idle">⏸️ 待機中</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            表示中: {filteredStudents.length}名
            {lastUpdated && ` | 最終更新: ${new Date(lastUpdated).toLocaleTimeString()}`}
          </Typography>
        </Box>
      </Box>

      {/* エラー表示 */}
      {error && (
        <Alert
          severity="error"
          onClose={clearError}
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {/* データテーブル */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ステータス</TableCell>
              <TableCell>受講生情報</TableCell>
              <TableCell>ノートブック</TableCell>
              <TableCell>最終活動</TableCell>
              <TableCell align="center">実行数</TableCell>
              <TableCell align="center">エラー数</TableCell>
              <TableCell align="center">アクション</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedStudents.map((student) => (
              <TableRow
                key={student.emailAddress}
                sx={{
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.04)',
                  }
                }}
              >
                <TableCell>{getStatusChip(student.status)}</TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      {student.userName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Email: {student.emailAddress}
                    </Typography>
                    {student.teamName && (
                      <Typography variant="caption" color="primary.main">
                        📋 {student.teamName}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  📓 {student.currentNotebook.split('/').pop()?.replace('.ipynb', '') || 'なし'}
                </TableCell>
                <TableCell>{student.lastActivity}</TableCell>
                <TableCell align="center">{student.cellExecutions}</TableCell>
                <TableCell
                  align="center"
                  sx={{ color: student.errorCount > 0 ? 'error.main' : 'inherit' }}
                >
                  {student.errorCount}
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    {student.status === 'help' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckIcon />}
                        onClick={() => handleDismissHelp(student.emailAddress)}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        対応完了
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleStudentDetail(student.emailAddress)}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      詳細
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={filteredStudents.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="表示件数:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} / ${count !== -1 ? count : `${to}以上`}`
          }
        />
      </TableContainer>
    </Container>
  );
};

export default StudentsListPage;
