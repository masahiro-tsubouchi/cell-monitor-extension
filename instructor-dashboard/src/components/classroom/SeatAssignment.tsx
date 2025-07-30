import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Paper,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  AutoMode as AutoModeIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material';
import { Seat, SeatStatus } from '../../types/api';

// TDD開発ルール: SeatAssignment（座席割り当て管理）Green フェーズ
// 目的: テストを通すための最小限の実装を作成する

interface Student {
  id: string;
  name: string;
  email: string;
}

interface BulkAssignmentData {
  seatNumber: string;
  studentId: string;
  studentName: string;
}

export interface SeatAssignmentProps {
  seats: Seat[];
  students: Student[];
  isLoading?: boolean;
  error?: string;
  onSeatAssign: (seatId: string, studentId: string) => void;
  onSeatUnassign: (seatId: string) => void;
  onBulkAssign: (assignments: BulkAssignmentData[]) => void;
  onAutoAssign: () => void;
  onExportAssignment: () => void;
  onImportAssignment: (file: File) => void;
}

export const SeatAssignment: React.FC<SeatAssignmentProps> = ({
  seats,
  students,
  isLoading = false,
  error,
  onSeatAssign,
  onSeatUnassign,
  onBulkAssign,
  onAutoAssign,
  onExportAssignment,
  onImportAssignment,
}) => {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [studentDialog, setStudentDialog] = useState(false);
  const [autoAssignDialog, setAutoAssignDialog] = useState(false);
  const [bulkAssignDialog, setBulkAssignDialog] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // 座席統計の計算
  const seatStats = useMemo(() => {
    const total = seats.length;
    const assigned = seats.filter(seat => seat.studentId).length;
    const available = total - assigned;
    const assignmentRate = total > 0 ? ((assigned / total) * 100).toFixed(1) : '0.0';

    return {
      total,
      assigned,
      available,
      assignmentRate,
    };
  }, [seats]);

  // 未割り当て学生の計算
  const unassignedStudents = useMemo(() => {
    const assignedStudentIds = new Set(seats.map(seat => seat.studentId).filter(Boolean));
    return students.filter(student => !assignedStudentIds.has(student.id));
  }, [seats, students]);

  // 学生検索フィルタリング
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return unassignedStudents;

    return unassignedStudents.filter(student =>
      student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(studentSearchQuery.toLowerCase())
    );
  }, [unassignedStudents, studentSearchQuery]);

  // 座席クリックハンドラ
  const handleSeatClick = useCallback((seat: Seat) => {
    if (seat.studentId) {
      // 割り当て済み座席の場合、割り当て解除
      onSeatUnassign(seat.id);
    } else {
      // 空席の場合、学生選択ダイアログを開く
      setSelectedSeat(seat);
      setStudentDialog(true);
    }
  }, [onSeatUnassign]);

  // 学生割り当てハンドラ
  const handleStudentAssign = useCallback((studentId: string) => {
    if (selectedSeat) {
      onSeatAssign(selectedSeat.id, studentId);
      setStudentDialog(false);
      setSelectedSeat(null);
      setStudentSearchQuery('');
    }
  }, [selectedSeat, onSeatAssign]);

  // 自動割り当てハンドラ
  const handleAutoAssign = useCallback(() => {
    onAutoAssign();
    setAutoAssignDialog(false);
  }, [onAutoAssign]);

  // CSVファイルアップロードハンドラ
  const handleCsvUpload = useCallback(() => {
    if (!csvFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const lines = csvContent.split('\n').filter(line => line.trim());

      // CSVデータを解析（ヘッダー行なしと仮定）
      const assignments: BulkAssignmentData[] = lines.map(line => {
        const [seatNumber, studentId, studentName] = line.split(',').map(item => item.trim());
        return { seatNumber, studentId, studentName };
      }).filter(assignment => assignment.seatNumber && assignment.studentId);

      if (assignments.length > 0) {
        onBulkAssign(assignments);
      }
      setBulkAssignDialog(false);
      setCsvFile(null);
    };

    reader.readAsText(csvFile);
  }, [csvFile, onBulkAssign]);

  // ドラッグ&ドロップハンドラ
  const handleDragStart = useCallback((e: React.DragEvent, studentId: string) => {
    e.dataTransfer.setData('text/plain', studentId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, seatId: string) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData('text/plain');
    if (studentId) {
      onSeatAssign(seatId, studentId);
    }
  }, [onSeatAssign]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // キーボードナビゲーション
  const handleSeatKeyDown = useCallback((e: React.KeyboardEvent, seat: Seat) => {
    if (e.key === 'Enter') {
      handleSeatClick(seat);
    }
  }, [handleSeatClick]);

  const handleDialogKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setStudentDialog(false);
      setSelectedSeat(null);
      setStudentSearchQuery('');
    }
  }, []);

  // グローバルキーボードイベントリスナー
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (studentDialog) {
          setStudentDialog(false);
          setSelectedSeat(null);
          setStudentSearchQuery('');
        }
        if (autoAssignDialog) {
          setAutoAssignDialog(false);
        }
        if (bulkAssignDialog) {
          setBulkAssignDialog(false);
          setCsvFile(null);
        }
      }
    };

    if (studentDialog || autoAssignDialog || bulkAssignDialog) {
      document.addEventListener('keydown', handleGlobalKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [studentDialog, autoAssignDialog, bulkAssignDialog]);

  // 座席ステータスに応じたCSSクラス
  const getSeatClassName = useCallback((seat: Seat) => {
    switch (seat.status) {
      case SeatStatus.AVAILABLE:
        return 'available';
      case SeatStatus.OCCUPIED:
        return 'occupied';
      case SeatStatus.HELP_REQUESTED:
        return 'help-requested';
      default:
        return 'available';
    }
  }, []);

  // ローディング状態
  if (isLoading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" p={4}>
        <CircularProgress role="progressbar" />
        <Typography variant="body2" color="text.secondary" mt={2}>
          座席割り当てを処理中...
        </Typography>
      </Box>
    );
  }

  // エラー状態
  if (error) {
    return (
      <Alert severity="error" role="alert">
        {error}
      </Alert>
    );
  }

  return (
    <Box role="region" aria-label="座席割り当て" onKeyDown={handleDialogKeyDown}>
      {/* ヘッダー */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          座席割り当て
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<AutoModeIcon />}
            onClick={() => setAutoAssignDialog(true)}
          >
            自動割り当て
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setBulkAssignDialog(true)}
          >
            一括割り当て
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={onExportAssignment}
          >
            エクスポート
          </Button>
        </Box>
      </Box>

      {/* 割り当て統計 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            割り当て統計
          </Typography>
          <Box display="flex" gap={4}>
            <Typography variant="body1">
              総座席数: {seatStats.total}
            </Typography>
            <Typography variant="body1">
              割り当て済み: {seatStats.assigned}
            </Typography>
            <Typography variant="body1">
              空席: {seatStats.available}
            </Typography>
            <Typography variant="body1">
              割り当て率: {seatStats.assignmentRate}%
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Box display="flex" gap={3}>
        {/* 座席一覧 */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              座席一覧
            </Typography>
            <List role="list" aria-label="座席一覧">
              {seats.map((seat) => (
                <ListItem key={seat.id} disablePadding>
                  <ListItemButton
                    data-testid={`seat-assignment-${seat.id}`}
                    className={getSeatClassName(seat)}
                    onClick={() => handleSeatClick(seat)}
                    onKeyDown={(e) => handleSeatKeyDown(e, seat)}
                    onDrop={(e) => handleDrop(e, seat.id)}
                    onDragOver={handleDragOver}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      '&.available': {
                        backgroundColor: 'success.50',
                        borderColor: 'success.main',
                      },
                      '&.occupied': {
                        backgroundColor: 'info.50',
                        borderColor: 'info.main',
                      },
                      '&.help-requested': {
                        backgroundColor: 'warning.50',
                        borderColor: 'warning.main',
                      },
                    }}
                  >
                    <ListItemText
                      primary={seat.seatNumber}
                      secondary={seat.studentName || '未割り当て'}
                    />
                    {seat.studentId ? (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeatUnassign(seat.id);
                        }}
                        aria-label="割り当て解除"
                      >
                        <PersonRemoveIcon />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        aria-label="学生を割り当て"
                      >
                        <PersonAddIcon />
                      </IconButton>
                    )}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* 未割り当て学生一覧 */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              未割り当て学生
            </Typography>
            <List role="list" aria-label="未割り当て学生">
              {unassignedStudents.map((student) => (
                <ListItem key={student.id} disablePadding>
                  <ListItemButton
                    data-testid={`unassigned-student-${student.id}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, student.id)}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      cursor: 'grab',
                      '&:active': {
                        cursor: 'grabbing',
                      },
                    }}
                  >
                    <DragIndicatorIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <ListItemText
                      primary={student.name}
                      secondary={student.email}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* 学生選択ダイアログ */}
      <Dialog
        open={studentDialog}
        onClose={() => {
          setStudentDialog(false);
          setSelectedSeat(null);
          setStudentSearchQuery('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          学生を選択
          {selectedSeat && (
            <Typography variant="body2" color="text.secondary">
              座席: {selectedSeat.seatNumber}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="学生を検索..."
            value={studentSearchQuery}
            onChange={(e) => setStudentSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            inputProps={{
              'aria-label': '学生検索',
            }}
            sx={{ mb: 2 }}
          />
          <List>
            {filteredStudents.map((student) => (
              <ListItem key={student.id} disablePadding>
                <ListItemButton onClick={() => handleStudentAssign(student.id)}>
                  <ListItemText
                    primary={student.name}
                    secondary={student.email}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStudentDialog(false)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            disabled={filteredStudents.length === 0}
            onClick={() => {
              if (filteredStudents.length > 0) {
                handleStudentAssign(filteredStudents[0].id);
              }
            }}
          >
            割り当て
          </Button>
        </DialogActions>
      </Dialog>

      {/* 自動割り当て確認ダイアログ */}
      <Dialog open={autoAssignDialog} onClose={() => setAutoAssignDialog(false)}>
        <DialogTitle>自動割り当てを実行しますか？</DialogTitle>
        <DialogContent>
          <Typography>
            未割り当ての学生を空席に自動で割り当てます。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoAssignDialog(false)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleAutoAssign}
          >
            実行
          </Button>
        </DialogActions>
      </Dialog>

      {/* 一括割り当てダイアログ */}
      <Dialog open={bulkAssignDialog} onClose={() => setBulkAssignDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>一括割り当て</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            CSVファイルをアップロード
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            座席番号,学生ID,学生名の形式でアップロードしてください
          </Typography>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
            id="csv-file-input"
            aria-label="CSVファイル選択"
          />
          <label htmlFor="csv-file-input">
            <Button variant="outlined" component="span" fullWidth sx={{ mt: 2 }}>
              CSVファイル選択
            </Button>
          </label>
          {csvFile && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              選択されたファイル: {csvFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setBulkAssignDialog(false);
            setCsvFile(null);
          }}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleCsvUpload}
            disabled={!csvFile}
          >
            アップロード
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
