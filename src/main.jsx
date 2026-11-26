import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ChatProvider } from './chat/chat.jsx';
import './styles/styles.css';

createRoot(document.getElementById('root')).render(<ChatProvider>
    <App />
  </ChatProvider>);
