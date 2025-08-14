import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ActivityTimePoint } from '../../services/dashboardAPI';

// Chart.js の必要なコンポーネントを登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ActivityChartProps {
  data: ActivityTimePoint[];
  timeRange?: '1h' | '24h' | '7d';
}

export const ActivityChart: React.FC<ActivityChartProps> = ({
  data,
  timeRange = '1h'
}) => {
  // データがない場合の処理
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📈 学習活動推移
          </Typography>
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 200,
            color: 'text.secondary'
          }}>
            <Typography>データがありません</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // 時間ラベルのフォーマット
  const formatTimeLabel = (timeString: string) => {
    const date = new Date(timeString);
    if (timeRange === '1h') {
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else if (timeRange === '24h') {
      return date.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  // Chart.jsのデータ設定
  const chartData = {
    labels: data.map(point => formatTimeLabel(point.time)),
    datasets: [
      {
        label: 'セル実行数',
        data: data.map(point => point.executionCount),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.3,
        fill: false,
      },
      {
        label: 'エラー数',
        data: data.map(point => point.errorCount),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.3,
        fill: false,
      },
      {
        label: 'ヘルプ要求数',
        data: data.map(point => point.helpCount),
        borderColor: 'rgb(255, 159, 64)',
        backgroundColor: 'rgba(255, 159, 64, 0.2)',
        tension: 0.3,
        fill: false,
      }
    ]
  };

  // Chart.jsのオプション設定
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (context: any) => {
            const index = context[0].dataIndex;
            const originalTime = data[index].time;
            return new Date(originalTime).toLocaleString('ja-JP');
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: '時刻'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: '回数'
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          stepSize: 1
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  // 時間範囲に応じたタイトル
  const getChartTitle = () => {
    switch (timeRange) {
      case '1h':
        return '📈 学習活動推移（直近1時間）';
      case '24h':
        return '📈 学習活動推移（直近24時間）';
      case '7d':
        return '📈 学習活動推移（直近7日間）';
      default:
        return '📈 学習活動推移';
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {getChartTitle()}
        </Typography>

        <Box sx={{
          height: 300,
          width: '100%',
          position: 'relative'
        }}>
          <Line data={chartData} options={chartOptions} />
        </Box>

        {/* 統計サマリー */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-around',
          mt: 2,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              {data.reduce((sum, point) => sum + point.executionCount, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              総実行数
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="error">
              {data.reduce((sum, point) => sum + point.errorCount, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              総エラー数
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="warning.main">
              {data.reduce((sum, point) => sum + point.helpCount, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              総ヘルプ要求数
            </Typography>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" color="success.main">
              {Math.round(data.reduce((sum, point) => sum + point.executionCount, 0) / data.length)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              平均実行数/時
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ActivityChart;
