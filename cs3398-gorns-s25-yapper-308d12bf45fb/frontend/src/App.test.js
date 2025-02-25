import { render, screen } from '@testing-library/react';
import App from './App';

test('renders upload button', () => {
  render(<App />);
  const uploadButton = screen.getByText(/Upload/i);
  expect(uploadButton).toBeInTheDocument();
});
