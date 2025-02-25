import { render, screen } from '@testing-library/react';
import App from './App';

test('renders placeholder heading', () => {
  render(<App />);
  const h2 = screen.getByText(/Placeholder/i);
  expect(h2).toBeInTheDocument();
});
