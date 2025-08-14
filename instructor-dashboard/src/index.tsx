import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { logEnvironmentInfo } from './config/environment';

// 環境設定の初期化とログ出力
logEnvironmentInfo();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
