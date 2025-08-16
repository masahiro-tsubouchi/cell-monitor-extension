/**
 * Lazy Component Loader
 * 遅延読み込みコンポーネントと Suspense ラッパー
 */

import React, { Suspense, ComponentType, LazyExoticComponent, memo } from 'react';
import { Box, CircularProgress, Typography, Skeleton } from '@mui/material';

interface LazyLoadProps {
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  loadingText?: string;
}

/**
 * 汎用遅延読み込みラッパー
 */
export const LazyComponentWrapper: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = memo(({ children, fallback }) => {
  const defaultFallback = (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: 200,
      gap: 2
    }}>
      <CircularProgress size={40} />
      <Typography color="text.secondary">
        コンポーネントを読み込み中...
      </Typography>
    </Box>
  );

  return (
    <Suspense fallback={fallback || defaultFallback}>
      {children}
    </Suspense>
  );
});

LazyComponentWrapper.displayName = 'LazyComponentWrapper';

/**
 * カスタムスケルトンローダー
 */
export const SkeletonLoader: React.FC<{
  type: 'card' | 'list' | 'grid' | 'chart';
  count?: number;
}> = memo(({ type, count = 1 }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rectangular" height={120} sx={{ mb: 1, borderRadius: 1 }} />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </Box>
        );
      
      case 'list':
        return (
          <Box sx={{ p: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="70%" />
                <Skeleton variant="text" width="50%" />
              </Box>
            </Box>
          </Box>
        );
      
      case 'grid':
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2, p: 2 }}>
            {Array.from({ length: count }).map((_, index) => (
              <Box key={index}>
                <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 1, mb: 1 }} />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="60%" />
              </Box>
            ))}
          </Box>
        );
      
      case 'chart':
        return (
          <Box sx={{ p: 2 }}>
            <Skeleton variant="text" width="40%" sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
          </Box>
        );
      
      default:
        return <Skeleton variant="rectangular" height={200} />;
    }
  };

  return (
    <Box>
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index}>
          {renderSkeleton()}
        </Box>
      ))}
    </Box>
  );
});

SkeletonLoader.displayName = 'SkeletonLoader';

/**
 * 高次コンポーネント: 遅延読み込み機能を追加
 * シンプルな実装に変更
 */
export function createLazyWrapper<T extends Record<string, any>>(
  LazyComponent: LazyExoticComponent<ComponentType<T>>,
  fallback?: React.ReactNode
) {
  return memo((props: T) => (
    <Suspense fallback={fallback || <CircularProgress />}>
      <LazyComponent {...(props as any)} />
    </Suspense>
  ));
}

/**
 * Intersection Observer を使用した可視性ベース遅延読み込み
 */
export const VisibilityBasedLoader: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
}> = memo(({ children, fallback, rootMargin = '50px', threshold = 0.1, once = true }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const [hasBeenVisible, setHasBeenVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        setIsVisible(visible);
        
        if (visible && !hasBeenVisible) {
          setHasBeenVisible(true);
        }
      },
      {
        rootMargin,
        threshold
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, hasBeenVisible]);

  const shouldRender = once ? hasBeenVisible : isVisible;

  return (
    <div ref={ref}>
      {shouldRender ? (
        <LazyComponentWrapper fallback={fallback}>
          {children}
        </LazyComponentWrapper>
      ) : (
        fallback || (
          <Box sx={{ 
            minHeight: 200, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Typography color="text.secondary">
              スクロールして読み込み...
            </Typography>
          </Box>
        )
      )}
    </div>
  );
});

VisibilityBasedLoader.displayName = 'VisibilityBasedLoader';

/**
 * 遅延読み込み可能なコンポーネント定義
 */
export const LazyStudentDetailModal = React.lazy(() => 
  import('../progress/StudentDetailModal').then(module => ({
    default: module.StudentDetailModal
  }))
);

export const LazyActivityChart = React.lazy(() => 
  import('../progress/ActivityChart').then(module => ({
    default: module.ActivityChart
  }))
);

export const LazyTeamMapView = React.lazy(() => 
  import('../progress/TeamMapView').then(module => ({
    default: module.TeamMapView
  }))
);

export const LazyVirtualizedStudentList = React.lazy(() => 
  import('../virtualized/VirtualizedStudentList').then(module => ({
    default: module.VirtualizedStudentList
  }))
);

// 事前にラップされたコンポーネント（シンプル版）
export const OptimizedStudentDetailModal = createLazyWrapper(
  LazyStudentDetailModal,
  <SkeletonLoader type="card" />
);

export const OptimizedActivityChart = createLazyWrapper(
  LazyActivityChart,
  <SkeletonLoader type="chart" />
);

export const OptimizedTeamMapView = createLazyWrapper(
  LazyTeamMapView,
  <SkeletonLoader type="grid" count={6} />
);

export const OptimizedVirtualizedStudentList = createLazyWrapper(
  LazyVirtualizedStudentList,
  <SkeletonLoader type="list" count={5} />
);

export default LazyComponentWrapper;