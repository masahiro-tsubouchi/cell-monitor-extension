import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LoginForm } from './LoginForm';

// TDD開発ルール: テストファースト
// 目的: LoginFormコンポーネントの完全な単体テストを作成する

describe('LoginForm', () => {
  const mockOnLogin = jest.fn();

  beforeEach(() => {
    mockOnLogin.mockClear();
  });

  // 1. 基本レンダリング
  it('should render without crashing', () => {
    render(<LoginForm onLogin={mockOnLogin} />);

    expect(screen.getByRole('textbox', { name: /ユーザー名/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ログイン/i })).toBeInTheDocument();
  });

  // 2. Props反映
  it('should display loading state when isLoading is true', () => {
    render(<LoginForm onLogin={mockOnLogin} isLoading={true} />);

    const loginButton = screen.getByRole('button', { name: /ログイン/i });
    expect(loginButton).toBeDisabled();
    expect(screen.getByText(/ログイン中/i)).toBeInTheDocument();
  });

  it('should display error message when error prop is provided', () => {
    const errorMessage = 'ログインに失敗しました';
    render(<LoginForm onLogin={mockOnLogin} error={errorMessage} />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // 3. ユーザー操作
  it('should handle user input correctly', () => {
    render(<LoginForm onLogin={mockOnLogin} />);

    const usernameInput = screen.getByRole('textbox', { name: /ユーザー名/i });
    const passwordInput = screen.getByLabelText(/パスワード/i);

    fireEvent.change(usernameInput, { target: { value: 'instructor1' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(usernameInput).toHaveValue('instructor1');
    expect(passwordInput).toHaveValue('password123');
  });

  it('should call onLogin with correct credentials when form is submitted', async () => {
    render(<LoginForm onLogin={mockOnLogin} />);

    const usernameInput = screen.getByRole('textbox', { name: /ユーザー名/i });
    const passwordInput = screen.getByLabelText(/パスワード/i);
    const loginButton = screen.getByRole('button', { name: /ログイン/i });

    fireEvent.change(usernameInput, { target: { value: 'instructor1' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledTimes(1);
      expect(mockOnLogin).toHaveBeenCalledWith({
        username: 'instructor1',
        password: 'password123'
      });
    });
  });

  // 4. エラー処理・バリデーション
  it('should not submit form with empty fields', () => {
    render(<LoginForm onLogin={mockOnLogin} />);

    const loginButton = screen.getByRole('button', { name: /ログイン/i });
    fireEvent.click(loginButton);

    expect(mockOnLogin).not.toHaveBeenCalled();
    expect(screen.getByText(/ユーザー名を入力してください/i)).toBeInTheDocument();
    expect(screen.getByText(/パスワードを入力してください/i)).toBeInTheDocument();
  });

  // 5. アクセシビリティ
  it('should have proper ARIA attributes', () => {
    render(<LoginForm onLogin={mockOnLogin} />);

    const usernameInput = screen.getByRole('textbox', { name: /ユーザー名/i });
    const passwordInput = screen.getByLabelText(/パスワード/i);
    const loginButton = screen.getByRole('button', { name: /ログイン/i });

    expect(usernameInput).toHaveAttribute('aria-required', 'true');
    expect(passwordInput).toHaveAttribute('aria-required', 'true');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(loginButton).toHaveAttribute('type', 'submit');
  });
});
