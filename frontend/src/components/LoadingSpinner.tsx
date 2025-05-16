import React from 'react';
import { ProgressSpinner } from 'primereact/progressspinner';

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="loading-container" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="4" />
      <p style={{ marginTop: '1rem' }}>{message}</p>
    </div>
  );
};

export default LoadingSpinner;
