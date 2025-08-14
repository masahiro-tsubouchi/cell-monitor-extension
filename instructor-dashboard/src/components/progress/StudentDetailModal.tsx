import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Chip,
  Avatar,
  Paper,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Code as CodeIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayIcon
} from '@mui/icons-material';
import { StudentActivity, dashboardAPI } from '../../services/dashboardAPI';

interface StudentDetailModalProps {
  student: StudentActivity | null;
  open: boolean;
  onClose: () => void;
}

// 実行履歴データ
interface ExecutionHistory {
  cellId: number;
  executionTime: number | null;
  hasError: boolean;
  timestamp: string;
  status: string;
  output: string | null;
  errorMessage: string | null;
  codeContent: string | null;  // セルのコード内容
  cellIndex: number | null;  // セルの位置
  cellType: string | null;  // セルの種類
  executionCount: number | null;  // 実行カウント
}

interface StudentDetailData {
  student: {
    emailAddress: string;
    name: string | null;
    teamName: string | null;
  };
  recentExecutions: ExecutionHistory[];
  sessions: {
    id: number;
    sessionId: string;
    startedAt: string;
    endedAt: string | null;
    isActive: boolean;
  }[];
}

const getStatusColor = (status: StudentActivity['status']) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'idle':
      return 'warning';
    case 'error':
      return 'error';
    case 'help':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusText = (status: StudentActivity['status']) => {
  switch (status) {
    case 'active':
      return 'アクティブ';
    case 'idle':
      return '待機中';
    case 'error':
      return 'エラー';
    case 'help':
      return 'ヘルプ要求中';
    default:
      return '不明';
  }
};

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  open,
  onClose
}) => {
  const [studentDetail, setStudentDetail] = useState<StudentDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load student detail data when modal opens
  useEffect(() => {
    if (open && student) {
      loadStudentDetail();
    }
  }, [open, student?.emailAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStudentDetail = async () => {
    if (!student) return;

    setLoading(true);
    setError(null);
    try {
      const data = await dashboardAPI.getStudentActivity(student.emailAddress);
      setStudentDetail(data);
    } catch (err: any) {
      console.error('Failed to load student detail:', err);
      setError('学生詳細データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!student) return null;

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP');
  };

  const formatDuration = (ms: number | null) => {
    return ms ? `${ms}ms` : '不明';
  };

  const executionHistory = studentDetail?.recentExecutions || [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            sx={{
              bgcolor: getStatusColor(student.status) === 'success' ? 'success.main' :
                      getStatusColor(student.status) === 'warning' ? 'warning.main' : 'error.main'
            }}
          >
            <PersonIcon />
          </Avatar>
          <Box>
            <Typography variant="h6">
              {student.userName}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary">
              Email: {student.emailAddress}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Typography>読み込み中...</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 2, bgcolor: 'error.50', borderRadius: 2, mb: 2 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {!loading && !error && (
          <>
            {/* ステータス概要 */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Chip
                  label={getStatusText(student.status)}
                  color={getStatusColor(student.status) as any}
                  variant="filled"
                />
                <Chip
                  icon={<ScheduleIcon />}
                  label={`最終活動: ${student.lastActivity}`}
                  variant="outlined"
                />
              </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                現在のノートブック
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                📓 {student.currentNotebook.split('/').pop()?.replace('.ipynb', '')}
              </Typography>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                総実行回数
              </Typography>
              <Typography variant="h6" color="primary">
                <CodeIcon sx={{ fontSize: 20, mr: 1 }} />
                {student.cellExecutions}回
              </Typography>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                エラー発生回数
              </Typography>
              <Typography variant="h6" color="error">
                <ErrorIcon sx={{ fontSize: 20, mr: 1 }} />
                {student.errorCount}回
              </Typography>
            </Paper>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 実行履歴 */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          📋 最近の実行履歴
        </Typography>

        <Box sx={{ mb: 2 }}>
          {executionHistory.map((execution, index) => (
            <Accordion key={`${execution.cellId}-${index}`} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {!execution.hasError ? (
                      <PlayIcon sx={{ color: 'success.main', fontSize: 20 }} />
                    ) : (
                      <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                    )}
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      セル {execution.cellIndex !== null ? execution.cellIndex + 1 : '?'}
                      {execution.executionCount && ` [${execution.executionCount}]`}
                    </Typography>
                    {execution.cellType && (
                      <Chip
                        label={execution.cellType}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: '20px' }}
                      />
                    )}
                  </Box>

                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {formatTimestamp(execution.timestamp)}
                    </Typography>
                  </Box>

                  <Box>
                    <Chip
                      label={formatDuration(execution.executionTime)}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails>
                {/* コード内容の表示 */}
                {execution.codeContent && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      💻 実行されたコード:
                    </Typography>
                    <Paper sx={{
                      p: 2,
                      bgcolor: 'grey.100',
                      border: '1px solid',
                      borderColor: 'grey.300',
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.875rem',
                          lineHeight: 1.4
                        }}
                      >
                        {execution.codeContent}
                      </Typography>
                    </Paper>
                  </Box>
                )}

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    📊 実行詳細:
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      ステータス: {execution.status}
                    </Typography>
                    {execution.executionTime && (
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        実行時間: {(execution.executionTime * 1000).toFixed(0)}ms
                      </Typography>
                    )}
                    {execution.cellType && (
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        セルタイプ: {execution.cellType}
                      </Typography>
                    )}
                  </Paper>
                </Box>

                {!execution.hasError && execution.output ? (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      📤 出力結果:
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {execution.output}
                      </Typography>
                    </Paper>
                  </Box>
                ) : execution.hasError && execution.errorMessage ? (
                  <Box>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      ❌ エラー:
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.200' }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'error.main' }}>
                        {execution.errorMessage}
                      </Typography>
                    </Paper>
                  </Box>
                ) : null}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        {executionHistory.length === 0 && (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 100,
            color: 'text.secondary'
          }}>
            <Typography>実行履歴がありません</Typography>
          </Box>
        )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StudentDetailModal;
