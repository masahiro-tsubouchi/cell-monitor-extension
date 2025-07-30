// LoginFormContainer - Phase 2ストア統合版
import React from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import { useAuthStore } from '../../stores/authStore';
import { LoginForm } from './LoginForm';
import { LoginCredentials } from '../../types';
import { LoginRequest } from '../../types/api';

export const LoginFormContainer: React.FC = () => {
  const { login, isLoading, error } = useAuthStore();

  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      // usernameをemailとしてマッピング
      const loginRequest: LoginRequest = {
        email: credentials.username,
        password: credentials.password
      };
      await login(loginRequest);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: 400,
            borderRadius: 2,
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              講師支援ダッシュボード
            </Typography>
            <Typography variant="body2" color="text.secondary">
              講師アカウントでログインしてください
            </Typography>
          </Box>

          <LoginForm
            onLogin={handleLogin}
            isLoading={isLoading}
            error={error || undefined}
          />
        </Paper>
      </Box>
    </Container>
  );
};
