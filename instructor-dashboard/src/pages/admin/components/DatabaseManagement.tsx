/**
 * データベース管理コンポーネント
 * セキュアなDB操作機能を提供
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Storage as StorageIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

interface DatabaseTable {
  table_name: string;
  class_name: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primary_key: boolean;
  }>;
}

interface DatabaseRecord {
  [key: string]: any;
}

interface DatabaseStats {
  database_stats: {
    [tableName: string]: {
      total_records: number;
      table_name: string;
      model_class: string;
    };
  };
  generated_at: string;
}

interface DatabaseHealth {
  status: 'healthy' | 'unhealthy';
  connection: string;
  checked_at: string;
  error?: string;
}

export const DatabaseManagement: React.FC = () => {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<DatabaseRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchFilters, setSearchFilters] = useState<{[key: string]: any}>({});
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  
  // 削除確認ダイアログ
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [recordToDelete, setRecordToDelete] = useState<{id: number, data: DatabaseRecord} | null>(null);

  // API基底URL
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

  // 初期データ読み込み
  useEffect(() => {
    loadTables();
    loadStats();
    loadHealth();
  }, []);

  // テーブル情報読み込み
  const loadTables = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/database/tables`);
      const data = await response.json();
      setTables(data.tables);
    } catch (error) {
      console.error('テーブル情報読み込みエラー:', error);
    }
  };

  // データベース統計読み込み
  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/database/stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('統計情報読み込みエラー:', error);
    }
  };

  // データベースヘルス読み込み
  const loadHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/database/health`);
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('ヘルス情報読み込みエラー:', error);
    }
  };

  // テーブルデータ検索
  const searchTableData = async (tableName: string = selectedTable) => {
    if (!tableName) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/database/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          table_name: tableName,
          filters: searchFilters,
          limit: rowsPerPage,
          offset: page * rowsPerPage
        })
      });
      
      const data = await response.json();
      setTableData(data.data);
      setTotalRecords(data.total_count);
    } catch (error) {
      console.error('データ検索エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // テーブル選択変更
  const handleTableChange = (tableName: string) => {
    setSelectedTable(tableName);
    setPage(0);
    setSearchFilters({});
    searchTableData(tableName);
  };

  // ページ変更
  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // 行数変更
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // データ更新
  useEffect(() => {
    if (selectedTable) {
      searchTableData();
    }
  }, [page, rowsPerPage]);

  // 削除確認ダイアログを開く
  const handleDeleteClick = (record: DatabaseRecord) => {
    setRecordToDelete({
      id: record.id,
      data: record
    });
    setDeleteDialogOpen(true);
  };

  // レコード削除実行
  const handleDeleteConfirm = async () => {
    if (!recordToDelete || !selectedTable) return;
    
    try {
      const response = await fetch(
        `${API_BASE}/admin/database/${selectedTable}/${recordToDelete.id}`,
        { 
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('削除成功:', result);
        
        // データを再読み込み
        searchTableData();
        loadStats(); // 統計も更新
      } else {
        const error = await response.json();
        console.error('削除失敗:', error);
        alert(`削除失敗: ${error.detail || 'エラーが発生しました'}`);
      }
    } catch (error) {
      console.error('削除エラー:', error);
      alert('ネットワークエラーが発生しました');
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const selectedTableInfo = tables.find(t => t.table_name === selectedTable);

  return (
    <Box>
      {/* ヘッダー情報 */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <StorageIcon sx={{ mr: 1 }} />
          データベース管理
        </Typography>
        <Typography variant="body2" color="text.secondary">
          セキュアなデータベース操作・監視機能
        </Typography>
      </Box>

      {/* データベース健全性表示 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              {health?.status === 'healthy' ? (
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
              ) : (
                <ErrorIcon color="error" sx={{ mr: 1 }} />
              )}
              <Typography variant="h6">接続状況</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {health?.status === 'healthy' ? '正常' : '異常'}
            </Typography>
            <Typography variant="caption" display="block">
              確認時刻: {health?.checked_at ? new Date(health.checked_at).toLocaleString('ja-JP') : '未確認'}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <StorageIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">テーブル数</Typography>
            </Box>
            <Typography variant="h4" color="primary">
              {tables.length}
            </Typography>
            <Typography variant="caption" display="block">
              管理対象テーブル
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <SearchIcon color="info" sx={{ mr: 1 }} />
              <Typography variant="h6">総レコード数</Typography>
            </Box>
            <Typography variant="h4" color="info.main">
              {stats ? Object.values(stats.database_stats).reduce((sum, table) => sum + table.total_records, 0).toLocaleString() : '-'}
            </Typography>
            <Typography variant="caption" display="block">
              全テーブル合計
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* テーブル選択とデータ表示 */}
      <Paper sx={{ p: 3 }}>
        {/* コントロール */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>テーブル選択</InputLabel>
            <Select
              value={selectedTable}
              label="テーブル選択"
              onChange={(e) => handleTableChange(e.target.value)}
            >
              {tables.map((table) => (
                <MenuItem key={table.table_name} value={table.table_name}>
                  {table.table_name}
                  <Chip 
                    label={stats?.database_stats[table.table_name]?.total_records || 0}
                    size="small"
                    color="primary"
                    sx={{ ml: 1 }}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={() => searchTableData()}
            disabled={!selectedTable || loading}
          >
            検索
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              loadStats();
              loadHealth();
              if (selectedTable) searchTableData();
            }}
          >
            更新
          </Button>
        </Box>

        {/* テーブル情報表示 */}
        {selectedTableInfo && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>{selectedTableInfo.table_name}</strong> テーブル 
              ({selectedTableInfo.columns.length} 列, {stats?.database_stats[selectedTable]?.total_records || 0} レコード)
            </Typography>
          </Alert>
        )}

        {/* データテーブル */}
        {selectedTable && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {selectedTableInfo?.columns.map((column) => (
                    <TableCell key={column.name}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {column.name}
                        {column.primary_key && (
                          <Chip label="PK" size="small" color="primary" sx={{ ml: 1 }} />
                        )}
                      </Box>
                    </TableCell>
                  ))}
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={selectedTableInfo ? selectedTableInfo.columns.length + 1 : 1} align="center">
                      <CircularProgress size={24} />
                    </TableCell>
                  </TableRow>
                ) : (
                  tableData.map((record, index) => (
                    <TableRow key={record.id || index}>
                      {selectedTableInfo?.columns.map((column) => (
                        <TableCell key={column.name}>
                          {record[column.name] ? String(record[column.name]) : '-'}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Tooltip title="削除">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClick(record)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* ページネーション */}
            <TablePagination
              rowsPerPageOptions={[25, 50, 100]}
              component="div"
              count={totalRecords}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
              labelRowsPerPage="表示件数:"
              labelDisplayedRows={({ from, to, count }) => 
                `${from}-${to} / ${count !== -1 ? count : `${to}以上`}`
              }
            />
          </TableContainer>
        )}
      </Paper>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <WarningIcon color="warning" sx={{ mr: 1 }} />
          レコード削除の確認
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            この操作は元に戻せません。本当に削除しますか？
          </Alert>
          {recordToDelete && (
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>テーブル:</strong> {selectedTable}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>レコードID:</strong> {recordToDelete.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                削除対象データの一部: {JSON.stringify(recordToDelete.data, null, 2).substring(0, 200)}...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            削除実行
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DatabaseManagement;