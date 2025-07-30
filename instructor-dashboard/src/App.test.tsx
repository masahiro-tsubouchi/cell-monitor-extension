import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Phase 2 統合テスト - App コンポーネント
describe('App', () => {
  const renderApp = () => {
    return render(<App />);
  };

  it('should render without crashing', () => {
    renderApp();
    expect(document.body).toBeInTheDocument();
  });

  it('should display login form when not authenticated', () => {
    renderApp();
    expect(screen.getByText('講師支援ダッシュボード')).toBeInTheDocument();
    expect(screen.getByText('講師アカウントでログインしてください')).toBeInTheDocument();
  });

  it('should have proper Material-UI theme', () => {
    renderApp();
    // Material-UIのテーマが適用されていることを確認
    const titleElement = screen.getByText('講師支援ダッシュボード');
    expect(titleElement).toHaveClass('MuiTypography-root');
    expect(titleElement).toHaveClass('MuiTypography-h4');
  });
});
